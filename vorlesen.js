/*
 * vorlesen.js – Texte vorlesen, wenn man möchte: ein kleiner Lautsprecher
 * neben dem Text.
 * ---------------------------------------------------------------------------
 * Für die Spiele zu zweit (zwei.js und die Spiele darauf). Neben der
 * Beschreibung im Menü, der Anleitung, den Hinweisen, dem Satz über dem
 * Brett und den Hinweisen im Spiel steht ein Lautsprecher. Ein Tipp liest
 * den Text mit der Stimme des Geräts vor (Deutsch; Schweizer Stimme, wenn
 * es eine gibt), ein zweiter Tipp hält an. Von selbst liest nichts vor.
 *
 * Gibt der Browser keine Sprachausgabe her, gibt es auch keine Knöpfe.
 *
 *   LernappVorlesen.kann                  ob vorgelesen werden kann
 *   LernappVorlesen.knopf(text, { klasse, titel })
 *                                         ein Lautsprecher-Knopf; text ist ein
 *                                         Text oder eine Funktion, die ihn
 *                                         beim Tippen liefert
 *   LernappVorlesen.sprich(text)          gleich vorlesen
 *   LernappVorlesen.stopp()               aufhören
 *   LernappVorlesen.sauber(text)          was die Stimme davon liest
 *   LernappVorlesen.zustand()             Stimmen, gewählte Stimme, letzter
 *                                         Fehler – zum Nachsehen
 *
 * Android ist eigen (gesehen auf einem Xiaomi-Tablet, November 2026: der
 * Lautsprecher leuchtete kurz auf und blieb stumm). Darum:
 *   - abgebrochen wird nur, was wirklich läuft – und danach kurz gewartet:
 *     Gleich nach cancel() verschlucken manche Geräte das Nächste;
 *   - endet ein Vorlesen, bevor es begonnen hat (oder mit einem Fehler),
 *     versucht es der nächste Weg: erst mit der gewählten deutschen Stimme,
 *     dann nur mit der Sprache Deutsch, zuletzt mit der Stimme, die das
 *     Gerät von sich aus nimmt;
 *   - klappt keiner, steht neben dem Lautsprecher kurz, woran es liegen kann
 *     (meist fehlt eine deutsche Stimme in der Sprachausgabe des Geräts).
 */
