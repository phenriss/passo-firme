const CACHE = "passo-firme-v5";
const ARQUIVOS = ["./", "index.html", "style.css", "app.js", "figuras.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).pathname.endsWith("/videos/lista.json")) {
    // lista de vídeos: sempre tenta a rede primeiro para enxergar vídeos novos
    e.respondWith(
      fetch(e.request).then((resp) => {
        const copia = resp.clone();
        if (resp.ok) caches.open(CACHE).then((c) => c.put(e.request, copia));
        return resp;
      }).catch(() => caches.match(e.request).then((r) => r || new Response("[]")))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => {
      // vídeos: guarda em cache ao primeiro uso para funcionar offline depois
      if (resp.ok && resp.status === 200 && /\/videos\/.+\.mp4$/.test(new URL(e.request.url).pathname)) {
        const copia = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
      }
      return resp;
    }).catch(() => caches.match("index.html")))
  );
});
