import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');

test('new identity preserves original logo asset', () => {
  assert.match(worker, /\/brand\/logo\.svg/);
  assert.match(worker, /Logo matched identity 2026-11-14/);
});

test('logo palette is applied to the live app', () => {
  for (const color of ['#2F5D4B', '#9A3D27', '#7A4E3A', '#EADFCF', '#F8F5F1']) {
    assert.ok(worker.includes(color), 'missing logo color '+color);
  }
});

test('all four new navigation shortcuts have supported actions', () => {
  const start = worker.indexOf('<nav class=\\\"lk-identity-shortcuts');
  const end = worker.indexOf('</nav>', start);
  assert.ok(start > 0 && end > start, 'missing shortcuts');
  const nav = worker.slice(start,end);
  for(const action of ['meetQuick','memories','chats']) {
    assert.ok(nav.includes('data-action=\\\"'+action+'\\\"'), 'missing action '+action);
  }
  assert.match(worker, /else if\(\['home','chats','meet','memories','account','settings'\]\.includes\(x\)\)choose\(x\)/);
});

test('responsive and accessible interactions remain enabled', () => {
  assert.match(worker, /@media\(max-width:390px\)/);
  assert.match(worker, /@media\(min-width:950px\)/);
  assert.match(worker, /focus-visible/);
  assert.match(worker, /prefers-reduced-motion/);
});
