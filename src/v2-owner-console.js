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
  const address=location.origin+'/v2/upload/'+link.token;
  $('link').value=address;say('رابط التصوير صالح حتى '+new Date(link.expires_at).toLocaleString('ar-SA'));
 }catch(e){say(e.message)}
};
$('copy').onclick=async()=>{try{if(!$('link').value)return say('أنشئ رابطًا أولًا');await navigator.clipboard.writeText($('link').value);say('تم نسخ رابط التصوير.')}catch(e){say('انسخ الرابط يدويًا من الخانة.')}};
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
