import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import worker from '../worker.js';

// Isolated integration test against the real Worker router and fake D1.
// No real account is created and no production D1 rows are read or written.
const origin='https://luqyak.athat.app';
const account='00000000-0000-4000-8000-000000000099';
const cookie='__Host-luqyak_session='+('a'.repeat(64));
const digest=async str=>Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(str)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const canonical=j=>JSON.stringify({crv:j.crv,kty:j.kty,x:j.x,y:j.y});
test('login on a second device cannot silently replace existing E2EE identity',async()=>{
  const oldPair=await webcrypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
  const newPair=await webcrypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
  const oldKey=await webcrypto.subtle.exportKey('jwk',oldPair.publicKey);
  const newKey=await webcrypto.subtle.exportKey('jwk',newPair.publicKey);
  const oldFp=await digest(canonical(oldKey)),newFp=await digest(canonical(newKey));
  assert.notEqual(oldFp,newFp);
  let writes=0,reads=0;
  const env={DB:{prepare(sql){
    return {bind(){return {
      async first(){
        reads++;
        if(sql.includes('FROM auth_sessions'))return {id:account,username:'test',email_verified_at:'2026-11-14'};
        if(sql.includes('SELECT fingerprint FROM encrypted_public_keys'))return {fingerprint:oldFp};
        throw Error('Unexpected read '+sql);
      },
      async run(){writes++;throw Error('Must not change remote identity')}
    }}};
  }}};
  const response=await worker.fetch(new Request(origin+'/api/private/key',{
    method:'POST',headers:{cookie,origin,'content-type':'application/json'},
    body:JSON.stringify({public_jwk:newKey,fingerprint:newFp})
  }),env,{waitUntil(){}});
  assert.equal(response.status,409);
  assert.equal((await response.json()).error,'key_already_registered');
  assert.equal(writes,0);
  assert.ok(reads>=2);
});
test('plaintext chat endpoint cannot accept a new message after E2EE migration',async()=>{
  const response=await worker.fetch(new Request(origin+'/api/chat/send',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({text:'should not store'})}),{}, {waitUntil(){}});
  assert.equal(response.status,401);
});
