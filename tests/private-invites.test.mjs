import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import {readFileSync} from 'node:fs';

const origin='https://luqyak.athat.app';
const actor='00000000-0000-4000-8000-000000000010';
const target='00000000-0000-4000-8000-000000000011';
const meetup='00000000-0000-4000-8000-000000000012';
const headers={cookie:'__Host-luqyak_session='+('a'.repeat(64)),origin,'content-type':'application/json'};
const ctx={waitUntil(){throw Error('Blocked user must not receive notifications')}};

function blockEnv(){
 const statements=[];
 return {statements,DB:{prepare(sql){
  statements.push(sql);
  return {bind(){return {
   async first(){
    if(sql.includes('FROM auth_sessions'))return {id:actor,username:'organizer'};
    if(sql.includes('SELECT * FROM lk_meetups'))return {id:meetup,owner_id:actor,privacy:'specific',title:'Private meeting'};
    if(sql.includes("FROM users WHERE username="))return {id:target};
    if(sql.includes('FROM lk_user_blocks'))return {x:1};
    throw Error('Unexpected database read: '+sql);
   },
   async run(){throw Error('A blocked invite must not write to D1')},
   async all(){throw Error('A blocked invite must not enumerate members')}
  }}};
 }}};
}

test('creating a meetup with blocked recipient fails without inserting or inviting',async()=>{
 const env=blockEnv();
 const r=await worker.fetch(new Request(origin+'/api/social/create',{method:'POST',headers,body:JSON.stringify({
  place:'Test cafe',title:'Private meeting',privacy:'specific',time:new Date(Date.now()+3600000).toISOString(),members:['blocked_friend']
 })}),env,ctx);
 assert.equal(r.status,403);
 assert.equal((await r.json()).error,'member_not_available');
 assert.ok(env.statements.some(q=>q.includes('FROM lk_user_blocks')));
 assert.ok(env.statements.every(q=>!q.includes('INSERT')));
});

test('inviting a blocked recipient to an existing meetup fails before member lookup or notifications',async()=>{
 const env=blockEnv();
 const r=await worker.fetch(new Request(origin+'/api/social/invite-member?id='+meetup,{
  method:'POST',headers,body:JSON.stringify({username:'blocked_friend'})
 }),env,ctx);
 assert.equal(r.status,403);
 assert.equal((await r.json()).error,'member_not_available');
 assert.ok(env.statements.some(q=>q.includes('FROM lk_user_blocks')));
 assert.ok(env.statements.every(q=>!q.includes('INSERT INTO lk_meetup_members')));
});

test('meetup invite pushes omit meetup title and photo notifications check blocks before delivery',()=>{
 const s=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 assert.doesNotMatch(s,/body:'دُعيت إلى '\+title/);
 assert.doesNotMatch(s,/body:'دُعيت إلى '\+meetup\.title/);
 assert.match(s,/body:'لديك دعوة للانضمام إلى لقاء'/);
 assert.match(s,/const eligible=await Promise\.all\(ids\.map\(async peer=>/);
 assert.match(s,/eligible\.filter\(x=>!x\.blocked\)/);
});
