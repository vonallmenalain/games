const APP_VERSION = "2026-09-20-04";
const CACHE_PREFIX = "mini-games-";
const CACHE_NAME = `${CACHE_PREFIX}${APP_VERSION}`;
const FALLBACK_DOCUMENT = "./index.html";
const NETWORK_TIMEOUT_MS = 3500;

/*
 * Der Service Worker der Mini-Games.
 * ---------------------------------------------------------------------------
 * ERZEUGT von scripts/seiten-bauen.mjs aus scripts/service-worker-vorlage.js –
 * nicht von Hand ändern. Die Liste unten ist genau das, was die Seiten laden;
 * sie entsteht aus denselben Daten, damit sie nicht auseinanderlaufen kann.
 *
 * Er liegt im Wurzelverzeichnis und bedient damit die ganze Site.
 */
const FIREBASE_SDK = [
  "https://www.gstatic.com/firebasejs/12.7.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore-compat.js"
];

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./kacheln.html",
  "./wasfehlt.html",
  "./fischteich.html",
  "./signal.html",
  "./blaetter.html",
  "./turmbau.html",
  "./zahlengleis.html",
  "./highscore.js?v=2026-09-20-04",
  "./cloud.js?v=2026-09-20-04",
  "./mini-games.js?v=2026-09-20-04",
  "./pwa.js?v=2026-09-20-04",
  "./kids.js?v=2026-09-20-04",
  "./train-art.js?v=2026-09-20-04",
  "./train-scenes.js?v=2026-09-20-04",
  "./game-cloud.js?v=2026-09-20-04",
  "./game-shell.js?v=2026-09-20-04",
  "./kacheln.js?v=2026-09-20-04",
  "./strand-art.js?v=2026-09-20-04",
  "./wasfehlt.js?v=2026-09-20-04",
  "./fischteich.js?v=2026-09-20-04",
  "./signal.js?v=2026-09-20-04",
  "./blaetter.js?v=2026-09-20-04",
  "./turmbau.js?v=2026-09-20-04",
  "./zahlengleis.js?v=2026-09-20-04",
  "./styles.css?v=2026-09-20-04",
  "./app.webmanifest?v=2026-09-20-04",
  "./icons/icon-32.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png"
];

async function addOpaque(cache, url) {
  const response = await fetch(url, { mode: "no-cors" });
  await cache.put(url, response);
}

// Jede Datei einzeln: Ein Aussetzer am Mobilnetz darf nicht die ganze
// Installation umwerfen – sonst entstünde gar kein Cache.
async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled([
    ...CORE_ASSETS.map((asset) => cache.add(asset)),
    ...FIREBASE_SDK.map((url) => addOpaque(cache, url)),
  ]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function fetchWithTimeout(request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Netz zu langsam")), NETWORK_TIMEOUT_MS);
    fetch(request).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

async function fetchAndStore(cache, request) {
  const response = await fetchWithTimeout(request);
  if (response && (response.ok || response.type === "opaque")) {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

async function cacheFirst(event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  return fetchAndStore(cache, event.request);
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(event.request);
  if (!cached) return fetchAndStore(cache, event.request);
  event.waitUntil(fetchAndStore(cache, event.request).catch(() => {}));
  return cached;
}

// Die Adresse, die man weitergibt, ist /turmbau – im Zwischenspeicher liegt
// die Datei aber unter ihrem eigenen Namen, turmbau.html. Netlify löst das
// beim Ausliefern auf; der Zwischenspeicher vergleicht stur Adressen und
// findet nichts.
//
// Ohne diese Umrechnung liefe offline jeder Weg in ein Spiel auf die
// Startseite zurück – gerade dann, wenn die installierte App am nötigsten
// ist: im Zug, im Flugzeug, im Keller.
function mitEndung(adresse) {
  const wo = new URL(adresse);
  if (wo.pathname.endsWith("/")) return null;
  if (/\.[A-Za-z0-9]+$/.test(wo.pathname)) return null;
  wo.pathname += ".html";
  return wo.href;
}

async function ausDemSpeicher(cache, request) {
  const direkt = await cache.match(request, { ignoreSearch: true });
  if (direkt) return direkt;
  const andersHerum = mitEndung(request.url);
  return andersHerum ? cache.match(andersHerum, { ignoreSearch: true }) : undefined;
}

async function documentFirstFromCache(event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await ausDemSpeicher(cache, event.request);
  if (cached) {
    event.waitUntil(fetchAndStore(cache, event.request).catch(() => {}));
    return cached;
  }
  try {
    return await fetchAndStore(cache, event.request);
  } catch (error) {
    const fallback = await cache.match(FALLBACK_DOCUMENT);
    if (fallback) return fallback;
    throw error;
  }
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) {
    if (FIREBASE_SDK.includes(requestUrl.href)) event.respondWith(cacheFirst(event));
    return;
  }

  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(documentFirstFromCache(event));
    return;
  }

  // Die Fassung steht im Namen: Ändert sie sich, ändert sich der Schlüssel.
  if (requestUrl.searchParams.has("v")) {
    event.respondWith(cacheFirst(event));
    return;
  }

  if (event.request.destination === "image" || event.request.destination === "font") {
    event.respondWith(cacheFirst(event));
    return;
  }

  if (["script", "style", "manifest"].includes(event.request.destination)) {
    event.respondWith(staleWhileRevalidate(event));
  }
});
