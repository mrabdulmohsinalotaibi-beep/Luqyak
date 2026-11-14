/**
 * Interactive avatar cropper for Luqyak. Does not upload until the user confirms.
 * Usage: const blob = await openAvatarCropper(file); // null when cancelled
 */
export async function openAvatarCropper(file) {
  if (!(file instanceof Blob) || !file.type.startsWith('image/') || file.size > 12 * 1024 * 1024) {
    throw new Error('اختر صورة صالحة بحجم لا يتجاوز 12 ميجابايت');
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 60000000)
      throw new Error('أبعاد الصورة غير مدعومة');
    return await new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'قص الصورة الشخصية');
      overlay.dir = 'rtl';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483640;background:#17121bcc;display:grid;place-items:center;padding:16px';
      overlay.innerHTML = `<div style="width:min(100%,440px);background:#fff;border-radius:22px;padding:20px;display:grid;gap:14px;color:#322B27">
        <strong>ضبط الصورة الشخصية</strong>
        <p style="margin:0;font-size:13px">حرّك الصورة بإصبعك أو الماوس، وكبّرها لتحديد الجزء المطلوب.</p>
        <canvas width="320" height="320" aria-label="معاينة القص الدائري" style="width:min(100%,320px);aspect-ratio:1;touch-action:none;border-radius:50%;justify-self:center;background:#EFE1D3"></canvas>
        <label>التكبير <input type="range" min="1" max="3" step=".01" value="1" style="width:100%"></label>
        <div style="display:flex;gap:10px"><button type="button" data-cancel style="flex:1;padding:12px">إلغاء</button><button type="button" data-save style="flex:1;padding:12px;background:#B65530;color:#fff;border:0;border-radius:12px">حفظ الصورة</button></div>
      </div>`;
      document.body.append(overlay);
      const canvas = overlay.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      const zoom = overlay.querySelector('input');
      let scale = 1, x = 0, y = 0, dragging = null;
      const base = Math.max(320 / image.naturalWidth, 320 / image.naturalHeight);
      const clamp = () => {
        const w = image.naturalWidth * base * scale, h = image.naturalHeight * base * scale;
        x = Math.max((320-w)/2, Math.min((w-320)/2,x));
        y = Math.max((320-h)/2, Math.min((h-320)/2,y));
      };
      const paint = () => {
        clamp(); ctx.clearRect(0,0,320,320);
        ctx.save(); ctx.beginPath(); ctx.arc(160,160,160,0,Math.PI*2);ctx.clip();
        const w=image.naturalWidth*base*scale,h=image.naturalHeight*base*scale;
        ctx.drawImage(image,160-w/2+x,160-h/2+y,w,h);ctx.restore();
      };
      const finish = value => {overlay.remove();resolve(value);};
      zoom.addEventListener('input', () => {scale=Number(zoom.value);paint();});
      canvas.addEventListener('pointerdown',e=>{dragging={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
      canvas.addEventListener('pointermove',e=>{if(!dragging||dragging.id!==e.pointerId)return;const factor=320/canvas.getBoundingClientRect().width;x+=(e.clientX-dragging.x)*factor;y+=(e.clientY-dragging.y)*factor;dragging.x=e.clientX;dragging.y=e.clientY;paint();});
      canvas.addEventListener('pointerup',()=>{dragging=null;});
      canvas.addEventListener('pointercancel',()=>{dragging=null;});
      overlay.querySelector('[data-cancel]').onclick=()=>finish(null);
      overlay.querySelector('[data-save]').onclick=async()=>{
        const button=overlay.querySelector('[data-save]');button.disabled=true;
        const output=document.createElement('canvas');output.width=output.height=512;
        const target=output.getContext('2d');
        target.scale(512/320,512/320);
        const w=image.naturalWidth*base*scale,h=image.naturalHeight*base*scale;
        target.drawImage(image,160-w/2+x,160-h/2+y,w,h);
        let blob=null;
        for(const quality of [.9,.8,.7,.55]) {
          blob=await new Promise(r=>output.toBlob(r,'image/jpeg',quality));
          if(blob && blob.size<=550000)break;
        }
        if(!blob || blob.size>550000){button.disabled=false;alert('تعذر ضغط الصورة، جرّب صورة أخرى');return;}
        finish(blob);
      };
      paint();
    });
  } finally {URL.revokeObjectURL(url);}
}
