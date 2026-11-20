// Bound memory and validate upload lengths even when browsers omit Content-Length.
export async function readBoundedBody(request,maxBytes){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw new TypeError('Invalid byte ceiling');
 const declared=request.headers.get('content-length');
 if(declared!==null){
  const n=Number(declared);
  if(!Number.isSafeInteger(n)||n<0||n>maxBytes)throw new RangeError('body_too_large');
 }
 if(!request.body)throw new TypeError('body_missing');
 const reader=request.body.getReader(),chunks=[];let total=0;
 try{
  for(;;){
   const {value,done}=await reader.read();
   if(done)break;
   if(!(value instanceof Uint8Array))throw new TypeError('invalid_body_chunk');
   total+=value.byteLength;
   if(total>maxBytes)throw new RangeError('body_too_large');
   chunks.push(value);
  }
 }catch(error){
  await reader.cancel().catch(()=>{});
  throw error;
 }
 if(declared!==null&&Number(declared)!==total)throw new TypeError('length_mismatch');
 const result=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength}
 return result.buffer;
}
