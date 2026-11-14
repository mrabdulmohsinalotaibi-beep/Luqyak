import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

// Isolated fake D1: deliberately fails on any attempted read of message bytes
// or mutation when a friendship is revoked, blocked, or inactive.
const origin='https://luqyak.athat.app';
const actor='00000000-0000-4000-8000-000000000010';
const peer='00000000-0000-4000-8000-000000000011';
const cookie='__Host-luqyak_session='+('a'.repeat(64));
function fixture({active=true,blocked=false,accepted=true}={}){
  const queries=[];
  const env={DB:{prepare(sql){
    queries.push(sql);
    return {bind(){return {
      async first(){
        if(sql.includes('FROM auth_sessions'))return {id:actor,username:'tester',display_name:'Tester'};
        if(sql.includes('FROM lk_user_blocks'))return blocked?{x:1}:null;
        if(sql.includes('FROM luqyak_friend_requests f JOIN users u'))return active&&accepted?{x:1}:null;
        throw Error('Unexpected DB access: '+sql);
      },
      async all(){throw Error('Private message bytes must not be fetched')},
      async run(){throw Error('No DB mutations permitted')},
    }}};
  }}};
  return {env,queries};
}
async function request(path,env,{post=false,originHeader=origin}={}){
  const headers={cookie};
  if(post){headers.origin=originHeader;headers['content-type']='application/json'}
  return worker.fetch(new Request(origin+path,{method:post?'POST':'GET',headers,
    ...(post?{body:JSON.stringify({text:'test message',client_id:crypto.randomUUID()})}:{})}),env,{waitUntil(){}});
}
test('inactive or removed friends cannot read, send or mark chats read',async()=>{
  for(const state of [{active:false},{accepted:false},{blocked:true}]){
    for(const path of ['/api/chat/messages?peer='+peer,'/api/chat/send?peer='+peer,'/api/chat/read?peer='+peer]){
      const {env,queries}=fixture(state);
      const response=await request(path,env,{post:!path.includes('/messages')});
      assert.equal(response.status,403,JSON.stringify({state,path}));
      assert.equal((await response.json()).error,'not_friends');
      assert.match(response.headers.get('cache-control')||'',/no-store/);
      assert.ok(queries.some(q=>q.includes('FROM auth_sessions')));
      assert.ok(!queries.some(q=>q.includes('SELECT id,sender_id,recipient_id,body,created_at,read_at FROM lk_account_messages')));
    }
  }
});
test('cross-origin account-chat writes fail before any message read/write',async()=>{
  const {env}=fixture();
  const response=await request('/api/chat/send?peer='+peer,env,{post:true,originHeader:'https://attacker.example'});
  assert.equal(response.status,403);
  assert.equal((await response.json()).error,'invalid_origin');
});
