import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const base='https://luqyak.athat.app';
const actor='00000000-0000-4000-8000-000000000010';
const peer='00000000-0000-4000-8000-000000000011';
const cookie='__Host-luqyak_session='+('a'.repeat(64));
const context={waitUntil(){throw Error('Unauthorized chat should not signal')}};

test('ordinary chat refuses inactive friend before reading messages or writing',async()=>{
 let friendLookup=false;
 const env={DB:{prepare(sql){return {bind(...args){return {
   async first(){
    if(sql.includes('FROM auth_sessions'))return {id:actor,username:'active'};
    if(sql.includes('FROM lk_user_blocks'))return null;
    if(sql.includes('FROM luqyak_friend_requests f JOIN users u ON u.id=?')){
      friendLookup=true;
      assert.ok(sql.includes("u.account_status='active'"));
      assert.equal(args[0],peer);
      return null;
    }
    throw Error('Unexpected read '+sql);
   },
   async all(){throw Error('Must not read messages for inactive peer')},
   async run(){throw Error('Must not write messages for inactive peer')}
 }}}}}};
 for(const path of ['/api/chat/messages?peer='+peer,'/api/chat/send?peer='+peer]){
   const opt=path.includes('/send')?{method:'POST',headers:{cookie,origin:base,'content-type':'application/json'},body:JSON.stringify({text:'hello',client_id:crypto.randomUUID()})}:{headers:{cookie}};
   const res=await worker.fetch(new Request(base+path,opt),env,context);
   assert.equal(res.status,403);
   assert.equal((await res.json()).error,'not_friends');
 }
 assert.ok(friendLookup);
});

test('encrypted inbox filters inactive senders before ciphertext delivery',async()=>{
 let seen=false;
 const env={DB:{prepare(sql){return {bind(){return {
   async first(){if(sql.includes('FROM auth_sessions'))return {id:actor,username:'receiver'};throw Error('Unexpected first '+sql)},
   async run(){if(sql.startsWith('DELETE FROM encrypted_delivery_queue WHERE expires_at'))return {meta:{changes:0}};throw Error('Unexpected write')},
   async all(){if(sql.includes('FROM encrypted_delivery_queue q')){seen=true;assert.ok(sql.includes("sender.account_status='active'"));return {results:[]}}throw Error('Unexpected all '+sql)}
 }}}}}};
 const res=await worker.fetch(new Request(base+'/api/private/inbox',{method:'POST',headers:{cookie,origin:base,'content-type':'application/json'},body:'{}'}),env,{waitUntil(){}});
 assert.equal(res.status,200);
 assert.deepEqual((await res.json()).messages,[]);
 assert.ok(seen);
});

test('ordinary chat shows in-conversation disclosure and link to encrypted conversation',async()=>{
 const res=await worker.fetch(new Request(base+'/account-chat'),{},context);
 assert.equal(res.status,200);
 const html=await res.text();
 assert.match(html,/هذه المحادثة محفوظة على الخادم وليست مشفّرة من الطرف إلى الطرف/);
 assert.match(html,/href="\/private"[^>]*>الانتقال إلى المحادثات الخاصة المشفّرة/);
});
