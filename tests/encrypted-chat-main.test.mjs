import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import worker from '../worker.js';

// Cryptographic round-trip for two isolated simulated identities.
// This is not a live two-account or two-device acceptance test.
const crypto=webcrypto;
const enc=new TextEncoder(),dec=new TextDecoder();
async function derive(privateKey,publicKey,salt,usage){
 const bits=await crypto.subtle.deriveBits({name:'ECDH',public:publicKey},privateKey,256);
 const base=await crypto.subtle.importKey('raw',bits,'HKDF',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt,info:enc.encode('luqyak/private/v1')},base,{name:'AES-GCM',length:256},false,[usage]);
}
test('two simulated accounts exchange authenticated ciphertext, never plaintext',async()=>{
 const alice=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
 const bob=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
 const mallory=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const plain=enc.encode(JSON.stringify({type:'message',body:'اختبار سري بين الحسابين'}));
 const senderKey=await derive(alice.privateKey,bob.publicKey,salt,'encrypt');
 const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},senderKey,plain));
 assert.equal(dec.decode(ciphertext).includes('اختبار سري'),false);
 const recipientKey=await derive(bob.privateKey,alice.publicKey,salt,'decrypt');
 assert.deepEqual(new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv},recipientKey,ciphertext)),plain);
 const foreignKey=await derive(mallory.privateKey,alice.publicKey,salt,'decrypt');
 await assert.rejects(crypto.subtle.decrypt({name:'AES-GCM',iv},foreignKey,ciphertext));
 const corrupted=ciphertext.slice();corrupted[0]^=1;
 await assert.rejects(crypto.subtle.decrypt({name:'AES-GCM',iv},recipientKey,corrupted));
});
test('social app provides a private friends circle without chat controls',async()=>{
 const response=await worker.fetch(new Request('https://luqyak.athat.app/app'),{},{waitUntil(){}});
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/دائرة أصدقائي/);
 assert.match(html,/دائرتي<\/button>/);
 assert.match(html,/lkAddFriendForm/);
 assert.doesNotMatch(html,/فتح المحادثات المشفّرة<\/a>/);
});
