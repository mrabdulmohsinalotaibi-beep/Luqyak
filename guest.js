
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const reply=(obj,status=200,extra={})=>new Response(JSON.stringify(obj),{status,headers:{...headers,...extra}});
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
async function digest(str){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str))),b=>b.toString(16).padStart(2,'0')).join('')}
const matchToken=s=>/^[a-f0-9]{64}$/.test(s||'');
async function viewer(request,env){
 const m=(request.headers.get('cookie')||'').match(/(?:^|;\s*)__Host-luqyak_session=([a-f0-9]{64})(?:;|$)/);
 if(!m)return null;
 return env.DB.prepare("SELECT u.id FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.account_status='active'").bind(await digest(m[1]),new Date().toISOString()).first();
}
async function linkFor(env,raw){
 if(!matchToken(raw))return null;
 return env.DB.prepare("SELECT l.*,m.title,m.place,m.starts_at,m.ended FROM lk_guest_links l JOIN lk_meetups m ON m.id=l.meetup_id WHERE l.token_hash=? AND l.revoked_at IS NULL").bind(await digest(raw)).first();
}
async function guestFor(request,env,link){
 const m=(request.headers.get('cookie')||'').match(/(?:^|;\s*)__Host-luqyak_guest=([a-f0-9]{64})(?:;|$)/);
 if(!m)return null;
 return env.DB.prepare("SELECT * FROM lk_guest_members WHERE token_hash=? AND session_hash=?").bind(link.token_hash,await digest(m[1])).first();
}
function page(token){
 return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="referrer" content="no-referrer"><title>مشاركة مناسبة | لُقياك</title><style>*{box-sizing:border-box}body{font:17px system-ui,Tahoma;background:#f7f0e8;color:#392c27;margin:0;padding:20px}main{max-width:550px;margin:auto}header{font-size:26px;color:#853e36;font-weight:800}article{background:#fff;padding:22px;border-radius:22px;margin-top:16px;box-shadow:0 3px 15px #402b2412}button,input{font:inherit;padding:14px;border-radius:12px;border:1px solid #dccbc2;width:100%;margin:8px 0}button{background:#853e36;color:white;cursor:pointer}button.secondary{background:#f4e7dd;color:#753e35}button:disabled{opacity:.55}p{line-height:1.7}img{max-width:100%;border-radius:12px}#gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.muted{color:#78675d}#status{padding:10px;white-space:pre-wrap}</style></head><body><main><header>لُقياك</header><p>اجتمعنا، صوّرنا، وحفظنا الذكرى.</p><article><h1 id="name">مناسبة مشتركة</h1><p id="details"></p><div id="entry"><p>شارك بدون حساب، أو سجل الدخول لحفظ مناسباتك.</p><input id="guestName" maxlength="60" placeholder="اسمك في المناسبة" autocomplete="name"><button id="join">الدخول كضيف</button><a href="/?login=1" id="signin">الدخول أو إنشاء حساب</a></div><div id="album" hidden><h2>ألبوم المناسبة</h2><p class="muted">الصور لا تظهر إلا للمشاركين المصرح لهم.</p><input type="file" accept="image/jpeg,image/png,image/heic,image/webp" id="file"><button id="upload">إضافة صورة</button><div id="gallery"></div><button id="claim" class="secondary">حفظ المناسبة في حسابي</button></div><p id="status" role="status"></p></article></main><script>
 const token=${JSON.stringify(token)};const q=id=>document.getElementById(id);
 async function call(path,options={}){const r=await fetch('/api/guest/'+path+'?token='+encodeURIComponent(token),{credentials:'same-origin',cache:'no-store',...options});const v=await r.json();if(!r.ok)throw Error(v.message||v.error||'تعذر إكمال العملية');return v}
 const say=m=>q('status').textContent=m;
 async function load(){try{const v=await call('album');q('name').textContent=v.title;q('details').textContent=v.place+' · '+new Date(v.time).toLocaleDateString('ar-SA');q('entry').hidden=v.joined;q('album').hidden=!v.allowed;q('join').disabled=v.mode==='accounts';if(v.mode==='accounts')say('هذه المناسبة للمستخدمين المسجلين والمدعوين فقط.');else if(v.joined&&!v.allowed)say('طلب المشاركة ينتظر الموافقة.');else say('');q('gallery').replaceChildren();if(v.allowed)for(const p of v.photos){const image=document.createElement('img');image.loading='lazy';image.alt='صورة من المناسبة';image.src='/api/guest/photo?token='+encodeURIComponent(token)+'&photo='+encodeURIComponent(p.id);q('gallery').append(image)}}catch(e){say(e.message)}}
 q('join').onclick=async()=>{const name=q('guestName').value.trim();if(name.length<2)return say('أدخل اسمك أولًا');try{await call('join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name})});await load()}catch(e){say(e.message)}};
 q('upload').onclick=async()=>{const f=q('file').files[0];if(!f)return say('اختر صورة');if(f.size>2500000)return say('اختر صورة بحجم أقل من 2.5 ميجابايت');q('upload').disabled=true;try{let img=f;if(f.type!=='image/jpeg'){const bitmap=await createImageBitmap(f),canvas=document.createElement('canvas');const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);img=await new Promise(res=>canvas.toBlob(res,'image/jpeg',.78));bitmap.close()}await call('upload',{method:'POST',headers:{'content-type':'image/jpeg'},body:img});q('file').value='';await load()}catch(e){say(e.message)}finally{q('upload').disabled=false}};
 q('claim').onclick=async()=>{try{await call('claim',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});say('تم ربط المناسبة بحسابك. يمكنك الرجوع إلى ذكرياتك.')}catch(e){say('سجّل الدخول أولًا في هذا المتصفح، ثم اضغط حفظ المناسبة في حسابي.')}};
 load();
 </script></body></html>`;
}
export async function guestHandler(request,env){
 const url=new URL(request.url),path=url.pathname,method=request.method;
 const raw=path.startsWith('/g/')?path.slice(3):url.searchParams.get('token');
 if(!matchToken(raw))return reply({error:'not_found'},404);
 try{
 const link=await linkFor(env,raw);
 if(!link)return reply({error:'not_found'},404);
 if(path.startsWith('/g/'))return new Response(page(raw),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
 const guest=await guestFor(request,env,link);
 const actor=await viewer(request,env);
 const owner=actor?.id===link.owner_id;
 const approved=guest?.status==='accepted',allowed=(approved||owner)&&link.can_view===1;
 const apiPath=path.replace('/api/guest/','');
 if(apiPath==='album'&&method==='GET'){
  const photos=allowed?(await env.DB.prepare("SELECT id FROM lk_meetup_photos WHERE meetup_id=? UNION ALL SELECT id FROM lk_guest_photos WHERE meetup_id=? AND status='approved' LIMIT 180").bind(link.meetup_id,link.meetup_id).all()).results:[];
  return reply({title:link.title,place:link.place,time:link.starts_at,mode:link.mode,joined:!!guest,allowed,photos});
 }
 if(apiPath==='join'&&method==='POST'){
  if(request.headers.get('origin')!==url.origin)return reply({error:'invalid_origin'},403);
  if(link.mode==='accounts')return reply({error:'account_required'},403);
  if(guest)return reply({ok:true,status:guest.status});
  const b=await request.json(),name=String(b.name||'').trim().replace(/\s+/g,' ');
  if(name.length<2||name.length>60||/[<>\u0000-\u001f]/.test(name))return reply({error:'invalid_name'},400);
  const count=await env.DB.prepare('SELECT COUNT(*) n FROM lk_guest_members WHERE token_hash=?').bind(link.token_hash).first();
  if(count.n>=200)return reply({error:'guest_limit'},429);
  const session=random(),status=link.mode==='approval'?'pending':'accepted';
  await env.DB.prepare("INSERT INTO lk_guest_members(id,token_hash,display_name,session_hash,status) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),link.token_hash,name,await digest(session),status).run();
  return reply({ok:true,status},201,{'set-cookie':'__Host-luqyak_guest='+session+'; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000'});
 }
 if(apiPath==='photo'&&method==='GET'){
  if(!allowed)return reply({error:'not_found'},404);
  const id=url.searchParams.get('photo');if(!/^[a-f0-9-]{36}$/.test(id||''))return reply({error:'not_found'},404);
  const p=await env.DB.prepare("SELECT object_key FROM lk_meetup_photos WHERE id=? AND meetup_id=? UNION ALL SELECT object_key FROM lk_guest_photos WHERE id=? AND meetup_id=? AND status='approved' LIMIT 1").bind(id,link.meetup_id,id,link.meetup_id).first();
  if(!p)return reply({error:'not_found'},404);
  const obj=await env.PHOTOS.get(p.object_key);return obj?new Response(obj.body,{headers:{'content-type':'image/jpeg','cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}}):reply({error:'not_found'},404);
 }
 if(apiPath==='upload'&&method==='POST'){
  if(request.headers.get('origin')!==url.origin)return reply({error:'invalid_origin'},403);
  if(!approved||!link.can_upload||link.ended)return reply({error:'not_allowed'},403);
  if(!(request.headers.get('content-type')||'').startsWith('image/jpeg'))return reply({error:'jpeg_required'},415);
  const size=Number(request.headers.get('content-length')||0);if(size>2500000)return reply({error:'too_large'},413);
  const bytes=new Uint8Array(await request.arrayBuffer());if(bytes.length<200||bytes.length>2500000||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)return reply({error:'invalid_image'},400);
  const count=await env.DB.prepare("SELECT COUNT(*) n FROM lk_guest_photos WHERE guest_id=? AND created_at>datetime('now','-1 hour')").bind(guest.id).first();if(count.n>=20)return reply({error:'rate_limited'},429);
  const id=crypto.randomUUID(),key='meetup-albums/'+link.meetup_id+'/guest-'+id+'.jpg';
  await env.PHOTOS.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'},onlyIf:{etagDoesNotMatch:'*'}});
  try{await env.DB.prepare("INSERT INTO lk_guest_photos(id,meetup_id,guest_id,object_key,status) VALUES(?,?,?,?,?)").bind(id,link.meetup_id,guest.id,key,link.review_photos?'pending':'approved').run()}catch(e){await env.PHOTOS.delete(key);throw e}
  return reply({ok:true,id,pending:!!link.review_photos},201);
 }
 if(apiPath==='claim'&&method==='POST'){
  if(request.headers.get('origin')!==url.origin)return reply({error:'invalid_origin'},403);
  if(!guest||!actor)return reply({error:'login_required'},401);
  if(guest.claimed_user_id&&guest.claimed_user_id!==actor.id)return reply({error:'already_claimed'},409);
  await env.DB.prepare("UPDATE lk_guest_members SET claimed_user_id=? WHERE id=? AND (claimed_user_id IS NULL OR claimed_user_id=?)").bind(actor.id,guest.id,actor.id).run();
  return reply({ok:true});
 }
 if(apiPath==='moderation'&&owner){
  if(method==='GET'){
   const members=(await env.DB.prepare("SELECT id,display_name,status FROM lk_guest_members WHERE token_hash=? ORDER BY created_at DESC LIMIT 200").bind(link.token_hash).all()).results;
   const photos=(await env.DB.prepare("SELECT p.id,m.display_name,p.status FROM lk_guest_photos p JOIN lk_guest_members m ON m.id=p.guest_id WHERE p.meetup_id=? ORDER BY p.created_at DESC LIMIT 200").bind(link.meetup_id).all()).results;
   return reply({members,photos});
  }
  if(method==='POST'&&request.headers.get('origin')===url.origin){
   const b=await request.json();if(!['approve','reject'].includes(b.action)||!['guest','photo'].includes(b.kind)||!/^[a-f0-9-]{36}$/.test(b.id||''))return reply({error:'invalid_request'},400);
   if(b.kind==='guest')await env.DB.prepare("UPDATE lk_guest_members SET status=? WHERE id=? AND token_hash=?").bind(b.action==='approve'?'accepted':'rejected',b.id,link.token_hash).run();
   else await env.DB.prepare("UPDATE lk_guest_photos SET status=? WHERE id=? AND meetup_id=?").bind(b.action==='approve'?'approved':'rejected',b.id,link.meetup_id).run();
   return reply({ok:true});
  }
 }
 return reply({error:'not_found'},404);
 }catch(e){console.error('guest album error',String(e));return reply({error:'guest_album_unavailable'},503)}
}
export async function guestOwnerHandler(request,env){
 const url=new URL(request.url);
 if(request.headers.get('origin')!==url.origin)return reply({error:'invalid_origin'},403);
 const actor=await viewer(request,env);if(!actor)return reply({error:'login_required'},401);
 const b=await request.json(),id=String(b.meetup_id||'');
 if(!/^[a-f0-9-]{36}$/.test(id))return reply({error:'invalid_meetup'},400);
 const meet=await env.DB.prepare('SELECT owner_id,privacy FROM lk_meetups WHERE id=?').bind(id).first();
 if(!meet||meet.owner_id!==actor.id)return reply({error:'not_allowed'},403);
 if(meet.privacy==='private')return reply({error:'private_meetup'},403);
 const mode=String(b.mode||'link');
 if(!['link','approval','accounts'].includes(mode))return reply({error:'invalid_mode'},400);
 const token=random();
 const old=await env.DB.prepare('SELECT token_hash FROM lk_guest_links WHERE meetup_id=? AND owner_id=? AND revoked_at IS NULL').bind(id,actor.id).all();
 for(const v of old.results)await env.DB.prepare('UPDATE lk_guest_links SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=?').bind(v.token_hash).run();
 await env.DB.prepare("INSERT INTO lk_guest_links(token_hash,meetup_id,owner_id,mode,can_view,can_upload,review_photos) VALUES(?,?,?,?,?,?,?)").bind(await digest(token),id,actor.id,mode,b.can_view===false?0:1,b.can_upload===false?0:1,b.review_photos===true?1:0).run();
 return reply({ok:true,url:url.origin+'/g/'+token});
}
