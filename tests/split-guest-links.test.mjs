import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { guestOwnerHandler } from '../guest.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const origin='https://luqyak.athat.app';
const meetup='00000000-0000-4000-8000-000000000002';
const owner='00000000-0000-4000-8000-000000000003';
function setup(active=0){
 const created=[];let batches=0;
 const env={DB:{
  prepare(sql){return {bind(...values){return {
   async first(){
    if(sql.includes('FROM auth_sessions'))return {id:owner};
    if(sql.includes('FROM lk_meetups'))return {owner_id:owner,privacy:'friends'};
    if(sql.includes('COUNT(*) n FROM lk_guest_links'))return {n:active};
    throw new Error('Unexpected query: '+sql);
   },
   async run(){if(sql.includes('INSERT INTO lk_guest_links'))created.push(values);return {meta:{changes:1}}}
  }}}},
  async batch(statements){batches++;for(const s of statements)await s.run();return [{success:true},{success:true}];}
 }};
 return {env,created,get batches(){return batches}};
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
