import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../worker.js';

const origin='https://luqyak.athat.app';
const cookie='__Host-luqyak_session='+('a'.repeat(64));
const actor='00000000-0000-4000-8000-000000000010';

function fakeEnv({active=true}={}){
 const statements=[];
 return {
  statements,
  env:{DB:{prepare(sql){
   statements.push(sql);
   return {bind(...args){return {
    async first(){
     if(sql.includes('FROM auth_sessions'))return active?{id:actor,username:'tester'}:null;
     if(sql.includes('FROM users u JOIN encrypted_public_keys'))return null;
     throw new Error('Unexpected SQL '+sql);
    },
    async all(){throw new Error('Unexpected query')},
    async run(){throw new Error('No writes expected')}
   }}};
  }}}
 };
}

test('private relay denies inactive account even with otherwise valid session',async()=>{
 const db=fakeEnv({active:false});
 const res=await worker.fetch(new Request(origin+'/api/private/status',{headers:{cookie}}),db.env,{waitUntil(){}});
 assert.equal(res.status,401);
 assert.equal((await res.json()).error,'login_required');
 assert.ok(db.statements.some(s=>s.includes("u.account_status='active'")));
});

test('private relay rejects missing or foreign origin for authenticated POST requests',async()=>{
 for(const headers of [{},{origin:'https://attacker.example'}]){
  const db=fakeEnv();
  const res=await worker.fetch(new Request(origin+'/api/private/friends/request',{
   method:'POST',headers:{cookie,'content-type':'application/json',...headers},
   body:JSON.stringify({username:'other_user'})
  }),db.env,{waitUntil(){}});
  assert.equal(res.status,403);
  assert.equal((await res.json()).error,'cross_site_request_rejected');
  assert.equal(db.statements.length,1,'only session lookup may run');
 }
});

test('private public-key username lookup is restricted to accepted and active friends',async()=>{
 const db=fakeEnv();
 const res=await worker.fetch(new Request(origin+'/api/private/lookup?username=someone'),db.env,{waitUntil(){}});
 assert.equal(res.status,401,'anonymous lookup denied');
 const auth=await worker.fetch(new Request(origin+'/api/private/lookup?username=someone',{headers:{cookie}}),db.env,{waitUntil(){}});
 assert.equal(auth.status,200);
 assert.equal((await auth.json()).user,null);
 assert.ok(db.statements.some(sql=>sql.includes("f.status='accepted'")&&sql.includes("u.account_status='active'")));
});

test('encrypted send requires accepted friendship and active target',()=>{
 const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 assert.match(source,/SELECT p\.user_id FROM encrypted_public_keys p JOIN users u ON u\.id=p\.user_id WHERE p\.user_id=\? AND u\.account_status='active' AND EXISTS\(SELECT 1 FROM luqyak_friend_requests/);
});

test('encrypted key lookup denies a blocked peer even with accepted friendship',async()=>{
 const peer='00000000-0000-4000-8000-000000000011';
 for(const lookup of ['peer_id='+peer,'username=someone']){
  let lookupQueried=false;
  const env={DB:{prepare(sql){return {bind(...args){return {
   async first(){
    if(sql.includes('FROM auth_sessions'))return {id:actor,username:'tester'};
    if(sql.includes('FROM users u JOIN encrypted_public_keys')){
     lookupQueried=true;
     assert.match(sql,/NOT EXISTS\(SELECT 1 FROM lk_user_blocks/);
     assert.equal(args.length,6);
     assert.equal(args[4],actor);
     assert.equal(args[5],actor);
     return null;
    }
    throw Error('Unexpected query: '+sql);
   },
   async run(){throw Error('Unexpected write')}
  }}}}}};
  const res=await worker.fetch(new Request(origin+'/api/private/lookup?'+lookup,{headers:{cookie}}),env,{waitUntil(){}});
  assert.equal(res.status,200);
  assert.equal((await res.json()).user,null);
  assert.equal(lookupQueried,true);
 }
});
