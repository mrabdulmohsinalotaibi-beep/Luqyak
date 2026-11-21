import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
const theme = readFileSync(new URL('../luqyak-theme-response.js', import.meta.url), 'utf8');
const start = worker.indexOf('function home(){');
const end = worker.indexOf('async function lkHomeEnsureDetails', start);
const home = start >= 0 && end > start ? worker.slice(start, end) : '';

test('photo-first home removes the old banner and duplicate shortcuts', () => {
 assert.ok(home, 'homepage renderer must exist');
 assert.ok(home.includes('lk-home-reimagined'));
 assert.ok(home.includes('lk-home-intro'));
 assert.ok(!home.includes('lk-home-hero'));
 assert.ok(!home.includes('lk-home-shortcut-main'));
 assert.ok(!home.includes('lk-home-shortcuts'));
 assert.ok(home.includes('lk-home-story-track'));
 assert.ok(home.indexOf('lk-home-story-track') < home.indexOf('lk-night-feature'), 'photos should precede the meetup card');
 assert.ok(home.includes('meetQuick'), 'empty meetup state must offer creation');
 assert.ok(home.includes('data-action=\\\"meet\\\"'), 'meetup section must remain navigable');
 assert.ok(home.includes('data-home-filter=\\\"latest\\\"'), 'full feed must remain available');
});

test('responsive image grid and consistent add button remain in the theme', () => {
 assert.ok(theme.includes('LUQYAK EDITORIAL HOME 2026-11-21'));
 assert.ok(theme.includes('grid-template-columns:repeat(2,minmax(0,1fr))!important'));
 assert.ok(theme.includes('aspect-ratio:1/1!important'));
 assert.ok(theme.includes('#bottom.lk-core-nav>button.lk-bottom-camera>.sym:before'));
 assert.ok(theme.includes("'cache-control':'no-store'"));
});
