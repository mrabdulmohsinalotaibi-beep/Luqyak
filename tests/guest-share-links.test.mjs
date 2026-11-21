import test from 'node:test';
import assert from 'node:assert/strict';
import { guestHandler, guestOwnerHandler } from '../guest.js';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../guest.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const token='a'.repeat(64);
const cookie='__Host-luqyak_guest_'+token.slice(0,16)+'='+'b'.repeat(64);

function fakeEnv(can_view,can_upload,memberStatus='accepted'){
 const link={token_hash:token,meetup_id:'meetup-1',owner_id:'owner-1',title:'اختبار',place:'مكة',starts_at:'2026-11-21T12:00:00Z',ended:0,mode:'link',can_view,can_upload,review_photos:1,expires_at:null};
 const calls=[];
 return {calls,DB:{prepare(sql){return {bind(...args){calls.push({sql,args});return {
  async first(){
   if(sql.includes('FROM lk_guest_links'))return link;
   if(sql.includes('FROM lk_guest_members'))return {id:'guest-1',status:memberStatus};
   return null;
  },async all(){return {results:[{id:'photo-1'}]};}
 }}}}},PHOTOS:{async get(){return null}}};
}
test('capture link permits upload but never album viewing',async()=>{
 const env=fakeEnv(0,1);
 const r=await guestHandler(new Request('https://luqyak.athat.app/api/guest/album?token='+token,{headers:{cookie}}),env);
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.access,'capture');
 assert.equal(data.canUpload,true);
 assert.equal(data.allowed,false);
 assert.deepEqual(data.photos,[]);
});
test('viewer link permits photo viewing but not uploads',async()=>{
 const env=fakeEnv(1,0);
 const r=await guestHandler(new Request('https://luqyak.athat.app/api/guest/album?token='+token,{headers:{cookie}}),env);
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.access,'view');
 assert.equal(data.canUpload,false);
 assert.equal(data.allowed,true);
 assert.equal(data.photos.length,1);
});
test('one combined guest link permits uploading and viewing approved photos',async()=>{
 const env=fakeEnv(1,1);
 const r=await guestHandler(new Request('https://luqyak.athat.app/api/guest/album?token='+token,{headers:{cookie}}),env);
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.access,'both');
 assert.equal(data.canUpload,true);
 assert.equal(data.allowed,true);
 assert.equal(data.photos.length,1);
});
test('revoked guest membership cannot enumerate or download album photos',async()=>{
 const env=fakeEnv(1,0,'revoked');
 const album=await guestHandler(new Request('https://luqyak.athat.app/api/guest/album?token='+token,{headers:{cookie}}),env);
 assert.equal(album.status,200);
 const data=await album.json();
 assert.equal(data.allowed,false);
 assert.deepEqual(data.photos,[]);
 const photoId='00000000-0000-4000-8000-000000000123';
 const photo=await guestHandler(new Request('https://luqyak.athat.app/api/guest/photo?token='+token+'&photo='+photoId,{headers:{cookie}}),env);
 assert.equal(photo.status,404);
 assert.equal((await photo.json()).error,'not_found');
 assert.ok(!env.calls.some(c=>c.sql.includes('SELECT id FROM lk_meetup_photos')||c.sql.includes('SELECT object_key')),'Revoked guest must not enumerate photos or object keys');
});
test('guest links cannot silently grant full meetup membership',()=>{
 assert.doesNotMatch(source,/INSERT INTO lk_meetup_members/i);
 assert.match(source,/julianday\(l\.expires_at\)>julianday\('now'\)/);
 assert.match(source,/read_only_link/);
 assert.match(source,/apiPath==='extend'/);
});
test('sharing dialog creates one combined photo link and keeps duration, approval and WhatsApp',()=>{
 assert.doesNotMatch(app,/lkSharePurpose/);
 assert.match(app,/const capture=!m\.ended/);
 assert.match(app,/can_view:true,can_upload:capture/);
 assert.match(app,/lkShareDuration/);
 assert.match(app,/lkShareReview/);
 assert.match(app,/رابط إضافة ومشاهدة الصور/);
 assert.match(app,/wa\.me\/\?text=/);
 assert.match(source,/savePdf/);
});
test('guest image flow uses a permitted blob preview, square preflight and explicit send or cancel',()=>{
 assert.match(source,/img-src 'self' data: blob:/);
 assert.match(source,/id="cancelPhoto"/);
 assert.match(source,/q\('cancelPhoto'\)\.onclick=/);
 assert.match(source,/const cropped=await openSquarePhotoEditor\(f\)/);
 assert.match(source,/body:selectedPhoto/);
 assert.match(source,/if\(!selectedPhoto\)return say/);
});

test('cancelling a guest image invalidates a pending asynchronous crop',()=>{
 assert.match(source,/let photoSelectionVersion=0/);
 assert.match(source,/const version=\+\+photoSelectionVersion/);
 assert.match(source,/if\(version!==photoSelectionVersion\)return/);
 assert.match(source,/q\('cancelPhoto'\)\.onclick=\(\)=>\{\s*photoSelectionVersion\+\+/);
});
