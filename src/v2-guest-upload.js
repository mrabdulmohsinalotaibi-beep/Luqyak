import {sealPhoto} from './secure-photo-envelope.js';
const $=id=>document.getElementById(id);
const token=location.pathname.split('/').pop();
const b64=data=>{const u=new Uint8Array(data);let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode(...u.subarray(i,i+8192));return btoa(s)};
const msg=t=>{$('status').textContent=t};
async function fetchJson(url,options){
 const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
 const body=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(body.error||'تعذر الاتصال بالموقع');
 return body;
}
async function init(){
 if(!/^[a-f0-9]{64}$/i.test(token))return msg('الرابط غير صالح');
 try{
  const info=await fetchJson('/api/v2/inbox/info?token='+encodeURIComponent(token));
  $('meetup').textContent='لقاء خاص — أرسل صورك لصاحب اللقاء';
  $('file').disabled=false;$('submit').disabled=false;
  $('submit').onclick=async()=>{
   const files=[...$('file').files];if(!files.length)return msg('اختر صورة أولًا');
   $('submit').disabled=true;let done=0;
   for(const f of files){
    try{
     if(!['image/jpeg','image/png','image/webp'].includes(f.type))throw Error('نوع الصورة غير مدعوم، اختر JPG أو PNG أو WebP');
     const sealed=await sealPhoto({meetupId:info.meetup_id,photoBytes:await f.arrayBuffer(),recipientPublicKey:Uint8Array.from(atob(info.public_key_spki),c=>c.charCodeAt(0))});
     const r=await fetch('/api/v2/inbox/upload?token='+encodeURIComponent(token),{
      method:'POST',credentials:'same-origin',headers:{
       'content-type':'application/octet-stream','x-luqyak-photo-id':sealed.photoId,'x-luqyak-device-id':info.device_id,
       'x-luqyak-sha256':sealed.sha256,'x-luqyak-iv':b64(sealed.iv),'x-luqyak-wrapped-key':b64(sealed.wrappedKey)
      },body:sealed.ciphertext
     });
     const result=await r.json().catch(()=>({}));
     if(!r.ok)throw Error(result.error||'تعذر الإرسال');
     done++;msg('وصل للوسيط المشفّر: '+done+' من '+files.length+' صورة. ينتظر الحفظ في جهاز صاحب اللقاء.');
    }catch(e){msg('تم إرسال '+done+' من '+files.length+'. تعذر إرسال «'+f.name+'»: '+e.message);break}
   }
   $('submit').disabled=false;
  };
 }catch(e){msg('تعذر فتح رابط التصوير: '+e.message)}
}
init();
