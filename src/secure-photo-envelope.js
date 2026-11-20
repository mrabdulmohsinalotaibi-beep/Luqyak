/**
 * LUQYAK v2 encrypted photo envelope.
 * The relay receives ciphertext, public recipient key material, and opaque identifiers only.
 * IMPORTANT: the caller must protect exported private keys with a user-controlled secret.
 * No plaintext photos, unwrapped AES keys or private keys belong in D1/R2.
 */
const encoder = new TextEncoder();
const VERSION = 1;
const uuid = () => crypto.randomUUID();
const bytes = value => value instanceof Uint8Array ? value : new Uint8Array(value);
const hex = data => [...new Uint8Array(data)].map(x => x.toString(16).padStart(2, '0')).join('');
const context = (meetupId, photoId) => encoder.encode(JSON.stringify({v:VERSION,meetupId,photoId}));

function ensureId(value) {
  if(typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new TypeError('Invalid identifier');
  return value;
}
export async function generateDeviceIdentity() {
  const keys = await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:3072,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);
  return {
    publicKey: await crypto.subtle.exportKey('spki',keys.publicKey),
    privateKey: await crypto.subtle.exportKey('pkcs8',keys.privateKey)
  };
}
export async function sealPhoto({meetupId,photoId=uuid(),photoBytes,recipientPublicKey}) {
  ensureId(meetupId);ensureId(photoId);
  if(!photoBytes || !recipientPublicKey) throw new TypeError('Photo and recipient key required');
  const input = bytes(photoBytes);
  if(input.byteLength===0 || input.byteLength>30*1024*1024) throw new RangeError('Photo outside 1B–30MB limit');
  const publicKey = await crypto.subtle.importKey('spki',recipientPublicKey,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
  const aes = await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:context(meetupId,photoId)},aes,input);
  const rawKey = await crypto.subtle.exportKey('raw',aes);
  const wrappedKey = await crypto.subtle.encrypt({name:'RSA-OAEP'},publicKey,rawKey);
  const sha256=hex(await crypto.subtle.digest('SHA-256',ciphertext));
  return {version:VERSION,meetupId,photoId,iv,wrappedKey,ciphertext,sha256};
}
export async function openPhoto(envelope,recipientPrivateKey) {
  if(envelope?.version!==VERSION) throw new TypeError('Unsupported envelope');
  ensureId(envelope.meetupId);ensureId(envelope.photoId);
  const checksum=hex(await crypto.subtle.digest('SHA-256',envelope.ciphertext));
  if(checksum!==envelope.sha256) throw new Error('Ciphertext integrity mismatch');
  const privateKey=await crypto.subtle.importKey('pkcs8',recipientPrivateKey,{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);
  const rawKey=await crypto.subtle.decrypt({name:'RSA-OAEP'},privateKey,envelope.wrappedKey);
  const aes=await crypto.subtle.importKey('raw',rawKey,{name:'AES-GCM'},false,['decrypt']);
  return crypto.subtle.decrypt({name:'AES-GCM',iv:envelope.iv,additionalData:context(envelope.meetupId,envelope.photoId)},aes,envelope.ciphertext);
}
export async function validateDelivery(envelope) {
  if(envelope?.version!==VERSION) return false;
  ensureId(envelope.meetupId);ensureId(envelope.photoId);
  return hex(await crypto.subtle.digest('SHA-256',envelope.ciphertext))===envelope.sha256;
}
