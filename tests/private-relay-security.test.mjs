import test from 'node:test';
import assert from 'node:assert/strict';
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

test('retired private status route cannot reveal account state',async()=>{
 const db=fakeEnv({active:false});
 const res=await worker.fetch(new Request(origin+'/api/private/status',{headers:{cookie}}),db.env,{waitUntil(){}});
 assert.equal(res.status,410);
 assert.equal((await res.json()).error,'feature_removed');
 assert.deepEqual(db.statements,[]);
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

test('retired public-key lookup never reveals contacts or performs DB reads',async()=>{
 for(const suffix of ['username=someone','peer_id=00000000-0000-4000-8000-000000000011']){
  for(const headers of [{},{cookie}]){
   const db=fakeEnv();
   const res=await worker.fetch(new Request(origin+'/api/private/lookup?'+suffix,{headers}),db.env,{waitUntil(){}});
   assert.equal(res.status,410);
   assert.equal((await res.json()).error,'feature_removed');
   assert.deepEqual(db.statements,[]);
  }
 }
});

test('retired private relay cannot accept encrypted writes',async()=>{
 const db=fakeEnv();
 const res=await worker.fetch(new Request(origin+'/api/private/send',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:'{}'}),db.env,{waitUntil(){}});
 assert.equal(res.status,410);
 assert.equal((await res.json()).error,'feature_removed');
 assert.deepEqual(db.statements,[]);
});

test('removed key route refuses registration with no read or write',async()=>{
 const db=fakeEnv();
 const res=await worker.fetch(new Request(origin+'/api/private/key',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:'{}'}),db.env,{waitUntil(){}});
 assert.equal(res.status,410);
 assert.equal((await res.json()).error,'feature_removed');
 assert.deepEqual(db.statements,[]);
});
