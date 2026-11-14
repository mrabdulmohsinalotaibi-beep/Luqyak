import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const origin='https://luqyak.athat.app';
const ctx={waitUntil() {}};
async function get(path) {
  return worker.fetch(new Request(origin+path),{},ctx);
}

test('PWA manifest is valid and points to Luqyak',async()=>{
  const response=await get('/manifest.webmanifest');
  assert.equal(response.status,200);
  const manifest=await response.json();
  assert.match(manifest.name,/Luqyak|لُق/);
  assert.ok(manifest.icons?.length>=1);
  assert.equal(manifest.display,'standalone');
});

test('service worker provides offline navigation and notification routing',async()=>{
  const response=await get('/luqyak-sw.js');
  assert.equal(response.status,200);
  const code=await response.text();
  assert.match(code,/notificationclick/);
  assert.match(code,/addEventListener\('push'/);
  assert.match(code,/addEventListener\('fetch'/);
  assert.match(response.headers.get('cache-control')||'',/no-store/);
});

test('social home contains quick creation, invitation strip and memory experience',async()=>{
  const response=await get('/app');
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/meetQuick/);
  assert.match(html,/incomingInvites/);
  assert.match(html,/inviteStrip/);
  assert.match(html,/memoryBook/);
  assert.match(html,/camera/);
});

test('HTML protects app routes from public caching',async()=>{
  const response=await get('/app');
  assert.match(response.headers.get('cache-control')||'',/no-store/);
});

test('worker does not write user data during read-only public smoke tests',async()=>{
  const response=await get('/manifest.webmanifest');
  assert.equal(response.status,200);
});

test('anonymous users cannot fetch private images or private/account chats',async()=>{
  const paths=[
    '/api/social/photo?id=00000000-0000-4000-8000-000000000001&photo=00000000-0000-4000-8000-000000000002',
    '/api/chat/messages?peer=00000000-0000-4000-8000-000000000001',
    '/api/private/status',
    '/api/social/profile'
  ];
  for(const path of paths){
    const response=await get(path);
    assert.equal(response.status,401,path);
    assert.match(response.headers.get('cache-control')||'',/no-store/,path);
  }
});

test('anonymous users cannot submit meetup or chat data',async()=>{
  const requests=[
    ['/api/social/create',{title:'test',place:'test'}],
    ['/api/chat/send',{text:'test'}],
    ['/api/private/send',{ciphertext:'test'}]
  ];
  for(const [path,body] of requests){
    const response=await worker.fetch(new Request(origin+path,{
      method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)
    }),{},ctx);
    assert.equal(response.status,401,path);
  }
});


test('account chat explicitly discloses that server-backed messages are not end-to-end encrypted',async()=>{
  const response=await get('/account-chat');
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/ليست مشفّرة من الطرف إلى الطرف/);
  assert.match(html,/href="\/private"/);
  assert.match(response.headers.get('cache-control')||'',/no-store/);
});

test('private image responses require authorized viewing and are not publicly cacheable',async()=>{
  const source=(await import('node:fs/promises')).readFile;
  const code=await source(new URL('../worker.js',import.meta.url),'utf8');
  assert.match(code,/if\(!access\.view\)return json\(\{error:'not_found'\},404\)/);
  assert.match(code,/'cache-control':'private, no-store'/);
  assert.match(code,/member\?\.status==='accepted'/);
});

test('account chat rate-limits and deduplicates sends, but is NOT cryptographically authenticated E2EE',async()=>{
  const code=await (await import('node:fs/promises')).readFile(new URL('../worker.js',import.meta.url),'utf8');
  assert.match(code,/INSERT OR IGNORE INTO lk_account_messages/);
  assert.match(code,/client_id/);
  assert.match(code,/rate_limited/);
  assert.match(code,/const body=String\(payload\?\.text\|\|''\)\.trim\(\)/);
});

test.todo('two-device encryption and account-chat ciphertext verification requires dedicated test accounts');
test.todo('closed-app iOS and Android push delivery needs physical device test');
test.todo('unauthorized album access after membership revocation needs isolated D1 fixture');

test('account chat refuses client-ID replay to a different recipient without writes',async()=>{
  const actor='00000000-0000-4000-8000-000000000010';
  const peer='00000000-0000-4000-8000-000000000011';
  const other='00000000-0000-4000-8000-000000000012';
  const clientId='00000000-0000-4000-8000-000000000013';
  let writes=0;
  const env={DB:{prepare(sql){
    return {
      bind(...args){
        return {
          async first(){
            if(sql.includes('FROM auth_sessions'))return {id:actor,username:'tester',display_name:'Tester'};
            if(sql.includes('FROM lk_user_blocks'))return null;
            if(sql.includes('FROM luqyak_friend_requests'))return {x:1};
            if(sql.includes('COUNT(*) n FROM lk_account_messages'))return {n:0};
            if(sql.includes('SELECT id,created_at,recipient_id,body FROM lk_account_messages'))return {id:'existing',created_at:123,recipient_id:other,body:'hello'};
            throw new Error('Unexpected query: '+sql);
          },
          async run(){writes++;throw new Error('Unexpected write')},
        };
      }
    };
  }}};
  const response=await worker.fetch(new Request(origin+'/api/chat/send?peer='+peer,{
    method:'POST',
    headers:{'content-type':'application/json',origin,cookie:'__Host-luqyak_session='+('a'.repeat(64))},
    body:JSON.stringify({text:'hello',client_id:clientId})
  }),env,ctx);
  assert.equal(response.status,409);
  assert.equal((await response.json()).error,'client_id_conflict');
  assert.equal(writes,0);
});
