import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
const theme = readFileSync(new URL('../luqyak-theme-response.js', import.meta.url), 'utf8');
const start = worker.indexOf('function home(){');
const end = worker.indexOf('async function lkHomeEnsureDetails', start);
const home = start >= 0 && end > start ? worker.slice(start, end) : '';

test('homepage renders one primary create action without duplicate destination shortcuts', () => {
  assert.ok(home, 'homepage renderer must exist');
  assert.equal(home.split('lk-home-shortcut-main').length - 1, 1);
  assert.ok(home.includes('meetQuick'));
  assert.ok(!home.includes('<strong>لقاءاتي</strong>'));
  assert.ok(!home.includes('<strong>ذكرياتي</strong>'));
  assert.ok(!home.includes('لقاءاتك وصورك وذكرياتك في مساحة واحدة.'));
});

test('home theme includes responsive square photos and a stable bottom add icon', () => {
  assert.ok(theme.includes('LUQYAK STRUCTURAL HOME FIX 2026-11-21'));
  assert.ok(theme.includes('aspect-ratio:1/1!important'));
  assert.ok(theme.includes('#bottom.lk-core-nav>button.lk-bottom-camera>.sym:before'));
  assert.ok(theme.includes("'cache-control':'no-store'"));
});
