// Isolated Luqyak 2.0 staging entrypoint.
// Never connects to the production site, production D1, production R2, or LIVE_CHANNEL.
// No staging authentication bypass: operator must create a synthetic test identity inside staging D1.
import {v2RelayHandler} from './v2-relay.js';
import {uploadPage} from './v2-upload-page.js';
import {ownerPage} from './v2-owner-page.js';
import {viewAlbumPage} from './v2-view-page.js';
import {v2BrowserAsset} from './v2-browser-assets.js';
import {atelierThemeResponse} from './luqyak-theme-response.js';
import {cleanupAcknowledgedV2} from './v2-cleanup.js';

const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/__health'&&request.method==='GET')return new Response(JSON.stringify({status:'isolated-staging',production:false}),{headers:{...headers,'content-type':'application/json'}});
  if(!env.DB||!env.PHOTOS)return new Response('Staging resources unavailable',{status:503,headers});
  if(path==='/v2/theme.css')return atelierThemeResponse();
  if(path.startsWith('/v2/assets/'))return v2BrowserAsset(path);
  if(path==='/v2/owner')return ownerPage();
  if(/^\/v2\/upload\/[a-f0-9]{64}$/i.test(path))return uploadPage();
  if(/^\/v2\/view\/[a-f0-9]{64}$/i.test(path))return viewAlbumPage();
  if(path.startsWith('/api/v2/'))return v2RelayHandler(request,env,ctx);
  // The staging Worker intentionally has no legacy user API, home feed or public signup.
  // Synthetic sessions are verified by the same v2RelayHandler as in production.
  return new Response('Not found',{status:404,headers});
 },
 async scheduled(event,env,ctx){ctx.waitUntil(cleanupAcknowledgedV2(env))}
};
