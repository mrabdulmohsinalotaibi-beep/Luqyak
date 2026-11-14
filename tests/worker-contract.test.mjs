import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const source = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');

test('three-step meetup flow and secure default', () => {
  for (const token of ['lkWizardProgress', 'lkBindMeetWizard', 'lkWizardSubmit', 'meetFriendChoice:checked', "value=\\\"specific\\\""]) {
    assert.ok(source.includes(token), `Missing ${token}`);
  }
});

test('home excludes elapsed and invited meetups from upcoming', () => {
  assert.match(source, /const upcoming=meetups\.filter\(m=>!m\.ended&&!m\.isInvited&&new Date\(m\.time\)\.getTime\(\)>=Date\.now\(\)\)/);
  assert.match(source, /const anniversaries=meetups\.filter\(m=>\(m\.ended\|\|m\.photos\?\.length\)&&sameHijriDay\(m\.time\)\)/);
});

test('worker never caches private API or media in offline handler', () => {
  const marker = "if(path==='/luqyak-sw.js')return new Response(";
  const begin = source.indexOf(marker);
  assert.ok(begin !== -1);
  const finish = source.indexOf(",{headers:{'content-type':'text/javascript; charset=utf-8'", begin);
  assert.ok(finish > begin);
  const workerJs = JSON.parse(source.slice(begin + marker.length, finish));
  new Script(workerJs, { filename: 'luqyak-sw.js' });
  assert.match(workerJs, /event\.request\.mode!=='navigate'/);
  assert.doesNotMatch(workerJs, /caches\.(?:open|put|match)/);
});

test('original account and media integrations remain in config', () => {
  const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.name, 'luqyak');
  assert.ok(config.d1_databases.some(x => x.binding === 'DB'));
  assert.ok(config.r2_buckets.some(x => x.binding === 'PHOTOS'));
  assert.ok(config.services.some(x => x.binding === 'LIVE_CHANNEL'));
});
