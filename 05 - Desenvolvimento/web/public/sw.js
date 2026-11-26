/* PDV de Bolso · service worker do app instalável (P-05).
   Rede primeiro: o app sempre abre a versão mais nova publicada na Vercel.
   Sem internet, abre a última versão guardada e mostra o aviso de sem conexão.
   Pedidos ao Supabase (outro domínio) nunca passam pelo cache. */
const CACHE = 'pdv-bolso-web-v3';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(chaves.filter(c => c !== CACHE).map(c => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', evento => {
  const pedido = evento.request;
  if (pedido.method !== 'GET' || new URL(pedido.url).origin !== self.location.origin) return;
  evento.respondWith(
    fetch(pedido)
      .then(resposta => {
        if (resposta.ok) {
          const copia = resposta.clone();
          caches.open(CACHE).then(cache => cache.put(pedido, copia));
        }
        return resposta;
      })
      .catch(() => caches.match(pedido).then(r => r || caches.match('/'))),
  );
});
