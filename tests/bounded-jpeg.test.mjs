import test from 'node:test';
import assert from 'node:assert/strict';
import {readBoundedJpeg} from '../src/bounded-jpeg.js';
const site='https://luqyak.athat.app/api/social/upload';
const makeJpeg=(size=220)=>{const a=new Uint8Array(size);a[0]=255;a[1]=216;a[size-2]=255;a[size-1]=217;return a};
const upload=(data,headers={})=>new Request(site,{method:'POST',headers:{'content-type':'image/jpeg',...headers},body:data});
test('primary image upload accepts a bounded JPEG from a streaming request',async()=>{
 const bytes=makeJpeg(260);
 const read=await readBoundedJpeg(upload(bytes));
 assert.deepEqual(read.bytes,bytes);
});
test('oversized image without Content-Length is rejected',async()=>{
 const result=await readBoundedJpeg(upload(makeJpeg(2500001)));
 assert.equal(result.status,413);
 assert.equal(result.error,'image_too_large');
 assert.equal(result.bytes,undefined);
});
test('declared oversized images are denied before streaming',async()=>{
 const result=await readBoundedJpeg(upload(makeJpeg(),{'content-length':'2500001'}));
 assert.equal(result.status,413);
 assert.equal(result.error,'image_too_large');
});
test('missing bytes and content-length mismatches are rejected',async()=>{
 const invalid=await readBoundedJpeg(upload(makeJpeg(220),{'content-length':'219'}));
 assert.equal(invalid.error,'invalid_length');
 const malformed=await readBoundedJpeg(upload(new Uint8Array(220)));
 assert.equal(malformed.error,'jpeg_invalid');
});
test('chunked streaming stops reading after size limit, without buffering entire upload',async()=>{
 let pulls=0;
 const stream=new ReadableStream({pull(c){pulls++;c.enqueue(new Uint8Array(1100000));if(pulls===10)c.close();}});
 const req=new Request(site,{method:'POST',headers:{'content-type':'image/jpeg'},body:stream,duplex:'half'});
 const result=await readBoundedJpeg(req);
 assert.equal(result.status,413);
 assert.ok(pulls<10);
});
