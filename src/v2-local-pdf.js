// Browser-native PDF writer: no uploads, no external font/CDN/network services.
const enc=new TextEncoder(),ascii=s=>enc.encode(s);
async function raster(blob,maxSide=1800){
 let source,dispose=()=>{};
 if('createImageBitmap' in globalThis){
  source=await createImageBitmap(blob);dispose=()=>source.close();
 }else{
  const url=URL.createObjectURL(blob),image=new Image();
  try{await new Promise((ok,no)=>{image.onload=ok;image.onerror=()=>no(Error('تعذر قراءة الصورة'));image.src=url});source=image;}
  finally{URL.revokeObjectURL(url)}
 }
 try{
  const w=source.width||source.naturalWidth,h=source.height||source.naturalHeight;
  if(!w||!h)throw Error('الصورة فارغة');
  const ratio=Math.min(1,maxSide/Math.max(w,h));
  const width=Math.max(1,Math.round(w*ratio)),height=Math.max(1,Math.round(h*ratio));
  const c=document.createElement('canvas');c.width=width;c.height=height;
  const g=c.getContext('2d',{alpha:false});g.fillStyle='#fff';g.fillRect(0,0,width,height);g.drawImage(source,0,0,width,height);
  const jpg=await new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(Error('تعذر تحويل الصورة')),'image/jpeg',0.84));
  return {width,height,bytes:new Uint8Array(await jpg.arrayBuffer())};
 }finally{dispose()}
}
async function cover(title){
 const c=document.createElement('canvas');c.width=960;c.height=1358;
 const g=c.getContext('2d');g.fillStyle='#F5F0E4';g.fillRect(0,0,c.width,c.height);
 g.fillStyle='#354434';g.textAlign='center';g.direction='rtl';g.font='bold 78px system-ui';g.fillText('لُقياك',480,380);
 g.font='bold 47px system-ui';g.fillText(String(title||'ذكريات اللقاء').slice(0,48),480,600,840);
 g.fillStyle='#867A62';g.font='30px system-ui';g.fillText('ألبوم الذكريات',480,700);
 const b=await new Promise((ok,no)=>c.toBlob(x=>x?ok(x):no(Error('تعذر إنشاء الغلاف')),'image/jpeg',0.87));
 return raster(b);
}
function pdfFromJpegs(images){
 const chunks=[],offsets=[0];let pos=0;
 const push=bytes=>{chunks.push(bytes);pos+=bytes.byteLength};
 const str=s=>push(ascii(s));
 str('%PDF-1.4\n%LUQYAK\n');
 const object=(id,begin,end)=>{offsets[id]=pos;str(id+' 0 obj\n');begin();str('endobj\n')};
 const ids=images.map((_,i)=>({page:3+i*3,img:4+i*3,content:5+i*3}));
 object(1,()=>str('<< /Type /Catalog /Pages 2 0 R >>\n'));
 object(2,()=>str('<< /Type /Pages /Kids ['+ids.map(a=>a.page+' 0 R').join(' ') +'] /Count '+ids.length+' >>\n'));
 for(let i=0;i<images.length;i++){
  const item=images[i],id=ids[i];
  const scale=Math.min(547/item.width,793/item.height),w=item.width*scale,h=item.height*scale;
  const x=(595.28-w)/2,y=(841.89-h)/2;
  const content='q '+[w,0,0,h,x,y].map(v=>Number(v.toFixed(3))).join(' ')+' cm /Im0 Do Q\n';
  object(id.page,()=>str('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 '+id.img+' 0 R >> >> /Contents '+id.content+' 0 R >>\n'));
  object(id.img,()=>{str('<< /Type /XObject /Subtype /Image /Width '+item.width+' /Height '+item.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+item.bytes.byteLength+' >>\nstream\n');push(item.bytes);str('\nendstream\n')});
  const body=ascii(content);object(id.content,()=>{str('<< /Length '+body.byteLength+' >>\nstream\n');push(body);str('endstream\n')});
 }
 const start=pos,total=2+images.length*3;
 str('xref\n0 '+(total+1)+'\n0000000000 65535 f \n');
 for(let id=1;id<=total;id++)str(String(offsets[id]).padStart(10,'0')+' 00000 n \n');
 str('trailer\n<< /Root 1 0 R /Size '+(total+1)+' >>\nstartxref\n'+start+'\n%%EOF');
 return new Blob(chunks,{type:'application/pdf'});
}
export async function createLocalPdfVolumes({title,photos,maxPhotosPerVolume=25,onProgress=()=>{}}){
 if(!Array.isArray(photos)||!photos.length)throw Error('لا توجد صور للتصدير');
 if(!Number.isInteger(maxPhotosPerVolume)||maxPhotosPerVolume<1||maxPhotosPerVolume>50)throw Error('حجم الجزء غير صالح');
 const result=[];
 for(let start=0;start<photos.length;start+=maxPhotosPerVolume){
  const pack=[await cover(title)];
  const slice=photos.slice(start,start+maxPhotosPerVolume);
  for(let i=0;i<slice.length;i++){
   pack.push(await raster(slice[i].bytes||slice[i]));
   onProgress({done:start+i+1,total:photos.length});
  }
  const data=pdfFromJpegs(pack);
  result.push({fileName:'luqyak-'+(Math.floor(start/maxPhotosPerVolume)+1)+'.pdf',blob:data,pages:pack.length});
 }
 return result;
}
