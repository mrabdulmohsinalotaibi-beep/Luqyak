import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');

test('new identity preserves original logo asset', () => {
  assert.match(worker, /\/brand\/logo\.svg/);
  assert.match(worker, /Logo matched identity 2026-11-14/);
});

const appMarker="if(path==='/app')return new Response(";
const appStart=worker.indexOf(appMarker)+appMarker.length;
const appEnd=worker.indexOf(",{headers:",appStart);
assert.ok(appStart>=appMarker.length&&appEnd>appStart);
const html=JSON.parse(worker.slice(appStart,appEnd));

test('active olive and sand palette is applied to the served app', () => {
  assert.match(html,/<meta name="theme-color" content="#354434">/);
  assert.match(html,/--wine:#354434/);
  assert.match(html,/--cream:#F5F0E4/);
  assert.match(html,/#BE9F57/);
});

test('main navigation keeps three tabs and an accessible create-meeting action', () => {
  const nav=html.match(/<nav class="bottom lk-bottom-premium lk-core-nav"[^>]*>([\\s\\S]*?)<\\/nav>/)?.[1];
  assert.ok(nav,'missing compact navigation');
  assert.deepEqual([...nav.matchAll(/data-tab="([^"]+)"/g)].map(x=>x[1]),['home','meet','memories']);
  assert.match(nav,/data-action="meetQuick"/);
  assert.match(nav,/aria-label="إنشاء لقاء"/);
  assert.doesNotMatch(nav,/data-(?:tab|action)="chats"/);
});

test('responsive and accessible interactions remain enabled', () => {
  assert.match(worker, /@media\(max-width:390px\)/);
  assert.match(worker, /@media\(min-width:950px\)/);
  assert.match(worker, /focus-visible/);
  assert.match(worker, /prefers-reduced-motion/);
});
