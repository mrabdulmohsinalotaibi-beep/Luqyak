// Integration exercises the real V2 relay against an actual SQLite database and R2-like object store.
// No production accounts, buckets, or APIs are touched.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {webcrypto} from 'node:crypto';
import {v2RelayHandler} from '../v2-relay.js';
import {generateDeviceIdentity,sealPhoto,openPhoto} from '../src/secure-photo-envelope.js';
import {cleanupAcknowledgedV2} from '../v2-cleanup.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const ORIGIN='https://luqyak.athat.app';
const ownerId='user-local-1';
const meetupId='f822fe87-a3a4-40eb-b8c8-11017f22ac0a';
const deviceId='edb93bbc-8206-4c60-a040-64718f922901';
const token='b'.repeat(64);
const hex=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const b64=input=>Buffer.from(input).toString('base64');
function setup(){
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE users(id TEXT PRIMARY KEY,account_status TEXT NOT NULL); CREATE TABLE auth_sessions(user_id TEXT,token_hash TEXT,expires_at TEXT); CREATE TABLE lk_meetups(id TEXT PRIMARY KEY,owner_id TEXT,title TEXT,ended INTEGER);');
 db.prepare('INSERT INTO users VALUES(?,?)').run(ownerId,'active');
 db.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(ownerId,Buffer.from(''), '2099-01-01T00:00:00.000Z');
 db.prepare('UPDATE auth_sessions SET token_hash=?').run(Buffer.from(token,'utf8').length===64?'':null);
 db.prepare('UPDATE auth_sessions SET token_hash=?').run('placeholder');
 db.prepare('INSERT INTO lk_meetups VALUES(?,?,?,?)').run(meetupId,ownerId,'لقاء تجريبي',0);
 db.exec(readFileSync(new URL('../migrations/20261120_local_first_v2.sql',import.meta.url),'utf8'));
 const objects=new Map();
 const env={
  DB:{prepare(sql){const s=db.prepare(sql);let bound=[];
   const stmt={bind(...args){bound=args;return stmt},async first(){return s.get(...bound)||null},async all(){return {results:s.all(...bound)}},async run(){const r=s.run(...bound);return {meta:{changes:r.changes}}}};
   return stmt;
  }},
  PHOTOS:{
   async put(key,data,opts={}){if(opts?.onlyIf?.etagDoesNotMatch==='*'&&objects.has(key))return null;objects.set(key,new Uint8Array(data));return {key}},
   async get(key){const bytes=objects.get(key);return bytes?{body:bytes}:null},
   async delete(key){objects.delete(key)}
  }
 };
 return {db,env,objects};
}
function req(path,{method='GET',auth=false,body,headers={}}={}){
 const h=new Headers(headers);
 if(auth)h.set('cookie','__Host-luqyak_session='+token);
 if(method!=='GET')h.set('origin',ORIGIN);
 if(body!==undefined){
  if(typeof body==='string'){h.set('content-type','application/json');h.set('content-length',String(Buffer.byteLength(body)))}
  else h.set('content-length',String(body.byteLength));
 }
 return new Request(ORIGIN+path,{method,headers:h,body});
}
const json=async r=>{const data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data};
test('photo is only readable by owner and retained until encrypted owner receipt',async()=>{
 const {db,env,objects}=setup(),sessionDigest=await hex(new TextEncoder().encode(token));
 db.prepare('UPDATE auth_sessions SET token_hash=?').run(sessionDigest);
 const identity=await generateDeviceIdentity(),publicKey=b64(identity.publicKey);
 let r=await v2RelayHandler(req('/api/v2/devices',{method:'POST',auth:true,body:JSON.stringify({device_id:deviceId,public_key_spki:publicKey})}),env);assert.equal(r.status,200,await r.text());
 const share=await json(await v2RelayHandler(req('/api/v2/meetups/'+meetupId+'/shares',{method:'POST',auth:true,body:JSON.stringify({scope:'upload',hours:1})}),env));
 const info=await json(await v2RelayHandler(req('/api/v2/inbox/info?token='+share.token),env));
 assert.equal(info.device_id,deviceId);
 const payload=new TextEncoder().encode('private-photo-not-readable-on-relay');
 const encrypted=await sealPhoto({meetupId,photoBytes:payload,recipientPublicKey:Buffer.from(info.public_key_spki,'base64')});
 const photoId=encrypted.photoId;
 const hdr={
  'content-type':'application/octet-stream','x-luqyak-photo-id':photoId,'x-luqyak-device-id':deviceId,
  'x-luqyak-sha256':encrypted.sha256,'x-luqyak-iv':b64(encrypted.iv),
  'x-luqyak-wrapped-key':b64(encrypted.wrappedKey)
 };
 const upload=await v2RelayHandler(req('/api/v2/inbox/upload?token='+share.token,{method:'POST',body:encrypted.ciphertext,headers:hdr}),env);
 assert.equal(upload.status,201,await upload.text());
 assert.equal(objects.size,1);
 assert.notDeepEqual([...objects.values()][0],payload);
 const unauthorized=await v2RelayHandler(req('/api/v2/deliveries/'+photoId),env);
 assert.equal(unauthorized.status,401);
 const list=await json(await v2RelayHandler(req('/api/v2/deliveries?device_id='+deviceId,{auth:true}),env));
 assert.equal(list.items.length,1);
 const ciphertext=await v2RelayHandler(req('/api/v2/deliveries/'+photoId,{auth:true}),env);
 assert.equal(ciphertext.status,200);
 const actual=new Uint8Array(await ciphertext.arrayBuffer());
 const unpacked=await openPhoto({...encrypted,ciphertext:actual},identity.privateKey);
 assert.deepEqual(new Uint8Array(unpacked),payload);
 const wrong=await v2RelayHandler(req('/api/v2/deliveries/'+photoId+'/ack',{method:'POST',auth:true,body:JSON.stringify({durable:true,sha256:'0'.repeat(64)})}),env);
 assert.equal(wrong.status,409);assert.equal(objects.size,1);
 const receipt=await v2RelayHandler(req('/api/v2/deliveries/'+photoId+'/ack',{method:'POST',auth:true,body:JSON.stringify({durable:true,sha256:encrypted.sha256})}),env);
 assert.equal(receipt.status,200,await receipt.text());
 assert.equal(objects.size,0);
 await cleanupAcknowledgedV2(env);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM lk_v2_photo_queue').get().n,0);
});
test('view capability cannot access upload endpoint and owner may close capture',async()=>{
 const {db,env}=setup();
 db.prepare('UPDATE auth_sessions SET token_hash=?').run(await hex(new TextEncoder().encode(token)));
 const share=await json(await v2RelayHandler(req('/api/v2/meetups/'+meetupId+'/shares',{method:'POST',auth:true,body:JSON.stringify({scope:'upload',hours:1})}),env));
 assert.equal((await v2RelayHandler(req('/api/v2/view/info?token='+share.token),env)).status,403);
 assert.equal((await v2RelayHandler(req('/api/v2/meetups/'+meetupId+'/close',{method:'POST',auth:true,body:'{}'}),env)).status,200);
 assert.equal((await v2RelayHandler(req('/api/v2/inbox/info?token='+share.token),env)).status,403);
});
