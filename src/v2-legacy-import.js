// Explicit one-way copy of legacy meetup photos to account-scoped local storage.
// NEVER deletes or changes a legacy Cloudflare photo; user must verify backups before migration.
import {openOwnerStore,saveOwnerPhoto} from './local-owner-inbox.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=async r=>{if(!r.ok)throw new Error('Legacy photo unavailable ('+r.status+')');return r};
export async function importLegacyMeetupPhotos({meetupId,onProgress=()=>{}}){
 if(!UUID.test(meetupId||''))throw new TypeError('Invalid meetup identifier');
 const result=await fail(await fetch('/api/social/meetup?id='+encodeURIComponent(meetupId),{credentials:'same-origin',cache:'no-store'}));
 const data=await result.json();
 const list=data?.item?.photos;
 if(!Array.isArray(list))throw new Error('Legacy photo listing unavailable');
 if(list.length>5000)throw new Error('Import in smaller batches');
 const db=await openOwnerStore();
 let existing;
 try{
  const tx=db.transaction('photos','readonly'),req=tx.objectStore('photos').getAllKeys();
  existing=new Set(await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)}));
 }finally{db.close()}
 let copied=0,skipped=0,failed=0;
 const errors=[];
 for(let i=0;i<list.length;i++){
  const photo=list[i],id=photo?.id;
  if(!UUID.test(id||'')){failed++;errors.push('معرف صورة غير صالح');continue}
  if(existing.has(id)){skipped++;onProgress({done:i+1,total:list.length,copied,skipped,failed});continue}
  try{
   const response=await fail(await fetch('/api/social/photo?id='+encodeURIComponent(meetupId)+'&photo='+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store'}));
   const data=await response.arrayBuffer(),bytes=new Uint8Array(data);
   if(bytes.length<4||bytes.length>30*1024*1024||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw new Error('صيغة JPEG غير صالحة');
   const digest=await crypto.subtle.digest('SHA-256',data);
   const sha=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
   await saveOwnerPhoto({id,meetupId,plain:bytes,sha256:sha});
   existing.add(id);copied++;
  }catch(e){failed++;errors.push(id+': '+e.message)}
  onProgress({done:i+1,total:list.length,copied,skipped,failed});
 }
 return {total:list.length,copied,skipped,failed,errors:errors.slice(0,10)};
}
