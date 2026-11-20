import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {atelierThemeResponse} from '../luqyak-theme-response.js';

const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const B=String.fromCharCode(92,34);
const appStart=worker.indexOf("if(path==='/app')return new Response(");
const app=worker.slice(appStart,worker.indexOf("if(path==='/notifications')return new Response(",appStart));
const between=(a,b)=>{const i=app.indexOf(a),j=app.indexOf(b,i+a.length);assert.ok(i>=0&&j>=0,'Missing markers: '+a+' '+b);return app.slice(i,j)};
test('home contains exactly three meaningful actions, working invite and accessible feed',()=>{
 const home=between('function home(){','async function lkHomeEnsureDetails');
 const actions=[...home.matchAll(/data-action=\\"(meetQuick|meet|memories|chats)\\" class=\\"lk-home-shortcut/g)].map(x=>x[1]);
 assert.deepEqual(actions,['meetQuick','meet','memories']);
 assert.match(home,/lk-live-invitehint/);
 assert.match(home,/lk-home-story-track/);
 assert.match(home,/data-feed-open/);
 for(const redundant of ['lk-night-memory','lk-home-next','lk-home-recent-track','lk-atelier-vault'])
  assert.ok(!home.includes(redundant),'Redundant home element: '+redundant);
});
test('mobile navigation has only three destinations and a functional meeting creation action',()=>{
 const nav=between('<nav class=\\"bottom lk-bottom-premium lk-core-nav','</nav>');
 const tabs=[...nav.matchAll(/data-tab=\\"([^\\"]+)/g)].map(x=>x[1]);
 assert.deepEqual(tabs,['home','meet','memories']);
 assert.match(nav,/data-action=\\"meetQuick/);
 assert.match(app,/else if\(x==='meetQuick'\)\{choose\('meet'\);document\.getElementById\('showMeetForm'\)\?\.click\(\)\}/);
 assert.match(app,/else if\(tab==='memories'\)\$\('main'\)\.innerHTML=memories\(\)/);
});
test('essential header keeps logo, notification and account paths',()=>{
 const header=between('<header class=\\"head lk-topbar','</header>');
 assert.match(header,/id=\\"lkBell/);
 assert.match(header,/data-action=\\"account/);
 assert.match(header,/href=\\"\/app/);
 assert.ok(!header.includes('data-action=\\"chats'));
 assert.ok(!header.includes('data-action=\\"settings'));
});
test('working but secondary account and settings features remain reachable',()=>{
 const account=between('function account(){','async function lkRunHealth(){');
 const settings=between('function accountSettings(){','function ');
 assert.match(account,/link\('chats'/);
 assert.match(account,/link\('settings'/);
 assert.match(account,/href=\\"\/notifications/);
 assert.match(settings,/id=\\"openMigration/);
 assert.match(settings,/id=\\"lkDeletionRequest/);
 assert.ok(!settings.includes('فتح الواجهة السابقة'));
});
test('source contains no destructive data migration and self-hosted theme is responsive',async()=>{
 const css=await atelierThemeResponse().text();
 assert.match(css,/\.lk-core-nav/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/focus-visible/);
 assert.ok(worker.includes("if(path==='/api/social/meetups'"));
 assert.ok(worker.includes("if(path==='/api/social/photo'"));
});
