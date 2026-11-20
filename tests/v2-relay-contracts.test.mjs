import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
import {v2RelayHandler} from '../v2-relay.js';
import {v2BrowserAsset} from '../v2-browser-assets.js';
import {uploadPage} from '../v2-upload-page.js';
import {viewAlbumPage} from '../v2-view-page.js';

const env={DB:{prepare(){throw Error('Unexpected database access for unauthorized request')}},PHOTOS:{}};
const request=(path,method='GET',headers={})=>new Request('https://luqyak.athat.app'+path,{method,headers});

test('owner delivery list is not available without login',async()=>{
 const response=await v2RelayHandler(request('/api/v2/deliveries'),env);
 assert.equal(response.status,401);
});

test('encrypted upload refuses missing or foreign Origin before reading token',async()=>{
 const invalid=await v2RelayHandler(request('/api/v2/inbox/upload','POST'),env);
 assert.equal(invalid.status,403);
 const cross=await v2RelayHandler(request('/api/v2/inbox/upload','POST',{'origin':'https://evil.example'}),env);
 assert.equal(cross.status,403);
});

test('view-only and upload capabilities cannot be guessed or used without a token',async()=>{
 const noView=await v2RelayHandler(request('/api/v2/view/info'),env);
 assert.equal(noView.status,403);
 const noPhoto=await v2RelayHandler(request('/api/v2/view/photo?id=00000000-0000-4000-8000-000000000000'),env);
 assert.equal(noPhoto.status,403);
 const noUpload=await v2RelayHandler(request('/api/v2/inbox/info'),env);
 assert.equal(noUpload.status,403);
});

test('owner management operations require active session',async()=>{
 const origin={'origin':'https://luqyak.athat.app','content-type':'application/json'};
 const shares=await v2RelayHandler(request('/api/v2/meetups/00000000-0000-4000-8000-000000000000/shares','POST',origin),env);
 assert.equal(shares.status,401);
 const keys=await v2RelayHandler(request('/api/v2/devices','POST',origin),env);
 assert.equal(keys.status,401);
});

test('v2 modules and guest/view pages are served as isolated non-cacheable resources',async()=>{
 const js=v2BrowserAsset('/v2/assets/crypto.js');
 assert.equal(js.status,200);
 assert.match(js.headers.get('content-type'),/javascript/);
 assert.equal(js.headers.get('cache-control'),'no-store');
 const upload=uploadPage(),view=viewAlbumPage();
 assert.equal(upload.headers.get('cache-control'),'no-store');
 assert.equal(view.headers.get('cache-control'),'no-store');
 assert.match(await upload.text(),/v2\/assets\/upload\.js/);
 assert.match(await uploadPage().text(),/capture="environment"/);
 assert.match(await view.text(),/v2\/assets\/view\.js/);
});

test('migration is additive and does not modify legacy schema or R2 objects',()=>{
 const text=readFileSync(new URL('../migrations/20261120_local_first_v2.sql',import.meta.url),'utf8');
 assert.match(text,/CREATE TABLE IF NOT EXISTS lk_v2_photo_queue/);
 assert.match(text,/CREATE TABLE IF NOT EXISTS lk_v2_meetup_windows/);
 assert.doesNotMatch(text,/\b(?:DROP|TRUNCATE|DELETE FROM|ALTER TABLE lk_meetups)\b/i);
});
