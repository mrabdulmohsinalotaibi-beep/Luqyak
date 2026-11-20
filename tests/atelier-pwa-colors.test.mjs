import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
test('all installed-app manifest variants use the same charcoal and ivory colors',()=>{
 const theme=String.raw`\\"theme_color\\":\\"#242623\\"`;
 const background=String.raw`\\"background_color\\":\\"#F8F6F1\\"`;
 assert.equal(source.split(theme).length-1,4);
 assert.equal(source.split(background).length-1,4);
 assert.doesNotMatch(source,/theme_color\\":\\"#006C35/);
 assert.doesNotMatch(source,/background_color\\":\\"#F7F1E9/);
});
test('logo assets, photo archive and production API remain in place',()=>{
 assert.match(source,/\/brand\/luqyak-icon-192\.png/);
 assert.match(source,/\/brand\/luqyak-icon-512\.png/);
 assert.match(source,/if\(path==='\/api\/social\/meetups'/);
 assert.match(source,/if\(path==='\/api\/social\/photo'/);
});
