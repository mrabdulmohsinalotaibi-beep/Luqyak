import test from 'node:test';import assert from 'node:assert/strict';import {Script} from 'node:vm';import worker from '../worker.js';
test('account avatar supports front camera, gallery, circular drag crop, zoom, save and cancel',async()=>{
 const res=await worker.fetch(new Request('https://luqyak.athat.app/app?tab=account'),{}, {waitUntil(){}});assert.equal(res.status,200);const html=await res.text();
 for(const term of ["cameraPicker.capture='user'","picker.accept='image/*'","تصوير الآن","اختيار من الصور","border-radius:50%","canvas.onpointermove","zoom.oninput=drawCrop","حفظ الصورة","/api/social/avatar","cameraPicker.onchange","picker.onchange"]){assert.ok(html.includes(term),term)}
 assert.ok(!html.includes('const img=await createImageBitmap(file),side=Math.min(img.width,img.height)'), 'old automatic crop removed');
 for(const [,body] of html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g))new Script(body);
});
