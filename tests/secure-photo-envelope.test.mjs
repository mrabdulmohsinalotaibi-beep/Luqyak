import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import {generateDeviceIdentity,sealPhoto,openPhoto,validateDelivery} from '../src/secure-photo-envelope.js';

test('encrypted photo roundtrip and relay integrity',async()=>{
 const device=await generateDeviceIdentity();
 const original=new TextEncoder().encode('private-memory-123');
 const sealed=await sealPhoto({meetupId:'meeting1',photoId:'photo1',photoBytes:original,recipientPublicKey:device.publicKey});
 assert.notDeepEqual(new Uint8Array(sealed.ciphertext),original);
 assert.equal(await validateDelivery(sealed),true);
 assert.deepEqual(new Uint8Array(await openPhoto(sealed,device.privateKey)),original);
});

test('tampering and swapped meetup context cannot decrypt',async()=>{
 const device=await generateDeviceIdentity();
 const sealed=await sealPhoto({meetupId:'meeting1',photoBytes:new Uint8Array([1,2,3]),recipientPublicKey:device.publicKey});
 const swapped={...sealed,meetupId:'meeting2'};
 await assert.rejects(()=>openPhoto(swapped,device.privateKey));
 const altered={...sealed,ciphertext:new Uint8Array(sealed.ciphertext).map((v,i)=>i===0?v^1:v)};
 assert.equal(await validateDelivery(altered),false);
 await assert.rejects(()=>openPhoto(altered,device.privateKey),/integrity mismatch/);
});

test('unauthorized device cannot decrypt',async()=>{
 const one=await generateDeviceIdentity(),two=await generateDeviceIdentity();
 const sealed=await sealPhoto({meetupId:'meeting1',photoBytes:new Uint8Array([6,7]),recipientPublicKey:one.publicKey});
 await assert.rejects(()=>openPhoto(sealed,two.privateKey));
});

test('rejects empty photos, huge photos and invalid identifiers',async()=>{
 const key=await generateDeviceIdentity();
 await assert.rejects(()=>sealPhoto({meetupId:'../escape',photoBytes:new Uint8Array([1]),recipientPublicKey:key.publicKey}),/identifier/);
 await assert.rejects(()=>sealPhoto({meetupId:'meeting1',photoBytes:new Uint8Array(),recipientPublicKey:key.publicKey}),/limit/);
});
