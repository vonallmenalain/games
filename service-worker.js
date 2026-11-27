const APP_VERSION = "2026-11-26-25";
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
  "./fischteich.html",
  "./blaetter.html",
  "./turmbau.html",
  "./bruecke.html",
  "./drehscheibe.html",
  "./liane.html",
  "./tunnelflug.html",
  "./drift.html",
  "./planeten.html",
  "./mondlandung.html",
  "./schwerkraft.html",
  "./huegel.html",
  "./ballon.html",
  "./slalom.html",
  "./frosch.html",
  "./kranhafen.html",
  "./seiltaenzer.html",
  "./draht.html",
  "./spuren.html",
  "./ball.html",
  "./jongleur.html",
  "./turmspringen.html",
  "./fallschirm.html",
  "./holzfaeller.html",
  "./fledermaus.html",
  "./ninja.html",
  "./freitaucher.html",
  "./schwarm.html",
  "./welle.html",
  "./steinhuepfer.html",
  "./eiskanal.html",
  "./felsflug.html",
  "./zahlengleis.html",
  "./heizer.html",
  "./hammerwurf.html",
  "./entenfamilie.html",
  "./grubenlore.html",
  "./rotoren.html",
  "./augenmass.html",
  "./feuerseil.html",
  "./flaggen.html",
  "./zeitgefuehl.html",
  "./kletterwand.html",
  "./freihand.html",
  "./kopfkino.html",
  "./eisstock.html",
  "./gratwanderung.html",
  "./kaminfeger.html",
  "./dachlaeufer.html",
  "./stampfwerk.html",
  "./bienenflug.html",
  "./marsrover.html",
  "./spiegelsee.html",
  "./seifenblase.html",
  "./wasserlaeufer.html",
  "./polwechsel.html",
  "./turnier.html",
  "./live.html",
  "./viererreihe.html",
  "./tictactoe.html",
  "./schiffe.html",
  "./kaesekaestchen.html",
  "./muehle.html",
  "./schach.html",
  "./paare.html",
  "./farbcode.html",
  "./blitzpaar.html",
  "./schatzkarte.html",
  "./malen.html",
  "./wackelturm.html",
  "./zwillinge.html",
  "./bohnen.html",
  "./wolf.html",
  "./ratetier.html",
  "./brueckenschlag.html",
  "./kippen.html",
  "./rechnen.html",
  "./leiter.html",
  "./baumeister.html",
  "./echo.html",
  "./kanu.html",
  "./weichensteller.html",
  "./raumschiff.html",
  "./garten.html",
  "./vollbild.js?v=2026-11-26-25",
  "./highscore.js?v=2026-11-26-25",
  "./cloud.js?v=2026-11-26-25",
  "./klang.js?v=2026-11-26-25",
  "./mini-games.js?v=2026-11-26-25",
  "./turnier.js?v=2026-11-26-25",
  "./pwa.js?v=2026-11-26-25",
  "./live.js?v=2026-11-26-25",
  "./kids.js?v=2026-11-26-25",
  "./vorlesen.js?v=2026-11-26-25",
  "./zwei.js?v=2026-11-26-25",
  "./viererreihe-ki.js?v=2026-11-26-25",
  "./viererreihe.js?v=2026-11-26-25",
  "./tictactoe.js?v=2026-11-26-25",
  "./schiffe.js?v=2026-11-26-25",
  "./kaesekaestchen.js?v=2026-11-26-25",
  "./muehle.js?v=2026-11-26-25",
  "./schach.js?v=2026-11-26-25",
  "./paare.js?v=2026-11-26-25",
  "./farbcode.js?v=2026-11-26-25",
  "./blitzpaar.js?v=2026-11-26-25",
  "./schatzkarte.js?v=2026-11-26-25",
  "./malen.js?v=2026-11-26-25",
  "./wackelturm.js?v=2026-11-26-25",
  "./zwillinge.js?v=2026-11-26-25",
  "./bohnen.js?v=2026-11-26-25",
  "./wolf.js?v=2026-11-26-25",
  "./ratetier.js?v=2026-11-26-25",
  "./brueckenschlag.js?v=2026-11-26-25",
  "./kippen.js?v=2026-11-26-25",
  "./rechnen.js?v=2026-11-26-25",
  "./leiter.js?v=2026-11-26-25",
  "./baumeister.js?v=2026-11-26-25",
  "./echo.js?v=2026-11-26-25",
  "./echtzeit.js?v=2026-11-26-25",
  "./kanu.js?v=2026-11-26-25",
  "./weichensteller.js?v=2026-11-26-25",
  "./raumschiff.js?v=2026-11-26-25",
  "./garten.js?v=2026-11-26-25",
  "./zufall.js?v=2026-11-26-25",
  "./train-art.js?v=2026-11-26-25",
  "./train-scenes.js?v=2026-11-26-25",
  "./game-cloud.js?v=2026-11-26-25",
  "./live-spiel.js?v=2026-11-26-25",
  "./game-shell.js?v=2026-11-26-25",
  "./geist.js?v=2026-11-26-25",
  "./kacheln.js?v=2026-11-26-25",
  "./fischteich.js?v=2026-11-26-25",
  "./blaetter.js?v=2026-11-26-25",
  "./turmbau.js?v=2026-11-26-25",
  "./bruecke.js?v=2026-11-26-25",
  "./drehscheibe.js?v=2026-11-26-25",
  "./liane.js?v=2026-11-26-25",
  "./tunnelflug.js?v=2026-11-26-25",
  "./drift.js?v=2026-11-26-25",
  "./planeten.js?v=2026-11-26-25",
  "./mondlandung.js?v=2026-11-26-25",
  "./schwerkraft.js?v=2026-11-26-25",
  "./huegel.js?v=2026-11-26-25",
  "./ballon.js?v=2026-11-26-25",
  "./slalom.js?v=2026-11-26-25",
  "./frosch.js?v=2026-11-26-25",
  "./kranhafen.js?v=2026-11-26-25",
  "./seiltaenzer.js?v=2026-11-26-25",
  "./draht.js?v=2026-11-26-25",
  "./spuren.js?v=2026-11-26-25",
  "./ball.js?v=2026-11-26-25",
  "./jongleur.js?v=2026-11-26-25",
  "./turmspringen.js?v=2026-11-26-25",
  "./fallschirm.js?v=2026-11-26-25",
  "./holzfaeller.js?v=2026-11-26-25",
  "./fledermaus.js?v=2026-11-26-25",
  "./ninja.js?v=2026-11-26-25",
  "./freitaucher.js?v=2026-11-26-25",
  "./schwarm.js?v=2026-11-26-25",
  "./welle.js?v=2026-11-26-25",
  "./steinhuepfer.js?v=2026-11-26-25",
  "./eiskanal.js?v=2026-11-26-25",
  "./felsflug.js?v=2026-11-26-25",
  "./zahlengleis.js?v=2026-11-26-25",
  "./heizer.js?v=2026-11-26-25",
  "./hammerwurf.js?v=2026-11-26-25",
  "./entenfamilie.js?v=2026-11-26-25",
  "./grubenlore.js?v=2026-11-26-25",
  "./rotoren.js?v=2026-11-26-25",
  "./augenmass.js?v=2026-11-26-25",
  "./feuerseil.js?v=2026-11-26-25",
  "./flaggen.js?v=2026-11-26-25",
  "./zeitgefuehl.js?v=2026-11-26-25",
  "./kletterwand.js?v=2026-11-26-25",
  "./freihand.js?v=2026-11-26-25",
  "./kopfkino.js?v=2026-11-26-25",
  "./eisstock.js?v=2026-11-26-25",
  "./gratwanderung.js?v=2026-11-26-25",
  "./kaminfeger.js?v=2026-11-26-25",
  "./dachlaeufer.js?v=2026-11-26-25",
  "./stampfwerk.js?v=2026-11-26-25",
  "./bienenflug.js?v=2026-11-26-25",
  "./marsrover.js?v=2026-11-26-25",
  "./spiegelsee.js?v=2026-11-26-25",
  "./seifenblase.js?v=2026-11-26-25",
  "./wasserlaeufer.js?v=2026-11-26-25",
  "./polwechsel.js?v=2026-11-26-25",
  "./styles.css?v=2026-11-26-25",
  "./app.webmanifest?v=2026-11-26-25",
  "./icons/icon-32.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png"
];

