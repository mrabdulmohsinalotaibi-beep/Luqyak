import {SOURCE} from './new-brand-data.js';
const png=Uint8Array.from(atob(SOURCE),c=>c.charCodeAt(0));
const cache=new Map();
const read32=(a,i)=>new DataView(a.buffer,a.byteOffset,a.byteLength).getUint32(i);
function u32(n){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n>>>0);return b}
function join(parts){const out=new Uint8Array(parts.reduce((n,x)=>n+x.length,0));let p=0;for(const x of parts){out.set(x,p);p+=x.length}return out}
function crc(a){let c=0xffffffff;for(const b of a){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
function chunk(name,data){const body=join([new TextEncoder().encode(name),data]);return join([u32(data.length),body,u32(crc(body))])}
async function resize(n,maskable=false){
 let palette,compressed=[];
 for(let p=8;p<png.length;){const len=read32(png,p),name=String.fromCharCode(...png.slice(p+4,p+8)),d=png.slice(p+8,p+8+len);if(name==='PLTE')palette=d;if(name==='IDAT')compressed.push(d);p+=12+len}
 const raw=new Uint8Array(await new Response(new Blob([join(compressed)]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
 const w=256,idx=new Uint8Array(w*w);
 if(raw.length!==w*(w+1)||!palette)throw Error('Invalid logo data');
 const paeth=(a,b,c)=>{let p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c};
 for(let y=0;y<w;y++){const t=raw[y*(w+1)];if(t>4)throw Error('Invalid logo filter');for(let x=0;x<w;x++){const i=y*w+x,a=x?idx[i-1]:0,b=y?idx[i-w]:0,c=x&&y?idx[i-w-1]:0;idx[i]=(raw[y*(w+1)+1+x]+(t===1?a:t===2?b:t===3?Math.floor((a+b)/2):t===4?paeth(a,b,c):0))&255}}
 const data=new Uint8Array(n*(n*3+1)),scale=maskable ? .72 : 1,side=n*scale,pad=(n-side)/2;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const off=y*(n*3+1)+1+x*3;let sx=(x+.5-pad)*w/side-.5,sy=(y+.5-pad)*w/side-.5;if(sx<-.5||sy<-.5||sx>w-.5||sy>w-.5){data.fill(255,off,off+3);continue}sx=Math.max(0,Math.min(w-1,sx));sy=Math.max(0,Math.min(w-1,sy));const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(w-1,x0+1),y1=Math.min(w-1,y0+1),fx=sx-x0,fy=sy-y0;for(let c=0;c<3;c++){const p00=palette[idx[y0*w+x0]*3+c],p10=palette[idx[y0*w+x1]*3+c],p01=palette[idx[y1*w+x0]*3+c],p11=palette[idx[y1*w+x1]*3+c];data[off+c]=Math.round((p00*(1-fx)+p10*fx)*(1-fy)+(p01*(1-fx)+p11*fx)*fy)}}
 const zipped=new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
 return join([png.slice(0,8),chunk('IHDR',join([u32(n),u32(n),new Uint8Array([8,2,0,0,0])])),chunk('IDAT',zipped),chunk('IEND',new Uint8Array())])
}
export async function newBrandResponse(path){
 if(!/^\/brand\/(?:luqyak-[\w.-]+|logo[\w.-]*)\.(?:png|svg|webp)$/.test(path))return null;
 const headers={'cache-control':'public, max-age=300','x-content-type-options':'nosniff'};
 if(path.endsWith('.svg'))return new Response('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 256 256" role="img" aria-label="لُقياك"><image width="256" height="256" href="data:image/png;base64,'+SOURCE+'" xlink:href="data:image/png;base64,'+SOURCE+'"/></svg>',{headers:{...headers,'content-type':'image/svg+xml'}});
 const size=path.includes('192')?192:path.includes('1024')?512:path.includes('512')||path.includes('icon')?512:256;
 const maskable=path.includes('maskable'),key=size+':'+maskable;
 if(size===256&&!maskable)return new Response(png,{headers:{...headers,'content-type':'image/png'}});
 if(!cache.has(key))cache.set(key,resize(size,maskable).catch(e=>{cache.delete(key);throw e}));
 return new Response(await cache.get(key),{headers:{...headers,'content-type':'image/png'}});
}
