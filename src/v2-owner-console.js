import {getStoredIdentity,createStoredIdentity,unlockStoredIdentity,exportEncryptedIdentity,restoreEncryptedIdentity} from './v2-device-vault.js';
import {receivePending,openOwnerStore} from './local-owner-inbox.js';
import {createLocalPdfVolumes} from './v2-local-pdf.js';
const $=id=>document.getElementById(id),say=t=>{$('status').textContent=t};
let identity;
const fetchJson=async(url,options={})=>{const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options}),b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error||'تعذر تنفيذ الطلب');return b};
const formBody=b=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});
const saveBlob=(blob,name)=>{const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),45000)};
const meetupId=()=>{const id=$('meetupId').value.trim();if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('أدخل معرّف اللقاء الصحيح');return id};
async function register(record){
 await fetchJson('/api/v2/devices',formBody({device_id:record.device_id,public_key_spki:record.public_key_spki}));
}
async function init(){
 identity=await getStoredIdentity();
 say(identity?'هذا الجهاز يحتوي على مفتاح محمي. افتحه بعبارة الحماية لاستلام الصور.':'أنشئ مفتاحًا لهذا الجهاز ثم حمّل نسخته الاحتياطية المشفرة قبل مشاركة أي رابط.');
}
$('createDevice').onclick=async()=>{
 const pass=$('passphrase').value;
 try{
  $('createDevice').disabled=true;
  identity=await createStoredIdentity(pass);
  await register(identity);
  $('passphrase').value='';
  say('تم إنشاء مفتاح الجهاز وتسجيل مفتاحه العام. احفظ النسخة الاحتياطية المشفرة الآن.');
 }catch(e){say(e.message)}finally{$('createDevice').disabled=false}
};
$('backup').onclick=async()=>{try{saveBlob(await exportEncryptedIdentity(),'luqyak-device-backup-encrypted.json');say('احفظ النسخة المشفرة بمكان آمن؛ يلزم معها تذكر عبارة الحماية.')}catch(e){say(e.message)}};
$('restore').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const doc=await restoreEncryptedIdentity(await f.text());identity=doc;await register(doc);say('تم استعادة المفتاح المشفر وتسجيل الجهاز.')}catch(e){say(e.message)}finally{e.target.value=''}};
$('receive').onclick=async()=>{
 try{
  $('receive').disabled=true;const unlocked=await unlockStoredIdentity($('passphrase').value);
  const out=await receivePending({deviceId:unlocked.deviceId,privateKey:unlocked.privateKey,onProgress:p=>say('الصور: '+p.photoId+' — '+p.status)});
  say(out.length?'نتيجة الاستلام: '+out.filter(x=>x.status==='saved').length+' محفوظة، '+out.filter(x=>x.status==='error').length+' تحتاج إعادة المحاولة.':'لا توجد صور جديدة تنتظر الاستلام.');
 }catch(e){say(e.message)}finally{$('receive').disabled=false}
};
$('share').onclick=async()=>{
 try{
  if(!identity)throw Error('أنشئ مفتاح هذا الجهاز أولًا');
  const id=meetupId(),hours=Number($('duration').value);
  const link=await fetchJson('/api/v2/meetups/'+encodeURIComponent(id)+'/shares',formBody({scope:'upload',hours}));
  localStorage.setItem('luqyak:v2:last-share:'+id,link.id);
  const address=location.origin+'/v2/upload/'+link.token;
  $('link').value=address;say('رابط التصوير صالح حتى '+new Date(link.expires_at).toLocaleString('ar-SA'));
 }catch(e){say(e.message)}
};
$('copy').onclick=async()=>{try{if(!$('link').value)return say('أنشئ رابطًا أولًا');await navigator.clipboard.writeText($('link').value);say('تم نسخ رابط التصوير.')}catch(e){say('انسخ الرابط يدويًا من الخانة.')}};
const b64=b=>{const u=new Uint8Array(b);let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode(...u.subarray(i,i+8192));return btoa(s)};
const base64url=b=>b64(b).split('+').join('-').split('/').join('_').replace(/=+$/,'');
const inferType=bytes=>bytes[0]===255&&bytes[1]===216?'image/jpeg':bytes[0]===137&&bytes[1]===80?'image/png':bytes[0]===82&&bytes[1]===73&&bytes[2]===70?'image/webp':null;
$('extend').onclick=async()=>{
 try{
  const id=meetupId(),shareId=localStorage.getItem('luqyak:v2:last-share:'+id);
  if(!shareId)throw Error('أنشئ رابط التصوير أولًا على هذا الجهاز');
  const out=await fetchJson('/api/v2/shares/'+encodeURIComponent(shareId)+'/extend',formBody({hours:Number($('duration').value)}));
  say('تم تمديد استقبال الصور حتى '+new Date(out.expires_at).toLocaleString('ar-SA')+'. سيبقى الرابط السابق صالحًا.');
 }catch(e){say(e.message)}
};
$('close').onclick=async()=>{
 try{
  const id=meetupId();
  if(!confirm('هل تريد إيقاف استقبال صور جديدة لهذا اللقاء؟ ستظل الصور المرسلة سابقًا في قائمة الاستلام.'))return;
  await fetchJson('/api/v2/meetups/'+encodeURIComponent(id)+'/close',formBody({}));
  say('تم إغلاق استقبال الصور. روابط المشاهدة الحالية لا تتأثر.');
 }catch(e){say(e.message)}
};
$('shareView').onclick=async()=>{
 let db;
 try{
  $('shareView').disabled=true;
  const id=meetupId(),hours=Number($('viewDuration').value);
  db=await openOwnerStore();
  const tx=db.transaction('photos','readonly'),req=tx.objectStore('photos').getAll();
  const items=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});
  const photos=items.filter(x=>x.meetupId===id).sort((a,b)=>a.savedAt-b.savedAt).slice(0,100);
  if(!photos.length)throw Error('استلم صور اللقاء على جهازك أولًا قبل مشاركة الألبوم');
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt']);
  const secret=await crypto.subtle.exportKey('raw',key);
  const share=await fetchJson('/api/v2/meetups/'+encodeURIComponent(id)+'/shares',formBody({scope:'view',hours,allow_pdf:$('allowPdf').checked}));
  try{
   for(let i=0;i<photos.length;i++){
    const raw=new Uint8Array(await photos[i].bytes.arrayBuffer()),type=inferType(raw);
    if(!type)throw Error('صيغة صورة غير مدعومة ضمن الألبوم');
    const photoId=crypto.randomUUID(),iv=crypto.getRandomValues(new Uint8Array(12));
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id+':'+photoId)},key,raw);
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',ciphertext))].map(x=>x.toString(16).padStart(2,'0')).join('');
    const resp=await fetch('/api/v2/meetups/'+encodeURIComponent(id)+'/view-photos?share_id='+encodeURIComponent(share.id),{
     method:'POST',credentials:'same-origin',headers:{'content-type':'application/octet-stream','x-luqyak-photo-id':photoId,
       'x-luqyak-iv':b64(iv),'x-luqyak-sha256':hash,'x-luqyak-media-type':type},body:ciphertext
    });
    if(!resp.ok)throw Error('تعذر إعداد الصورة رقم '+(i+1));
    say('تجهيز رابط المشاهدة: '+(i+1)+' من '+photos.length);
   }
   $('viewLink').value=location.origin+'/v2/view/'+share.token+'#key='+base64url(secret);
   say('رابط الألبوم جاهز للمشاهدة فقط؛ يحتفظ الوسيط بنسخ مشفّرة حتى انتهاء الصلاحية.');
  }catch(e){
   await fetchJson('/api/v2/shares/'+encodeURIComponent(share.id)+'/revoke',formBody({})).catch(()=>{});
   throw e;
  }
 }catch(e){say(e.message)}finally{db?.close();$('shareView').disabled=false}
};
$('copyView').onclick=async()=>{try{if(!$('viewLink').value)return say('أنشئ رابط المشاهدة أولًا');await navigator.clipboard.writeText($('viewLink').value);say('تم نسخ رابط المشاهدة.')}catch(e){say('يمكن نسخ رابط المشاهدة يدويًا')}};

$('exportPdf').onclick=async()=>{
 let db;
 try{
  $('exportPdf').disabled=true;
  const id=meetupId();db=await openOwnerStore();
  const tx=db.transaction('photos','readonly'),req=tx.objectStore('photos').getAll();
  const items=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)});
  const local=items.filter(item=>item.meetupId===id).sort((a,b)=>a.savedAt-b.savedAt);
  if(!local.length)throw Error('لا توجد صور محفوظة لهذا اللقاء على هذا الجهاز');
  const docs=await createLocalPdfVolumes({title:$('title').value||'ذكريات اللقاء',photos:local,onProgress:p=>say('إنشاء PDF: '+p.done+' من '+p.total)});
  const out=$('pdfLinks');out.replaceChildren();
  for(const doc of docs){
   const url=URL.createObjectURL(doc.blob),a=document.createElement('a');a.href=url;a.download=doc.fileName;a.textContent='حفظ '+doc.fileName+' ('+doc.pages+' صفحات)';a.className='download';out.append(a);
  }
  say('ملفات PDF جاهزة للحفظ داخل جهازك دون رفعها للخادم.');
 }catch(e){say(e.message)}finally{db?.close();$('exportPdf').disabled=false}
};
init().catch(e=>say(e.message));