(() => {
  "use strict";

  const synth = window.speechSynthesis;
  const kann = Boolean(synth && typeof synth.speak === "function" && window.SpeechSynthesisUtterance);

  // Eine deutsche Stimme: zuerst aus der Schweiz, dann aus Deutschland, dann
  // irgendeine; auf dem Gerät selbst vor einer aus dem Netz.
  let stimme = null;
  function stimmeWaehlen() {
    if (!kann) return;
    let alle = [];
    try { alle = synth.getVoices?.() || []; } catch { alle = []; }
    const rang = (v) => (/^de[-_]CH/i.test(v.lang) ? 0 : /^de[-_]DE/i.test(v.lang) ? 1 : 2) + (v.localService ? 0 : 0.5);
    stimme = alle.filter((v) => /^de([-_]|$)/i.test(v.lang || "")).sort((a, b) => rang(a) - rang(b))[0] || null;
  }
  if (kann) {
    stimmeWaehlen();
    try { synth.addEventListener?.("voiceschanged", stimmeWaehlen); } catch { /* alte Browser */ }
  }

  // Was die Stimme stolpern liesse: Bilder (Emoji), Anführungszeichen,
  // Gedankenstriche, Pünktchen.
  function sauber(text) {
    return String(text || "")
      .replace(/\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu, " ")
      .replace(/[️‍]/g, "")
      .replace(/[«»„“”"]/g, "")
      .replace(/\s+[–—]\s+/g, ", ")
      .replace(/\s*…/g, ".")
      .replace(/\s+([,.!?:;])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  const knopfAn = (k) => { k?.classList.add("ist-spricht"); k?.setAttribute("aria-pressed", "true"); };
  const knopfAus = (k) => { k?.classList.remove("ist-spricht"); k?.setAttribute("aria-pressed", "false"); };

  let jetzt = null;        // { knopf, nr, aeusserung }
  let laufNr = 0;          // jedes Vorlesen hat eine Nummer; was älter ist, zählt nicht mehr
  let abgebrochenUm = 0;   // wann zuletzt cancel() lief
  let letzterFehler = "";

  function stopp() {
    if (!kann) return;
    const war = jetzt;
    jetzt = null;
    laufNr += 1;
    knopfAus(war?.knopf);
    let laeuft = Boolean(war);
    try { laeuft = laeuft || synth.speaking || synth.pending; } catch { /* egal */ }
    if (!laeuft) return;
    try { synth.cancel(); } catch { /* egal */ }
    abgebrochenUm = Date.now();
  }

  // Die Wege, auf denen gesprochen wird – der nächste, wenn einer nicht klappt.
  function wege() {
    const liste = [];
    if (stimme) liste.push((a) => { a.lang = stimme.lang; a.voice = stimme; });
    liste.push((a) => { a.lang = "de-DE"; });
    liste.push(() => { /* was das Gerät von sich aus nimmt */ });
    return liste;
  }

  function sprich(text, knopf = null) {
    if (!kann) return false;
    const t = sauber(text);
    stopp();
    if (!t) return false;
    const nr = laufNr;
    jetzt = { knopf, nr, aeusserung: null };
    knopfAn(knopf);
    hinweisWeg();
    const liste = wege();
    // Gleich nach cancel() kurz warten; sonst sofort (im Tipp selbst).
    const warte = Math.max(0, 250 - (Date.now() - abgebrochenUm));
    if (warte) window.setTimeout(() => versuche(t, knopf, nr, liste, 0), warte);
    else versuche(t, knopf, nr, liste, 0);
    return true;
  }

  function versuche(t, knopf, nr, liste, weg) {
    if (jetzt?.nr !== nr) return;
    const a = new window.SpeechSynthesisUtterance(t);
    a.rate = 0.95;
    liste[weg](a);
    jetzt.aeusserung = a;
    const anfang = Date.now();
    let begonnen = false;
    let wache = 0;
    let erledigt = false;
    const ende = (fehler) => {
      window.clearTimeout(wache);
      if (erledigt) return;
      erledigt = true;
      if (jetzt?.nr !== nr || jetzt.aeusserung !== a) return;
      // Ohne zu beginnen schon wieder fertig: Da wurde nichts gesprochen.
      const stumm = !begonnen && Date.now() - anfang < 1200;
      if (fehler || stumm) {
        letzterFehler = fehler || "ohne Ton beendet";
        if (weg + 1 < liste.length) {
          try { synth.cancel(); } catch { /* egal */ }
          abgebrochenUm = Date.now();
          window.setTimeout(() => versuche(t, knopf, nr, liste, weg + 1), 300);
          return;
        }
        jetzt = null;
        knopfAus(knopf);
        hinweisZeigen(knopf);
        return;
      }
      jetzt = null;
      knopfAus(knopf);
    };
    a.onstart = () => { begonnen = true; window.clearTimeout(wache); };
    a.onend = () => ende("");
    a.onerror = (e) => ende(e?.error || "Fehler");
    // Kommt gar nichts – weder Anfang noch Ende –, ist auch das ein Fehler.
    wache = window.setTimeout(() => { if (!begonnen) ende("keine Antwort"); }, 6000);
    try { synth.resume?.(); } catch { /* egal */ }
    try { synth.speak(a); } catch (fehler) { ende(String(fehler?.message || fehler || "Fehler")); }
  }

  // Klappt gar nichts: ein kurzer Hinweis neben dem Lautsprecher.
  let hinweis = null;
  function hinweisWeg() { hinweis?.remove(); hinweis = null; }
  function hinweisZeigen(knopf) {
    hinweisWeg();
    if (!knopf?.isConnected) return;
    const h = document.createElement("div");
    h.className = "vl-hinweis";
    h.setAttribute("role", "status");
    const deutsch = alleStimmen().filter((v) => /^de([-_]|$)/i.test(v.lang || "")).length;
    h.textContent = deutsch
      ? `Vorlesen klappt auf diesem Gerät gerade nicht (${letzterFehler}). Tipp: In den Einstellungen unter «Sprachausgabe» (Text-in-Sprache) die Google-Sprachausgabe wählen.`
      : `Auf diesem Gerät fehlt eine deutsche Stimme (${letzterFehler}). In den Einstellungen unter «Sprachausgabe» (Text-in-Sprache) die Google-Sprachausgabe wählen und Deutsch laden.`;
    const r = knopf.getBoundingClientRect();
    const breit = Math.min(300, window.innerWidth - 24);
    h.style.width = `${breit}px`;
    h.style.left = `${Math.max(12, Math.min(window.innerWidth - breit - 12, r.left + r.width / 2 - breit / 2))}px`;
    if (r.bottom + 120 < window.innerHeight) h.style.top = `${r.bottom + 8}px`;
    else h.style.bottom = `${window.innerHeight - r.top + 8}px`;
    h.addEventListener("click", hinweisWeg);
    document.body.append(h);
    hinweis = h;
    window.setTimeout(() => { if (hinweis === h) hinweisWeg(); }, 12000);
  }

  function alleStimmen() { try { return synth?.getVoices?.() || []; } catch { return []; } }
  function zustand() {
    const alle = alleStimmen();
    return {
      kann,
      stimmen: alle.length,
      deutsch: alle.filter((v) => /^de([-_]|$)/i.test(v.lang || "")).map((v) => `${v.name} (${v.lang}${v.localService ? "" : ", Netz"})`),
      gewaehlt: stimme ? `${stimme.name} (${stimme.lang})` : "",
      letzterFehler,
    };
  }

  const SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
    + '<path d="M3.5 9.2h3.6L12 5.1v13.8l-4.9-4.1H3.5z" fill="currentColor"/>'
    + '<path class="vl-welle vl-welle-1" d="M15.2 9.1a4.2 4.2 0 0 1 0 5.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    + '<path class="vl-welle vl-welle-2" d="M17.8 6.6a7.8 7.8 0 0 1 0 10.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    + "</svg>";

  function knopf(text, { klasse = "", titel = "Vorlesen" } = {}) {
    const k = document.createElement("button");
    k.type = "button";
    k.className = `vl-knopf${klasse ? ` ${klasse}` : ""}`;
    k.innerHTML = SVG;
    k.setAttribute("aria-label", titel);
    k.setAttribute("aria-pressed", "false");
    k.title = titel;
    if (!kann) k.hidden = true;
    k.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (jetzt?.knopf === k) { stopp(); return; }
      sprich(typeof text === "function" ? text() : text, k);
    });
    return k;
  }

  // Wer die Seite verlässt, will nichts mehr hören.
  window.addEventListener("pagehide", stopp);

  window.LernappVorlesen = { kann, knopf, sprich, stopp, sauber, zustand };
})();
