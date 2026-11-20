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
  $('file').disabled=false;$('camera').disabled=false;$('submit').disabled=false;
  $('submit').onclick=async()=>{
   const files=[...$('file').files,...$('camera').files];if(!files.length)return msg('اختر صورة أولًا');
   $('submit').disabled=true;let done=0;
   for(const f of files){
    try{
     let photo=f;
     if(!['image/jpeg','image/png','image/webp'].includes(f.type)){
      if(!['image/heic','image/heif','image/heic-sequence','image/heif-sequence',''].includes(f.type))throw Error('نوع الصورة غير مدعوم');
      if(!('createImageBitmap' in globalThis))throw Error('هذه الصورة تحتاج إلى تحويلها إلى JPG قبل الإرسال');
      const im=await createImageBitmap(f);
      const canvas=document.createElement('canvas');const scale=Math.min(1,2200/Math.max(im.width,im.height));
      canvas.width=Math.round(im.width*scale);canvas.height=Math.round(im.height*scale);
      canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);im.close();
      photo=await new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(Error('تعذر تجهيز الصورة')),'image/jpeg',0.85));
     }
     const sealed=await sealPhoto({meetupId:info.meetup_id,photoBytes:await photo.arrayBuffer(),recipientPublicKey:Uint8Array.from(atob(info.public_key_spki),c=>c.charCodeAt(0))});
     const r=await fetch('/api/v2/inbox/upload?token='+encodeURIComponent(token),{
      method:'POST',credentials:'same-origin',headers:{
       'content-type':'application/octet-stream','x-luqyak-photo-id':sealed.photoId,'x-luqyak-device-id':info.device_id,
       'x-luqyak-sha256':sealed.sha256,'x-luqyak-iv':b64(sealed.iv),'x-luqyak-wrapped-key':b64(sealed.wrappedKey)
      },body:sealed.ciphertext
     });
     const result=await r.json().catch(()=>({}));
     if(!r.ok)throw Error(result.error||'تعذر الإرسال');
     done++;$('camera').value='';msg('وصل للوسيط المشفّر: '+done+' من '+files.length+' صورة. ينتظر الحفظ في جهاز صاحب اللقاء.');
    }catch(e){msg('تم إرسال '+done+' من '+files.length+'. تعذر إرسال «'+f.name+'»: '+e.message);break}
   }
   $('submit').disabled=false;
  };
 }catch(e){msg('تعذر فتح رابط التصوير: '+e.message)}
}
init();
