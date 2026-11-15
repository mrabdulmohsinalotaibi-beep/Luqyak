import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const marker="if(path==='/app')return new Response(";
const start=worker.indexOf(marker)+marker.length;
const end=worker.indexOf(",{headers:",start);
assert.ok(start>=marker.length&&end>start);
const html=JSON.parse(worker.slice(start,end));
const scripts=[...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi)];
test('all inline scripts are valid JS',()=>{for(const [,code] of scripts)assert.doesNotThrow(()=>new Script(code))});
test('olive-gold home is photo-led and scrollable horizontally',()=>{
 assert.match(html,/LUQYAK_HOME_PREMIUM_2026_11_16/);
 assert.match(html,/lk-home-story-track/);
 assert.match(html,/lk-home-recent-track/);
 assert.match(html,/scroll-snap-type:x mandatory/);
 assert.match(html,/#354434/);
 assert.match(html,/#BE9F57/);
});
test('real authorized photos, navigation and viewer are retained',()=>{
 assert.match(html,/function lkHomeFeedPosts/);
 assert.match(html,/meetups\.filter\(m=>!m\.isInvited/);
 assert.match(html,/urlPhoto\(m\.id,photo\.id\)/);
 assert.match(html,/data-feed-view/);
 assert.match(html,/data-action="meetQuick"/);
 assert.match(html,/data-action="memories"/);
 assert.match(html,/data-action="chats"/);
});
