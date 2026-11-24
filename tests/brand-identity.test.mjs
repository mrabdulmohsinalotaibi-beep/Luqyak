import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
const config = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');

test('Saudi Najdi identity and accessible app assets are wired', () => {
  assert.match(source, /LUQYAK_SAUDI_NAJDI_IDENTITY_V1/);
  assert.match(source, /LUQYAK_BRAND_PNG_2026_11_15/);
  assert.match(source, /\/brand\/luqyak-2026-logo\.svg/);
  assert.match(source, /\/brand\/luqyak-2026-icon\.svg/);
  assert.match(source, /\/brand\/luqyak-2026-icon\.png/);
  assert.match(source, /--wine:#395344/);
  assert.match(source, /--cream:#FAF6F2/);
  assert.match(source, /#963B24/);
});

test('PWA icon and bindings remain available', () => {
  assert.match(source, /apple-touch-icon/);
  assert.match(source, /application\/manifest\+json/);
  for (const binding of ['DB', 'PHOTOS', 'LIVE_CHANNEL']) {
    assert.match(config, new RegExp('"binding"\\s*:\\s*"'+binding+'"'), 'missing binding '+binding);
  }
});
