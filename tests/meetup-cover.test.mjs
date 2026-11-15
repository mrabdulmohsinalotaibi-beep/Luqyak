import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
test('meetup cover change requires owner and checks that photo belongs to the meetup',()=>{
 assert.match(code,/LUQYAK_COVER_API_V1/);
 assert.match(code,/if\(!csrf\(\)\|\|!access\.owner\)return json\(\{error:'not_allowed'\},403\)/);
 assert.match(code,/SELECT id FROM lk_meetup_photos WHERE id=\? AND meetup_id=\?/);
 assert.match(code,/lk_guest_photos WHERE id=\? AND meetup_id=\? AND status='approved'/);
});
test('cover is visible on meetups and deletions keep metadata consistent',()=>{
 assert.match(code,/lk_meetup_covers/);
 assert.match(code,/ORDER BY CASE WHEN p2\.id=/);
 assert.match(code,/DELETE FROM lk_meetup_covers WHERE meetup_id=\? AND photo_id=\?/);
 assert.match(code,/DELETE FROM lk_meetup_covers WHERE meetup_id=\?'/);
});
test('owner-only cover picker has a dedicated photo grid and save control',()=>{
 assert.match(code,/LUQYAK_COVER_PICKER_UI_V1/);
 assert.match(code,/m\.isOwner&&rows\.length/);
 assert.match(code,/chooseCoverPhoto/);
 assert.match(code,/lk-cover-picker-grid/);
 assert.match(code,/LUQYAK_COVER_PICKER_CSS_V1/);
});
