// Explicit encrypted local photo backup in bounded volumes; no server upload.
import {openOwnerStore,saveOwnerPhoto} from './local-owner-inbox.js';
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=b=>{const u=new Uint8Array(b);let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode(...u.subarray(i,i+8192));return btoa(s)};
const unb64=s=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));
async function key(pass,salt){
 if(typeof pass!=='string'||pass.length<12)throw Error('عبارة النسخ الاحتياطي يجب أن تتكون من 12 حرفًا على الأقل');
 const material=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function allPhotos(meetupId){
 const db=await openOwnerStore();
 try{
  const tx=db.transaction('photos','readonly'),req=tx.objectStore('photos').getAll();
  const items=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});
  return items.filter(x=>x.meetupId===meetupId).sort((a,b)=>a.savedAt-b.savedAt);
 }finally{db.close()}
}
export async function exportEncryptedPhotoBackup(meetupId,passphrase,onProgress=()=>{}){
 if(!/^[0-9a-f-]{36}$/i.test(meetupId))throw Error('معرف اللقاء غير صالح');
 const photos=await allPhotos(meetupId);
 if(!photos.length)throw Error('لا توجد صور محلية لنسخها احتياطيًا');
 const volumes=[];let pending=[],size=0,done=0;
 const flush=async()=>{
  if(!pending.length)return;
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const payload=enc.encode(JSON.stringify({meetupId,photos:pending,version:1}));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(passphrase,salt),payload);
  const blob=new Blob([JSON.stringify({format:'luqyak-photo-backup-v1',salt:b64(salt),iv:b64(iv),ciphertext:b64(ciphertext)})],{type:'application/json'});
  volumes.push({fileName:'luqyak-photos-'+meetupId+'-part-'+(volumes.length+1)+'.json',blob,count:pending.length});
  pending=[];size=0;
 };
 for(const item of photos){
  const bytes=new Uint8Array(await item.bytes.arrayBuffer());
  if(size+bytes.length>20*1024*1024&&pending.length)await flush();
  if(!item.encrypted||!item.wrappedKey||!item.iv||!item.ciphertextSha256)throw Error('Found unprotected legacy local photo; migrate before backup');
  pending.push({id:item.id,meetupId,savedAt:item.savedAt,encrypted:true,version:item.version,iv:item.iv,wrappedKey:item.wrappedKey,ciphertextSha256:item.ciphertextSha256,data:b64(bytes)});
  size+=bytes.length;done++;onProgress({done,total:photos.length});
  if(size>=20*1024*1024)await flush();
 }
 await flush();
 return volumes;
}
export async function importEncryptedPhotoBackup(file,passphrase){
 const doc=typeof file==='string'?JSON.parse(file):file;
 if(doc?.format!=='luqyak-photo-backup-v1')throw Error('ملف النسخة الاحتياطية ليس من لُقياك');
 let payload;
 try{
  const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(doc.iv)},await key(passphrase,unb64(doc.salt)),unb64(doc.ciphertext));
  payload=JSON.parse(dec.decode(decrypted));
 }catch(e){throw Error('فشل فك النسخة: عبارة الحماية غير صحيحة أو الملف تالف')}
 if(payload.version!==1||!/^[0-9a-f-]{36}$/i.test(payload.meetupId||'')||!Array.isArray(payload.photos)||payload.photos.length>100)throw Error('محتويات النسخة غير صالحة');
 let count=0;
 for(const photo of payload.photos){
  if(!/^[0-9a-f-]{36}$/i.test(photo.id||'')||photo.meetupId!==payload.meetupId||typeof photo.data!=='string'||photo.data.length>45*1024*1024)throw Error('بيانات صورة غير صالحة');
  if(photo.encrypted!==true||!photo.iv||!photo.wrappedKey||!photo.ciphertextSha256||photo.version!==1)throw Error('Encrypted photo envelope missing');
  const bytes=unb64(photo.data),envelope={version:photo.version,meetupId:photo.meetupId,photoId:photo.id,ciphertext:bytes,
   iv:unb64(photo.iv),wrappedKey:unb64(photo.wrappedKey),sha256:photo.ciphertextSha256};
  await saveOwnerPhoto({id:photo.id,meetupId:photo.meetupId,envelope});
  count++;
 }
 return {meetupId:payload.meetupId,count};
}
