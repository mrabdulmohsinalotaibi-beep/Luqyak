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


test('Worker actually serves the avatar editor module and connects it to profile', () => {
  assert.match(worker, /path==='\\/src\\/profile-avatar-editor\\.js'/);
  assert.match(worker, /import\\('\\/src\\/profile-avatar-editor\\.js'\\)/);
  assert.match(worker, /capture','user'/);
  assert.match(worker, /border-radius:50%!important/);
});

test('Changing email requires an active user, same-origin POST and code verification', () => {
  const request = worker.indexOf("if((path==='/api/social/email/request'");
  assert.ok(request > 0);
  const body = worker.slice(request, worker.indexOf("if(path==='/api/social/avatar'&&method==='GET')",request));
  assert.match(body, /if\\(!csrf\\(\\)\\)/);
  assert.match(body, /profile-change:/);
  assert.match(body, /rate_limited/);
  assert.match(body, /code_hash/);
  assert.match(body, /expires_at/);
  assert.match(body, /UPDATE users SET email=\\?,email_verified_at=\\? WHERE id=\\?/);
  assert.match(worker, /api\\/social\\/email\\/verify/);
});
