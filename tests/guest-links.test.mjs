import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../guest.js',import.meta.url),'utf8');

test('guest link module parses',()=>{
 assert.doesNotThrow(()=>new Function(code.replaceAll('export async function','async function')));
});
test('new guest links cannot combine capture and viewing',()=>{
 assert.match(code,/canView===canUpload/);
 assert.match(code,/canView\?1:0,canUpload\?1:0/);
 assert.match(code,/linkType:canUpload\?'capture':'view'/);
});
test('sharing duration and revocation are enforced by server',()=>{
 assert.match(code,/julianday\(l\.expires_at\)>julianday\('now'\)/);
 assert.match(code,/julianday\(expires_at\)>julianday\('now'\)/);
 assert.match(code,/duration\*3600000/);
 assert.match(code,/!link\.ended/);
 assert.match(code,/revoked_at IS NULL/);
});
test('guest experience distinguishes camera-only from read-only album',()=>{
 assert.match(code,/v\.access==='capture'/);
 assert.match(code,/v\.access==='view'/);
 assert.match(code,/!v\.allowed&&!v\.canUpload/);
 assert.match(code,/read_only_link/);
});
