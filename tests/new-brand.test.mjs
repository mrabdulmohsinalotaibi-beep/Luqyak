import test from 'node:test';
import assert from 'node:assert/strict';
import {newBrandResponse} from '../src/new-brand.js';
import {atelierThemeResponse} from '../luqyak-theme-response.js';
test('new brand icons are valid PNG with declared dimensions',async()=>{
 for(const [path,size] of [['/brand/luqyak-icon-192.png',192],['/brand/luqyak-icon-512.png',512],['/brand/luqyak-icon-maskable-512.png',512]]){
  const r=await newBrandResponse(path);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');
  const b=new Uint8Array(await r.arrayBuffer());assert.deepEqual([...b.slice(0,8)],[137,80,78,71,13,10,26,10]);
  const d=new DataView(b.buffer);assert.equal(d.getUint32(16),size);assert.equal(d.getUint32(20),size);
 }
});
test('logo SVG embeds the new source and theme uses the new palette',async()=>{
 const r=await newBrandResponse('/brand/luqyak-2026-logo.svg');assert.match(await r.text(),/data:image\/png;base64,/);
 const css=await atelierThemeResponse().text();for(const c of ['#395344','#963b24','#faf6f2'])assert.ok(css.toLowerCase().includes(c),c);
 assert.equal(await newBrandResponse('/api/social/avatar'),null);
});
