import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import worker from '../worker.js';

test('private chat includes opt-in identity backup and recovery controls',async()=>{
 const response=await worker.fetch(new Request('https://luqyak.athat.app/private'),{}, {waitUntil(){}});
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/lkMakeRecoverableIdentity/);
 assert.match(html,/lkImportIdentityBackup/);
 assert.match(html,/luqyak-encrypted-identity/);
 assert.match(html,/remote\.key\.fingerprint!==bundle\.fingerprint/);
 assert.match(html,/لم تؤكد حفظ نسخة المفتاح/);
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.ok(scripts.length>0);
 for(const [,script] of scripts)new Script(script);
});
test('new-device key is never silently overwritten and recovery remains account bound',async()=>{
 const html=await (await worker.fetch(new Request('https://luqyak.athat.app/private'),{}, {waitUntil(){}})).text();
 assert.match(html,/bundle\.account_id!==account\.id/);
 assert.match(html,/await put\('settings',\{privateKey,publicKey\},'keypair:'\+account\.id\)/);
 assert.match(html,/if\(!account\|\|!myPair\|\|!keyConflict\)/);
 assert.match(html,/privateKey=await crypto\.subtle\.importKey\('jwk',jwk,\{name:'ECDH',namedCurve:'P-256'\},false/);
});
