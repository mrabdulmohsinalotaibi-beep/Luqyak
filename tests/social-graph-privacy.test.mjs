import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const origin='https://luqyak.athat.app';
const alice='11111111-1111-4111-8111-111111111111';
const bob='22222222-2222-4222-8222-222222222222';
const carol='33333333-3333-4333-8333-333333333333';
const cookieA='__Host-luqyak_session='+('a'.repeat(64));
const cookieB='__Host-luqyak_session='+('b'.repeat(64));
const accounts=[{id:alice,username:'alice'},{id:bob,username:'bob'}];
const friendRows={
 [alice]:[{id:12,sender_id:alice,recipient_id:carol,status:'accepted',created_at:'2026-01-01',peer_id:carol,username:'carol',display_name:'Carol'}],
 [bob]:[{id:18,sender_id:bob,recipient_id:alice,status:'pending',created_at:'2026-01-02',peer_id:alice,username:'alice',display_name:'Alice'}]
};
let calls=[];
const db={prepare(sql){return {bind(...args){return {
 async first(){
  calls.push({sql,args,kind:'first'});
  if(sql.includes('FROM auth_sessions'))return accounts[args[0]===undefined?0:(this.cookieIndex||0)]||null;
  throw Error('Unexpected first: '+sql);
 },
 async all(){
  calls.push({sql,args,kind:'all'});
  if(sql.includes('FROM luqyak_friend_requests f JOIN users u'))return {results:friendRows[args[0]]||[]};
  throw Error('Unexpected list: '+sql);
 }
}}}}};
function makeEnv(account){
 return {DB:{prepare(sql){return {bind(...args){return {
  async first(){calls.push({sql,args,kind:'first'});if(sql.includes('FROM auth_sessions'))return {id:account,username:account===alice?'alice':'bob',email_verified_at:'2026-01-01'};throw Error('Unexpected read: '+sql)},
  async all(){calls.push({sql,args,kind:'all'});if(sql.includes('FROM luqyak_friend_requests f JOIN users u'))return {results:friendRows[account]};throw Error('Unexpected query: '+sql)}
 }}}}}};
}
async function get(path,account=alice,cookie=cookieA){
 return worker.fetch(new Request(origin+path,{headers:{cookie}}),makeEnv(account),{waitUntil(){}});
}
test('two signed-in accounts can each read only their own accepted/pending relations',async()=>{
 calls=[];
 const own=await get('/api/private/friends',alice,cookieA);
 const other=await get('/api/private/friends',bob,cookieB);
 assert.equal(own.status,200);
 assert.equal(other.status,200);
 assert.match(own.headers.get('cache-control')||'',/no-store/);
 assert.equal(own.headers.get('content-type')?.includes('application/json'),true);
 const a=await own.json(),b=await other.json();
 assert.deepEqual(a.items.map(x=>x.peer_id),[carol]);
 assert.deepEqual(b.items.map(x=>x.peer_id),[alice]);
 assert.equal(a.items.some(x=>x.peer_id===bob),false);
 assert.equal(b.items.some(x=>x.peer_id===carol),false);
 for(const result of [a,b]){assert.equal('total' in result,false);assert.equal('count' in result,false);assert.equal('followers_count' in result,false)}
 assert.equal(calls.filter(x=>x.sql.includes('FROM luqyak_friend_requests f JOIN users u')).length,2);
});
test('any attempt to enumerate another user by query parameter is denied before DB friend lookup',async()=>{
 for(const query of ['user_id='+bob,'peer_id='+bob,'username=bob','include_counts=true','owner_id='+bob]){
  calls=[];
  const res=await get('/api/private/friends?'+query,alice,cookieA);
  assert.equal(res.status,403);
  assert.equal((await res.json()).error,'relationship_list_private');
  assert.equal(calls.some(x=>x.sql.includes('FROM luqyak_friend_requests f JOIN users u')),false);
 }
});
test('legacy chat contact list also denies selecting another user via query params',async()=>{
 calls=[];
 const res=await get('/api/chat/list?user_id='+bob,alice,cookieA);
 assert.equal(res.status,403);
 assert.equal((await res.json()).error,'relationship_list_private');
 assert.equal(calls.some(x=>x.sql.includes('luqyak_friend_requests')),false);
});
test('relationship API is unavailable without login',async()=>{
 const res=await worker.fetch(new Request(origin+'/api/private/friends'),{},{waitUntil(){}});
 assert.equal(res.status,401);
});
test('private relationships are available without exposing the removed chat screen',async()=>{
 const app=await worker.fetch(new Request(origin+'/app'),{},{waitUntil(){}});
 const privatePage=await worker.fetch(new Request(origin+'/private'),{},{waitUntil(){}});
 const html=await app.text();
 assert.match(html,/دائرة أصدقائي/);
 assert.match(html,/أصدقاؤك يظهرون لك وحدك/);
 assert.equal(privatePage.status,302);
});
