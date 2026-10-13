/*
 * zufall.js – Der Zufall, den ein Turnier braucht.
 * ---------------------------------------------------------------------------
 * Ein Spiel würfelt: welche Farbe die Welle hat, wie weit die Haltetafel steht,
 * wie schnell der Kessel leerläuft. Solange jeder für sich spielt, ist das
 * richtig so – zwei Runden hintereinander sollen nicht dieselben sein.
 *
 * In einem Turnier ist es falsch. Wenn vier Leute denselben Link öffnen und um
 * dieselbe Bestenliste spielen, dann muss jeder dieselbe Aufgabe bekommen,
 * sonst gewinnt der mit dem freundlicheren Würfel.
 *
 * Deshalb dieses Modul. Es hat zwei Betriebsarten, und welche gilt, steht in
 * der Adresse:
 *
 *   /turmbau                     kein Turnier – jede Runde neu gewürfelt
 *   /turmbau?turnier=herbst24    Turnier – jeder bekommt denselben Lauf
 *
 * Ohne den Parameter würfelt jede Runde ihren eigenen Anfang (die Saat) aus
 * Math.random und zieht daraus ihre Zahlen. Das ist so zufällig wie vorher –
 * aber die Saat lässt sich aufschreiben: Wer einen Lauf aufzeichnet
 * (geist.js), schreibt sie dazu, und wer ihn später anschaut, baut mit ihr
 * dieselbe Welt wieder auf (halte).
 *
 * Im Turnier stellt turnier.js zwei Dinge nach, sobald es das Turnier gelesen
 * hat (stelle):
 *
 *   runde   der wievielte Versuch das ist. Der erste Versuch ist für alle
 *           derselbe Lauf, der zweite auch – aber ein anderer als der erste.
 *           So vergleicht das Turnier Gleiches mit Gleichem, und trotzdem
 *           lernt niemand seinen Lauf auswendig, indem er ihn dreimal spielt.
 *   frei    das Turnier will gar keinen festen Lauf ("jedes Mal neu
 *           gewürfelt"). Dann würfelt jede Runde wieder frisch.
 *
 * Und im Live-Modus (live-spiel.js) gibt der Live-Abend die Saat vor: Alle,
 * die eine Runde zusammen spielen, spielen dieselbe Welt.
 *
 * Ein Spiel benutzt es so:
 *
 *   const zufall = LernappZufall.fuer("towerStack");   // einmal beim Laden
 *   zufall.neu();                                      // zu Beginn jeder Runde
 *   const x = zufall.zahl();                           // statt Math.random()
 *
 * Das neu() zu Beginn der Runde ist der Teil, den man vergisst: Erst dort
 * greift, was turnier.js zuletzt gestellt hat. Ohne neu() liefe der zweite
 * Versuch mit dem Rest der Zahlen des ersten weiter.
 *
 * Und nur, was die Aufgabe entscheidet, kommt von hier: welche Kacheln
 * leuchten, welche Zahl gesucht wird. Was davon abhängt, wie jemand spielt –
 * Funken beim perfekten Treffer, das Schlingern eines Fisches Bild für Bild –,
 * bleibt bei Math.random. Sonst verbrauchte der bessere Spieler mehr Zahlen,
 * und ab seinem ersten Funken liefe sein Lauf anders als der aller anderen.
 */
(() => {
  "use strict";

  // Die Kennung des Turniers steht in der Adresse. "runde" in der Adresse ist
  // der Anfangswert; turnier.js stellt sie nach, sobald es weiss, der
  // wievielte Versuch gleich beginnt.
  function ausDerAdresse() {
    let params;
    try { params = new URLSearchParams(window.location.search); } catch { return null; }
    const id = (params.get("turnier") || "").trim().slice(0, 64);
    if (!id) return null;
    const runde = (params.get("runde") || "").trim().slice(0, 16);
    return { id, runde };
  }

  const adresse = ausDerAdresse();
  const lage = { id: adresse?.id || "", runde: adresse?.runde || "", frei: false };

  function turnier() {
    return lage.id ? { id: lage.id, runde: lage.runde } : null;
  }

  const istTurnier = () => turnier() !== null;
  // Die Saat einer Live-Runde, sonst null.
  const liveSaat = () => {
    const saat = window.LernappLiveSpiel?.saat?.();
    return Number.isInteger(saat) ? saat >>> 0 : null;
  };

  // Ob die Runden gerade für alle dieselben sind.
  const istFest = () => liveSaat() !== null || (Boolean(lage.id) && !lage.frei);

  /*
   * Was das Turnier aus dem Zufall macht. Gilt ab dem nächsten neu() – eine
   * Runde, die schon läuft, würfelt mit dem weiter, was sie hatte.
   */
  function stelle({ runde, frei } = {}) {
    if (runde !== undefined && runde !== null) lage.runde = String(runde).trim().slice(0, 16);
    if (frei !== undefined) lage.frei = Boolean(frei);
  }

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
   * Ohne Turnier würfelt neu() eine frische Saat aus Math.random.
   *
   * Mit Turnier hängt die Saat am Turnier, an der Runde UND am Spiel: sonst
   * begänne jedes Spiel desselben Turniers mit derselben Zahlenfolge, und wer
   * bei einem Spiel merkt, was kommt, wüsste es beim nächsten wieder.
   *
   * halte(saat) legt die Saat für alle folgenden Runden fest – so spielt das
   * Zuschauen einen aufgezeichneten Lauf in seiner eigenen Welt ab.
   *
   * Im Live-Modus kommt die Saat von der Runde des Live-Abends.
   */
  function fuer(spiel) {
    const turnierSaat = () => streuwert(`${lage.id}|${lage.runde}|${spiel}`);
    let gehalten = null;
    let jetzt = 0;
    const wuerfel = () => {
      if (gehalten !== null) jetzt = gehalten;
      else if (liveSaat() !== null) jetzt = liveSaat();
      else if (istFest()) jetzt = turnierSaat();
      else jetzt = Math.floor(Math.random() * 4294967296) >>> 0;
      return mulberry32(jetzt);
    };
    let aktuell = wuerfel();

    const zahl = () => aktuell();
    return {
      // Wahr, wenn dieser Lauf für alle derselbe ist.
      get fest() { return istFest(); },
      // Zurück an den Anfang – und zwar an den Anfang der Runde, die jetzt
      // gilt. Ohne Turnier mit frischer Saat.
      neu() { aktuell = wuerfel(); },
      // Mit welcher Saat diese Runde würfelt – für die Aufzeichnung.
      saat: () => jetzt,
      halte(saat) { gehalten = saat === null || saat === undefined ? null : Number(saat) >>> 0; },
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

  window.LernappZufall = { turnier, istTurnier, istFest, fuer, stelle };
})();
