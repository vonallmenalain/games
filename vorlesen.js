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

  let jetzt = null; // { knopf, aeusserung }
  function stopp() {
    if (!kann) return;
    const war = jetzt;
    jetzt = null;
    war?.knopf?.classList.remove("ist-spricht");
    war?.knopf?.setAttribute("aria-pressed", "false");
    try { synth.cancel(); } catch { /* egal */ }
  }

  function sprich(text, knopf = null) {
    if (!kann) return false;
    const t = sauber(text);
    stopp();
    if (!t) return false;
    const a = new window.SpeechSynthesisUtterance(t);
    a.lang = stimme?.lang || "de-DE";
    if (stimme) a.voice = stimme;
    a.rate = 0.95;
    const fertig = () => {
      if (jetzt?.aeusserung !== a) return;
      jetzt = null;
      knopf?.classList.remove("ist-spricht");
      knopf?.setAttribute("aria-pressed", "false");
    };
    a.onend = fertig;
    a.onerror = fertig;
    jetzt = { knopf, aeusserung: a };
    knopf?.classList.add("ist-spricht");
    knopf?.setAttribute("aria-pressed", "true");
    try { synth.speak(a); } catch { fertig(); return false; }
    return true;
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

  window.LernappVorlesen = { kann, knopf, sprich, stopp, sauber };
})();
