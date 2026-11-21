
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
 return env.DB.prepare("SELECT l.*,m.title,m.place,m.starts_at,m.ended FROM lk_guest_links l JOIN lk_meetups m ON m.id=l.meetup_id WHERE l.token_hash=? AND l.revoked_at IS NULL AND (l.expires_at IS NULL OR julianday(l.expires_at)>julianday('now')) AND m.privacy<>'private'").bind(await digest(raw)).first();
}
async function guestFor(request,env,link){
 const cookieName='__Host-luqyak_guest_'+link.token_hash.slice(0,16);
 const m=(request.headers.get('cookie')||'').match(new RegExp('(?:^|;\\s*)'+cookieName+'=([a-f0-9]{64})(?:;|$)'));
 if(m){const guest=await env.DB.prepare("SELECT * FROM lk_guest_members WHERE token_hash=? AND session_hash=?").bind(link.token_hash,await digest(m[1])).first();if(guest)return guest}
 const actor=await viewer(request,env);
 return actor?env.DB.prepare("SELECT * FROM lk_guest_members WHERE token_hash=? AND claimed_user_id=? ORDER BY created_at DESC LIMIT 1").bind(link.token_hash,actor.id).first():null;
}
function page(token){
 return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="referrer" content="no-referrer"><title>مشاركة مناسبة | لُقياك</title><style>*{box-sizing:border-box}body{font:17px system-ui,Tahoma;background:#f7f0e8;color:#392c27;margin:0;padding:20px}main{max-width:550px;margin:auto}header{font-size:26px;color:#853e36;font-weight:800}article{background:#fff;padding:22px;border-radius:22px;margin-top:16px;box-shadow:0 3px 15px #402b2412}button,input{font:inherit;padding:14px;border-radius:12px;border:1px solid #dccbc2;width:100%;margin:8px 0}button{background:#853e36;color:white;cursor:pointer}button.secondary{background:#f4e7dd;color:#753e35}button:disabled{opacity:.55}p{line-height:1.7}img{max-width:100%;border-radius:12px}#gallery img{width:100%;aspect-ratio:1/1;object-fit:cover}#gallery button{padding:0;overflow:hidden;background:transparent;border:0;margin:0;aspect-ratio:1/1}#gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.muted{color:#78675d}#status{padding:10px;white-space:pre-wrap}@media print{body{background:white;padding:0;color:#1b211b}main{max-width:none}article{box-shadow:none;margin:0;padding:12px}#entry,#ownerPanel,#file,#capture,#upload,#claim,#savePdf,#status,#signin{display:none!important}#gallery{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}#gallery button{border:0!important;break-inside:avoid}#gallery img{width:100%;height:auto;aspect-ratio:1/1;object-fit:cover}header{margin:8px 0}}</style></head><body><main><header>لُقياك</header><p>اجتمعنا، صوّرنا، وحفظنا الذكرى.</p><article><h1 id="name">مناسبة مشتركة</h1><p id="details"></p><div id="entry"><p>شارك بدون حساب، أو سجل الدخول لحفظ مناسباتك.</p><input id="guestName" maxlength="60" placeholder="اسمك في المناسبة" autocomplete="name"><button id="join">الدخول كضيف</button><a href="/?login=1" id="signin">الدخول أو إنشاء حساب</a></div><div id="album" hidden><h2 id="albumHeading">المشاركة في اللقاء</h2><p class="muted" id="albumDescription">تُعرض الصور وفق صلاحيات الرابط.</p><input type="file" accept="image/jpeg,image/png,image/heic,image/webp" id="file"><button type="button" id="capture">📷 تصوير مباشر</button><button id="upload">اختيار صورة وإرسالها</button><div id="gallery"></div><button id="savePdf" type="button" class="secondary">طباعة الألبوم أو حفظه PDF</button><button id="claim" class="secondary">حفظ المناسبة في حسابي</button></div><section id="ownerPanel" hidden><h2>إدارة المشاركات</h2><p class="muted">وافق على المشاركين والصور قبل ظهورها للآخرين.</p><div id="pendingGuests"></div><div id="pendingPhotos"></div><label for="extendHours">تمديد صلاحية الرابط</label><select id="extendHours"><option value="1">ساعة</option><option value="2">ساعتان</option><option value="3">3 ساعات</option><option value="24">يوم كامل</option><option value="48">يومان</option><option value="168">أسبوع</option></select><button type="button" id="extend" class="secondary">تمديد الرابط</button><button id="revoke" class="secondary">إلغاء هذا الرابط</button></section><p id="status" role="status"></p></article></main><script>
 const token=${JSON.stringify(token)};const q=id=>document.getElementById(id);let accessMode='view',isOwner=false;
 async function call(path,options={}){const r=await fetch('/api/guest/'+path+(path.includes('?')?'&':'?')+'token='+encodeURIComponent(token),{credentials:'same-origin',cache:'no-store',...options});const v=await r.json();if(!r.ok)throw Error(v.message||v.error||'تعذر إكمال العملية');return v}
 const say=m=>q('status').textContent=m;
 async function load(){try{const v=await call('album');accessMode=v.access;isOwner=!!v.owner;q('name').textContent=v.title;q('details').textContent=v.place+' · '+new Date(v.time).toLocaleDateString('ar-SA');q('entry').hidden=v.joined||v.owner;q('album').hidden=!(v.allowed||v.canUpload);q('file').hidden=!v.canUpload;q('upload').hidden=!v.canUpload;q('capture').hidden=!v.canUpload;q('gallery').hidden=!v.allowed;q('savePdf').hidden=!v.allowed;q('albumHeading').textContent=v.access==='capture'?'إضافة صور اللقاء':v.access==='view'?'مشاهدة صور اللقاء':'ألبوم اللقاء';q('albumDescription').textContent=v.access==='capture'?'هذا الرابط للتصوير والإرسال فقط؛ لن تظهر لك صور الآخرين.':v.access==='view'?'هذا الرابط للمشاهدة فقط؛ لا يتيح إضافة صور.':'تُعرض الصور وفق صلاحيات الرابط.';q('join').disabled=false;if(v.mode==='accounts')say('هذه المناسبة تتطلب تسجيل الدخول بحساب لُقياك.');else if(v.joined&&!v.allowed&&!v.canUpload)say('طلب المشاركة ينتظر الموافقة أو صلاحية المشاهدة غير متاحة.');else say('');q('ownerPanel').hidden=!v.owner;if(v.owner)await loadModeration();q('gallery').replaceChildren();if(v.allowed)for(const p of v.photos){const button=document.createElement('button'),image=document.createElement('img');button.className='secondary';button.type='button';button.setAttribute('aria-label','عرض الصورة والتعليقات');image.loading='lazy';image.alt='صورة من المناسبة';image.src='/api/guest/photo?token='+encodeURIComponent(token)+'&photo='+encodeURIComponent(p.id);button.append(image);button.onclick=()=>openPhoto(p.id);q('gallery').append(button)}}catch(e){say(e.message)}}
 async function openPhoto(photoId){
  const dlg=document.createElement('dialog');dlg.style.cssText='width:min(96vw,570px);max-height:90dvh;overflow:auto;border:0;border-radius:20px;padding:16px;background:#fff;color:#392c27';
  const close=document.createElement('button');close.textContent='إغلاق';close.className='secondary';close.onclick=()=>dlg.close();dlg.append(close);
  const img=document.createElement('img');img.src='/api/guest/photo?token='+encodeURIComponent(token)+'&photo='+encodeURIComponent(photoId);img.alt='صورة الذكرى';img.style.width='100%';dlg.append(img);
  const like=document.createElement('button');dlg.append(like);
  const comments=document.createElement('div');dlg.append(comments);
  const input=document.createElement('input');input.maxLength=350;input.placeholder='أضف تعليقًا';dlg.append(input);
  const submit=document.createElement('button');submit.textContent='إضافة التعليق';dlg.append(submit);const readOnly=accessMode==='view'&&!isOwner;like.disabled=readOnly;input.hidden=readOnly;submit.hidden=readOnly;
  document.body.append(dlg);dlg.addEventListener('close',()=>dlg.remove());dlg.showModal();
  async function update(){try{const data=await call('interact?photo='+photoId);like.textContent=(data.liked?'♥ ':'♡ ')+data.likes;comments.replaceChildren();for(const c of data.comments){const p=document.createElement('p');p.textContent=c.display_name+': '+c.body;comments.append(p)}}catch(e){say(e.message)}}
  like.onclick=async()=>{try{await call('interact?photo='+photoId,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'like'})});await update()}catch(e){say(e.message)}};
  submit.onclick=async()=>{const val=input.value.trim();if(!val)return;try{await call('interact?photo='+photoId,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'comment',text:val})});input.value='';await update()}catch(e){say(e.message)}};
  await update();
 }
 async function loadModeration(){
  try{
   const data=await call('moderation');
   const guests=q('pendingGuests');guests.replaceChildren();
   const members=data.members.filter(x=>x.status==='pending');
   if(members.length){const h=document.createElement('h3');h.textContent='طلبات المشاركة ('+members.length+')';guests.append(h)}
   for(const g of members){
    const box=document.createElement('div');box.textContent=g.display_name+' ';
    for(const [action,label] of [['approve','قبول'],['reject','رفض']]){
     const b=document.createElement('button');b.textContent=label;b.className=action==='reject'?'secondary':'';b.onclick=()=>moderate('guest',g.id,action);box.append(b)
    }
    guests.append(box);
   }
   const panel=q('pendingPhotos');panel.replaceChildren();const pending=data.photos.filter(x=>x.status==='pending');
   if(pending.length){const h=document.createElement('h3');h.textContent='صور تنتظر المراجعة ('+pending.length+')';panel.append(h)}
   for(const p of pending){
    const box=document.createElement('div'),im=document.createElement('img');
    im.src='/api/guest/photo?token='+encodeURIComponent(token)+'&photo='+encodeURIComponent(p.id);im.alt='صورة قيد المراجعة';im.loading='lazy';box.append(im);
    const txt=document.createElement('p');txt.textContent=p.display_name;box.append(txt);
    for(const [action,label] of [['approve','اعتماد الصورة'],['reject','رفض الصورة']]){
     const b=document.createElement('button');b.textContent=label;b.className=action==='reject'?'secondary':'';b.onclick=()=>moderate('photo',p.id,action);box.append(b)
    }
    panel.append(box)
   }
  }catch(e){say(e.message)}
 }
 async function moderate(kind,id,action){try{await call('moderation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind,id,action})});await load()}catch(e){say(e.message)}}
 q('extend').onclick=async()=>{try{await call('extend',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({hours:Number(q('extendHours').value)})});say('تم تمديد الرابط');await load()}catch(e){say(e.message)}};\n q('revoke').onclick=async()=>{if(!confirm('إلغاء هذا الرابط سيمنع الضيوف من الدخول إليه. هل تريد المتابعة؟'))return;try{await call('revoke',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});say('تم إلغاء الرابط');q('ownerPanel').hidden=true}catch(e){say(e.message)}};
 q('join').onclick=async()=>{const name=q('guestName').value.trim();if(name.length<2)return say('أدخل اسمك أولًا');try{await call('join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name})});await load()}catch(e){say(e.message)}};
 q('savePdf').onclick=async()=>{if(q('gallery').hidden)return;await Promise.all([...q('gallery').querySelectorAll('img')].map(img=>img.decode?.().catch(()=>{})||Promise.resolve()));window.print()};
 q('capture').onclick=()=>{q('file').setAttribute('capture','environment');q('file').click()};\n q('upload').onclick=async()=>{const f=q('file').files[0];if(!f)return say('اختر صورة');q('upload').disabled=true;try{const {openSquarePhotoEditor}=await import('/src/square-photo-editor.js');const img=await openSquarePhotoEditor(f);if(!img){say('لم تُحفظ الصورة');return}await call('upload',{method:'POST',headers:{'content-type':'image/jpeg'},body:img});q('file').value='';await load()}catch(e){say(e.message)}finally{q('upload').disabled=false}};
 q('claim').onclick=async()=>{try{await call('claim',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});say('تم ربط مشاركتك في الرابط بحسابك.')}catch(e){say('سجّل الدخول أولًا في هذا المتصفح، ثم اضغط حفظ المناسبة في حسابي.')}};
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
 if(path.startsWith('/g/'))return new Response(page(raw),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
 const guest=await guestFor(request,env,link);
 const actor=await viewer(request,env);
 const owner=actor?.id===link.owner_id;
 const approved=guest?.status==='accepted',allowed=owner||(approved&&link.can_view===1),canUpload=approved&&link.can_upload===1&&!link.ended;
 const apiPath=path.replace('/api/guest/','');
 if(apiPath==='album'&&method==='GET'){
  const photos=allowed?(await env.DB.prepare("SELECT id FROM lk_meetup_photos WHERE meetup_id=? UNION ALL SELECT id FROM lk_guest_photos WHERE meetup_id=? AND status='approved' LIMIT 180").bind(link.meetup_id,link.meetup_id).all()).results:[];
  return reply({title:link.title,place:link.place,time:link.starts_at,mode:link.mode,joined:!!guest,allowed,canUpload,owner,photos,expiresAt:link.expires_at||null,access:link.can_upload&&!link.can_view?'capture':link.can_view&&!link.can_upload?'view':'both'});
 }
 if(apiPath==='join'&&method==='POST'){
  if(request.headers.get('origin')!==url.origin)return reply({error:'invalid_origin'},403);
  if(link.mode==='accounts'&&!actor)return reply({error:'account_required'},401);
  if(guest)return reply({ok:true,status:guest.status});
  const b=await request.json(),name=String(b.name||'').trim().replace(/\s+/g,' ');
  if(name.length<2||name.length>60||/[<>\u0000-\u001f]/.test(name))return reply({error:'invalid_name'},400);
  const count=await env.DB.prepare('SELECT COUNT(*) n FROM lk_guest_members WHERE token_hash=?').bind(link.token_hash).first();
  if(count.n>=200)return reply({error:'guest_limit'},429);
  const session=random(),status=link.mode==='approval'?'pending':'accepted';
  await env.DB.prepare("INSERT INTO lk_guest_members(id,token_hash,display_name,session_hash,status,claimed_user_id) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),link.token_hash,name,await digest(session),status,actor?.id||null).run();
  return reply({ok:true,status},201,{'set-cookie':'__Host-luqyak_guest_'+link.token_hash.slice(0,16)+'='+session+'; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000'});
 }
 if(apiPath==='interact'&&allowed){if(method==='POST'&&link.can_upload!==1&&!owner)return reply({error:'read_only_link'},403);const pid=url.searchParams.get('photo');const row=await env.DB.prepare("SELECT id FROM lk_guest_photos WHERE id=? AND meetup_id=? AND status='approved'").bind(pid,link.meetup_id).first();if(!row)return reply({error:'not_found'},404);return guestPhotoInteraction(request,env,pid,owner?'user':'guest',owner?actor.id:guest.id)}
 if(apiPath==='photo'&&method==='GET'){
  if(!allowed)return reply({error:'not_found'},404);
  const id=url.searchParams.get('photo');if(!/^[a-f0-9-]{36}$/.test(id||''))return reply({error:'not_found'},404);
  const p=await env.DB.prepare("SELECT object_key FROM lk_meetup_photos WHERE id=? AND meetup_id=? UNION ALL SELECT object_key FROM lk_guest_photos WHERE id=? AND meetup_id=? AND (status='approved' OR ?=1) LIMIT 1").bind(id,link.meetup_id,id,link.meetup_id,owner?1:0).first();
  if(!p)return reply({error:'not_found'},404);
  const obj=await env.PHOTOS.get(p.object_key);return obj?new Response(obj.body,{headers:{'content-type':'image/jpeg','cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}}):reply({error:'not_found'},404);
 }
 if(apiPath==='upload'&&method==='POST'){
  if(request.headers.get('origin')!==url.origin)return reply({error:'invalid_origin'},403);
  if(!canUpload||(link.mode==='accounts'&&!actor))return reply({error:'not_allowed'},403);
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
 if(apiPath==='extend'&&owner&&method==='POST'&&request.headers.get('origin')===url.origin){
  const b=await request.json().catch(()=>({}));const hours=Number(b.hours);
  if(![1,2,3,24,48,168].includes(hours))return reply({error:'invalid_duration'},400);
  await env.DB.prepare("UPDATE lk_guest_links SET expires_at=datetime(MAX(COALESCE(expires_at,datetime('now')),datetime('now')),'+'||?||' hours') WHERE token_hash=? AND owner_id=?").bind(hours,link.token_hash,actor.id).run();
  return reply({ok:true,extendedHours:hours});
 }
 if(apiPath==='revoke'&&owner&&method==='POST'&&request.headers.get('origin')===url.origin){await env.DB.prepare('UPDATE lk_guest_links SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=? AND owner_id=?').bind(link.token_hash,actor.id).run();return reply({ok:true})}
 if(apiPath==='moderation'&&owner){
  if(method==='GET'){
   const members=(await env.DB.prepare("SELECT id,display_name,status FROM lk_guest_members WHERE token_hash=? ORDER BY created_at DESC LIMIT 200").bind(link.token_hash).all()).results;
   const photos=(await env.DB.prepare("SELECT p.id,m.display_name,p.status FROM lk_guest_photos p JOIN lk_guest_members m ON m.id=p.guest_id WHERE p.meetup_id=? ORDER BY p.created_at DESC LIMIT 200").bind(link.meetup_id).all()).results;
   return reply({members,photos});
  }
  if(method==='POST'&&request.headers.get('origin')===url.origin){
   const b=await request.json();if(!['approve','reject'].includes(b.action)||!['guest','photo'].includes(b.kind)||!/^[a-f0-9-]{36}$/.test(b.id||''))return reply({error:'invalid_request'},400);
   if(b.kind==='guest'){await env.DB.prepare("UPDATE lk_guest_members SET status=? WHERE id=? AND token_hash=?").bind(b.action==='approve'?'accepted':'rejected',b.id,link.token_hash).run();if(b.action==='approve'){const member=await env.DB.prepare("SELECT claimed_user_id FROM lk_guest_members WHERE id=? AND token_hash=?").bind(b.id,link.token_hash).first();}}
   else await env.DB.prepare("UPDATE lk_guest_photos SET status=? WHERE id=? AND meetup_id=?").bind(b.action==='approve'?'approved':'rejected',b.id,link.meetup_id).run();
   return reply({ok:true});
  }
 }
 return reply({error:'not_found'},404);
 }catch(e){console.error('guest album error',String(e));return reply({error:'guest_album_unavailable'},503)}
}
export async function guestOwnerHandler(request,env){
 const url=new URL(request.url),method=request.method,route=url.pathname;
 const actor=await viewer(request,env);if(!actor)return reply({error:'login_required'},401);
 if(route==='/api/guest/owner-links'){
  if(method!=='GET')return reply({error:'method_not_allowed'},405);
  const id=String(url.searchParams.get('meetup_id')||'');
  if(!/^[a-f0-9-]{36}$/.test(id))return reply({error:'invalid_meetup'},400);
  const meet=await env.DB.prepare('SELECT owner_id FROM lk_meetups WHERE id=?').bind(id).first();
  if(!meet||meet.owner_id!==actor.id)return reply({error:'not_allowed'},403);
  const rows=await env.DB.prepare("SELECT token_hash,mode,can_view,can_upload,review_photos,expires_at,revoked_at,created_at,CASE WHEN revoked_at IS NOT NULL THEN 'revoked' WHEN expires_at IS NOT NULL AND julianday(expires_at)<=julianday('now') THEN 'expired' ELSE 'active' END AS status FROM lk_guest_links WHERE meetup_id=? AND owner_id=? ORDER BY created_at DESC LIMIT 40").bind(id,actor.id).all();
  return reply({ok:true,items:(rows.results||[]).map(x=>({id:x.token_hash,mode:x.mode,purpose:x.can_upload===1?'capture':'view',reviewPhotos:x.review_photos===1,createdAt:x.created_at,expiresAt:x.expires_at,status:x.status}))});
 }
 if(method!=='POST')return reply({error:'method_not_allowed'},405);
 if(request.headers.get('origin')!==url.origin)return reply({error:'invalid_origin'},403);
 if(route==='/api/guest/manage-link'){
  const b=await request.json().catch(()=>({}));
  const id=String(b.meetup_id||''),hash=String(b.link_id||''),action=String(b.action||'');
  if(!/^[a-f0-9-]{36}$/.test(id)||!/^[a-f0-9]{64}$/.test(hash)||!['revoke','extend'].includes(action))return reply({error:'invalid_request'},400);
  const link=await env.DB.prepare("SELECT l.token_hash,l.revoked_at,l.expires_at,l.can_upload,m.ended FROM lk_guest_links l JOIN lk_meetups m ON l.meetup_id=m.id WHERE l.token_hash=? AND l.meetup_id=? AND l.owner_id=?").bind(hash,id,actor.id).first();
  if(!link)return reply({error:'not_found'},404);
  if(link.revoked_at)return reply({error:'link_revoked'},409);
  if(action==='revoke'){
   await env.DB.prepare('UPDATE lk_guest_links SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=? AND owner_id=?').bind(hash,actor.id).run();
   return reply({ok:true,status:'revoked'});
  }
  const hours=Number(b.hours);
  if(![1,2,3,24,48,168].includes(hours))return reply({error:'invalid_duration'},400);
  if(link.ended&&link.can_upload===1)return reply({error:'meetup_ended'},409);
  await env.DB.prepare("UPDATE lk_guest_links SET expires_at=datetime(MAX(COALESCE(expires_at,datetime('now')),datetime('now')),'+'||?||' hours') WHERE token_hash=? AND owner_id=? AND revoked_at IS NULL").bind(hours,hash,actor.id).run();
  return reply({ok:true,status:'active',extendedHours:hours});
 }
 if(route!=='/api/guest/create-link')return reply({error:'not_found'},404);
 const b=await request.json().catch(()=>({})),id=String(b.meetup_id||'');
 if(!/^[a-f0-9-]{36}$/.test(id))return reply({error:'invalid_meetup'},400);
 const meet=await env.DB.prepare('SELECT owner_id,privacy,ended FROM lk_meetups WHERE id=?').bind(id).first();
 if(!meet||meet.owner_id!==actor.id)return reply({error:'not_allowed'},403);
 if(meet.privacy==='private')return reply({error:'private_meetup'},403);
 const canView=b.can_view===true,canUpload=b.can_upload===true;
 if(canView===canUpload)return reply({error:'invalid_purpose',message:'أنشئ رابطًا للتصوير فقط أو للمشاهدة فقط'},400);
 if(meet.ended&&canUpload)return reply({error:'meetup_ended',message:'اللقاء منتهٍ؛ أنشئ رابط مشاهدة فقط'},409);
 const mode=String(b.mode||'link');
 if(!['link','approval','accounts'].includes(mode))return reply({error:'invalid_mode'},400);
 const duration=Number(b.duration_hours||0);
 if(![0,1,2,3,24,48,168].includes(duration))return reply({error:'invalid_duration'},400);
 const active=await env.DB.prepare("SELECT COUNT(*) n FROM lk_guest_links WHERE meetup_id=? AND owner_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR julianday(expires_at)>julianday('now'))").bind(id,actor.id).first();
 if(active.n>=12)return reply({error:'link_limit',message:'وصلت إلى الحد الأقصى من الروابط. ألغِ رابطًا قديمًا أولًا.'},429);
 const token=random(),expiresAt=duration?new Date(Date.now()+duration*3600000).toISOString():null;
 await env.DB.prepare("INSERT INTO lk_guest_links(token_hash,meetup_id,owner_id,mode,can_view,can_upload,review_photos,expires_at) VALUES(?,?,?,?,?,?,?,?)").bind(await digest(token),id,actor.id,mode,canView?1:0,canUpload?1:0,canUpload&&b.review_photos===true?1:0,expiresAt).run();
 return reply({ok:true,url:url.origin+'/g/'+token,expiresAt,linkType:canUpload?'capture':'view'});
}


export async function guestPhotoInteraction(request,env,photoId,actorType,actorId){
 const url=new URL(request.url),method=request.method;
 const valid=/^[a-f0-9-]{36}$/.test(photoId||'');
 if(!valid||!['user','guest'].includes(actorType)||!actorId)return reply({error:'not_found'},404);
 if(method==='GET'){
  const [likes,comments]=await Promise.all([
   env.DB.prepare('SELECT actor_type,actor_id FROM lk_guest_photo_reactions WHERE photo_id=? LIMIT 1000').bind(photoId).all(),
   env.DB.prepare("SELECT c.id,c.body,c.created_at,COALESCE(u.display_name,g.display_name,'مشارك') AS display_name FROM lk_guest_photo_comments c LEFT JOIN users u ON c.actor_type='user' AND u.id=c.actor_id LEFT JOIN lk_guest_members g ON c.actor_type='guest' AND g.id=c.actor_id WHERE c.photo_id=? ORDER BY c.created_at DESC LIMIT 100").bind(photoId).all()
  ]);
  return reply({likes:likes.results.length,liked:likes.results.some(x=>x.actor_type===actorType&&x.actor_id===actorId),comments:comments.results});
 }
 if(method!=='POST')return reply({error:'method_not_allowed'},405);
 if(request.headers.get('origin')!==url.origin)return reply({error:'invalid_origin'},403);
 if(!(request.headers.get('content-type')||'').startsWith('application/json'))return reply({error:'json_required'},415);
 if(Number(request.headers.get('content-length')||0)>1200)return reply({error:'too_large'},413);
 let b;try{b=await request.json()}catch{return reply({error:'invalid_body'},400)}
 if(b.action==='like'){
  const old=await env.DB.prepare('SELECT 1 x FROM lk_guest_photo_reactions WHERE photo_id=? AND actor_type=? AND actor_id=?').bind(photoId,actorType,actorId).first();
  if(old)await env.DB.prepare('DELETE FROM lk_guest_photo_reactions WHERE photo_id=? AND actor_type=? AND actor_id=?').bind(photoId,actorType,actorId).run();
  else await env.DB.prepare('INSERT INTO lk_guest_photo_reactions(photo_id,actor_type,actor_id) VALUES(?,?,?)').bind(photoId,actorType,actorId).run();
  return reply({ok:true,liked:!old});
 }
 if(b.action==='comment'){
  const value=String(b.text||'').trim();
  if(!value||value.length>350)return reply({error:'invalid_comment'},400);
  const count=await env.DB.prepare("SELECT COUNT(*) n FROM lk_guest_photo_comments WHERE actor_type=? AND actor_id=? AND created_at>datetime('now','-1 minute')").bind(actorType,actorId).first();
  if(count.n>=10)return reply({error:'rate_limited'},429);
  await env.DB.prepare('INSERT INTO lk_guest_photo_comments(id,photo_id,actor_type,actor_id,body) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),photoId,actorType,actorId,value).run();
  return reply({ok:true});
 }
 return reply({error:'invalid_action'},400);
}
