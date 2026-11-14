import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
test('all install prompts hide redundant help button after showing manual installation steps',async()=>{
 const routes=['/app','/private','/notifications','/account-chat'];
 for(const route of routes){
  const response=await worker.fetch(new Request('https://luqyak.athat.app'+route),{}, {waitUntil(){}});
  assert.equal(response.status,200,route);
  const html=await response.text();
  assert.match(html,/yes\.hidden=true;no\.textContent='إغلاق';/,route);
  assert.doesNotMatch(html,/عرض الخطوات أعلاه/,route);
  assert.match(html,/إضافة إلى الشاشة الرئيسية/,route);
 }
});
