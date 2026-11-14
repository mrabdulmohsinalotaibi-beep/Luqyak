import test from 'node:test';
import assert from 'node:assert/strict';
import {guestHandler} from '../guest.js';

const root='https://luqyak.athat.app',token='a'.repeat(64);
const link={token_hash:'link-hash',meetup_id:'00000000-0000-4000-8000-000000000002',owner_id:'00000000-0000-4000-8000-000000000003',title:'لقاء العائلة',place:'مكة',starts_at:'2026-11-15T18:00:00Z',mode:'link',can_view:1,can_upload:1,review_photos:1,ended:0};
function mocked(){
 let member=null,photos=[],writes=[];
 const env={DB:{prepare(sql){return {bind(...args){return {
 async first(){
  if(sql.includes('FROM lk_guest_links l JOIN lk_meetups'))return link;
  if(sql.includes('SELECT * FROM lk_guest_members'))return member;
  if(sql.includes('COUNT(*) n FROM lk_guest_members'))return {n:member?1:0};
  if(sql.includes('COUNT(*) n FROM lk_guest_photos'))return {n:photos.length};
  if(sql.includes('FROM auth_sessions'))return null;
  throw Error('Unexpected DB read: '+sql)
 },
 async all(){
  if(sql.includes('SELECT id FROM lk_meetup_photos'))return {results:photos.filter(x=>x.status==='approved').map(x=>({id:x.id}))};
  throw Error('Unexpected DB list: '+sql)
 },
 async run(){
  writes.push(sql);
  if(sql.includes('INSERT INTO lk_guest_members'))member={id:args[0],token_hash:args[1],display_name:args[2],session_hash:args[3],status:args[4],claimed_user_id:null};
  if(sql.includes('INSERT INTO lk_guest_photos'))photos.push({id:args[0],status:args[4]});
  return {meta:{changes:1}}
 }
 }}}}},PHOTOS:{async put(){return {etag:'mock'}}}};
 return {env,writes,photos};
}
test('private album does not reveal images to unjoined visitors',async()=>{
 const {env}=mocked();
 const response=await guestHandler(new Request(root+'/api/guest/album?token='+token),env);
 assert.equal(response.status,200);
 const album=await response.json();
 assert.equal(album.allowed,false);
 assert.deepEqual(album.photos,[]);
});
test('guest joins without account, can upload under review and cannot publish immediately',async()=>{
 const {env,photos}=mocked();
 const join=await guestHandler(new Request(root+'/api/guest/join?token='+token,{
  method:'POST',headers:{origin:root,'content-type':'application/json'},body:JSON.stringify({name:'ضيف المناسبة'})
 }),env);
 assert.equal(join.status,201);
 const cookie=join.headers.get('set-cookie');
 assert.match(cookie,/__Host-luqyak_guest_/);
 assert.match(cookie,/HttpOnly/);
 assert.match(cookie,/SameSite=Lax/);
 const album=await guestHandler(new Request(root+'/api/guest/album?token='+token,{headers:{cookie}}),env);
 assert.equal((await album.json()).allowed,true);
 const data=new Uint8Array(220);data[0]=255;data[1]=216;data[218]=255;data[219]=217;
 const upload=await guestHandler(new Request(root+'/api/guest/upload?token='+token,{
  method:'POST',headers:{cookie,origin:root,'content-type':'image/jpeg'},body:data
 }),env);
 assert.equal(upload.status,201);
 assert.equal((await upload.json()).pending,true);
 assert.equal(photos[0].status,'pending');
 const after=await guestHandler(new Request(root+'/api/guest/album?token='+token,{headers:{cookie}}),env);
 assert.deepEqual((await after.json()).photos,[]);
});
test('untrusted requests cannot join cross-origin or upload without a joined session',async()=>{
 const {env}=mocked();
 const join=await guestHandler(new Request(root+'/api/guest/join?token='+token,{
  method:'POST',headers:{origin:'https://attacker.invalid','content-type':'application/json'},body:JSON.stringify({name:'Attack'})
 }),env);
 assert.equal(join.status,403);
 const upload=await guestHandler(new Request(root+'/api/guest/upload?token='+token,{
  method:'POST',headers:{origin:root,'content-type':'image/jpeg'},body:new Uint8Array(200)
 }),env);
 assert.equal(upload.status,403);
});
test('guest invitation landing page uses a private non-cacheable response',async()=>{
 const {env}=mocked();
 const response=await guestHandler(new Request(root+'/g/'+token),env);
 assert.equal(response.status,200);
 assert.match(response.headers.get('cache-control'),'no-store');
 assert.match(response.headers.get('referrer-policy'),'no-referrer');
 const html=await response.text();
 assert.match(html,/الدخول كضيف/);
 assert.match(html,/حفظ المناسبة في حسابي/);
});
