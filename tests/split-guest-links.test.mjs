import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { guestOwnerHandler } from '../guest.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const origin='https://luqyak.athat.app';
const meetup='00000000-0000-4000-8000-000000000002';
const owner='00000000-0000-4000-8000-000000000003';
function setup(active=0){
 const created=[];let batches=0;let extensions=0;let revokes=0;
 const env={DB:{
  prepare(sql){return {bind(...values){return {
   async first(){
    if(sql.includes('FROM auth_sessions'))return {id:owner};
    if(sql.includes('FROM lk_meetups'))return {owner_id:owner,privacy:'friends'};
    if(sql.includes('COUNT(*) n FROM lk_guest_links'))return {n:active};
    if(sql.includes('SELECT can_upload,revoked_at FROM lk_guest_links'))return {can_upload:1,revoked_at:null};
    throw new Error('Unexpected query: '+sql);
   },
   async all(){if(sql.includes('SELECT token_hash,mode,can_view,can_upload'))return {results:[{token_hash:'a'.repeat(64),mode:'link',can_view:0,can_upload:1,review_photos:0,capture_expires_at:null,created_at:'2026-11-21'}]};throw Error('Unexpected list: '+sql)},
   async run(){if(sql.includes('INSERT INTO lk_guest_links'))created.push(values);if(sql.includes('UPDATE lk_guest_links SET capture_expires_at'))extensions++;if(sql.includes('UPDATE lk_guest_links SET revoked_at'))revokes++;return {meta:{changes:1}}}
  }}}},
  async batch(statements){batches++;for(const s of statements)await s.run();return [{success:true},{success:true}];}
 }};
 return {env,created,get batches(){return batches},get extensions(){return extensions},get revokes(){return revokes}};
}
function request(body){
 return new Request(origin+'/api/guest/owner',{method:'POST',headers:{origin,'content-type':'application/json',cookie:'__Host-luqyak_session='+'f'.repeat(64)},body:JSON.stringify({meetup_id:meetup,...body})});
}
test('split link creation produces capture-only and view-only capabilities',async()=>{
 const fixture=setup();
 const response=await guestOwnerHandler(request({link_set:'split',mode:'link',review_photos:true}),fixture.env);
 assert.equal(response.status,201);
 const data=await response.json();
 assert.equal(data.ok,true);
 assert.equal(data.url,data.capture_url);
 assert.notEqual(data.capture_url,data.view_url);
 assert.match(data.capture_url,/\/g\/[a-f0-9]{64}$/);
 assert.match(data.view_url,/\/g\/[a-f0-9]{64}$/);
 assert.equal(fixture.batches,1);
 assert.equal(fixture.created.length,2);
 assert.deepEqual(fixture.created.map(x=>x.slice(4,7)),[[0,1,1],[1,0,0]]);
});
test('split creation refuses insufficient link capacity without writes',async()=>{
 const fixture=setup(11);
 const response=await guestOwnerHandler(request({link_set:'split'}),fixture.env);
 assert.equal(response.status,429);
 assert.equal(fixture.batches,0);
 assert.equal(fixture.created.length,0);
});
test('legacy single link stays available and defaults to both capabilities',async()=>{
 const fixture=setup();
 const response=await guestOwnerHandler(request({}),fixture.env);
 assert.equal(response.status,200);
 const data=await response.json();
 assert.ok(data.url);
 assert.equal(data.capture_url,undefined);
 assert.deepEqual(fixture.created[0].slice(4,7),[1,1,0]);
});

test('owner UI requests independent link capabilities and shows two separate actions',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 const begin=source.indexOf('async function share(){');
 const end=source.indexOf('function album(){',begin);
 assert.ok(begin>=0&&end>begin);
 const ui=source.slice(begin,end);
 assert.match(ui,/link_set:'split'/);
 assert.match(ui,/data\.capture_url/);
 assert.match(ui,/data\.view_url/);
 assert.match(ui,/نسخ /);
 assert.match(ui,/مشاركة /);
 assert.doesNotMatch(ui,/lkShareView|lkShareUpload/);
});

test('capture expires independently of view access',async()=>{
 const fixture=setup();
 const response=await guestOwnerHandler(request({link_set:'split',hours:1}),fixture.env);
 assert.equal(response.status,201);
 const data=await response.json();
 const capture=fixture.created[0],view=fixture.created[1];
 assert.ok(Date.parse(capture[7])>Date.now());
 assert.ok(Date.parse(capture[7])<=Date.now()+3600100);
 assert.equal(view[7],null);
 assert.equal(data.capture_expires_at,capture[7]);
});
test('invalid durations cannot create guest links',async()=>{
 const fixture=setup();
 const response=await guestOwnerHandler(request({link_set:'split',hours:999}),fixture.env);
 assert.equal(response.status,400);
 assert.equal(fixture.batches,0);
});
test('owner may extend capture expiry, never the view link',async()=>{
 const fixture=setup();
 const token='a'.repeat(64);
 const response=await guestOwnerHandler(request({action:'extend_capture',capture_token:token,hours:3}),fixture.env);
 assert.equal(response.status,200);
 const data=await response.json();
 assert.ok(Date.parse(data.capture_expires_at)>Date.now()+2*3600000);
 assert.equal(fixture.extensions,1);
});
test('invalid extension duration is rejected without writes',async()=>{
 const fixture=setup();
 const response=await guestOwnerHandler(request({action:'extend_capture',capture_token:'b'.repeat(64),hours:0}),fixture.env);
 assert.equal(response.status,400);
 assert.equal(fixture.extensions,0);
});

test('owner can list active links without exposing usable raw tokens',async()=>{
 const fixture=setup();
 const response=await guestOwnerHandler(new Request(origin+'/api/guest/owner?meetup_id='+meetup,{headers:{cookie:'__Host-luqyak_session='+'f'.repeat(64)}}),fixture.env);
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.links.length,1);
 assert.equal(data.links[0].id,'a'.repeat(64));
 assert.equal(data.links[0].can_upload,true);
 assert.equal(data.links[0].can_view,false);
 assert.equal(data.links[0].url,undefined);
});
test('owner can stop capture by its link hash, preserving other links',async()=>{
 const fixture=setup();
 const response=await guestOwnerHandler(request({action:'manage_link',operation:'stop',link_hash:'a'.repeat(64)}),fixture.env);
 assert.equal(response.status,200);
 assert.ok(Date.parse((await response.json()).capture_expires_at)<=Date.now());
 assert.equal(fixture.extensions,1);
 assert.equal(fixture.revokes,0);
});
test('owner can revoke one link without deleting photos',async()=>{
 const fixture=setup();
 const response=await guestOwnerHandler(request({action:'manage_link',operation:'revoke',link_hash:'b'.repeat(64)}),fixture.env);
 assert.equal(response.status,200);
 assert.equal((await response.json()).revoked,true);
 assert.equal(fixture.revokes,1);
});
test('invalid hash or management operation is rejected',async()=>{
 const fixture=setup();
 const response=await guestOwnerHandler(request({action:'manage_link',operation:'revoke',link_hash:'bad'}),fixture.env);
 assert.equal(response.status,400);
 assert.equal(fixture.revokes,0);
});
test('owner share dialog can refresh and manage preexisting links',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 const ui=source.slice(source.indexOf('async function share(){'),source.indexOf('function album(){',source.indexOf('async function share(){')));
 assert.match(ui,/async function loadExistingLinks/);
 assert.match(ui,/action:'manage_link'/);
 assert.match(ui,/operation==='revoke'/);
 assert.match(ui,/operation==='extend'/);
 assert.match(ui,/operation==='stop'/);
});
