import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import { RECOVERY_MODULE } from '../crypto/recovery-browser.mjs';

const {sealRecovery,openRecovery}=await import('data:text/javascript;base64,'+Buffer.from(RECOVERY_MODULE).toString('base64'));
const accountA='00000000-0000-4000-8000-000000000010';
const accountB='00000000-0000-4000-8000-000000000011';
const passphrase='a deliberately unique recovery passphrase 2026';
async function newIdentity(account){
 const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 return {v:1,account_id:account,private_jwk:await crypto.subtle.exportKey('jwk',pair.privateKey),public_jwk:await crypto.subtle.exportKey('jwk',pair.publicKey),rooms:[{id:'room-a',members:[]}],messages:[{id:'message-a',account_id:account,text:'encrypted in the archive'}]};
}

test('recovery module is served as no-store JavaScript and encrypted chats are the default entrypoint',async()=>{
 const ctx={waitUntil(){}};
 let response=await worker.fetch(new Request('https://luqyak.athat.app/crypto/recovery.mjs'),{},ctx);
 assert.equal(response.status,200);
 assert.match(response.headers.get('content-type'),/javascript/);
 assert.match(response.headers.get('cache-control'),/no-store/);
 assert.equal(await response.text(),RECOVERY_MODULE);
 response=await worker.fetch(new Request('https://luqyak.athat.app/private'),{},ctx);
 assert.equal(response.status,200);
 const page=await response.text();
 assert.match(page,/lkBackupExport/);
 assert.match(page,/lkBackupImport/);
 assert.match(page,/crypto\/recovery\.mjs/);
 assert.match(page,/lkRecoveryPassword/);
 const {Script}=await import('node:vm');
 for(const script of page.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g))new Script(script[1]);
});
test('two isolated synthetic accounts recover only their own key, rooms and messages',async()=>{
 const a=await newIdentity(accountA),b=await newIdentity(accountB);
 const [archiveA,archiveB]=await Promise.all([sealRecovery(a,passphrase),sealRecovery(b,passphrase)]);
 assert.doesNotMatch(archiveA,/encrypted in the archive/);
 assert.doesNotMatch(archiveA,/"private_jwk"/);
 assert.notEqual(archiveA,archiveB);
 const restoredA=await openRecovery(archiveA,passphrase,accountA);
 const restoredB=await openRecovery(archiveB,passphrase,accountB);
 assert.deepEqual(restoredA.data.messages,a.messages);
 assert.deepEqual(restoredB.data.rooms,b.rooms);
 await assert.rejects(openRecovery(archiveA,passphrase,accountB),/backup_account_mismatch/);
 await assert.rejects(openRecovery(archiveA,'incorrect password',accountA),/wrong_password_or_corrupted_backup/);
 const altered=JSON.parse(archiveA);altered.ciphertext=altered.ciphertext.slice(0,-5)+'AAAAA';
 await assert.rejects(openRecovery(JSON.stringify(altered),passphrase,accountA));
 const pubB=await crypto.subtle.importKey('jwk',b.public_jwk,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const oldPriv=await crypto.subtle.importKey('jwk',a.private_jwk,{name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
 const left=await crypto.subtle.deriveBits({name:'ECDH',public:pubB},oldPriv,256);
 const newPriv=restoredA.pair.privateKey;
 const right=await crypto.subtle.deriveBits({name:'ECDH',public:pubB},newPriv,256);
 assert.deepEqual(new Uint8Array(left),new Uint8Array(right));
 assert.equal(newPriv.extractable,false);
});
test('recovery requires a strong passphrase and enforces schema',async()=>{
 const a=await newIdentity(accountA);
 await assert.rejects(sealRecovery(a,'short'),/recovery_password_too_short/);
 await assert.rejects(openRecovery('{}',passphrase,accountA),/unsupported_backup_format/);
});
