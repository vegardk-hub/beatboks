/* Service worker: gjør appen tilgjengelig uten nett, og sørger for at en ny
   utgave faktisk når fram til nettbrettet. */
const CACHE = 'beatboks-v12';
const FILES = ['./', './index.html', './styles.css', './audio.js', './monsters.js',
  './record.js', './analyse.js', './navn.js', './visual.js', './app.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  /* cache: 'reload' er hele poenget her. Uten det henter installasjonen filene
     gjennom nettleserens egen hurtiglagring, og legger da den GAMLE utgaven
     under det NYE cachenavnet. Resultatet var at appen ble stående på forrige
     versjon selv om både versjonsnummeret og cachenavnet var bumpet — og det
     eneste sporet var at versjonsmerket nederst viste feil tall. */
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Cache først, ikke nett først. Filene i cachen er hentet ferske ved
   installasjonen, så de hører sammen og passer til denne versjonen — og da
   starter appen momentant, også uten nett. En ny utgave kommer inn ved at
   sw.js selv endrer seg (CACHE bumpes), installerer på nytt og tar over. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(svar => {
      if (svar) return svar;
      return fetch(e.request).then(r => {
        if (r && r.ok) {
          const kopi = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, kopi)).catch(() => {});
        }
        return r;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
