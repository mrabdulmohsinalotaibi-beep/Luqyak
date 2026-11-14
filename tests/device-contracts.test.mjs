import test from 'node:test';
import assert from 'node:assert/strict';
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
  assert.match(html,/src="\/brand\/logo\.svg"/);
  const appManifest=await manifest.json();
  assert.equal(appManifest.display,'standalone');
  assert.ok(appManifest.icons.some(icon=>icon.src.includes('luqyak-user-upload-20261114.png')));
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
