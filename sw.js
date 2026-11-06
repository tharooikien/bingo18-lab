'use strict';
const CACHE='bingo18-shell-11.2',FILES=['/','/index.html','/lab10.js','/exports.js','/mobile.js','/xsmt.js','/manifest.webmanifest','/icon-192.png','/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('message',e=>{if(e.data==='ACTIVATE_UPDATE')self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('bingo18-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==self.location.origin||e.request.method!=='GET'||u.pathname.startsWith('/api/')||u.pathname==='/healthz')return;
 if(!FILES.includes(u.pathname))return;
 // A warm installed shell opens immediately, even while Render is waking up.
 e.respondWith(caches.open(CACHE).then(async c=>{const cached=await c.match(e.request);if(cached)return cached;return fetch(e.request)}));
});
