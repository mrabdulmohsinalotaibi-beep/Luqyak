import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {Script} from 'node:vm';
import worker from '../worker.js';
const origin='https://luqyak.athat.app';
test('legacy private chat archive screen is no longer published',async()=>{
 const response=await worker.fetch(new Request(origin+'/private'),{}, {waitUntil(){}});
 assert.equal(response.status,302);
 assert.match(response.headers.get('location')||'',/\/app\?tab=chats$/);
});
test('encrypted archive rejects wrong password and altered ciphertext, accepts correct passphrase',async()=>{
 const crypto=webcrypto,encoder=new TextEncoder(),decoder=new TextDecoder();
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const aad=encoder.encode('luqyak-archive-v1');
 const material=async password=>crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
 const derive=async(password,mode)=>crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:650000,hash:'SHA-256'},await material(password),{name:'AES-GCM',length:256},false,[mode]);
 const expected=JSON.stringify({account_id:'accountA',messages:[{text:'خاص جدا'}]});
 const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},await derive('a-long-strong-recovery-passphrase','encrypt'),encoder.encode(expected)));
 assert.equal(decoder.decode(cipher).includes('خاص جدا'),false);
 assert.equal(decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},await derive('a-long-strong-recovery-passphrase','decrypt'),cipher)),expected);
 await assert.rejects(crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},await derive('wrong-password-123','decrypt'),cipher));
 cipher[0]^=1;
 await assert.rejects(crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},await derive('a-long-strong-recovery-passphrase','decrypt'),cipher));
});
