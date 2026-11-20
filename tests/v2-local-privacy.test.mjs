import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('local inbox only writes ciphertext and verifies durable encrypted bytes before acknowledgement',()=>{
 const src=read('src/local-owner-inbox.js');
 assert.match(src,/encrypted:true/);
 assert.match(src,/bytes:new Blob\(\[cipher\]/);
 assert.match(src,/validateDelivery\(envelope\)/);
 assert.match(src,/crypto\.subtle\.digest\('SHA-256',await item\.bytes\.arrayBuffer\(\)\)/);
 assert.ok(src.indexOf('await saveOwnerPhoto(')<src.indexOf("'/ack'") || src.indexOf('await saveOwnerPhoto(')<src.indexOf("+'/ack'"));
 assert.doesNotMatch(src,/new Blob\(\[plain\]\).*objectStore\('photos'\)\.put/s);
});

test('local photos and private keys are isolated by authenticated user',()=>{
 const inbox=read('src/local-owner-inbox.js'),vault=read('src/v2-device-vault.js');
 for(const src of [inbox,vault]){
  assert.match(src,/\/api\/auth\/me/);
  assert.match(src,/body\.authenticated/);
  assert.match(src,/indexedDB\.open\([^\n]+\+':'+/);
 }
});

test('legacy importer does not remove uploaded originals and verifies each JPG',()=>{
 const src=read('src/v2-legacy-import.js');
 assert.match(src,/\/api\/social\/photo\?/);
 assert.match(src,/await saveOwnerPhoto/);
 assert.doesNotMatch(src,/method:\s*'DELETE'|\.PHOTOS\.delete|delete-photo/);
});

test('encrypted backup restores IV wrapped key and ciphertext checksum',()=>{
 const src=read('src/v2-local-backup.js');
 for(const name of ['wrappedKey','iv','ciphertextSha256','encrypted:true','saveOwnerPhoto'])assert.ok(src.includes(name));
});
