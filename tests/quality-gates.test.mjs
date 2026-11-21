import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const origin='https://luqyak.athat.app';
const ctx={waitUntil() {}};
async function get(path) {
  return worker.fetch(new Request(origin+path),{},ctx);
}

test('PWA manifest is valid and points to Luqyak',async()=>{
  const response=await get('/manifest.webmanifest');
  assert.equal(response.status,200);
  const manifest=await response.json();
  assert.match(manifest.name,/Luqyak|لُق/);
  assert.ok(manifest.icons?.length>=1);
  assert.equal(manifest.display,'standalone');
});

test('service worker provides offline navigation and notification routing',async()=>{
  const response=await get('/luqyak-sw.js');
  assert.equal(response.status,200);
  const code=await response.text();
  assert.match(code,/notificationclick/);
  assert.match(code,/addEventListener\('push'/);
  assert.match(code,/addEventListener\('fetch'/);
  assert.match(response.headers.get('cache-control')||'',/no-store/);
});

test('simplified social home exposes documentation, meetup and memory flows',async()=>{
  const response=await get('/app');
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/meetQuick/);
  assert.match(html,/اللقاءات تصنع الحكاية/);
  assert.match(html,/لحظات الأصدقاء/);
  assert.match(html,/lk-home-story-track/);
  assert.match(html,/data-tab="home"/);
  assert.match(html,/data-tab="meet"/);
  assert.match(html,/data-tab="memories"/);
  assert.doesNotMatch(html,/data-tab="chats"/);
  assert.match(html,/memoryBook/);
  assert.match(html,/camera/);
});

test('HTML protects app routes from public caching',async()=>{
  const response=await get('/app');
  assert.match(response.headers.get('cache-control')||'',/no-store/);
});

test('worker does not write user data during read-only public smoke tests',async()=>{
  const response=await get('/manifest.webmanifest');
  assert.equal(response.status,200);
});

test('messaging endpoints are permanently disabled without touching user data',async()=>{
 const paths=['/api/chat/list','/api/chat/messages','/api/chat/send','/api/chat/read','/api/private/status','/api/private/key','/api/private/lookup','/api/private/send','/api/private/inbox','/api/private/ack'];
 for(const path of paths){
  for(const method of ['GET','POST']){
   const res=await worker.fetch(new Request(origin+path,{method,headers:method==='POST'?{'content-type':'application/json',origin}:undefined,body:method==='POST'?'{}':undefined}),{},ctx);
   assert.equal(res.status,410,path+' '+method);
   assert.equal((await res.json()).error,'feature_removed');
  }
 }
});

test('server-backed legacy chat UI is retired',async()=>{
 const response=await get('/account-chat');
 assert.equal(response.status,302);
 assert.match(response.headers.get('location')||'',/\/app\?tab=chats$/);
});

test('private image responses require authorized viewing and are not publicly cacheable',async()=>{
  const source=(await import('node:fs/promises')).readFile;
  const code=await source(new URL('../worker.js',import.meta.url),'utf8');
  assert.match(code,/if\(!access\.view\)return json\(\{error:'not_found'\},404\)/);
  assert.match(code,/'cache-control':'private, no-store'/);
  assert.match(code,/member\?\.status==='accepted'/);
});

test('old account chat and encrypted relay implementation are absent',async()=>{
 const code=await (await import('node:fs/promises')).readFile(new URL('../worker.js',import.meta.url),'utf8');
 assert.doesNotMatch(code,/function lkAccountChat\(/);
 assert.doesNotMatch(code,/if\(path==='\/api\/private\/send'\)/);
 assert.doesNotMatch(code,/INSERT OR IGNORE INTO lk_account_messages/);
 assert.match(code,/feature_removed/);
});
test.todo('closed-app iOS and Android notification delivery needs physical device test');
test.todo('unauthorized album access after membership revocation needs isolated D1 fixture');

test('in-app logo uses an alpha-safe existing SVG, without a baked-in white square',async()=>{
  const logo=await get('/brand/luqyak-2026-logo.svg');
  assert.equal(logo.status,200);
  assert.match(logo.headers.get('content-type')||'',/image\/svg\+xml/);
  const svg=await logo.text();
  assert.match(svg,/<svg\b/);
  assert.match(svg,/<path\b/);
  assert.doesNotMatch(svg,/<rect\b[^>]*fill=["'](?:white|#fff(?:fff)?|#F7F1E9)["']/i);
  const app=await get('/app');
  assert.equal(app.status,200);
  assert.ok((await app.text()).includes('src="/brand/luqyak-2026-logo.svg?v=20261115olivegold3"'));
});

test('account settings no longer expose per-device display preferences',async()=>{
  const response=await get('/app');
  assert.equal(response.status,200);
  const html=await response.text();
  assert.doesNotMatch(html,/تفضيلات العرض|عرض مكثف|lkCompactPref|lkMotionPref|lkApplyDisplayOptions/);
  assert.doesNotMatch(html,/lk-compact|lk-less-motion/);
});
test('social UI includes consistent responsive dimensions and OS motion accessibility',async()=>{
  const response=await get('/app');
  const html=await response.text();
  assert.match(html,/--lk-content-width:720px/);
  assert.match(html,/One unified responsive density across phone, tablet, desktop/);
  assert.match(html,/prefers-reduced-motion:reduce/);
  assert.match(html,/viewport-fit=cover/);
});

test('friendship endpoints remain protected by active sessions and same-origin requests',async()=>{
 const token='__Host-luqyak_session='+('a'.repeat(64));
 const env={DB:{prepare(sql){return {bind(){return {async first(){if(sql.includes('FROM auth_sessions'))return {id:'00000000-0000-4000-8000-000000000010',username:'tester'};throw Error('unexpected database read')}}}}}}};
 for(const extra of [{},{origin:'https://attacker.example'}]){
  const res=await worker.fetch(new Request(origin+'/api/private/friends/request',{method:'POST',headers:{cookie:token,'content-type':'application/json',...extra},body:JSON.stringify({username:'some_friend'})}),env,ctx);
  assert.equal(res.status,403);
  assert.equal((await res.json()).error,'cross_site_request_rejected');
 }
});

test('blocked meetup owner cannot expose photo bytes or private details to the blocked account',async()=>{
  const actor='00000000-0000-4000-8000-000000000010';
  const host='00000000-0000-4000-8000-000000000011';
  const meetupId='00000000-0000-4000-8000-000000000012';
  let photoReads=0,queries=[];
  const env={
    DB:{prepare(sql){
      queries.push(sql);
      return {bind(){return {
        async first(){
          if(sql.includes('FROM auth_sessions'))return {id:actor,username:'visitor',display_name:'Visitor'};
          if(sql.includes('SELECT * FROM lk_meetups'))return {id:meetupId,owner_id:host,privacy:'friends'};
          if(sql.includes('FROM lk_user_blocks'))return {x:1};
          throw Error('Unexpected read: '+sql);
        },
        async all(){throw Error('Blocked user must not be able to enumerate private details')},
        async run(){throw Error('No writes allowed')}
      }}};
    }},
    PHOTOS:{async get(){photoReads++;throw Error('Photo bytes must never be fetched')}}
  };
  const headers={cookie:'__Host-luqyak_session='+('a'.repeat(64))};
  const photo=await worker.fetch(new Request(origin+'/api/social/photo?id='+meetupId+'&photo=00000000-0000-4000-8000-000000000013',{headers}),env,ctx);
  assert.equal(photo.status,404);
  assert.equal(photoReads,0);
  const details=await worker.fetch(new Request(origin+'/api/social/meetup?id='+meetupId,{headers}),env,ctx);
  assert.equal(details.status,404);
  assert.ok(queries.some(q=>q.includes('FROM lk_user_blocks')));
});

test('repeat photo upload never overwrites R2; interrupted upload metadata can recover',async()=>{
 const id='00000000-0000-4000-8000-000000000001',userId='00000000-0000-4000-8000-000000000002';
 const file=new Uint8Array(200);file[0]=255;file[1]=216;file[198]=255;file[199]=217;
 let puts=0,inserted=0;
 const env={
  DB:{prepare(sql){return {bind(){return {
   async first(){
    if(sql.includes('FROM auth_sessions'))return {id:userId,username:'owner',display_name:'Owner'};
    if(sql.includes('SELECT * FROM lk_meetups'))return {id,owner_id:userId,privacy:'private',title:'Test'};
    if(sql.includes('SELECT id FROM lk_meetup_photos'))return null;
    throw new Error('Unexpected read: '+sql);
   },
   async run(){
    if(sql.includes('INSERT OR IGNORE INTO lk_meetup_photos')){inserted++;return {meta:{changes:1}}}
    throw new Error('Unexpected write: '+sql);
   }
  }}}}},
  PHOTOS:{async put(key,data,options){
   puts++;assert.match(key,/^meetup-albums\//);
   assert.equal(options.onlyIf.etagDoesNotMatch,'*');
   return null; // Another concurrent request already stored original image.
  }}
 };
 const response=await worker.fetch(new Request(origin+'/api/social/upload?id='+id,{
   method:'POST',
   headers:{cookie:'__Host-luqyak_session='+('a'.repeat(64)),origin,'content-type':'image/jpeg','x-luqyak-upload-id':'00000000-0000-4000-8000-000000000003'},
   body:file
 }),env,{});
 assert.equal(response.status,200);
 assert.equal((await response.json()).recovered,true);
 assert.equal(puts,1);
 assert.equal(inserted,1);
});


test('square 1:1 crop editor is served and required for camera and photo-library uploads',async()=>{
 const response=await get('/src/square-photo-editor.js');
 assert.equal(response.status,200);
 assert.ok((response.headers.get('content-type')||'').includes('application/javascript'));
 const script=await response.text();
 for(const phrase of ['export async function openSquarePhotoEditor','canvas.width = canvas.height = 720','touch-action:none','out.toBlob','centerX-size/2,centerY-size/2,size,size']){
  assert.ok(script.includes(phrase),'Square editor missing: '+phrase);
 }
 const app=await (await get('/app')).text();
 for(const phrase of ['id="cameraFile"','id="albumFiles"','lk-camera-stage','openSquarePhotoEditor(file)','if(!blob)return','aspect-ratio:1/1']){
  assert.ok(app.includes(phrase),'Application missing: '+phrase);
 }
 const guest=await (await import('node:fs/promises')).readFile(new URL('../guest.js',import.meta.url),'utf8');
 assert.ok(guest.includes('openSquarePhotoEditor(f)'));
 assert.ok(guest.includes("script-src 'self' 'unsafe-inline'"));
});


test('Memories shows six personal photos per page and rectangular meetup albums',async()=>{
 const page=await get('/app');
 assert.equal(page.status,200);
 const html=await page.text();
 assert.ok(html.includes('myMemoriesRoot'));
 assert.ok(html.includes("import('/src/my-memories.js')"));
 const script=await get('/src/my-memories.js');
 assert.equal(script.status,200);
 const code=await script.text();
 for(const keyword of ['const perPage=6','lk-my-grid','lk-my-album-tab','touchstart','touchend','/api/social/my-photos','/api/social/meetup?id=']){
   assert.ok(code.includes(keyword),'Missing Memories feature: '+keyword);
 }
});
test('personal-photo API filters upload ownership and reuses photo permission checks',async()=>{
 const code=await (await import('node:fs/promises')).readFile(new URL('../worker.js',import.meta.url),'utf8');
 assert.ok(code.includes("if(path==='/api/social/my-photos'&&method==='GET')"));
 assert.ok(code.includes('FROM lk_meetup_photos p WHERE p.uploader_id=?'));
 assert.ok(code.includes("g.claimed_user_id=? AND g.status='accepted'"));
 assert.ok(code.includes('const permissions=await can(m)'));
});

test('served Memories module always matches the source file',async()=>{
 const response=await get('/src/my-memories.js');
 assert.equal(response.status,200);
 const served=await response.text();
 const source=await (await import('node:fs/promises')).readFile(new URL('../src/my-memories.js',import.meta.url),'utf8');
 assert.equal(served,source,'Update the embedded Worker module when its source changes');
 assert.match(served,/const perPage=6/);
});
