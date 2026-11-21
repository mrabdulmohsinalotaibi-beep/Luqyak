import test from 'node:test';
import assert from 'node:assert/strict';
import { guestHandler } from '../guest.js';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../guest.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const token='a'.repeat(64);
const cookie='__Host-luqyak_guest_'+token.slice(0,16)+'='+'b'.repeat(64);

function fakeEnv(can_view,can_upload){
 const link={token_hash:token,meetup_id:'meetup-1',owner_id:'owner-1',title:'اختبار',place:'مكة',starts_at:'2026-11-21T12:00:00Z',ended:0,mode:'link',can_view,can_upload,review_photos:1,expires_at:null};
 const calls=[];
 return {calls,DB:{prepare(sql){return {bind(...args){calls.push({sql,args});return {
  async first(){
   if(sql.includes('FROM lk_guest_links'))return link;
   if(sql.includes('FROM lk_guest_members'))return {id:'guest-1',status:'accepted'};
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
test('guest links cannot silently grant full meetup membership',()=>{
 assert.doesNotMatch(source,/INSERT INTO lk_meetup_members/i);
 assert.match(source,/julianday\(l\.expires_at\)>julianday\('now'\)/);
 assert.match(source,/read_only_link/);
 assert.match(source,/apiPath==='extend'/);
});
test('sharing UI separates purposes, duration and WhatsApp delivery',()=>{
 assert.match(app,/lkSharePurpose/);
 assert.match(app,/lkShareDuration/);
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
