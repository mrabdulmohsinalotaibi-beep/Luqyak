import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {atelierThemeResponse} from '../luqyak-theme-response.js';
import {ownerPage} from '../v2-owner-page.js';
import {uploadPage} from '../v2-upload-page.js';
import {viewAlbumPage} from '../v2-view-page.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('shared premium theme loads with safe CSS headers and no third-party CDN',async()=>{
 const response=atelierThemeResponse();
 assert.equal(response.status,200);
 assert.match(response.headers.get('content-type'),/text\/css/);
 const css=await response.text();
 for(const key of ['.lk-home-premium','.lk-topbar','.lk-my-memories','.lk-account-revamp','.lk-v2','.lk-atelier-vault'])assert.ok(css.includes(key),key);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/focus-visible/);
 assert.doesNotMatch(css,/@import|fonts\.googleapis|https?:\/\//);
});
test('main app, notifications and private page include last-in-head theme stylesheet',()=>{
 const worker=read('worker.js');
 for(const route of ["/app","/notifications","/private"]){
  const start=worker.indexOf("if(path==='"+route+"')return new Response(");
  assert.ok(start>=0,'route '+route);
  const finish=worker.indexOf('\",{headers:',start);
  const link=worker.indexOf("<link rel='stylesheet' href='/v2/theme.css'>",start);
  const body=worker.indexOf('</head><body>',start);
  assert.ok(link>start&&link<body&&body<finish,'route theme '+route);
 }
 assert.match(worker,/if\(path==='\/v2\/theme\.css'\)return atelierThemeResponse\(\)/);
});
test('mobile bottom nav has actual memories route and home links to device vault',()=>{
 const worker=read('worker.js');
 const app=worker.slice(worker.indexOf("if(path==='/app')return new Response("));
 assert.match(app,/data-tab=\\\"memories\\\"/);
 assert.match(app,/function draw\(\).*?tab==='memories'/s);
 assert.match(app,/href=\\\"\/v2\/owner\\\"/);
 assert.doesNotMatch(app.slice(0,300000),/data-tab=\\\"chats\\\"/);
});
test('owner, upload, and viewer share the same theme and a return path',async()=>{
 for(const page of [ownerPage(),uploadPage(),viewAlbumPage()]){
  const html=await page.text();
  assert.match(html,/href="\/v2\/theme\.css"/);
  assert.match(html,/class="lk-v2 [^"]+"/);
  assert.match(html,/class="lk-v2-back"/);
  assert.match(html,/href="\/app"/);
  assert.equal(page.headers.get('cache-control'),'no-store');
 }
});
