import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../worker.js', import.meta.url),'utf8');
test('Logo palette is present in app and secondary pages',()=>{
 assert.match(source,/Logo matched identity/);
 for(const color of ['#2F5D4B','#9A3D27','#7A4E3A','#F8F5F1','#EADFCF'])assert.ok(source.includes(color),color);
 for(const page of ['/account-chat','/notifications','/private']){
  const start=source.indexOf("if(path==='"+page+"')return");
  const end=source.indexOf('</head>',start);
  assert.ok(start>=0&&end>start);
  assert.match(source.slice(start,end),/lk-coordinated-brand/);
 }
});
test('Homepage contains usable shortcut actions',()=>{
 const start=source.indexOf('function home(){');
 const end=source.indexOf('function memories(){',start);
 const html=source.slice(start,end);
 assert.ok(start>0&&end>start);
 assert.match(html,/lk-identity-shortcuts/);
 for(const action of ['meetQuick','memories','chats'])assert.ok(html.includes('data-action=\\\"'+action+'\\\"'));
 const bind=source.slice(source.indexOf('function bind(){'),source.indexOf('async function share(){'));
 assert.match(bind,/meetQuick/);
 assert.match(bind,/memories/);
 assert.match(bind,/chats/);
});
test('New theme keeps core worker features',()=>{
 for(const path of ['/api/social/profile','/api/social/email/request','/api/social/avatar'])assert.ok(source.includes(path));
 assert.ok(source.includes('/src/profile-avatar-editor.js'));
 assert.match(source,/if\(path==='\/app'\)return/);
 assert.match(source,/\.lk-profile-avatar/);
});
