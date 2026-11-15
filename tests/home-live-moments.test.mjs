import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const begin=worker.indexOf('/* LUQYAK_LIVE_MOMENTS_V1');
const end=worker.indexOf('function sharedMemories(){',begin);
assert.ok(begin>=0&&end>begin,'Live moments home should be embedded in the app');
const source=JSON.parse('"'+worker.slice(begin,end)+'"');

test('home feed JS parses and remains attached to home draw',()=>{
  assert.doesNotThrow(()=>new Script(source,{filename:'luqyak-live-home.js'}));
  assert.match(worker,/bind\(\);if\(tab==='home'\)lkBindHomeFeed\(\);lkBindProfile\(\)/);
});
test('feed uses authorized meetup/photo routes and no fabricated public gallery',()=>{
  assert.match(source,/meetups\.filter\(m=>!m\.isInvited/);
  assert.match(source,/api\(p\('\/api\/social\/meetup'/);
  assert.match(source,/urlPhoto\(m\.id/);
  assert.match(source,/api\(p\('\/api\/social\/like'/);
});
test('live photo carousels and responsive feed styles are present',()=>{
  assert.match(source,/data-feed-slide/);
  assert.match(source,/data-feed-view/);
  assert.match(source,/lkHomeMoveSlide/);
  assert.match(source,/lkHomePhotoViewer/);
  assert.match(source,/lkHomeEnsureDetails/);
  const app=worker.slice(worker.indexOf("if(path==='/app')return new Response("),worker.indexOf("if(path==='/notifications')return new Response("));
  assert.match(app,/LUQYAK_LIVE_MOMENTS_STYLE_V1/);
  assert.match(app,/lk-live-card-media/);
  assert.match(app,/@media\(max-width:430px\)/);
});
