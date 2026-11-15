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
test('all personal photos display in a uniform square gallery without six-photo pager',()=>{
  assert.match(code,/const perPage=Number\.MAX_SAFE_INTEGER/);
  assert.match(code,/photos\.slice\(page\*perPage,\(page\+1\)\*perPage\)/);
  assert.doesNotMatch(code,/lkMyPager|const perPage=6/);
  assert.match(code,/className='lk-my-grid'/);
  assert.match(worker,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});
test('Instagram-style memories layout has profile summary, circular highlight albums and a 3-column gallery in the actual app page',()=>{
  const appStart=worker.indexOf("if(path==='/app')return new Response(");
  const appEnd=worker.indexOf("if(path==='/notifications')return new Response(",appStart);
  assert.ok(appStart>=0 && appEnd>appStart,'App page must exist');
  const appPage=worker.slice(appStart,appEnd);
  assert.match(code,/lk-my-profile-summary/);
  assert.match(code,/lk-my-stats/);
  assert.match(code,/lk-my-highlights/);
  assert.match(code,/lk-my-album-circle/);
  assert.match(appPage,/\.lk-my-memories \.lk-my-grid\{display:grid!important;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(appPage,/\.lk-my-memories \.lk-my-photo>img\{position:absolute!important/);
  assert.match(appPage,/aspect-ratio:1\/1!important/);
  assert.match(appPage,/object-fit:cover!important/);
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

test('tapping a meetup highlight opens its photos directly in the viewer',()=>{
  assert.match(code,/b\.onclick=async\(\)=>\{/);
  assert.match(code,/if\(group\.length\)openViewer\(group,0\)/);
  assert.match(code,/api\/social\/meetup\?id=/);
});
