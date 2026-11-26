/* Service worker do protótipo: guarda os arquivos do app para abrir sem internet (RF-32). */
const CACHE = 'pdv-bolso-v9';
const ARQUIVOS = [
  './',
  './index.html',
  './css/style.css',
  './css/tema-rerisson.css',
  './js/dados.js',
  './js/app.js',
  './manifest.webmanifest',
  './img/icon.svg',
];

self.addEventListener('install', evento => {
  evento.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys().then(chaves => Promise.all(chaves.filter(c => c !== CACHE).map(c => caches.delete(c))))
  );
  self.clients.claim();
});

/* Rede primeiro; se falhar (offline), usa o que está no cache. */
self.addEventListener('fetch', evento => {
  if (evento.request.method !== 'GET') return;
  evento.respondWith(
    fetch(evento.request)
      .then(resposta => {
        const copia = resposta.clone();
        caches.open(CACHE).then(cache => cache.put(evento.request, copia));
        return resposta;
      })
      .catch(() => caches.match(evento.request).then(r => r || caches.match('./index.html')))
  );
});
