import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const origin='https://luqyak.athat.app';
const actor='00000000-0000-4000-8000-000000000010';
const host='00000000-0000-4000-8000-000000000011';
const meetup='00000000-0000-4000-8000-000000000012';
const headers={cookie:'__Host-luqyak_session='+('a'.repeat(64))};
const ctx={waitUntil(){}};

test('removed private inbox rejects requests before any database operation',async()=>{
 const env={DB:{prepare(){throw Error('Removed inbox must not access private data')}}};
 const res=await worker.fetch(new Request(origin+'/api/private/inbox',{method:'POST',headers:{...headers,origin,'content-type':'application/json'},body:'{}'}),env,ctx);
 assert.equal(res.status,410);
 assert.equal((await res.json()).error,'feature_removed');
 assert.match(res.headers.get('cache-control')||'',/no-store/);
});

test('private friendship list excludes blocked and disabled users',async()=>{
  const sqls=[];
  const env={DB:{prepare(sql){sqls.push(sql);return {bind(){return {
    async first(){if(sql.includes('FROM auth_sessions'))return {id:actor,username:'viewer'};throw Error('Unexpected read: '+sql)},
    async all(){return {results:[]}},
    async run(){throw Error('Unexpected mutation')}
  }}}}}};
  const res=await worker.fetch(new Request(origin+'/api/private/friends',{headers}),env,ctx);
  assert.equal(res.status,200);
  assert.deepEqual((await res.json()).items,[]);
  const q=sqls.find(sql=>sql.includes('FROM luqyak_friend_requests f JOIN users u'));
  assert.match(q,/u.account_status='active'/);
  assert.match(q,/NOT EXISTS\(SELECT 1 FROM lk_user_blocks/);
});

test('previously declined invite cannot be revived by recipient without a new invitation',async()=>{
  const queries=[];
  const env={DB:{prepare(sql){queries.push(sql);return {bind(){return {
    async first(){
      if(sql.includes('FROM auth_sessions'))return {id:actor,username:'viewer'};
      if(sql.includes('SELECT * FROM lk_meetups'))return {id:meetup,owner_id:host,privacy:'specific'};
      if(sql.includes('FROM lk_user_blocks'))return null;
      if(sql.includes('SELECT status FROM lk_meetup_members'))return {status:'declined'};
      if(sql.includes('FROM lk_guest_members g JOIN lk_guest_links l'))return null;
      throw Error('Unexpected read: '+sql);
    },
    async run(){throw Error('Declined member should not trigger writes')},
    async all(){throw Error('Unexpected list')}
  }}}}}};
  const res=await worker.fetch(new Request(origin+'/api/social/rsvp?id='+meetup,{
    method:'POST',headers:{...headers,origin,'content-type':'application/json'},
    body:JSON.stringify({status:'accepted'})
  }),env,ctx);
  assert.equal(res.status,404);
  assert.ok(queries.every(q=>!q.includes('UPDATE lk_meetup_members')));
});

test('accepted invite may be declined, but a declined status is excluded from reacceptance',async()=>{
  const queries=[];
  const env={DB:{prepare(sql){queries.push(sql);return {bind(){return {
    async first(){
      if(sql.includes('FROM auth_sessions'))return {id:actor,username:'viewer'};
      if(sql.includes('SELECT * FROM lk_meetups'))return {id:meetup,owner_id:host,privacy:'specific'};
      if(sql.includes('FROM lk_user_blocks'))return null;
      if(sql.includes('SELECT status FROM lk_meetup_members'))return {status:'accepted'};
      throw Error('Unexpected read: '+sql);
    },
    async run(){
      if(sql.includes('UPDATE lk_meetup_members'))return {meta:{changes:1}};
      throw Error('Unexpected write: '+sql);
    }
  }}}}}};
  const res=await worker.fetch(new Request(origin+'/api/social/rsvp?id='+meetup,{
    method:'POST',headers:{...headers,origin,'content-type':'application/json'},
    body:JSON.stringify({status:'declined'})
  }),env,ctx);
  assert.equal(res.status,200);
  assert.equal((await res.json()).ok,true);
  const query=queries.find(q=>q.includes('UPDATE lk_meetup_members'));
  assert.match(query,/status IN \('pending','accepted'\)/);
  assert.doesNotMatch(query,/,'declined'\)/);
});
