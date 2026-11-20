import {createLocalPdfVolumes} from './v2-local-pdf.js';
const $=id=>document.getElementById(id),say=t=>{$('status').textContent=t};
const token=location.pathname.split('/').pop();
const unb64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),x=>x.charCodeAt(0));
const digest=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('');
const photos=[],objectUrls=[];
const fetchJson=async url=>{const r=await fetch(url,{cache:'no-store',credentials:'same-origin'}),b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error||'الرابط غير متاح');return b};
window.addEventListener('pagehide',()=>objectUrls.forEach(URL.revokeObjectURL));
async function start(){
 try{
  if(!/^[a-f0-9]{64}$/i.test(token))throw Error('رابط الألبوم غير صالح');
  const secret=new URLSearchParams(location.hash.slice(1)).get('key');
  if(!secret||unb64(secret).length!==32)throw Error('رابط العرض لا يحتوي على مفتاح فك التشفير');
  const key=await crypto.subtle.importKey('raw',unb64(secret),{name:'AES-GCM'},false,['decrypt']);
  const info=await fetchJson('/api/v2/view/info?token='+encodeURIComponent(token));
  $('title').textContent=info.title||'ذكريات اللقاء';
  $('expiry').textContent='متاح حتى '+new Date(info.expires_at).toLocaleString('ar-SA');
  $('pdf').hidden=!info.can_download_pdf;
  for(let i=0;i<info.items.length;i++){
   const item=info.items[i],r=await fetch('/api/v2/view/photo?token='+encodeURIComponent(token)+'&id='+encodeURIComponent(item.id),{cache:'no-store'});
   if(!r.ok)throw Error('تعذر استلام الصورة رقم '+(i+1));
   const encrypted=await r.arrayBuffer();
   if(await digest(encrypted)!==item.ciphertext_sha256)throw Error('ملف مشفر تالف');
   const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(item.iv),additionalData:new TextEncoder().encode(info.meetup_id+':'+item.id)},key,encrypted);
   const blob=new Blob([raw],{type:item.media_type}),url=URL.createObjectURL(blob);
   objectUrls.push(url);photos.push({bytes:blob});
   const im=document.createElement('img');im.src=url;im.loading='lazy';im.alt='صورة من اللقاء';
   const card=document.createElement('div');card.className='photo';card.append(im);$('gallery').append(card);
   say('تم تحميل '+(i+1)+' من '+info.items.length+' صورة');
  }
  if(!info.items.length)say('الألبوم لا يحتوي على صور منشورة بعد');
  else say('يمكنك مشاهدة '+photos.length+' صورة. لا يتيح هذا الرابط إضافة صور.');
 }catch(e){say('تعذر عرض الألبوم: '+e.message)}
}
$('pdf').onclick=async()=>{
 try{
  $('pdf').disabled=true;
  const docs=await createLocalPdfVolumes({title:$('title').textContent,photos,onProgress:p=>say('إعداد PDF: '+p.done+' من '+p.total)});
  const area=$('pdfLinks');area.replaceChildren();
  for(const d of docs){
   const u=URL.createObjectURL(d.blob);objectUrls.push(u);
   const a=document.createElement('a');a.href=u;a.download=d.fileName;a.textContent='حفظ '+d.fileName;area.append(a);
  }
  say('يمكن حفظ PDF على جهازك. لم تُرفع الصور إلى خدمة توليد PDF.');
 }catch(e){say(e.message)}finally{$('pdf').disabled=false}
};
start();
