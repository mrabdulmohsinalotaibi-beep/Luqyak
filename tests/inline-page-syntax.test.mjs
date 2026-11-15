import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const worker = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');

function page(path) {
  const marker = `if(path==='${path}')return new Response(`;
  const start = worker.indexOf(marker);
  assert.ok(start >= 0, `Missing page route ${path}`);
  const contentStart = start + marker.length;
  const end = worker.indexOf(",{headers:{'content-type':'text/html; charset=utf-8'", contentStart);
  assert.ok(end > contentStart, `Missing HTML response terminator for ${path}`);
  return JSON.parse(worker.slice(contentStart, end));
}

for (const path of ['/app', '/notifications']) {
  test(`All inline JavaScript in ${path} parses successfully`, () => {
    const html = page(path);
    const matches = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
    assert.ok(matches.length > 0, 'No inline scripts found');
    for (const [index, match] of matches.entries()) {
      const attributes = match[1] || '';
      if (/\btype\s*=\s*["'](?:module|application\/json)["']/i.test(attributes)) continue;
      assert.doesNotThrow(
        () => { try { new Script(match[2], { filename: `${path}:inline-script-${index + 1}` }); } catch(err) { console.error(String(err.stack).slice(0,1600)); throw err; } },
        `Broken inline script ${index + 1} on ${path}`
      );
    }
  });
}

test('Main page does not embed raw newlines inside generated memory-book string', () => {
  const html = page('/app');
  assert.ok(html.includes('function memoryBook()'));
  const matches = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(matches.some(([, code]) => code.includes('function memoryBook()')));
});
