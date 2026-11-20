import test from 'node:test';
import assert from 'node:assert/strict';
import {readBoundedBody} from '../v2-bounded-body.js';
test('accepts streaming encrypted uploads without a Content-Length header',async()=>{
 const input=new Uint8Array([0,1,2,3,4,5,6,7]);
 const request=new Request('https://example.test/upload',{method:'POST',body:input});
 const output=await readBoundedBody(request,64);
 assert.deepEqual(new Uint8Array(output),input);
});
test('rejects declared lengths beyond limits and mismatched lengths',async()=>{
 const huge=new Request('https://example.test/upload',{method:'POST',body:new Uint8Array([1]),headers:{'content-length':'123456'}});
 await assert.rejects(()=>readBoundedBody(huge,10),RangeError);
 const mismatch=new Request('https://example.test/upload',{method:'POST',body:new Uint8Array([1,2]),headers:{'content-length':'3'}});
 await assert.rejects(()=>readBoundedBody(mismatch,10),/length_mismatch/);
});
test('rejects chunk streams that exceed size limit without accumulating entire file',async()=>{
 const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(8));controller.enqueue(new Uint8Array(8));controller.close()}});
 const request=new Request('https://example.test/upload',{method:'POST',body:stream,duplex:'half'});
 await assert.rejects(()=>readBoundedBody(request,10),RangeError);
});
