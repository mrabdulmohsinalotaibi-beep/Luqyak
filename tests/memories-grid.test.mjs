import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// This checks the client module embedded in the Cloudflare Worker without changing data.
const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const prefix="if(path==='/src/my-memories.js')return new Response(";
const start=worker.indexOf(prefix);
assert.notEqual(start,-1,'my-memories module route should exist');
const from=start+prefix.length;
const to=worker.indexOf(",{headers:{'content-type':'application/javascript; charset=utf-8'",from);
assert.ok(to>from,'module response should be found');
const code=JSON.parse(worker.slice(from,to));

test('personal memories module parses as JavaScript',()=>{
  assert.doesNotThrow(()=>new Function(code.replace('export function mountMyMemories','function mountMyMemories')+';return mountMyMemories;'));
});
test('personal memories use six-photo pages and a square grid',()=>{
  assert.match(code,/const perPage=6/);
  assert.match(code,/photos\.slice\(page\*perPage,\(page\+1\)\*perPage\)/);
  assert.match(code,/lkMyPager/);
  assert.match(code,/className='lk-my-grid'/);
  assert.match(worker,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});
test('memories list albums and allow opening a selected meetup',()=>{
  assert.match(code,/lk-my-album-list/);
  assert.match(code,/lk-my-album-card/);
  assert.match(code,/lk-my-album-tab/);
  assert.match(code,/b\.onclick=\(\)=>\{selected=m\.id;renderAlbums\(\)\}/);
  assert.match(code,/const result=await api\('\/api\/social\/meetup\?id=/);
  assert.match(code,/list\.append\(imageButton\(p,i,albumPhotos\)\)/);
});
test('viewer preserves guarded photo endpoint, swipe and keyboard navigation',()=>{
  assert.match(code,/api\/social\/photo\?id=/);
  assert.match(code,/api\/social\/my-photos/);
  assert.match(code,/api\/social\/meetup\?id=/);
  assert.match(code,/aria-modal/);
  assert.match(code,/touchstart/);
  assert.match(code,/ArrowLeft/);
  assert.match(code,/function openViewer\(group,starting\)/);
});

test('album photo grid opens the guarded full-screen image viewer',()=>{
 assert.match(code,/imageButton\(p,i,albumPhotos\)/);
 assert.match(code,/button\.onclick=\(\)=>openViewer\(group,index\)/);
 assert.match(code,/function openViewer\(group,starting\)/);
});
