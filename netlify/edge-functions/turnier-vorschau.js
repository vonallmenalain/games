/*
 * Die Vorschau eines Turnierlinks – mit dem Namen des Turniers.
 * ---------------------------------------------------------------------------
 * Wer einen Link in WhatsApp, Signal oder iMessage schickt, bekommt darunter
 * ein Kärtchen: Bild, Titel, ein Satz. Das liest der Messenger aus dem HTML
 * der Seite (og:title, og:description), ohne ein Skript laufen zu lassen. Die
 * Turnierseite ist aber für alle Turniere dieselbe Datei (turnier.html) –
 * ohne Hilfe stünde unter jedem Turnierlink dasselbe.
 *
 * Diese Edge Function hilft: Netlify ruft sie vor dem Ausliefern auf.
 *
 *   /turnier?t=<id>   holt den Namen (und die Beschreibung) des Turniers aus
 *                     Firestore und schreibt ihn in die Vorschau: Titel ist
 *                     der Name, darunter «Turnier · arcade» oder die
 *                     Beschreibung. Der Rest der Seite bleibt, wie er ist.
 *   /<id>             der eigene Link (admin.js, «Eigener Link"): Liegt dort
 *                     keine Datei und gibt es das Turnier, geht es gleich
 *                     weiter auf /turnier?t=<id> – auch für den Messenger,
 *                     der so die Vorschau mit dem Namen bekommt. Ohne diese
 *                     Function leitet 404.html im Browser weiter
 *                     (scripts/seiten-bauen.mjs, weiterSeite).
 *
 * Gelesen wird über die REST-Schnittstelle von Firestore, ohne Konto: Ein
 * einzelnes Turnier darf jeder lesen, der seine Kennung kennt
 * (firestore.rules) – und wer den Link hat, kennt sie. Geht dabei etwas
 * schief (kein Netz, zu langsam, kein Turnier), kommt die Seite unverändert:
 * Die Vorschau ist eine Zugabe, nie ein Grund, dass eine Seite nicht lädt.
 *
 * Keine Geheimnisse, keine Umgebungsvariablen. Geprüft wird sie ohne Netlify
 * in scripts/pruefen.mjs (mit einem nachgemachten Firestore).
 */

// Dasselbe Projekt wie in cloud.js – scripts/pruefen.mjs hält die beiden
// zusammen.
const PROJEKT = "games-a0cd4";
// Die Kennung eines Turniers, wie firestore.rules sie verlangt (istTurnier).
const KENNUNG = /^[a-z0-9-]{6,48}$/;
// Länger wartet niemand auf eine Vorschau – und kein Spieler auf seine Seite.
const WARTEN_MS = 1500;
const BESCHREIBUNG_MAX = 140;

export async function turnierDaten(id) {
  const felder = ["name", "beschreibung"].map((f) => `mask.fieldPaths=${f}`).join("&");
  const adresse = `https://firestore.googleapis.com/v1/projects/${PROJEKT}/databases/(default)/documents/miniTurniere/${id}?${felder}`;
  const antwort = await fetch(adresse, { signal: AbortSignal.timeout(WARTEN_MS) });
  if (antwort.status === 404) return null;
  if (!antwort.ok) throw new Error(`Firestore antwortet mit ${antwort.status}`);
  const daten = await antwort.json();
  const name = String(daten?.fields?.name?.stringValue || "").trim();
  if (!name) return null;
  return { name, beschreibung: String(daten?.fields?.beschreibung?.stringValue || "").replace(/\s+/g, " ").trim() };
}

const sicher = (text) => String(text)
  .replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function gekuerzt(text, max) {
  if (text.length <= max) return text;
  const stueck = text.slice(0, max - 1);
  const wort = stueck.lastIndexOf(" ");
  return `${(wort > max * 0.6 ? stueck.slice(0, wort) : stueck).replace(/[\s,;:.–-]+$/, "")} …`;
}

// Titel und Satz der Vorschau in die Seite schreiben – nur in die Stellen,
// die es schon gibt.
export function mitVorschau(html, { name, beschreibung }) {
  const titel = sicher(name);
  const satz = sicher(beschreibung ? `Turnier · arcade – ${gekuerzt(beschreibung, BESCHREIBUNG_MAX)}` : "Turnier · arcade");
  const setze = (text, muster, wert) => text.replace(muster, (_, vorne, hinten) => `${vorne}${wert}${hinten}`);
  let raus = html;
  raus = setze(raus, /(<meta property="og:title" content=")[^"]*(" \/>)/, titel);
  raus = setze(raus, /(<meta property="og:description" content=")[^"]*(" \/>)/, satz);
  raus = setze(raus, /(<meta name="description" content=")[^"]*(" \/>)/, satz);
  raus = setze(raus, /(<title>)[^<]*(<\/title>)/, `${titel} · Turnier · arcade`);
  return raus;
}

export default async function turnierVorschau(request, context) {
  const adresse = new URL(request.url);

  if (adresse.pathname === "/turnier") {
    const seite = await context.next();
    const id = (adresse.searchParams.get("t") || "").trim();
    if (!KENNUNG.test(id) || seite.status !== 200 || !(seite.headers.get("content-type") || "").includes("text/html")) return seite;
    let turnier = null;
    try { turnier = await turnierDaten(id); } catch { return seite; }
    if (!turnier) return seite;
    const kopf = new Headers(seite.headers);
    kopf.delete("content-length");
    kopf.delete("etag");
    return new Response(mitVorschau(await seite.text(), turnier), { status: seite.status, headers: kopf });
  }

  // Der eigene Link. Alles, was nicht so aussieht, geht unberührt weiter –
  // und auch, was so aussieht, aber eine Seite ist (/turmbau).
  let weg = "";
  try { weg = decodeURIComponent(adresse.pathname); } catch { return undefined; }
  weg = weg.replace(/^\/+|\/+$/g, "").toLowerCase();
  if (!KENNUNG.test(weg)) return undefined;
  const seite = await context.next();
  if (seite.status !== 404) return seite;
  let turnier = null;
  try { turnier = await turnierDaten(weg); } catch { return seite; }
  if (!turnier) return seite;
  // 302, nicht 301: Wird das Turnier gelöscht, darf der Link wieder frei sein.
  return Response.redirect(new URL(`/turnier?t=${weg}`, adresse), 302);
}

// Nur für Seiten: Skripte, Stylesheets, Bilder und Klänge gehen an ihr vorbei.
export const config = {
  path: "/*",
  excludedPath: ["/*.js", "/*.css", "/*.html", "/*.webmanifest", "/*.png", "/*.jpg", "/*.webp", "/*.svg", "/*.ico",
    "/icons/*", "/bilder/*", "/filme/*", "/klang/*"],
};
