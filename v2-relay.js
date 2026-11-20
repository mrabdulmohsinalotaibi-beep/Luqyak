// LUQYAK v2 relay: isolated additive API, not a migration of legacy photos.
const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
const send=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const err=(status,error)=>send({error},status);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX=/^[0-9a-f]{64}$/i;
const B64=/^[A-Za-z0-9+/_=-]+$/;
const sha=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
const now=()=>Date.now();
async function actor(request,env){
 const token=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-luqyak_session=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(!token)return null;
 return env.DB.prepare("SELECT u.id FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.account_status='active'").bind(await sha(token),new Date().toISOString()).first();
}
const isJson=r=>(r.headers.get('content-type')||'').toLowerCase().startsWith('application/json');
const sameOrigin=r=>{const o=r.headers.get('origin');return o===new URL(r.url).origin};
async function meetup(env,id,userId){
 if(!UUID.test(id||''))return null;
 return env.DB.prepare('SELECT id,owner_id,ended FROM lk_meetups WHERE id=? AND owner_id=?').bind(id,userId).first();
}
async function capability(env,token,scope){
 if(!HEX.test(token||''))return null;
 return env.DB.prepare("SELECT * FROM lk_v2_meetup_shares WHERE token_hash=? AND scope=? AND revoked_at IS NULL AND expires_at>?").bind(await sha(token),scope,now()).first();
}
const validBytes=(s,min,max)=>typeof s==='string'&&s.length>=min&&s.length<=max&&B64.test(s);
export async function v2RelayHandler(request,env,ctx){
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(!path.startsWith('/api/v2/'))return err(404,'not_found');
 if(!env.DB||!env.PHOTOS)return err(503,'relay_unconfigured');
 if(method!=='GET' && !sameOrigin(request))return err(403,'invalid_origin');
 const owner=await actor(request,env);
 try{
  if(path==='/api/v2/devices'&&method==='POST'){
   if(!owner)return err(401,'login_required');
   if(!isJson(request))return err(415,'json_required');
   const b=await request.json();
   if(!UUID.test(b.device_id||'')||!validBytes(b.public_key_spki,100,2000))return err(400,'invalid_device');
   const existed=await env.DB.prepare('SELECT owner_id,public_key_spki FROM lk_v2_device_keys WHERE device_id=?').bind(b.device_id).first();
   if(existed && (existed.owner_id!==owner.id||existed.public_key_spki!==b.public_key_spki))return err(409,'device_key_conflict');
   await env.DB.prepare('INSERT OR IGNORE INTO lk_v2_device_keys(device_id,owner_id,public_key_spki,created_at) VALUES(?,?,?,?)').bind(b.device_id,owner.id,b.public_key_spki,now()).run();
   return send({ok:true,device_id:b.device_id});
  }
  const create=path.match(/^\/api\/v2\/meetups\/([a-f0-9-]{36})\/shares$/i);
  if(create&&method==='POST'){
   if(!owner)return err(401,'login_required');
   const m=await meetup(env,create[1],owner.id);if(!m)return err(404,'meetup_not_found');
   if(!isJson(request))return err(415,'json_required');
   const b=await request.json(),scope=b.scope;
   if(!['upload','view'].includes(scope))return err(400,'invalid_scope');
   const hours=Number(b.hours);if(!Number.isInteger(hours)||hours<1||hours>720)return err(400,'invalid_hours');
   const id=crypto.randomUUID(),token=random(),expires_at=now()+hours*3600000;
   await env.DB.prepare("INSERT INTO lk_v2_meetup_shares(id,meetup_id,owner_id,scope,token_hash,expires_at,created_at) VALUES(?,?,?,?,?,?,?)").bind(id,m.id,owner.id,scope,await sha(token),expires_at,now()).run();
   return send({id,scope,token,expires_at},201);
  }
  const end=path.match(/^\/api\/v2\/shares\/([a-f0-9-]{36})\/revoke$/i);
  if(end&&method==='POST'){
   if(!owner)return err(401,'login_required');
   await env.DB.prepare('UPDATE lk_v2_meetup_shares SET revoked_at=? WHERE id=? AND owner_id=?').bind(now(),end[1],owner.id).run();
   return send({ok:true});
  }
  if(path==='/api/v2/inbox/upload'&&method==='POST'){
   const c=await capability(env,url.searchParams.get('token'),'upload');
   if(!c)return err(403,'link_invalid');
   const m=await env.DB.prepare('SELECT id,ended FROM lk_meetups WHERE id=? AND owner_id=?').bind(c.meetup_id,c.owner_id).first();
   if(!m||m.ended)return err(410,'meetup_closed');
   const id=request.headers.get('x-luqyak-photo-id'),deviceId=request.headers.get('x-luqyak-device-id');
   const checksum=request.headers.get('x-luqyak-sha256');
   const iv=request.headers.get('x-luqyak-iv'),wrapped=request.headers.get('x-luqyak-wrapped-key');
   if(!UUID.test(id||'')||!UUID.test(deviceId||'')||!HEX.test(checksum||'')||!validBytes(iv,12,40)||!validBytes(wrapped,200,1000))return err(400,'invalid_envelope');
   const device=await env.DB.prepare('SELECT device_id FROM lk_v2_device_keys WHERE device_id=? AND owner_id=? AND revoked_at IS NULL').bind(deviceId,c.owner_id).first();
   if(!device)return err(403,'device_invalid');
   const length=Number(request.headers.get('content-length'));
   if(!Number.isFinite(length)||length<17||length>30*1024*1024+16)return err(413,'size_invalid');
   const existing=await env.DB.prepare('SELECT photo_id,ciphertext_sha256 FROM lk_v2_photo_queue WHERE photo_id=?').bind(id).first();
   if(existing)return existing.ciphertext_sha256===checksum?send({ok:true,id,existing:true}):err(409,'photo_id_conflict');
   const bytes=await request.arrayBuffer();
   if(bytes.byteLength!==length)return err(400,'length_mismatch');
   const actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
   if(actual!==checksum.toLowerCase())return err(400,'checksum_mismatch');
   const key='v2-pending/'+c.owner_id+'/'+id+'.bin',expires=now()+7*86400000;
   await env.PHOTOS.put(key,bytes,{httpMetadata:{contentType:'application/octet-stream'}});
   try{
    await env.DB.prepare("INSERT INTO lk_v2_photo_queue(photo_id,meetup_id,owner_id,recipient_device_id,storage_key,ciphertext_sha256,wrapped_key,iv,version,status,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,1,'queued',?,?)").bind(id,c.meetup_id,c.owner_id,deviceId,key,checksum.toLowerCase(),wrapped,iv,now(),expires).run();
   }catch(e){await env.PHOTOS.delete(key);throw e}
   return send({ok:true,id,status:'queued'},201);
  }
  if(path==='/api/v2/deliveries'&&method==='GET'){
   if(!owner)return err(401,'login_required');
   const deviceId=url.searchParams.get('device_id');if(!UUID.test(deviceId||''))return err(400,'invalid_device');
   const rows=await env.DB.prepare("SELECT photo_id,meetup_id,ciphertext_sha256,wrapped_key,iv,version,created_at,expires_at FROM lk_v2_photo_queue WHERE owner_id=? AND recipient_device_id=? AND status='queued' AND expires_at>? ORDER BY created_at LIMIT 100").bind(owner.id,deviceId,now()).all();
   return send({items:rows.results});
  }
  const download=path.match(/^\/api\/v2\/deliveries\/([a-f0-9-]{36})$/i);
  if(download&&method==='GET'){
   if(!owner)return err(401,'login_required');
   const row=await env.DB.prepare("SELECT storage_key FROM lk_v2_photo_queue WHERE photo_id=? AND owner_id=? AND status='queued' AND expires_at>?").bind(download[1],owner.id,now()).first();
   if(!row)return err(404,'not_found');
   const obj=await env.PHOTOS.get(row.storage_key);if(!obj)return err(404,'object_missing');
   return new Response(obj.body,{headers:{'content-type':'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
  }
  const ack=path.match(/^\/api\/v2\/deliveries\/([a-f0-9-]{36})\/ack$/i);
  if(ack&&method==='POST'){
   if(!owner)return err(401,'login_required');
   if(!isJson(request))return err(415,'json_required');
   const b=await request.json();
   if(b.durable!==true||!HEX.test(b.sha256||''))return err(400,'durable_receipt_required');
   const row=await env.DB.prepare("SELECT storage_key,ciphertext_sha256,status FROM lk_v2_photo_queue WHERE photo_id=? AND owner_id=?").bind(ack[1],owner.id).first();
   if(!row)return err(404,'not_found');
   if(row.ciphertext_sha256!==b.sha256.toLowerCase())return err(409,'checksum_mismatch');
   if(row.status==='acknowledged')return send({ok:true,already:true});
   await env.DB.prepare("UPDATE lk_v2_photo_queue SET status='acknowledged',acknowledged_at=? WHERE photo_id=? AND owner_id=? AND status='queued'").bind(now(),ack[1],owner.id).run();
   // Failure here leaves a safely acknowledged row for an independent cleanup retry.
   try{await env.PHOTOS.delete(row.storage_key)}catch(e){ctx?.waitUntil?.(Promise.reject(e).catch(()=>{}))}
   return send({ok:true});
  }
  return err(404,'not_found');
 }catch(e){
   // Do not return DB/crypto errors or authorization details to clients.
   return err(500,'relay_error');
 }
}