// Je Spielseite, was nur sie braucht: die Seite selbst und ihr Skript. Alles
// andere in CORE_ASSETS ist der Rahmen, den alle Seiten teilen.
const SPIEL_DATEIEN = {
  "kacheln": [
    "./kacheln.html",
    "./kacheln.js?v=2026-11-26-25"
  ],
  "fischteich": [
    "./fischteich.html",
    "./fischteich.js?v=2026-11-26-25"
  ],
  "blaetter": [
    "./blaetter.html",
    "./blaetter.js?v=2026-11-26-25"
  ],
  "turmbau": [
    "./turmbau.html",
    "./turmbau.js?v=2026-11-26-25"
  ],
  "bruecke": [
    "./bruecke.html",
    "./bruecke.js?v=2026-11-26-25"
  ],
  "drehscheibe": [
    "./drehscheibe.html",
    "./drehscheibe.js?v=2026-11-26-25"
  ],
  "liane": [
    "./liane.html",
    "./liane.js?v=2026-11-26-25"
  ],
  "tunnelflug": [
    "./tunnelflug.html",
    "./tunnelflug.js?v=2026-11-26-25"
  ],
  "drift": [
    "./drift.html",
    "./drift.js?v=2026-11-26-25"
  ],
  "planeten": [
    "./planeten.html",
    "./planeten.js?v=2026-11-26-25"
  ],
  "mondlandung": [
    "./mondlandung.html",
    "./mondlandung.js?v=2026-11-26-25"
  ],
  "schwerkraft": [
    "./schwerkraft.html",
    "./schwerkraft.js?v=2026-11-26-25"
  ],
  "huegel": [
    "./huegel.html",
    "./huegel.js?v=2026-11-26-25"
  ],
  "ballon": [
    "./ballon.html",
    "./ballon.js?v=2026-11-26-25"
  ],
  "slalom": [
    "./slalom.html",
    "./slalom.js?v=2026-11-26-25"
  ],
  "frosch": [
    "./frosch.html",
    "./frosch.js?v=2026-11-26-25"
  ],
  "kranhafen": [
    "./kranhafen.html",
    "./kranhafen.js?v=2026-11-26-25"
  ],
  "seiltaenzer": [
    "./seiltaenzer.html",
    "./seiltaenzer.js?v=2026-11-26-25"
  ],
  "draht": [
    "./draht.html",
    "./draht.js?v=2026-11-26-25"
  ],
  "spuren": [
    "./spuren.html",
    "./spuren.js?v=2026-11-26-25"
  ],
  "ball": [
    "./ball.html",
    "./ball.js?v=2026-11-26-25"
  ],
  "jongleur": [
    "./jongleur.html",
    "./jongleur.js?v=2026-11-26-25"
  ],
  "turmspringen": [
    "./turmspringen.html",
    "./turmspringen.js?v=2026-11-26-25"
  ],
  "fallschirm": [
    "./fallschirm.html",
    "./fallschirm.js?v=2026-11-26-25"
  ],
  "holzfaeller": [
    "./holzfaeller.html",
    "./holzfaeller.js?v=2026-11-26-25"
  ],
  "fledermaus": [
    "./fledermaus.html",
    "./fledermaus.js?v=2026-11-26-25"
  ],
  "ninja": [
    "./ninja.html",
    "./ninja.js?v=2026-11-26-25"
  ],
  "freitaucher": [
    "./freitaucher.html",
    "./freitaucher.js?v=2026-11-26-25"
  ],
  "schwarm": [
    "./schwarm.html",
    "./schwarm.js?v=2026-11-26-25"
  ],
  "welle": [
    "./welle.html",
    "./welle.js?v=2026-11-26-25"
  ],
  "steinhuepfer": [
    "./steinhuepfer.html",
    "./steinhuepfer.js?v=2026-11-26-25"
  ],
  "eiskanal": [
    "./eiskanal.html",
    "./eiskanal.js?v=2026-11-26-25"
  ],
  "felsflug": [
    "./felsflug.html",
    "./felsflug.js?v=2026-11-26-25"
  ],
  "zahlengleis": [
    "./zahlengleis.html",
    "./zahlengleis.js?v=2026-11-26-25"
  ],
  "heizer": [
    "./heizer.html",
    "./heizer.js?v=2026-11-26-25"
  ],
  "hammerwurf": [
    "./hammerwurf.html",
    "./hammerwurf.js?v=2026-11-26-25"
  ],
  "entenfamilie": [
    "./entenfamilie.html",
    "./entenfamilie.js?v=2026-11-26-25"
  ],
  "grubenlore": [
    "./grubenlore.html",
    "./grubenlore.js?v=2026-11-26-25"
  ],
  "rotoren": [
    "./rotoren.html",
    "./rotoren.js?v=2026-11-26-25"
  ],
  "augenmass": [
    "./augenmass.html",
    "./augenmass.js?v=2026-11-26-25"
  ],
  "feuerseil": [
    "./feuerseil.html",
    "./feuerseil.js?v=2026-11-26-25"
  ],
  "flaggen": [
    "./flaggen.html",
    "./flaggen.js?v=2026-11-26-25"
  ],
  "zeitgefuehl": [
    "./zeitgefuehl.html",
    "./zeitgefuehl.js?v=2026-11-26-25"
  ],
  "kletterwand": [
    "./kletterwand.html",
    "./kletterwand.js?v=2026-11-26-25"
  ],
  "freihand": [
    "./freihand.html",
    "./freihand.js?v=2026-11-26-25"
  ],
  "kopfkino": [
    "./kopfkino.html",
    "./kopfkino.js?v=2026-11-26-25"
  ],
  "eisstock": [
    "./eisstock.html",
    "./eisstock.js?v=2026-11-26-25"
  ],
  "gratwanderung": [
    "./gratwanderung.html",
    "./gratwanderung.js?v=2026-11-26-25"
  ],
  "kaminfeger": [
    "./kaminfeger.html",
    "./kaminfeger.js?v=2026-11-26-25"
  ],
  "dachlaeufer": [
    "./dachlaeufer.html",
    "./dachlaeufer.js?v=2026-11-26-25"
  ],
  "stampfwerk": [
    "./stampfwerk.html",
    "./stampfwerk.js?v=2026-11-26-25"
  ],
  "bienenflug": [
    "./bienenflug.html",
    "./bienenflug.js?v=2026-11-26-25"
  ],
  "marsrover": [
    "./marsrover.html",
    "./marsrover.js?v=2026-11-26-25"
  ],
  "spiegelsee": [
    "./spiegelsee.html",
    "./spiegelsee.js?v=2026-11-26-25"
  ],
  "seifenblase": [
    "./seifenblase.html",
    "./seifenblase.js?v=2026-11-26-25"
  ],
  "wasserlaeufer": [
    "./wasserlaeufer.html",
    "./wasserlaeufer.js?v=2026-11-26-25"
  ],
  "polwechsel": [
    "./polwechsel.html",
    "./polwechsel.js?v=2026-11-26-25"
  ]
};

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
