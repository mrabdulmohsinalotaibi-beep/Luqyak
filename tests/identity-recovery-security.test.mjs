import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import worker from '../worker.js';

test('retired encrypted chat page redirects to private relationships circle',async()=>{
 const response=await worker.fetch(new Request('https://luqyak.athat.app/private'),{}, {waitUntil(){}});
 assert.equal(response.status,302);
 assert.equal(response.headers.get('location'),'https://luqyak.athat.app/app?tab=chats');
});
test('old encryption setup cannot be reached through retired chat route',async()=>{
 const response=await worker.fetch(new Request('https://luqyak.athat.app/private?peer=any'),{}, {waitUntil(){}});
 assert.equal(response.status,302);
 assert.equal(response.headers.get('location'),'https://luqyak.athat.app/app?tab=chats');
});
