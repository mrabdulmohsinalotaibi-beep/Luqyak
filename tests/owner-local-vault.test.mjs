import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ownerLocalVaultResponse} from '../owner-local-vault-response.js';

test('local owner vault is self-hosted and encrypts bytes with AES-GCM',async()=>{
 const r=ownerLocalVaultResponse();
 assert.equal(r.status,200);
 assert.match(r.headers.get('content-type'),/text\/javascript/);
 assert.match(r.headers.get('cache-control'),/no-store/);
 const source=await r.text();
 assert.match(source,/indexedDB\.open/);
 assert.match(source,/AES-GCM/);
 assert.match(source,/false,\['encrypt','decrypt'\]/);
 assert.match(source,/additionalData/);
 assert.match(source,/credentials:'same-origin'/);
 assert.match(source,/cache:'no-store'/);
 assert.doesNotMatch(source,/localStorage|eval\(|https:\/\//);
});
test('owner photo storage is an explicit opt-in control, not an automatic background upload',()=>{
 const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 const i=worker.indexOf('async function share(){');
 const j=worker.indexOf('function album(){',i);
 const ui=worker.slice(i,j);
 assert.ok(i>=0&&j>i);
 assert.match(ui,/saveMeetupToDevice/);
 assert.match(ui,/saveLocal\.onclick/);
 assert.match(ui,/النسخة المحلية/);
 assert.match(ui,/قد تُفقد/);
 assert.match(worker,/ownerLocalVaultResponse\(\)/);
});

test('owner can list and preview encrypted photos without re-fetching server media',async()=>{
 const source=await ownerLocalVaultResponse().text();
 assert.match(source,/export async function listLocalPhotos/);
 assert.match(source,/export async function getLocalPhoto/);
 assert.match(source,/crypto\.subtle\.decrypt/);
 const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 const ui=worker.slice(worker.indexOf('async function share(){'),worker.indexOf('function album(){',worker.indexOf('async function share(){')));
 assert.match(ui,/browseLocal\.onclick/);
 assert.match(ui,/listLocalPhotos\(m\.id\)/);
 assert.match(ui,/getLocalPhoto\(m\.id,entry\.photoId\)/);
 assert.match(ui,/URL\.revokeObjectURL/);
});
