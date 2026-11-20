import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {atelierThemeResponse} from '../luqyak-theme-response.js';
const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
test('premium design CSS is self-hosted, accessible and responsive',async()=>{
 const response=atelierThemeResponse(),css=await response.text();
 assert.equal(response.status,200);
 assert.match(response.headers.get('content-type'),/text\/css/);
 for(const selector of ['.lk-home-premium','.lk-topbar','.lk-my-memories','.lk-account-revamp','.lk-home-shortcuts'])
  assert.ok(css.includes(selector),selector);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/focus-visible/);
 assert.match(css,/max-width:700px/);
 assert.doesNotMatch(css,/@import|fonts\.googleapis|https?:\/\//);
});
test('production UI routes include the last-in-head premium stylesheet',()=>{
 for(const route of ['/app','/notifications','/private']){
  const start=source.indexOf("if(path==='"+route+"')return new Response(");
  const head=source.indexOf("</head><body>",start),link=source.indexOf("<link rel='stylesheet' href='/v2/theme.css'>",start);
  assert.ok(start>=0&&link>start&&head>link,route);
 }
 assert.match(source,/if\(path==='\/v2\/theme\.css'\)return atelierThemeResponse\(\)/);
});
test('main mobile menu opens memories instead of retired chat',()=>{
 const app=source.slice(source.indexOf("if(path==='/app')return new Response("));
 assert.match(app,/data-tab=\\\"memories\\\"/);
 assert.doesNotMatch(app.slice(0,270000),/data-tab=\\\"chats\\\"/);
 assert.match(app,/function draw\(\).*?tab==='memories'/s);
 assert.match(app,/lk-core-nav/);
 assert.match(app,/lk-home-shortcuts/);
 assert.doesNotMatch(app,/lk-atelier-vault/);
});
