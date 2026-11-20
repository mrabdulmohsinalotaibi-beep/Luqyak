// Local durable owner inbox: never acknowledge relay receipt before IndexedDB commit.
// Private key is supplied by an unlocked owner and is never persisted here.
import {openPhoto,validateDelivery} from './secure-photo-envelope.js';
const DATABASE='luqyak-v2-local-owner',VERSION=1;
const b64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
function requestDone(r){return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function transactionDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Transaction aborted'))})}
export async function openOwnerStore(){
 const r=indexedDB.open(DATABASE,VERSION);
 r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('photos'))db.createObjectStore('photos',{keyPath:'id'});if(!db.objectStoreNames.contains('meetups'))db.createObjectStore('meetups',{keyPath:'id'})};
 return requestDone(r);
}
export async function saveOwnerPhoto({id,meetupId,plain,sha256}){
 const db=await openOwnerStore();
 try{
  const tx=db.transaction(['photos'],'readwrite');
  const done=transactionDone(tx);
  tx.objectStore('photos').put({id,meetupId,bytes:new Blob([plain]),sha256,savedAt:Date.now()});
  await done;
  // Confirm persisted data can be read after the write transaction has committed.
  const verify=db.transaction(['photos'],'readonly');
  const item=await requestDone(verify.objectStore('photos').get(id));
  if(!item?.bytes||item.bytes.size!==plain.byteLength||item.sha256!==sha256)throw new Error('Local storage verification failed');
  return item;
 }finally{db.close()}
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
   const plain=await openPhoto(envelope,privateKey);
   await saveOwnerPhoto({id:item.photo_id,meetupId:item.meetup_id,plain,sha256:item.ciphertext_sha256});
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
