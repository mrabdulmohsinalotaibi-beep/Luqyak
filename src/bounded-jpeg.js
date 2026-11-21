// Bounded JPEG ingestion for authenticated social uploads.
// Never buffer a request larger than the configured limit, even with no Content-Length.
export async function readBoundedJpeg(request,maxBytes=2500000){
 const header=request.headers.get('content-length');
 if(header!==null){
  const n=Number(header);
  if(!Number.isSafeInteger(n)||n<0)return {error:'invalid_length',status:400};
  if(n>maxBytes)return {error:'image_too_large',status:413};
 }
 if(!request.body)return {error:'image_invalid',status:400};
 const reader=request.body.getReader();
 let total=0;
 const chunks=[];
 try {
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   if(!(value instanceof Uint8Array))return {error:'image_invalid',status:400};
   total+=value.byteLength;
   if(total>maxBytes)return {error:'image_too_large',status:413};
   chunks.push(value);
  }
 }finally{
  try{await reader.cancel()}catch{}
 }
 if(header!==null&&Number(header)!==total)return {error:'invalid_length',status:400};
 if(total<200)return {error:'image_invalid',status:400};
 const bytes=new Uint8Array(total);
 let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 if(bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)return {error:'jpeg_invalid',status:400};
 return {bytes};
}
