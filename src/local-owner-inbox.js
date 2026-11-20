// Local-first encrypted photo library, partitioned by signed-in account.
// Never store plaintext photo blobs in IndexedDB. Ack relay only after encrypted record readback.
import {openPhoto,sealPhoto,validateDelivery} from './secure-photo-envelope.js';
import {getStoredIdentity} from './v2-device-vault.js';
const DATABASE='luqyak-v2-local-owner',VERSION=1;
const b64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const toB64=value=>{let s='';const bytes=new Uint8Array(value);for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)};
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function currentAccount(){
 const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
 if(!response.ok)throw new Error('Login required for private storage');
 const body=await response.json(),id=body?.user?.id;
 if(!body.authenticated||typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(id))throw new Error('Authenticated account required');
 return id;
}
function requestDone(r){return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function transactionDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Transaction failed'));tx.onabort=()=>reject(tx.error||new Error('Transaction aborted'))})}
export async function openOwnerStore(){
 const accountId=await currentAccount(),r=indexedDB.open(DATABASE+':'+accountId,VERSION);
 r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('photos'))db.createObjectStore('photos',{keyPath:'id'});if(!db.objectStoreNames.contains('meetups'))db.createObjectStore('meetups',{keyPath:'id'})};
 return requestDone(r);
}
export async function saveOwnerPhoto({id,meetupId,plain,sha256,envelope}){
 // For v2 deliveries reuse already encrypted sender envelope; for legacy imports seal locally with owner public key.
 if(!envelope){
  if(!plain)throw new Error('Photo bytes required');
  const identity=await getStoredIdentity();if(!identity)throw new Error('Register local device key before importing legacy photos');
  envelope=await sealPhoto({meetupId,photoId:id,photoBytes:plain,recipientPublicKey:b64(identity.public_key_spki)});
 }
 if(envelope.meetupId!==meetupId||envelope.photoId!==id||!await validateDelivery(envelope))throw new Error('Encrypted envelope verification failed');
 const cipher= new Uint8Array(envelope.ciphertext);
 const record={id,meetupId,bytes:new Blob([cipher],{type:'application/octet-stream'}),ciphertextSha256:envelope.sha256,
  wrappedKey:toB64(envelope.wrappedKey),iv:toB64(envelope.iv),version:envelope.version,encrypted:true,
  sourceSha256:sha256||null,savedAt:Date.now()};
 const db=await openOwnerStore();
 try{
  const tx=db.transaction(['photos'],'readwrite'),done=transactionDone(tx);
  tx.objectStore('photos').put(record);await done;
  const verify=db.transaction(['photos'],'readonly');
  const item=await requestDone(verify.objectStore('photos').get(id));
  if(!item?.encrypted||item.meetupId!==meetupId||item.bytes?.size!==cipher.byteLength)throw new Error('Local encrypted storage verification failed');
  const diskHash=hex(await crypto.subtle.digest('SHA-256',await item.bytes.arrayBuffer()));
  if(diskHash!==envelope.sha256)throw new Error('Local encrypted storage content mismatch');
  return item;
 }finally{db.close()}
}
export async function getDecryptedOwnerPhotos({meetupId,privateKey,onProgress=()=>{}}){
 if(!privateKey)throw new Error('Unlock local device key before viewing photos');
 const db=await openOwnerStore();let items;
 try{
  const req=db.transaction('photos','readonly').objectStore('photos').getAll();
  items=await requestDone(req);
 }finally{db.close()}
 const subset=items.filter(item=>!meetupId||item.meetupId===meetupId).sort((a,b)=>a.savedAt-b.savedAt),out=[];
 for(let i=0;i<subset.length;i++){
  const p=subset[i];
  if(!p.encrypted)throw new Error('Found older unencrypted local photo. Export it safely before upgrading.');
  const envelope={version:p.version,meetupId:p.meetupId,photoId:p.id,ciphertext:await p.bytes.arrayBuffer(),
   iv:b64(p.iv),wrappedKey:b64(p.wrappedKey),sha256:p.ciphertextSha256};
  if(!await validateDelivery(envelope))throw new Error('Encrypted photo integrity error: '+p.id);
  const plain=await openPhoto(envelope,privateKey),sample=new Uint8Array(plain);
  const type=sample[0]===255&&sample[1]===216?'image/jpeg':sample[0]===137&&sample[1]===80?'image/png':sample[0]===82&&sample[1]===73&&sample[2]===70?'image/webp':'application/octet-stream';
  out.push({...p,bytes:new Blob([plain],{type})});
  onProgress({done:i+1,total:subset.length});
 }
 return out;
}
export async function receivePending({deviceId,privateKey,onProgress=()=>{}}){
 if(!/^[0-9a-f-]{36}$/i.test(deviceId))throw new TypeError('Invalid device ID');
 const options={credentials:'same-origin',cache:'no-store'};
 const list=await fetch('/api/v2/deliveries?device_id='+encodeURIComponent(deviceId),options);
 if(!list.ok)throw new Error('Cannot list pending deliveries');
 const {items}=await list.json(),results=[];
 for(const item of items){
  try{
   const r=await fetch('/api/v2/deliveries/'+encodeURIComponent(item.photo_id),options);
   if(!r.ok)throw new Error('Cannot download encrypted photo');
   const ciphertext=await r.arrayBuffer();
   const envelope={version:item.version,meetupId:item.meetup_id,photoId:item.photo_id,ciphertext,iv:b64(item.iv),wrappedKey:b64(item.wrapped_key),sha256:item.ciphertext_sha256};
   if(!await validateDelivery(envelope))throw new Error('Invalid encrypted payload');
   await openPhoto(envelope,privateKey); // authenticate AES-GCM before any acknowledgement
   await saveOwnerPhoto({id:item.photo_id,meetupId:item.meetup_id,sha256:item.ciphertext_sha256,envelope});
   const receipt=await fetch('/api/v2/deliveries/'+encodeURIComponent(item.photo_id)+'/ack',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({durable:true,sha256:item.ciphertext_sha256})});
   if(!receipt.ok)throw new Error('Saved locally but relay receipt failed; retry safely');
   results.push({id:item.photo_id,status:'saved'});
   onProgress({photoId:item.photo_id,status:'saved'});
  }catch(error){
   results.push({id:item.photo_id,status:'error',message:error.message});
   onProgress({photoId:item.photo_id,status:'error',message:error.message});
  }
 }
 return results;
}
