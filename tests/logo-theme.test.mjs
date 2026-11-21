import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../worker.js', import.meta.url),'utf8');
test('olive and sand theme is consistent across current app pages',()=>{
 assert.match(source,/Logo matched identity/);
 assert.match(source,/#354434/);
 assert.match(source,/#F5F0E4/);
 for(const page of ['/app','/notifications','/private']){
  const start=source.indexOf("if(path==='"+page+"')return new Response(");
  const end=source.indexOf('</head>',start);
  assert.ok(start>=0&&end>start,'missing page '+page);
  const head=source.slice(start,end);
  assert.ok(head.includes('#354434'),'theme mismatch on '+page);
  assert.ok(head.includes('/v2/theme.css'),'missing shared stylesheet on '+page);
 }
});
test('photo-led home retains shared feed and meeting entry points',()=>{
 const start=source.indexOf('function home(){');
 const end=source.indexOf('async function lkHomeEnsureDetails',start);
 assert.ok(start>0&&end>start);
 const home=source.slice(start,end);
 for(const part of ['lk-home-story-track','lk-home-photos-empty','data-feed-open','lk-live-invitehint'])
  assert.ok(home.includes(part),'missing home component '+part);
 const quote=String.fromCharCode(92,34);
 for(const action of ['meet','meetQuick'])
  assert.ok(home.includes('data-action='+quote+action+quote),'missing home action '+action);
 assert.ok(!home.includes('data-action='+quote+'chats'+quote));
});
test('New theme keeps core worker features',()=>{
 for(const path of ['/api/social/profile','/api/social/email/request','/api/social/avatar'])assert.ok(source.includes(path));
 assert.ok(source.includes('/src/profile-avatar-editor.js'));
 assert.match(source,/if\(path==='\/app'\)return/);
 assert.match(source,/\.lk-profile-avatar/);
});
