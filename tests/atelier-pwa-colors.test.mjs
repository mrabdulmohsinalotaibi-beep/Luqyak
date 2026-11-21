import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
test('all installed-app manifest variants use the same olive and sand colors',()=>{
 const escapedQuote=String.fromCharCode(92,34);
 const themeKey='theme_color'+escapedQuote+':'+escapedQuote;
 const backgroundKey='background_color'+escapedQuote+':'+escapedQuote;
 const themeMatches=source.split(themeKey).length-1;
 const backgroundMatches=source.split(backgroundKey).length-1;
 assert.ok(themeMatches>=4,'Manifest theme variants are unexpectedly missing');
 assert.equal(backgroundMatches,themeMatches,'Theme and background variants must match');
 assert.equal(source.split(themeKey+'#354434').length-1,themeMatches);
 assert.equal(source.split(backgroundKey+'#F5F0E4').length-1,backgroundMatches);
 assert.ok(!source.includes(themeKey+'#242623'));
 assert.ok(!source.includes(backgroundKey+'#F8F6F1'));
});
test('logo assets, photo archive and production API remain in place',()=>{
 assert.match(source,/\/brand\/luqyak-icon-192\.png/);
 assert.match(source,/\/brand\/luqyak-icon-512\.png/);
 assert.match(source,/if\(path==='\/api\/social\/meetups'/);
 assert.match(source,/if\(path==='\/api\/social\/photo'/);
});
