import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
const cropper = readFileSync(new URL('../src/profile-avatar-editor.js', import.meta.url), 'utf8');
const controls = readFileSync(new URL('../src/profile-avatar-controls.js', import.meta.url), 'utf8');

test('profile route checks origin and validates username', () => {
  const start = worker.indexOf("if(path==='/api/social/profile'&&method==='POST')");
  assert.ok(start > 0);
  const route = worker.slice(start, worker.indexOf("if(path==='/api/social/avatar'&&method==='GET')", start));
  assert.match(route, /csrf\(\)/);
  assert.match(route, /username_taken/);
  assert.match(route, /lower\(username\)/);
  assert.match(route, /UPDATE users SET display_name=\?,username=\? WHERE id=\?/);
});

test('profile editor includes username field and saves it', () => {
  assert.match(worker, /name=\\"username\\"/);
  assert.match(worker, /username:new FormData\(form\)\.get\('username'\)/);
});

test('avatar editor supports interactive crop and explicit confirmation', () => {
  assert.match(cropper, /pointermove/);
  assert.match(cropper, /data-save/);
  assert.match(cropper, /data-cancel/);
  assert.match(cropper, /toBlob/);
});

test('avatar controls use authenticated same-origin upload', () => {
  assert.match(controls, /credentials: 'same-origin'/);
  assert.match(controls, /openAvatarCropper\(file\)/);
  assert.match(controls, /\/api\/social\/avatar/);
});


test('Worker serves avatar editor and integrates cropper in the account UI', () => {
  assert.ok(worker.includes("path==='/src/profile-avatar-editor.js'"));
  assert.ok(worker.includes("import('/src/profile-avatar-editor.js')"));
  assert.ok(worker.includes("capture','user'"));
  assert.ok(worker.includes('border-radius:50%!important'));
});

test('Verified email change requires origin, OTP and updates email only after proof', () => {
  const start = worker.indexOf("if((path==='/api/social/email/request'");
  assert.ok(start > 0);
  const body = worker.slice(start, worker.indexOf("if(path==='/api/social/avatar'&&method==='GET')",start));
  for (const guard of ['if(!csrf())','profile-change:', 'rate_limited','code_hash','expires_at','UPDATE users SET email=']) {
    assert.ok(body.includes(guard), 'missing security guard: '+guard);
  }
  assert.ok(worker.includes('/api/social/email/verify'));
});
