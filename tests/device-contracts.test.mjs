import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker from '../worker.js';

const origin='https://luqyak.athat.app';
const ctx={waitUntil(){}};

test('installed mobile app has safe-area, active branding and resolvable PNG icon',async()=>{
  const [page,manifest]=await Promise.all([
    worker.fetch(new Request(origin+'/app'),{},ctx),
    worker.fetch(new Request(origin+'/manifest.webmanifest'),{},ctx)
  ]);
  assert.equal(page.status,200);
  const html=await page.text();
  assert.match(html,/viewport-fit=cover/);
  assert.match(html,/apple-mobile-web-app-capable/);
  assert.match(html,/src="\/brand\/luqyak-2026-logo\.svg\?v=20261115olivegold3"/);
  const appManifest=await manifest.json();
  assert.equal(appManifest.display,'standalone');
  assert.equal(appManifest.theme_color,'#354434');
  assert.equal(appManifest.background_color,'#F5F0E4');
  assert.ok(appManifest.icons.some(icon=>icon.type==='image/png' && icon.sizes==='192x192'));
  assert.ok(appManifest.icons.some(icon=>icon.type==='image/png' && icon.sizes==='512x512'));
  const touchIcon=html.match(/rel="apple-touch-icon"[^>]+href="([^"]+)"/)?.[1];
  assert.ok(touchIcon?.startsWith('/brand/luqyak-2026-icon.png?v='),'Current Apple icon missing');
  const iconRoute=await worker.fetch(new Request(new URL(touchIcon,origin)),{},ctx);
  assert.equal(iconRoute.status,302,'Apple icon alias must redirect to hosted PNG');
  const location=iconRoute.headers.get('location');
  assert.ok(location?.startsWith(origin+'/brand/luqyak-icon-512.png'));
  const icon=await worker.fetch(new Request(location),{},ctx);
  assert.equal(icon.status,200);
  assert.match(icon.headers.get('content-type')||'',/image\/png/);
  const bytes=new Uint8Array(await icon.arrayBuffer());
  assert.deepEqual([...bytes.slice(0,8)],[137,80,78,71,13,10,26,10]);
  const dimensions=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  assert.equal(dimensions.getUint32(16),512);
  assert.equal(dimensions.getUint32(20),512);
});

test('meetup creation is a three-step wizard and accepts privacy choice',async()=>{
  const page=await worker.fetch(new Request(origin+'/app'),{},ctx);
  const html=await page.text();
  assert.match(html,/lkWizardProgress/);
  assert.match(html,/lkMeetPrivacy/);
  assert.match(html,/lkChooseMap/);
  assert.match(html,/lkWizardSubmit/);
});

test('background notification route is same-origin and defaults to notifications',async()=>{
  const response=await worker.fetch(new Request(origin+'/luqyak-sw.js'),{},ctx);
  assert.equal(response.status,200);
  const js=await response.text();
  assert.match(js,/notificationclick/);
  assert.match(js,/self\.location\.origin/);
  assert.match(js,/\/notifications/);
});

test('private photo endpoint requires a session even for guessed IDs',async()=>{
  const response=await worker.fetch(new Request(origin+'/api/social/photo?id=00000000-0000-4000-8000-000000000001&photo=00000000-0000-4000-8000-000000000002'),{},ctx);
  assert.equal(response.status,401);
  assert.match(response.headers.get('cache-control')||'',/no-store/);
});


test('redesigned app includes syntactically valid browser scripts',async()=>{
 const page=await worker.fetch(new Request(origin+'/app'),{},ctx);
 const html=await page.text();
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
 assert.ok(scripts.length>0);
 for(const [,body] of scripts)if(body.trim())assert.doesNotThrow(()=>new vm.Script(body));
});


test('invited participants can join in one tap and share photos while only host ends meeting',async()=>{
 const page=await worker.fetch(new Request(origin+'/app'),{},ctx);
 const html=await page.text();
 assert.match(html,/data-quick-rsvp/);
 assert.match(html,/قبول والانضمام/);
 assert.match(html,/data-action="album"/);
 assert.match(html,/data-action="camera"/);
 assert.match(html,/m\.isOwner&&!m\.ended/);
 const source=(await import('node:fs/promises')).readFile;
 const code=await source(new URL('../worker.js',import.meta.url),'utf8');
 assert.match(code,/member\?\.status==='accepted'\)return \{view:true,post:true/);
 assert.match(code,/if\(!csrf\(\)\|\|!access\.post\)return json\(\{error:'not_allowed'\},403\)/);
 assert.match(code,/if\(!csrf\(\)\|\|!access\.owner\)return json\(\{error:'not_allowed'\},403\)/);
 assert.match(code,/m\.created_at,u\.display_name FROM lk_meetup_members/);
});

test('installed theme uses the same olive and sand colors as the app',async()=>{
 const [manifestResponse,appResponse]=await Promise.all([
  worker.fetch(new Request(origin+'/manifest.webmanifest'),{},ctx),
  worker.fetch(new Request(origin+'/app'),{},ctx)
 ]);
 assert.equal(manifestResponse.status,200);
 assert.equal(appResponse.status,200);
 const manifest=await manifestResponse.json();
 const html=await appResponse.text();
 assert.equal(manifest.theme_color,'#354434');
 assert.equal(manifest.background_color,'#F5F0E4');
 assert.match(html,/<meta name="theme-color" content="#354434"/);
 assert.match(html,/--wine:#354434/);
});
