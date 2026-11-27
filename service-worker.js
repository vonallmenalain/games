const APP_VERSION = "2026-11-26-19";
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
  "./vollbild.js?v=2026-11-26-19",
  "./highscore.js?v=2026-11-26-19",
  "./cloud.js?v=2026-11-26-19",
  "./klang.js?v=2026-11-26-19",
  "./mini-games.js?v=2026-11-26-19",
  "./turnier.js?v=2026-11-26-19",
  "./pwa.js?v=2026-11-26-19",
  "./live.js?v=2026-11-26-19",
  "./kids.js?v=2026-11-26-19",
  "./vorlesen.js?v=2026-11-26-19",
  "./zwei.js?v=2026-11-26-19",
  "./viererreihe-ki.js?v=2026-11-26-19",
  "./viererreihe.js?v=2026-11-26-19",
  "./tictactoe.js?v=2026-11-26-19",
  "./schiffe.js?v=2026-11-26-19",
  "./kaesekaestchen.js?v=2026-11-26-19",
  "./muehle.js?v=2026-11-26-19",
  "./schach.js?v=2026-11-26-19",
  "./paare.js?v=2026-11-26-19",
  "./farbcode.js?v=2026-11-26-19",
  "./blitzpaar.js?v=2026-11-26-19",
  "./schatzkarte.js?v=2026-11-26-19",
  "./malen.js?v=2026-11-26-19",
  "./wackelturm.js?v=2026-11-26-19",
  "./zwillinge.js?v=2026-11-26-19",
  "./bohnen.js?v=2026-11-26-19",
  "./wolf.js?v=2026-11-26-19",
  "./ratetier.js?v=2026-11-26-19",
  "./brueckenschlag.js?v=2026-11-26-19",
  "./kippen.js?v=2026-11-26-19",
  "./rechnen.js?v=2026-11-26-19",
  "./leiter.js?v=2026-11-26-19",
  "./baumeister.js?v=2026-11-26-19",
  "./echo.js?v=2026-11-26-19",
  "./echtzeit.js?v=2026-11-26-19",
  "./kanu.js?v=2026-11-26-19",
  "./weichensteller.js?v=2026-11-26-19",
  "./raumschiff.js?v=2026-11-26-19",
  "./garten.js?v=2026-11-26-19",
  "./zufall.js?v=2026-11-26-19",
  "./train-art.js?v=2026-11-26-19",
  "./train-scenes.js?v=2026-11-26-19",
  "./game-cloud.js?v=2026-11-26-19",
  "./live-spiel.js?v=2026-11-26-19",
  "./game-shell.js?v=2026-11-26-19",
  "./geist.js?v=2026-11-26-19",
  "./kacheln.js?v=2026-11-26-19",
  "./fischteich.js?v=2026-11-26-19",
  "./blaetter.js?v=2026-11-26-19",
  "./turmbau.js?v=2026-11-26-19",
  "./bruecke.js?v=2026-11-26-19",
  "./drehscheibe.js?v=2026-11-26-19",
  "./liane.js?v=2026-11-26-19",
  "./tunnelflug.js?v=2026-11-26-19",
  "./drift.js?v=2026-11-26-19",
  "./planeten.js?v=2026-11-26-19",
  "./mondlandung.js?v=2026-11-26-19",
  "./schwerkraft.js?v=2026-11-26-19",
  "./huegel.js?v=2026-11-26-19",
  "./ballon.js?v=2026-11-26-19",
  "./slalom.js?v=2026-11-26-19",
  "./frosch.js?v=2026-11-26-19",
  "./kranhafen.js?v=2026-11-26-19",
  "./seiltaenzer.js?v=2026-11-26-19",
  "./draht.js?v=2026-11-26-19",
  "./spuren.js?v=2026-11-26-19",
  "./ball.js?v=2026-11-26-19",
  "./jongleur.js?v=2026-11-26-19",
  "./turmspringen.js?v=2026-11-26-19",
  "./fallschirm.js?v=2026-11-26-19",
  "./holzfaeller.js?v=2026-11-26-19",
  "./fledermaus.js?v=2026-11-26-19",
  "./ninja.js?v=2026-11-26-19",
  "./freitaucher.js?v=2026-11-26-19",
  "./schwarm.js?v=2026-11-26-19",
  "./welle.js?v=2026-11-26-19",
  "./steinhuepfer.js?v=2026-11-26-19",
  "./eiskanal.js?v=2026-11-26-19",
  "./felsflug.js?v=2026-11-26-19",
  "./zahlengleis.js?v=2026-11-26-19",
  "./heizer.js?v=2026-11-26-19",
  "./hammerwurf.js?v=2026-11-26-19",
  "./entenfamilie.js?v=2026-11-26-19",
  "./grubenlore.js?v=2026-11-26-19",
  "./rotoren.js?v=2026-11-26-19",
  "./augenmass.js?v=2026-11-26-19",
  "./feuerseil.js?v=2026-11-26-19",
  "./flaggen.js?v=2026-11-26-19",
  "./zeitgefuehl.js?v=2026-11-26-19",
  "./kletterwand.js?v=2026-11-26-19",
  "./freihand.js?v=2026-11-26-19",
  "./kopfkino.js?v=2026-11-26-19",
  "./eisstock.js?v=2026-11-26-19",
  "./gratwanderung.js?v=2026-11-26-19",
  "./kaminfeger.js?v=2026-11-26-19",
  "./dachlaeufer.js?v=2026-11-26-19",
  "./stampfwerk.js?v=2026-11-26-19",
  "./bienenflug.js?v=2026-11-26-19",
  "./marsrover.js?v=2026-11-26-19",
  "./spiegelsee.js?v=2026-11-26-19",
  "./seifenblase.js?v=2026-11-26-19",
  "./styles.css?v=2026-11-26-19",
  "./app.webmanifest?v=2026-11-26-19",
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
    "./kacheln.js?v=2026-11-26-19"
  ],
  "fischteich": [
    "./fischteich.html",
    "./fischteich.js?v=2026-11-26-19"
  ],
  "blaetter": [
    "./blaetter.html",
    "./blaetter.js?v=2026-11-26-19"
  ],
  "turmbau": [
    "./turmbau.html",
    "./turmbau.js?v=2026-11-26-19"
  ],
  "bruecke": [
    "./bruecke.html",
    "./bruecke.js?v=2026-11-26-19"
  ],
  "drehscheibe": [
    "./drehscheibe.html",
    "./drehscheibe.js?v=2026-11-26-19"
  ],
  "liane": [
    "./liane.html",
    "./liane.js?v=2026-11-26-19"
  ],
  "tunnelflug": [
    "./tunnelflug.html",
    "./tunnelflug.js?v=2026-11-26-19"
  ],
  "drift": [
    "./drift.html",
    "./drift.js?v=2026-11-26-19"
  ],
  "planeten": [
    "./planeten.html",
    "./planeten.js?v=2026-11-26-19"
  ],
  "mondlandung": [
    "./mondlandung.html",
    "./mondlandung.js?v=2026-11-26-19"
  ],
  "schwerkraft": [
    "./schwerkraft.html",
    "./schwerkraft.js?v=2026-11-26-19"
  ],
  "huegel": [
    "./huegel.html",
    "./huegel.js?v=2026-11-26-19"
  ],
  "ballon": [
    "./ballon.html",
    "./ballon.js?v=2026-11-26-19"
  ],
  "slalom": [
    "./slalom.html",
    "./slalom.js?v=2026-11-26-19"
  ],
  "frosch": [
    "./frosch.html",
    "./frosch.js?v=2026-11-26-19"
  ],
  "kranhafen": [
    "./kranhafen.html",
    "./kranhafen.js?v=2026-11-26-19"
  ],
  "seiltaenzer": [
    "./seiltaenzer.html",
    "./seiltaenzer.js?v=2026-11-26-19"
  ],
  "draht": [
    "./draht.html",
    "./draht.js?v=2026-11-26-19"
  ],
  "spuren": [
    "./spuren.html",
    "./spuren.js?v=2026-11-26-19"
  ],
  "ball": [
    "./ball.html",
    "./ball.js?v=2026-11-26-19"
  ],
  "jongleur": [
    "./jongleur.html",
    "./jongleur.js?v=2026-11-26-19"
  ],
  "turmspringen": [
    "./turmspringen.html",
    "./turmspringen.js?v=2026-11-26-19"
  ],
  "fallschirm": [
    "./fallschirm.html",
    "./fallschirm.js?v=2026-11-26-19"
  ],
  "holzfaeller": [
    "./holzfaeller.html",
    "./holzfaeller.js?v=2026-11-26-19"
  ],
  "fledermaus": [
    "./fledermaus.html",
    "./fledermaus.js?v=2026-11-26-19"
  ],
  "ninja": [
    "./ninja.html",
    "./ninja.js?v=2026-11-26-19"
  ],
  "freitaucher": [
    "./freitaucher.html",
    "./freitaucher.js?v=2026-11-26-19"
  ],
  "schwarm": [
    "./schwarm.html",
    "./schwarm.js?v=2026-11-26-19"
  ],
  "welle": [
    "./welle.html",
    "./welle.js?v=2026-11-26-19"
  ],
  "steinhuepfer": [
    "./steinhuepfer.html",
    "./steinhuepfer.js?v=2026-11-26-19"
  ],
  "eiskanal": [
    "./eiskanal.html",
    "./eiskanal.js?v=2026-11-26-19"
  ],
  "felsflug": [
    "./felsflug.html",
    "./felsflug.js?v=2026-11-26-19"
  ],
  "zahlengleis": [
    "./zahlengleis.html",
    "./zahlengleis.js?v=2026-11-26-19"
  ],
  "heizer": [
    "./heizer.html",
    "./heizer.js?v=2026-11-26-19"
  ],
  "hammerwurf": [
    "./hammerwurf.html",
    "./hammerwurf.js?v=2026-11-26-19"
  ],
  "entenfamilie": [
    "./entenfamilie.html",
    "./entenfamilie.js?v=2026-11-26-19"
  ],
  "grubenlore": [
    "./grubenlore.html",
    "./grubenlore.js?v=2026-11-26-19"
  ],
  "rotoren": [
    "./rotoren.html",
    "./rotoren.js?v=2026-11-26-19"
  ],
  "augenmass": [
    "./augenmass.html",
    "./augenmass.js?v=2026-11-26-19"
  ],
  "feuerseil": [
    "./feuerseil.html",
    "./feuerseil.js?v=2026-11-26-19"
  ],
  "flaggen": [
    "./flaggen.html",
    "./flaggen.js?v=2026-11-26-19"
  ],
  "zeitgefuehl": [
    "./zeitgefuehl.html",
    "./zeitgefuehl.js?v=2026-11-26-19"
  ],
  "kletterwand": [
    "./kletterwand.html",
    "./kletterwand.js?v=2026-11-26-19"
  ],
  "freihand": [
    "./freihand.html",
    "./freihand.js?v=2026-11-26-19"
  ],
  "kopfkino": [
    "./kopfkino.html",
    "./kopfkino.js?v=2026-11-26-19"
  ],
  "eisstock": [
    "./eisstock.html",
    "./eisstock.js?v=2026-11-26-19"
  ],
  "gratwanderung": [
    "./gratwanderung.html",
    "./gratwanderung.js?v=2026-11-26-19"
  ],
  "kaminfeger": [
    "./kaminfeger.html",
    "./kaminfeger.js?v=2026-11-26-19"
  ],
  "dachlaeufer": [
    "./dachlaeufer.html",
    "./dachlaeufer.js?v=2026-11-26-19"
  ],
  "stampfwerk": [
    "./stampfwerk.html",
    "./stampfwerk.js?v=2026-11-26-19"
  ],
  "bienenflug": [
    "./bienenflug.html",
    "./bienenflug.js?v=2026-11-26-19"
  ],
  "marsrover": [
    "./marsrover.html",
    "./marsrover.js?v=2026-11-26-19"
  ],
  "spiegelsee": [
    "./spiegelsee.html",
    "./spiegelsee.js?v=2026-11-26-19"
  ],
  "seifenblase": [
    "./seifenblase.html",
    "./seifenblase.js?v=2026-11-26-19"
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
