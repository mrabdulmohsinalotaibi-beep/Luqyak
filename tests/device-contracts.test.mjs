import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker from '../worker.js';

const origin='https://luqyak.athat.app';
const ctx={waitUntil(){}};

test('installed mobile app has safe-area and standalone metadata',async()=>{
  const [page,manifest]=await Promise.all([
    worker.fetch(new Request(origin+'/app'),{},ctx),
    worker.fetch(new Request(origin+'/manifest.webmanifest'),{},ctx)
  ]);
  assert.equal(page.status,200);
  const html=await page.text();
  assert.match(html,/viewport-fit=cover/);
  assert.match(html,/apple-mobile-web-app-capable/);
  assert.match(html,/src="\/brand\/luqyak-logo-transparent\.svg\?v=20261114c"/);
  const appManifest=await manifest.json();
  assert.equal(appManifest.display,'standalone');
  assert.match(html,/rel="apple-touch-icon"[^>]+luqyak-home-white-20261114\.png/);
  const icon=await worker.fetch(new Request(origin+'/brand/luqyak-home-white-20261114.png'),{},ctx);
  assert.equal(icon.headers.get('content-type'),'image/png');
  const iconBytes=new Uint8Array(await icon.arrayBuffer());
  assert.equal(iconBytes[25],3); // indexed PNG
  const imageChunks=new TextDecoder('latin1').decode(iconBytes);
  assert.equal(imageChunks.includes('tRNS'),false); // opaque icon; iOS will not fill transparency with black
  assert.ok(appManifest.icons.some(icon=>icon.src.includes('luqyak-home-white-20261114.png') && icon.type==='image/png' && icon.sizes==='180x180'));
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
