import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../worker.js';

const site = 'https://luqyak.athat.app';
const ctx = {waitUntil(){}};
const request = (path, options={}) => new Request(site+path, options);

test('private meetup photos require a session', async()=>{
  const response = await worker.fetch(request('/api/social/photo?id=00000000-0000-4000-8000-000000000001&photo=00000000-0000-4000-8000-000000000002'),{},ctx);
  assert.equal(response.status,401);
  assert.match(response.headers.get('cache-control')||'',/no-store/i);
});

test('private relay requires a session', async()=>{
  const response=await worker.fetch(request('/api/private/status'),{},ctx);
  assert.equal(response.status,401);
  assert.match(response.headers.get('cache-control')||'',/no-store/i);
});

test('account chat messages and send endpoint require a session',async()=>{
  for(const [path,options] of [
    ['/api/chat/messages?peer=00000000-0000-4000-8000-000000000001',{}],
    ['/api/chat/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'test'})}]
  ]){
    const response=await worker.fetch(request(path,options),{},ctx);
    assert.equal(response.status,401,path);
    assert.match(response.headers.get('cache-control')||'',/no-store/i);
  }
});

test('web app manifest uses the configured scope and theme',async()=>{
  const response=await worker.fetch(request('/manifest.webmanifest'),{},ctx);
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.display,'standalone');
  assert.equal(data.scope,'/');
  assert.ok(Array.isArray(data.icons)&&data.icons.length>0);
});

test('service worker avoids private chat and photo caching',async()=>{
  const response=await worker.fetch(request('/luqyak-sw.js'),{},ctx);
  assert.equal(response.status,200);
  const source=await response.text();
  assert.match(source,/notificationclick/);
  assert.match(source,/addEventListener\('push'/);
  assert.match(source,/event\.request\.mode!==['"]navigate['"]/);
  assert.doesNotMatch(source,/caches\.open\(/);
});

test('sensitive photo retrieval verifies meetup access and disables caching',async()=>{
  const source=await readFile(new URL('../worker.js',import.meta.url),'utf8');
  const photo=source.slice(source.indexOf("if(path==='/api/social/photo'&&method==='GET')"),source.indexOf("if(path==='/api/social/delete-photo'"));
  assert.ok(photo.includes('if(!access.view)'));
  assert.ok(photo.includes('meetup_id=?'));
  assert.match(photo,/private, no-store/);
});

test('meeting creation guards duplicate submissions',async()=>{
  const source=await readFile(new URL('../worker.js',import.meta.url),'utf8');
  const start=source.indexOf('async function create(e){');
  assert.ok(start>=0);
  const create=source.slice(start,source.indexOf('function chats(){',start));
  assert.ok(create.includes('submit?.disabled'));
  assert.ok(create.includes('finally{'));
});
