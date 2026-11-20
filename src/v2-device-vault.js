// Owner keys live only in encrypted local browser storage, never in Cloudflare.
import {generateDeviceIdentity} from './secure-photo-envelope.js';
const DB='luqyak-v2-key-vault';
const encoder=new TextEncoder();
const b64=b=>{const bytes=new Uint8Array(b);let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out)};
const unb64=s=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));
function req(r){return new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
async function db(){
 const r=indexedDB.open(DB,1);
 r.onupgradeneeded=()=>r.result.createObjectStore('keys',{keyPath:'id'});
 return req(r);
}
async function transaction(mode,action){
 const d=await db();
 try{
  const tx=d.transaction('keys',mode),done=new Promise((ok,no)=>{tx.oncomplete=ok;tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error)});
  const result=await action(tx.objectStore('keys'));
  await done;return result;
 }finally{d.close()}
}
async function derive(password,salt){
 const input=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},input,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function getStoredIdentity(){
 return transaction('readonly',store=>req(store.get('owner')));
}
export async function createStoredIdentity(passphrase){
 if(typeof passphrase!=='string'||passphrase.length<12)throw Error('استخدم عبارة حماية من 12 حرفًا على الأقل');
 if(await getStoredIdentity())throw Error('يوجد مفتاح جهاز بالفعل؛ صدّر نسخته الاحتياطية بدل استبداله');
 const identity=await generateDeviceIdentity();
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await derive(passphrase,salt),ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,identity.privateKey);
 const doc={id:'owner',version:1,device_id:crypto.randomUUID(),public_key_spki:b64(identity.publicKey),private_key_encrypted:b64(ciphertext),salt:b64(salt),iv:b64(iv),created_at:Date.now()};
 await transaction('readwrite',store=>req(store.add(doc)));
 return doc;
}
export async function unlockStoredIdentity(passphrase){
 const record=await getStoredIdentity();if(!record)throw Error('لا يوجد مفتاح محفوظ على هذا الجهاز');
 try{
  const key=await derive(passphrase,unb64(record.salt));
  const privateKey=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(record.iv)},key,unb64(record.private_key_encrypted));
  return {deviceId:record.device_id,publicKeySpki:record.public_key_spki,privateKey};
 }catch(e){throw Error('عبارة الحماية غير صحيحة أو بيانات المفتاح تالفة')}
}
export async function exportEncryptedIdentity(){
 const record=await getStoredIdentity();if(!record)throw Error('أنشئ مفتاح الجهاز أولًا');
 return new Blob([JSON.stringify(record,null,2)],{type:'application/json'});
}
export async function restoreEncryptedIdentity(json){
 const value=typeof json==='string'?JSON.parse(json):json;
 if(value?.version!==1||value.id!=='owner'||!/^[0-9a-f-]{36}$/i.test(value.device_id||'')||!value.private_key_encrypted||!value.public_key_spki||!value.salt||!value.iv)throw Error('ملف الاستعادة غير صالح');
 if(await getStoredIdentity())throw Error('المفتاح الحالي محفوظ؛ لا يمكن استبداله تلقائيًا');
 await transaction('readwrite',store=>req(store.add(value)));
 return value;
}
