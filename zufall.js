/*
 * zufall.js – Der Zufall, den ein Turnier braucht.
 * ---------------------------------------------------------------------------
 * Ein Spiel würfelt: welche Farbe die Welle hat, wie weit die Haltetafel steht,
 * wie schnell der Kessel leerläuft. Solange jeder für sich spielt, ist das
 * richtig so – zwei Runden hintereinander sollen nicht dieselben sein.
 *
 * In einem Turnier ist es falsch. Wenn vier Leute denselben Link öffnen und um
 * dieselbe Bestenliste spielen, dann muss jeder dieselbe Aufgabe bekommen,
 * sonst gewinnt der mit dem freundlicheren Würfel. Und die drei Versuche
 * derselben Person müssen dieselbe Aufgabe sein, sonst ist der dritte Versuch
 * nur ein neuer Wurf.
 *
 * Deshalb dieses Modul. Es hat zwei Betriebsarten, und welche gilt, steht in
 * der Adresse:
 *
 *   /turmbau                     kein Turnier – Math.random, wie bisher
 *   /turmbau?turnier=herbst24    Turnier – jeder bekommt denselben Lauf
 *
 * Ohne den Parameter ist hier nichts anders als vorher: zahl() IST
 * Math.random, ohne Umweg und ohne Zustand. Das ist Absicht. Der Turniermodus
 * ist noch nicht gebaut; was hier liegt, ist nur die Fassung, in die er später
 * seinen Seed legt, damit die Spiele dafür nicht noch einmal angefasst werden
 * müssen.
 *
 * Ein Spiel benutzt es so:
 *
 *   const zufall = LernappZufall.fuer("towerStack");   // einmal beim Laden
 *   zufall.neu();                                      // zu Beginn jeder Runde
 *   const x = zufall.zahl();                           // statt Math.random()
 *
 * Das neu() zu Beginn der Runde ist der Teil, den man vergisst: ohne ihn wäre
 * der zweite Versuch im Turnier ein anderer Lauf als der erste.
 */
(() => {
  "use strict";

  // Die Kennung des Turniers steht in der Adresse. "runde" ist Platz für
  // später: ein Turnier mit mehreren Durchgängen dreht daran, und jeder
  // Durchgang ist ein anderer Lauf – derselbe aber für alle.
  function turnier() {
    let params;
    try { params = new URLSearchParams(window.location.search); } catch { return null; }
    const id = (params.get("turnier") || "").trim().slice(0, 64);
    if (!id) return null;
    const runde = (params.get("runde") || "").trim().slice(0, 16);
    return { id, runde };
  }

  const istTurnier = () => turnier() !== null;

  // ---------------------------------------------------------------------------
  // Aus einem Text eine Zahl
  // ---------------------------------------------------------------------------
  // FNV-1a, 32 Bit. Gebraucht wird kein guter Streuwert, sondern ein
  // wiederholbarer: derselbe Text muss auf jedem Gerät dieselbe Zahl geben.
  function streuwert(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // mulberry32: ein Zähler, ein paar Verwürfelungen, fertig. Klein genug, um
  // hier zu stehen, und gut genug für ein Spiel – es geht darum, dass niemand
  // die Abfolge vorhersagen kann, nicht darum, dass niemand sie nachrechnen
  // kann.
  function mulberry32(saat) {
    let a = saat >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /*
   * Die Zufallsquelle eines Spiels.
   *
   * Ohne Turnier ist zahl() Math.random und neu() tut nichts – der normale
   * Modus bleibt Bit für Bit der von vorher.
   *
   * Mit Turnier hängt die Saat am Turnier UND am Spiel: sonst begänne jedes
   * Spiel desselben Turniers mit derselben Zahlenfolge, und wer bei einem
   * Spiel merkt, was kommt, wüsste es beim nächsten wieder.
   */
  function fuer(spiel) {
    const t = turnier();
    const saat = t ? streuwert(`${t.id}|${t.runde}|${spiel}`) : 0;
    let wuerfel = t ? mulberry32(saat) : Math.random;

    const zahl = () => wuerfel();
    return {
      // Wahr, wenn dieser Lauf für alle derselbe ist.
      fest: Boolean(t),
      // Zurück an den Anfang. Im Turnier ist der zweite Versuch damit
      // derselbe Lauf wie der erste; ohne Turnier ist es ein leerer Handgriff.
      neu() { if (t) wuerfel = mulberry32(saat); },
      zahl,
      ganz: (n) => Math.floor(zahl() * n),
      von: (min, max) => min + zahl() * (max - min),
      aus: (liste) => liste[Math.floor(zahl() * liste.length)],
      // Fisher-Yates auf einer Kopie – die übergebene Liste bleibt, wie sie war.
      misch(liste) {
        const kopie = [...liste];
        for (let i = kopie.length - 1; i > 0; i -= 1) {
          const j = Math.floor(zahl() * (i + 1));
          [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
        }
        return kopie;
      },
    };
  }

  window.LernappZufall = { turnier, istTurnier, fuer };
})();
