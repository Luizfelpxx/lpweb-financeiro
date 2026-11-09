// Service worker mínimo (necessário para instalar o app na tela inicial).
// Não guarda páginas nem dados financeiros em cache: tudo vem sempre do servidor.
// Só os arquivos estáticos do app (logo/ícones) são servidos do cache para abrir mais rápido.
const CACHE = "lpweb-estatico-v2";
const ESTATICOS = ["/logo/logo-claro.png", "/logo/logo-escuro.png", "/logo/emblema.png", "/icons/icon-192.png"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESTATICOS)));
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (ESTATICOS.includes(url.pathname)) {
    evento.respondWith(caches.match(req).then((r) => r || fetch(req)));
  }
  // demais requisições: rede normal (sem cache)
});
