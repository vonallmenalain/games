const APP_VERSION = "__FASSUNG__";
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
const FIREBASE_SDK = __SDK__;

const CORE_ASSETS = __DATEIEN__;

// Je Spielseite, was nur sie braucht: die Seite selbst und ihr Skript. Alles
// andere in CORE_ASSETS ist der Rahmen, den alle Seiten teilen.
const SPIEL_DATEIEN = __SPIELE__;

// So viele Dateien auf einmal. Bis Oktober 2026 holte der Service Worker
// alle gleichzeitig – gut hundert Anfragen, rund 5 MB. Kamen sechs Geräte
// zugleich in ein schwaches WLAN, stand dort alles andere still.
const GLEICHZEITIG = 4;

async function addOpaque(cache, url) {
  const response = await fetch(url, { mode: "no-cors" });
  await cache.put(url, response);
}

// Die Reihenfolge: zuerst der Rahmen (Startseite, Turnierseite, die
// gemeinsamen Skripte, Firebase), dann die genannten Spiele (die eines
// Turniers), dann der Rest.
function reihenfolge(zuerst = []) {
  const spielDateien = new Set(Object.values(SPIEL_DATEIEN).flat());
  const vorne = zuerst.flatMap((seite) => SPIEL_DATEIEN[seite] || []);
  return [
    ...CORE_ASSETS.filter((datei) => !spielDateien.has(datei)),
    ...FIREBASE_SDK,
    ...vorne,
    ...CORE_ASSETS.filter((datei) => spielDateien.has(datei) && !vorne.includes(datei)),
  ];
}

// Was eine Seite braucht, um ohne Netz zu laufen: der Rahmen und die
// genannten Spiele.
function noetig(seiten) {
  const spielDateien = new Set(Object.values(SPIEL_DATEIEN).flat());
  return [
    ...CORE_ASSETS.filter((datei) => !spielDateien.has(datei)),
    ...FIREBASE_SDK,
    ...seiten.flatMap((seite) => SPIEL_DATEIEN[seite] || []),
  ];
}

// Jede Datei einzeln: Ein Aussetzer am Mobilnetz darf nicht die ganze
// Installation umwerfen – sonst entstünde gar kein Cache. Was fehlt, holt
// die nächste Seite nach (VORBEREITEN).
async function fuelle(cache, liste) {
  const offen = [...liste];
  const arbeiter = Array.from({ length: GLEICHZEITIG }, async () => {
    while (offen.length) {
      const datei = offen.shift();
      try {
        if (await cache.match(datei)) continue;
        if (FIREBASE_SDK.includes(datei)) await addOpaque(cache, datei);
        else await cache.add(datei);
      } catch { /* später noch einmal */ }
    }
  });
  await Promise.all(arbeiter);
}

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await fuelle(cache, reihenfolge());
}

// Wie viel von dem, was die Seiten brauchen, schon da ist.
async function stand(seiten) {
  const cache = await caches.open(CACHE_NAME);
  const liste = noetig(seiten);
  let da = 0;
  for (const datei of liste) if (await cache.match(datei)) da += 1;
  return { da, gesamt: liste.length };
}

// Die Turnierseite fragt (turnier.js, offlineBereit): «Ist alles da, was es
// für diese Spiele braucht?» – und lässt holen, was fehlt.
let fuellt = null;
async function vorbereiten(seiten) {
  const cache = await caches.open(CACHE_NAME);
  if (!fuellt) fuellt = fuelle(cache, reihenfolge(seiten)).finally(() => { fuellt = null; });
  await fuellt;
  return stand(seiten);
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
  const antwort = event.ports && event.ports[0];
  const seiten = Array.isArray(event.data?.seiten) ? event.data.seiten.map(String) : [];
  if (event.data?.type === "STAND" && antwort) {
    event.waitUntil(stand(seiten).then((s) => antwort.postMessage(s), () => antwort.postMessage(null)));
  }
  if (event.data?.type === "VORBEREITEN" && antwort) {
    event.waitUntil(vorbereiten(seiten).then((s) => antwort.postMessage(s), () => antwort.postMessage(null)));
  }
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
