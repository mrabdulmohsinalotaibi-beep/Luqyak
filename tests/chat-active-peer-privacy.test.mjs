import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const base='https://luqyak.athat.app';
const actor='00000000-0000-4000-8000-000000000010';
const peer='00000000-0000-4000-8000-000000000011';
const cookie='__Host-luqyak_session='+('a'.repeat(64));
const context={waitUntil(){throw Error('Unauthorized chat should not signal')}};

test('disabled ordinary chats cannot read messages or write for any peer',async()=>{
 const queries=[];
 const env={DB:{prepare(sql){queries.push(sql);throw Error('Disabled messaging must not touch D1')}}};
 for(const path of ['/api/chat/messages?peer='+peer,'/api/chat/send?peer='+peer]){
  const options=path.includes('/send')?{method:'POST',headers:{cookie,origin:base,'content-type':'application/json'},body:'{}'}:{headers:{cookie}};
  const res=await worker.fetch(new Request(base+path,options),env,context);
  assert.equal(res.status,410,path);
  assert.equal((await res.json()).error,'feature_removed');
 }
 assert.deepEqual(queries,[]);
});
test('disabled encrypted inbox cannot reveal ciphertext or query delivery queue',async()=>{
 const env={DB:{prepare(){throw Error('Retired inbox must not read private queue')}}};
 const res=await worker.fetch(new Request(base+'/api/private/inbox',{method:'POST',headers:{cookie,origin:base,'content-type':'application/json'},body:'{}'}),env,{waitUntil(){}});
 assert.equal(res.status,410);
 assert.equal((await res.json()).error,'feature_removed');
 assert.match(res.headers.get('cache-control')||'',/no-store/);
});

test('legacy ordinary chat screen is retired',async()=>{
 const response=await worker.fetch(new Request(base+'/account-chat'),{},context);
 assert.equal(response.status,302);
 assert.match(response.headers.get('location')||'',/\/app\?tab=chats$/);
});
