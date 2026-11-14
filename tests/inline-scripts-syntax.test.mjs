import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');

function pageHtml(route) {
  const entry = "if(path==='" + route + "')return new Response(";
  const start = source.indexOf(entry);
  assert.ok(start >= 0, 'missing route ' + route);
  const q = start + entry.length;
  assert.equal(source[q], '"');
  let i = q + 1;
  for (; i < source.length; i++) {
    if (source[i] === '\\') { i++; continue; }
    if (source[i] === '"') break;
  }
  return JSON.parse(source.slice(q, i + 1));
}

test('All embedded /app JavaScript scripts parse (not just worker.js)', () => {
  const html = pageHtml('/app');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  assert.ok(scripts.length >= 4);
  for (const [i, script] of scripts.entries()) {
    assert.doesNotThrow(() => new Function(script), 'inline script #'+i+' fails to parse');
  }
});

test('Memory-book CSS stays in its own string and app has logo palette', () => {
  const html = pageHtml('/app');
  assert.ok(html.includes('Logo matched identity'));
  assert.ok(html.includes('lk-identity-shortcuts'));
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const main = scripts.find(s => s[1].includes('function memoryBook()'))?.[1];
  assert.ok(main,'memory book function missing');
  assert.ok(main.includes('window.print()'));
});
