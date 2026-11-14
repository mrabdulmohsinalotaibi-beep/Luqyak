/**
 * Shared square (1:1) photo editor for Luqyak, including iPhone camera imports.
 * The photo is never uploaded until the user confirms the crop.
 * Returns a square JPEG Blob (under 2.45 MB) or null if cancelled.
 */
export async function openSquarePhotoEditor(file) {
  if (!(file instanceof Blob) || (file.type && !file.type.startsWith('image/')) || file.size > 35_000_000) {
    throw new Error('اختر صورة صالحة بحجم لا يتجاوز 35 ميجابايت');
  }
  let bitmap = null, objectUrl = null, image = null;
  try {
    if (typeof createImageBitmap === 'function') {
      try { bitmap = await createImageBitmap(file, {imageOrientation:'from-image'}); } catch (e) { /* use image decoding fallback */ }
    }
    if (bitmap) image = bitmap;
    else {
      objectUrl = URL.createObjectURL(file);
      const element = new Image();
      element.src = objectUrl;
      if (element.decode) await element.decode();
      else await new Promise((res,rej)=>{element.onload=res;element.onerror=rej});
      image = element;
    }
  } catch (error) {
    try { bitmap?.close?.(); } catch(e) {}
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    throw new Error('تعذر فتح الصورة. جرّب صورة أخرى بصيغة JPEG أو PNG');
  }
  const width = image.width || image.naturalWidth, height = image.height || image.naturalHeight;
  if (!(width >= 1 && height >= 1)) {
    try { bitmap?.close?.(); } catch(e) {}
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    throw new Error('الصورة غير صالحة للقص');
  }
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','قص صورة مربعة');
    overlay.dir = 'rtl';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:#191a17f5;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:calc(16px + env(safe-area-inset-top,0px)) 16px calc(18px + env(safe-area-inset-bottom,0px));gap:14px;overflow:auto;font:16px system-ui,Tahoma,sans-serif';
    const title = document.createElement('h2');
    title.textContent = 'اضبط صورتك المربعة';
    title.style.cssText = 'font-size:20px;margin:0;text-align:center';
    const sub = document.createElement('p');
    sub.textContent = 'حرّك الصورة بإصبعك داخل المربع، أو استخدم التقريب';
    sub.style.cssText = 'margin:0;color:#f0dbcd;font-size:13px;text-align:center';
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 720;
    canvas.style.cssText = 'display:block;width:min(90vw,480px,53dvh);height:auto;aspect-ratio:1/1;touch-action:none;border:2px solid #f1d6c5;border-radius:13px;background:#292a27;box-shadow:0 8px 30px #0006';
    canvas.setAttribute('aria-label','معاينة قص الصورة إلى مربع');
    const zoomLabel = document.createElement('label');
    zoomLabel.textContent = 'تقريب الصورة';
    zoomLabel.style.cssText = 'display:flex;align-items:center;gap:14px;width:min(90vw,480px);font-size:14px';
    const zoomInput = document.createElement('input');
    zoomInput.type='range'; zoomInput.min='1'; zoomInput.max='3'; zoomInput.step='0.01'; zoomInput.value='1';
    zoomInput.style.cssText = 'flex:1;accent-color:#c77958;min-height:44px';
    zoomInput.setAttribute('aria-label','تكبير أو تصغير الصورة');
    zoomLabel.append(zoomInput);
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;justify-content:center;gap:10px;width:min(90vw,480px)';
    const save = document.createElement('button');
    save.type='button';save.textContent='حفظ الصورة المربعة';
    save.style.cssText = 'background:#a44a34;color:white;border:0;border-radius:14px;padding:14px 18px;min-height:48px;flex:1;font:600 15px system-ui';
    const cancel = document.createElement('button');
    cancel.type='button';cancel.textContent='إلغاء';
    cancel.style.cssText = 'background:#fff2;color:white;border:1px solid #ffffff70;border-radius:14px;padding:14px 18px;min-height:48px;font:500 15px system-ui';
    buttons.append(save,cancel);
    const status = document.createElement('p');status.setAttribute('role','status');
    status.style.cssText = 'margin:0;color:#f1d6c5;text-align:center;font-size:12px;min-height:16px';
    overlay.append(title,sub,canvas,zoomLabel,buttons,status);
    document.body.append(overlay);
    const ctx = canvas.getContext('2d',{alpha:false});
    const dim = Math.min(width,height);
    let zoom = 1, centerX = width/2, centerY = height/2;
    const bounds=()=>{const size=dim/zoom;centerX=Math.min(width-size/2,Math.max(size/2,centerX));centerY=Math.min(height-size/2,Math.max(size/2,centerY));return size};
    const draw=()=>{const size=bounds();ctx.fillStyle='#242424';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,centerX-size/2,centerY-size/2,size,size,0,0,720,720)};
    let last = null, finished = false;
    canvas.addEventListener('pointerdown',event=>{if(finished)return;last={x:event.clientX,y:event.clientY,id:event.pointerId};canvas.setPointerCapture?.(event.pointerId)});
    canvas.addEventListener('pointermove',event=>{if(!last||last.id!==event.pointerId||finished)return;const rect=canvas.getBoundingClientRect(),size=dim/zoom;centerX-=(event.clientX-last.x)*size/rect.width;centerY-=(event.clientY-last.y)*size/rect.height;last={x:event.clientX,y:event.clientY,id:event.pointerId};draw()});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{last=null});
    zoomInput.addEventListener('input',()=>{zoom=Number(zoomInput.value);draw()});
    const key=(event)=>{if(event.key==='Escape'){event.preventDefault();end(null)}};
    document.addEventListener('keydown',key);
    const end=(result)=>{if(finished)return;finished=true;document.removeEventListener('keydown',key);overlay.remove();try{bitmap?.close?.()}catch(e){}if(objectUrl)URL.revokeObjectURL(objectUrl);resolve(result)};
    cancel.onclick=()=>end(null);
    save.onclick=async()=>{
      save.disabled=true;status.textContent='جارٍ إعداد الصورة المربعة...';
      try {
        const size=bounds(),maxBytes=2_450_000;
        let output=Math.max(1,Math.min(2048,Math.floor(size)));
        for(let attempt=0;attempt<9;attempt++){
          const out=document.createElement('canvas');out.width=out.height=output;
          const context=out.getContext('2d',{alpha:false});
          if(!context)throw new Error('تعذر تجهيز الصورة');
          context.fillStyle='#fff';context.fillRect(0,0,output,output);
          context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
          context.drawImage(image,centerX-size/2,centerY-size/2,size,size,0,0,output,output);
          for(const quality of [0.94,0.88,0.8,0.71,0.61]){
            const blob=await new Promise(r=>out.toBlob(r,'image/jpeg',quality));
            if(blob&&blob.size>=200&&blob.size<=maxBytes){end(blob);return}
          }
          output=Math.max(320,Math.floor(output*0.8));
        }
        throw new Error('تعذر ضغط الصورة بالحجم المطلوب');
      }catch(e){status.textContent=e.message||'تعذر حفظ الصورة';save.disabled=false}
    };
    draw();
  });
}
