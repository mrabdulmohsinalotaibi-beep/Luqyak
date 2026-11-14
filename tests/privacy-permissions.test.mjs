import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const origin='https://luqyak.athat.app';
const actor='00000000-0000-4000-8000-000000000010';
const host='00000000-0000-4000-8000-000000000011';
const meetup='00000000-0000-4000-8000-000000000012';
const headers={cookie:'__Host-luqyak_session='+('a'.repeat(64))};
const ctx={waitUntil(){}};

test('private inbox only returns messages from current, unblocked accepted friends',async()=>{
  const sqls=[];
  const env={DB:{prepare(sql){sqls.push(sql);return {bind(){return {
    async first(){if(sql.includes('FROM auth_sessions'))return {id:actor,username:'receiver'};throw Error('Unexpected read: '+sql)},
    async run(){if(sql.includes('DELETE FROM encrypted_delivery_queue WHERE expires_at'))return {meta:{changes:0}};throw Error('Unexpected write: '+sql)},
    async all(){if(sql.includes('FROM encrypted_delivery_queue q'))return {results:[]};throw Error('Unexpected list: '+sql)}
  }}}}}};
  const res=await worker.fetch(new Request(origin+'/api/private/inbox',{method:'POST',headers:{...headers,origin,'content-type':'application/json'},body:'{}'}),env,ctx);
  assert.equal(res.status,200);
  assert.deepEqual((await res.json()).messages,[]);
  const inboxSql=sqls.find(q=>q.includes('FROM encrypted_delivery_queue q'));
  assert.match(inboxSql,/f.status='accepted'/);
  assert.match(inboxSql,/NOT EXISTS\(SELECT 1 FROM lk_user_blocks/);
  assert.match(inboxSql,/q.recipient_id=\?/);
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
