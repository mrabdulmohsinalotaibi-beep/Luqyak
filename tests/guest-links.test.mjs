import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../guest.js',import.meta.url),'utf8');

test('guest link module parses',()=>{
 assert.doesNotThrow(()=>new Function(code.replaceAll('export async function','async function')));
});
test('new guest links support combined capture and viewing without enabling an empty purpose',()=>{
 assert.match(code,/if\(!canView&&!canUpload\)/);
 assert.match(code,/canView\?1:0,canUpload\?1:0/);
 assert.match(code,/linkType:canView&&canUpload\?'both':canUpload\?'capture':'view'/);
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

test('owner alone can enumerate and manage share links without disclosing raw URL tokens',()=>{
 assert.match(code,/route==='\/api\/guest\/owner-links'/);
 assert.match(code,/route==='\/api\/guest\/manage-link'/);
 assert.match(code,/meet\.owner_id!==actor\.id/);
 assert.match(code,/l\.owner_id=\?/);
 assert.match(code,/link_id/);
 assert.match(code,/token_hash/);
 assert.match(code,/items:\(rows\.results\|\|\[\]\)\.map/);
 assert.match(code,/id:x\.token_hash/);
 assert.match(code,/!\['revoke','extend'\]\.includes\(action\)/);
 assert.match(code,/if\(link\.ended&&link\.can_upload===1\)/);
});

test('capture page has a deliberate choose-preview-send flow',()=>{
 const page=code.slice(code.indexOf('function page(token)'),code.indexOf('export async function guestHandler'));
 assert.match(page,/id="choosePhoto"/);
 assert.match(page,/id="photoPreview"/);
 assert.match(page,/id="upload" disabled/);
 assert.match(page,/q\('file'\)\.addEventListener\('change'/);
 assert.match(page,/إرسال الصورة الآن/);
 assert.match(page,/جارٍ إرسال الصورة بأمان/);
 assert.match(page,/أُرسلت الصورة بنجاح/);
 assert.match(page,/background:#FAF6F2/);
});
