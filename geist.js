/*
 * geist.js – Gegen wen man spielt.
 * ---------------------------------------------------------------------------
 * Allein spielt man gegen die Uhr. Packender ist es gegen jemanden: gegen den,
 * der auf Platz 1 steht, und gegen sich selbst, so gut man schon einmal war.
 * Diese Datei holt beide auf die Bühne – als zwei kleine Schalter über der
 * Spielfläche, die zugleich zeigen, wo man gegen sie steht.
 *
 * Zwei Arten, je nach Spiel:
 *
 *   tempo   Spiele mit fester Zeit (Blätter im Strom, Lianenschwung).
 *           Aufgezeichnet wird, wann jemand wie viele Punkte hatte; beim
 *           nächsten Mal läuft dieser Stand Viertelsekunde für Viertelsekunde
 *           mit. Wer vorne liegt, sieht es sofort, und wer überholt wird, auch.
 *           Der Lianenschwung zeichnet dazu den Weg auf (ort) und zeigt den
 *           Gegner als Geist im Bild – auf seiner festen Strecke an denselben
 *           Lianen.
 *   ziel    Spiele ohne Uhr, die beim ersten Fehler enden (Turmbau,
 *           Brückenbauer, Drehscheibe, Fischteich, Kacheln). Dort gibt es
 *           keinen Takt, nur eine Zahl: die Zielmarke. Der Turmbau zieht sie
 *           als Linie über den Turm.
 *
 * Wer auf Platz 1 steht, sagt die Hall of Fame – im Turnier dessen eigene
 * Liste. Die eigene Bestmarke kennt das Gerät: mini-games.js merkt sich den
 * Bestwert, diese Datei den besten Lauf dazu. Was angezeigt wird, entscheidet
 * jeder selbst mit den beiden Schaltern; die Wahl gilt auf diesem Gerät für
 * alle Spiele.
 *
 * Im Turnier kann der Admin beides abschalten (ohneGeist), und eine
 * verdeckte Rangliste verrät auch hier nicht, wer vorne liegt.
 *
 * Woher die Aufzeichnung des Gegners kommt:
 *
 *   Hall of Fame   miniGeister (cloud.js), geschrieben bei jedem Rekord
 *                  (mini-games.js, melde)
 *   Turnier        miniTurniere/<id>/geister, der beste Lauf jedes Spielers
 *                  in diesem Turnier (turnier.js, ergebnis)
 *   eigene         localStorage – auch ohne Namen und ohne Netz
 *
 * Gibt es zum Gegner keine Aufzeichnung (eine Bestzahl von früher), steht er
 * als Zielmarke da: seine Zahl, ohne Takt.
 */
(() => {
  "use strict";

  const mini = () => window.LernappMini || null;
  const cloud = () => window.MiniCloud || null;
  const kids = () => window.LernappKids || null;
  // Das Turnier, aber nur, wenn diese Seite in einem gespielt wird.
  const turnier = () => (window.LernappTurnier?.aufSpielseite?.() ? window.LernappTurnier : null);

  // Die Fassung der Aufzeichnung. Ändert sich, was in einer steht, zählt sie
  // hoch – und die alten verschwinden von selbst aus dem Bild (cloud.js,
  // geister fragt nach genau dieser Fassung).
  const LEVEL = "t1";
  const TAKT_MS = 250;
  // Zwei Minuten. Keine Runde mit Uhr dauert hier länger.
  const PROBEN_MAX = 480;
  const BAHN_MAX = 12000;
  const WAHL_KEY = "mini.gegner";
  const LAUF_KEY = "mini.lauf";
  // Gold für Platz 1, Hellblau für die eigene Bestmarke – im Bild der Spiele
  // dieselben Farben wie auf den Schaltern.
  const FARBE = { erster: "#ffd23f", eigen: "#8fd3ff" };
  const ARTEN = ["erster", "eigen"];

  const clamp = (wert, min, max) => Math.max(min, Math.min(max, wert));

  function el(tag, klasse, text) {
    const knoten = document.createElement(tag);
    if (klasse) knoten.className = klasse;
    if (text !== undefined) knoten.textContent = text;
    return knoten;
  }

  function zeichen(pfad, klasse) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", klasse);
    const weg = document.createElementNS(NS, "path");
    weg.setAttribute("d", pfad);
    svg.append(weg);
    return svg;
  }
  const KRONE = "M3 18.5h18l-1.6-10.2-4.6 4.3L12 5l-2.8 7.6-4.6-4.3z";
  const STERN = "M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z";
  const HAKEN = "M5 12.5l4.5 4.5L19 7.5";

  // Etwas, das scheitern darf, ohne die Runde mitzunehmen.
  const vielleicht = (frage) => Promise.resolve().then(frage).catch((fehler) => {
    console.warn("Der Gegner war nicht zu haben", fehler);
    return null;
  });

  // ---------------------------------------------------------------------------
  // Auf dem Gerät: die Wahl und der eigene beste Lauf
  // ---------------------------------------------------------------------------
  function liesJson(schluessel) {
    try {
      const roh = JSON.parse(localStorage.getItem(schluessel) || "null");
      return roh && typeof roh === "object" ? roh : {};
    } catch { return {}; }
  }

  function schreibeJson(schluessel, wert) {
    try { localStorage.setItem(schluessel, JSON.stringify(wert)); } catch { /* privater Modus */ }
  }

  // Beide an, bis jemand etwas anderes wählt.
  function wahl() {
    const w = liesJson(WAHL_KEY);
    return { erster: w.erster !== false, eigen: w.eigen !== false };
  }

  function setzeWahl(art, an) {
    const w = wahl();
    w[art] = Boolean(an);
    schreibeJson(WAHL_KEY, w);
  }

  // Der eigene beste Lauf: die Zahl, und in Spielen mit Uhr die Aufzeichnung
  // dazu (sonst leer). Er steht auf dem Gerät, auch wenn nie ein Name
  // eingetragen wurde – dann kennt ihn mini-games.js nicht. Ein Lauf aus
  // einer anderen Fassung des Spiels zählt nicht: Seine Zahl hiess damals
  // etwas anderes.
  //
  // Und einer, der höher ist als das, was der Server für dieses Gerät kennt
  // (mini-games.js, gleicheAb), ist keiner mehr: Der Admin hat den Eintrag
  // gelöscht. Nur ein Lauf, der schon vor dieser Auskunft dastand – einer von
  // eben, dessen Zahl noch unterwegs ist, bleibt.
  function eigenerLauf(spiel, fassung = LEVEL) {
    const alle = liesJson(LAUF_KEY);
    const lauf = alle[spiel];
    const punkte = Math.round(Number(lauf?.punkte) || 0);
    if (!(punkte > 0) || (lauf.level || LEVEL) !== fassung) return null;
    const server = mini()?.bestwertAbgeglichen?.(spiel);
    if (server && punkte > server.punkte && (Number(lauf.ms) || 0) <= server.ms) {
      delete alle[spiel];
      schreibeJson(LAUF_KEY, alle);
      return null;
    }
    return { punkte, bahn: typeof lauf.bahn === "string" ? lauf.bahn : "" };
  }

  function merkeLauf(spiel, punkte, bahn, fassung = LEVEL) {
    const alle = liesJson(LAUF_KEY);
    alle[spiel] = { punkte, bahn, level: fassung, ms: Date.now() };
    schreibeJson(LAUF_KEY, alle);
  }

  // ---------------------------------------------------------------------------
  // Die Aufzeichnung
  // ---------------------------------------------------------------------------
  // Alle TAKT_MS eine Probe: die Punkte und, wo das Spiel einen Geist zeigt,
  // wo er war (a, b, c – was das heisst, weiss das Spiel; c ist eine ganze
  // Zahl, die nicht gemittelt wird). Geschrieben wird sie als JSON, ganze
  // Zahlen, eine Probe je Stelle:
  //
  //   {"v":1,"dt":250,"p":[0,0,1,…],"a":[…],"b":[…],"c":[…]}
  function neueAufzeichnung() {
    return { p: [], a: [], b: [], c: [], ort: false, mitC: false };
  }

  // Bis zur Zeit ms auffüllen. Kam ein Bild zu spät, steht der jetzige Stand
  // auch in den Proben dazwischen – eine Viertelsekunde Unschärfe, mehr nicht.
  function probe(auf, ms, punkte, ort) {
    const soll = Math.min(PROBEN_MAX, Math.floor(Math.max(0, ms) / TAKT_MS) + 1);
    if (ort) auf.ort = true;
    if (ort && ort.c !== undefined) auf.mitC = true;
    const letzte = (liste) => (liste.length ? liste[liste.length - 1] : 0);
    while (auf.p.length < soll) {
      auf.p.push(Math.max(0, Math.round(punkte)));
      auf.a.push(ort ? Math.round(ort.a) : letzte(auf.a));
      auf.b.push(ort ? Math.round(ort.b || 0) : letzte(auf.b));
      auf.c.push(ort ? Math.round(ort.c || 0) : letzte(auf.c));
    }
  }

  // Zu lang für die Datenbank? Dann jede zweite Probe, mit doppeltem Takt –
  // die letzte bleibt, was sie war: das Ergebnis.
  function packe(auf) {
    const ende = auf.p[auf.p.length - 1];
    let dt = TAKT_MS;
    let p = auf.p;
    let a = auf.ort ? auf.a : null;
    let b = auf.ort ? auf.b : null;
    let c = auf.ort && auf.mitC ? auf.c : null;
    for (let versuch = 0; versuch < 6 && p.length; versuch += 1) {
      const daten = { v: 1, dt, p };
      if (a) Object.assign(daten, { a, b });
      if (c) daten.c = c;
      const text = JSON.stringify(daten);
      if (text.length <= BAHN_MAX) return text;
      const halb = (liste) => liste.filter((_, i) => i % 2 === 0);
      dt *= 2;
      p = halb(p);
      p[p.length - 1] = ende;
      if (a) { a = halb(a); b = halb(b); }
      if (c) c = halb(c);
    }
    return "";
  }

  function entpacke(bahn) {
    let d = null;
    try { d = JSON.parse(String(bahn || "")); } catch { return null; }
    if (!d || d.v !== 1 || !Array.isArray(d.p) || !d.p.length) return null;
    const zahl = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
    const p = d.p.map(zahl);
    const mitOrt = Array.isArray(d.a) && Array.isArray(d.b) && d.a.length === p.length && d.b.length === p.length;
    const mitC = mitOrt && Array.isArray(d.c) && d.c.length === p.length;
    return {
      dt: Number(d.dt) > 0 ? Number(d.dt) : TAKT_MS,
      p,
      a: mitOrt ? d.a.map(zahl) : null,
      b: mitOrt ? d.b.map(zahl) : null,
      c: mitC ? d.c.map(zahl) : null,
    };
  }

  // Ein Lauf zum Abspielen: Punkte und Ort zu jeder Zeit. Nach seinem Ende
  // bleibt er stehen, wo er aufgehört hat.
  function abspieler(bahn) {
    const d = entpacke(bahn);
    if (!d) return null;
    const n = d.p.length;
    const dauer = (n - 1) * d.dt;
    const stelle = (ms) => {
      const f = Math.max(0, ms) / d.dt;
      const i = Math.min(n - 1, Math.floor(f));
      return { i, j: Math.min(n - 1, i + 1), k: clamp(f - i, 0, 1) };
    };
    return {
      dauer,
      mitOrt: Boolean(d.a),
      wert: (ms) => d.p[stelle(ms).i],
      ort(ms) {
        if (!d.a) return null;
        const { i, j, k } = stelle(ms);
        return { a: d.a[i] + (d.a[j] - d.a[i]) * k, b: d.b[i] + (d.b[j] - d.b[i]) * k, c: d.c ? d.c[i] : 0 };
      },
      fertig: (ms) => ms > dauer,
    };
  }

  // ---------------------------------------------------------------------------
  // Wer die Gegner sind
  // ---------------------------------------------------------------------------
  // stand: { aus, erster, eigen, grund }
  //   aus     im Turnier abgeschaltet – dann gibt es keine Schalter
  //   erster  { name, punkte, lauf, ich } oder null
  //   eigen   { punkte, lauf } oder null
  //   grund   warum es keinen ersten gibt: "verdeckt", "frei"
  async function ladeStand(spiel, art, lage, fassung) {
    const stand = { aus: false, erster: null, eigen: null, grund: "frei" };
    const t = lage?.t || null;
    if (t?.ohneGeist) { stand.aus = true; return stand; }

    // Erst mit dem Server abgleichen: Ein gelöschter Eintrag nimmt die
    // Bestmarke auf dem Gerät mit.
    await vielleicht(() => mini()?.gleicheAb?.(spiel));
    const lokal = eigenerLauf(spiel, fassung);
    const best = Math.max(Math.round(Number(mini()?.bestwert?.(spiel)) || 0), lokal?.punkte || 0);
    if (best > 0) {
      stand.eigen = {
        punkte: best,
        lauf: art === "tempo" && lokal?.bahn && lokal.punkte === best ? abspieler(lokal.bahn) : null,
      };
    }

    if (t) {
      // Verdeckt heisst verdeckt: Wer vorne liegt, steht erst am Schluss da.
      if (t.verdeckt && turnier()?.lage?.(t) !== "beendet") { stand.grund = "verdeckt"; return stand; }
      const alle = await vielleicht(() => cloud()?.turnierErgebnisse?.(lage.id, { game: spiel }));
      const liste = mini()?.rangliste?.((alle || []).filter((e) => e.game === spiel)) || [];
      const vorne = liste[0];
      if (!vorne || !(vorne.punkte > 0)) return stand;
      const geist = art === "tempo" && vorne.spieler
        ? await vielleicht(() => cloud()?.turnierGeist?.(lage.id, spiel, vorne.spieler))
        : null;
      const passt = geist?.bahn && geist.level === fassung;
      // Zählen alle Versuche zusammen, ist die Zahl in der Liste eine Summe –
      // gegen die lässt sich keine einzelne Runde spielen. Dann gilt sein
      // bester einzelner Lauf, und ohne Aufzeichnung gibt es keinen.
      if (t.zaehlt === "summe") {
        if (passt) stand.erster = { name: vorne.name, punkte: geist.punkte, lauf: abspieler(geist.bahn), ich: Boolean(vorne.eigen) };
        return stand;
      }
      stand.erster = {
        name: vorne.name,
        punkte: vorne.punkte,
        lauf: passt && geist.punkte === vorne.punkte ? abspieler(geist.bahn) : null,
        ich: Boolean(vorne.eigen),
      };
      return stand;
    }

    const liste = await vielleicht(() => mini()?.listeFuer?.(spiel));
    const vorne = (liste || [])[0];
    if (!vorne || !(vorne.punkte > 0)) return stand;
    let lauf = null;
    if (art === "tempo" && vorne.spieler) {
      const gefunden = await vielleicht(() => cloud()?.geister?.(spiel, [vorne.spieler], fassung));
      const geist = (gefunden || [])[0];
      // Nur der Lauf, der zu dieser Zahl gehört. Trägt jemand denselben Namen
      // auf zwei Geräten, kann die Aufzeichnung vom anderen stammen.
      if (geist?.bahn && geist.punkte === vorne.punkte) lauf = abspieler(geist.bahn);
    }
    stand.erster = { name: vorne.name, punkte: vorne.punkte, lauf, ich: Boolean(vorne.eigen) };
    return stand;
  }

  // ---------------------------------------------------------------------------
  // Für ein Spiel
  // ---------------------------------------------------------------------------
  /*
   * Ein Spiel meldet sich einmal an, gleich nach game-shell.js:
   *
   *   const gegner = LernappGeist?.fuer({ spiel: "vineSwing", host, art: "tempo" });
   *
   * fassung gibt die Fassung der Aufzeichnung an (Vorgabe LEVEL). Ändert ein
   * Spiel, was seine Zahl bedeutet oder was es aufzeichnet, bekommt es eine
   * neue – dann laufen alte Läufe nicht mehr gegen neue.
   *
   * und ruft dann:
   *
   *   gegner.runde()        bei jedem Neustart, noch vor dem ersten Zug
   *   gegner.los()          wenn die Runde wirklich beginnt
   *   gegner.takt(p, ort)   wann immer es will – mit den Punkten und, für einen
   *                         Geist im Bild, dem Ort ({ a, b })
   *   gegner.ende(p)        am Schluss; gibt die Aufzeichnung für showResult
   *                         zurück (nur bei tempo)
   *   gegner.gegner()       wer gerade angezeigt wird, für das Bild
   *   gegner.zeit()         wie lange die Runde schon läuft, in ms
   */
  function fuer({ spiel, host, art = "ziel", fassung = LEVEL }) {
    if (!spiel || !host) return null;

    const z = {
      stand: null,
      ladung: 0,
      laeuft: false,
      t0: 0,
      endeMs: 0,
      punkte: 0,
      ort: null,
      auf: neueAufzeichnung(),
      vorne: {},
      geschlagen: {},
      meldungBis: {},
      zuletzt: {},
      ticker: null,
    };

    // --- Die Schalter --------------------------------------------------------
    const leiste = el("div", "gs-leiste");
    leiste.setAttribute("role", "group");
    leiste.setAttribute("aria-label", "Gegner anzeigen");
    leiste.hidden = true;

    function baueSchalter(welche, titel, pfad) {
      const knopf = el("button", `gs-chip gs-${welche}`);
      knopf.type = "button";
      const haken = el("span", "gs-haken");
      haken.append(zeichen(HAKEN, "gs-haken-zeichen"));
      const name = el("span", "gs-name");
      const wert = el("span", "gs-wert");
      knopf.append(haken, zeichen(pfad, "gs-zeichen"), el("span", "gs-titel", titel), name, wert);
      knopf.addEventListener("click", (ereignis) => {
        setzeWahl(welche, !wahl()[welche]);
        zeichne();
        // Mit Finger oder Maus: Der Knopf gibt den Fokus wieder ab, sonst
        // gehörte die Leertaste ihm statt dem Spiel. Mit der Tastatur bleibt
        // er, wo er ist.
        if (ereignis.detail > 0) knopf.blur();
      });
      return { knopf, name, wert, titel };
    }

    const schalter = {
      erster: baueSchalter("erster", "Platz 1", KRONE),
      eigen: baueSchalter("eigen", "Bestmarke", STERN),
    };
    leiste.append(schalter.erster.knopf, schalter.eigen.knopf);
    host.insertBefore(leiste, host.querySelector(".cm-play"));

    const zeit = () => (z.laeuft ? performance.now() - z.t0 : z.endeMs);

    function gegnerVon(welche) {
      const g = z.stand?.[welche];
      if (!g) return null;
      return { ...g, name: welche === "eigen" ? "Bestmarke" : g.ich ? "du" : g.name };
    }

    // Was der Gegner zu dieser Zeit hatte: mit Aufzeichnung sein Stand von
    // damals, ohne seine Zahl vom Schluss.
    const wertBei = (g, ms) => (g.lauf ? g.lauf.wert(ms) : g.punkte);
    const gespielt = () => z.laeuft || z.endeMs > 0;

    function setze(knoten, text) {
      if (knoten.textContent !== text) knoten.textContent = text;
    }

    function zeichne() {
      const s = z.stand;
      // Im Turnier erst, wenn feststeht, ob es Gegner zeigen will – sonst
      // stünden die Schalter kurz da und verschwänden wieder.
      if (s?.aus || (!s && turnier())) {
        leiste.hidden = true;
        delete host.dataset.gegner;
        return;
      }
      leiste.hidden = false;
      host.dataset.gegner = "an";
      const w = wahl();
      const ms = zeit();
      ARTEN.forEach((welche) => {
        const c = schalter[welche];
        const g = gegnerVon(welche);
        const an = Boolean(g) && w[welche];
        c.knopf.disabled = !s || !g;
        c.knopf.classList.toggle("is-an", an);
        c.knopf.classList.toggle("ist-leer", Boolean(s) && !g);
        c.knopf.setAttribute("aria-pressed", String(an));
        if (!s || !g) {
          setze(c.name, "");
          setze(c.wert, !s ? "…" : welche === "eigen" ? "noch keine" : s.grund === "verdeckt" ? "verdeckt" : "noch frei");
          c.knopf.classList.remove("ist-vorne", "ist-geschlagen");
          c.knopf.title = welche === "eigen"
            ? "Deine Bestmarke – nach deiner ersten Runde steht sie hier."
            : s?.grund === "verdeckt" ? "Die Rangliste dieses Turniers bleibt bis zum Schluss verdeckt." : "Platz 1 – noch hat hier niemand gespielt.";
          return;
        }
        setze(c.name, welche === "erster" ? g.name : "");
        const soll = gespielt() ? wertBei(g, ms) : g.punkte;
        if (Date.now() >= (z.meldungBis[welche] || 0)) setze(c.wert, String(soll));
        c.knopf.classList.toggle("ist-vorne", an && gespielt() && z.punkte > soll);
        c.knopf.classList.toggle("ist-geschlagen", an && Boolean(z.geschlagen[welche]));
        const wer = welche === "erster" ? `Platz 1: ${g.name}, ${g.punkte}` : `Deine Bestmarke: ${g.punkte}`;
        c.knopf.title = `${wer}${g.lauf ? " – läuft mit" : ""}. Antippen zum ${an ? "Ausblenden" : "Einblenden"}.`;
        c.knopf.setAttribute("aria-label", `${wer}. ${an ? "Wird angezeigt" : "Ausgeblendet"}.`);
      });
    }

    function melde(welche, text) {
      const c = schalter[welche];
      setze(c.wert, text);
      z.meldungBis[welche] = Date.now() + 1300;
      z.zuletzt[welche] = Date.now();
      c.knopf.classList.remove("is-pop");
      void c.knopf.offsetWidth;
      c.knopf.classList.add("is-pop");
    }

    // Überholt? Zweierlei: Wer mit Aufzeichnung mitläuft, kann man unterwegs
    // überholen – und wieder verlieren. Seine Zahl vom Schluss schlägt man
    // einmal, und das ist der Moment mit Ton.
    function pruefe() {
      const s = z.stand;
      if (!s || s.aus || !z.laeuft) return;
      const w = wahl();
      const ms = zeit();
      ARTEN.forEach((welche) => {
        const g = gegnerVon(welche);
        if (!g || !w[welche]) return;
        const vorne = z.punkte > wertBei(g, ms);
        if (!z.geschlagen[welche] && z.punkte > g.punkte) {
          z.geschlagen[welche] = true;
          melde(welche, welche === "eigen" ? "Bestmarke!" : g.ich ? "Rekord!" : "geschlagen!");
          kids()?.playJingle?.("unlock");
          kids()?.vibrate?.([12, 30, 12]);
        } else if (g.lauf && vorne && !z.vorne[welche] && ms > 1200
          && Date.now() - (z.zuletzt[welche] || 0) > 2500) {
          melde(welche, "überholt!");
        }
        z.vorne[welche] = vorne;
      });
    }

    function stoppe() {
      if (z.ticker) { window.clearInterval(z.ticker); z.ticker = null; }
    }

    function tick() {
      if (!z.laeuft) return;
      probe(z.auf, zeit(), z.punkte, z.ort);
      pruefe();
      zeichne();
    }

    // Wer gegen wen: frisch bei jeder Runde, damit ein neuer Platz 1 auch
    // gleich als solcher dasteht. Im Turnier erst, wenn das Turnier gelesen
    // ist – vorher weiss niemand, ob es überhaupt Gegner zeigen will.
    function lade(nr, versuch) {
      const t = turnier();
      const lage = t?.geistLage?.() || null;
      if (t && (!lage || !lage.geladen)) {
        if (versuch < 60) window.setTimeout(() => { if (nr === z.ladung) lade(nr, versuch + 1); }, 250);
        return;
      }
      ladeStand(spiel, art, lage?.t ? lage : null, fassung).then((stand) => {
        if (nr !== z.ladung) return;
        z.stand = stand;
        zeichne();
      });
    }

    function runde() {
      stoppe();
      z.laeuft = false;
      z.t0 = 0;
      z.endeMs = 0;
      z.punkte = 0;
      z.ort = null;
      z.auf = neueAufzeichnung();
      z.vorne = {};
      z.geschlagen = {};
      z.meldungBis = {};
      z.zuletzt = {};
      z.ladung += 1;
      zeichne();
      lade(z.ladung, 0);
    }

    function los() {
      if (z.laeuft) return;
      z.laeuft = true;
      z.t0 = performance.now();
      z.endeMs = 0;
      probe(z.auf, 0, z.punkte, z.ort);
      stoppe();
      z.ticker = window.setInterval(tick, 150);
      zeichne();
    }

    function takt(punkte, ort = null) {
      z.punkte = Math.max(0, Math.round(Number(punkte) || 0));
      if (ort) z.ort = ort;
      if (!z.laeuft) return;
      probe(z.auf, zeit(), z.punkte, z.ort);
      pruefe();
    }

    function ende(punkte) {
      if (punkte !== undefined) z.punkte = Math.max(0, Math.round(Number(punkte) || 0));
      const lief = z.laeuft;
      const ms = zeit();
      if (lief) {
        probe(z.auf, ms, z.punkte, z.ort);
        z.auf.p[z.auf.p.length - 1] = z.punkte;
        pruefe();
      }
      z.laeuft = false;
      z.endeMs = Math.max(1, ms);
      stoppe();
      zeichne();
      if (!lief) return null;
      const bahn = art === "tempo" && z.auf.p.length ? packe(z.auf) : "";
      // Der eigene beste Lauf bleibt auf dem Gerät – auch ohne Namen, auch
      // ohne Netz.
      if (z.punkte > 0 && z.punkte > (eigenerLauf(spiel, fassung)?.punkte || 0)) {
        merkeLauf(spiel, z.punkte, bahn, fassung);
      }
      return bahn ? { level: fassung, bahn } : null;
    }

    // Wer gerade angezeigt wird – für das Bild des Spiels. Liegt man selbst
    // auf Platz 1, liefe die eigene Bestmarke genau unter dem ersten Geist
    // her; dann steht sie nur einmal da.
    function gegner() {
      const s = z.stand;
      if (!s || s.aus) return [];
      const w = wahl();
      const raus = [];
      ARTEN.forEach((welche) => {
        const g = gegnerVon(welche);
        if (!g || !w[welche]) return;
        if (welche === "eigen" && raus[0]?.ich && raus[0].punkte === g.punkte) return;
        raus.push({ art: welche, name: g.name, punkte: g.punkte, lauf: g.lauf, ich: Boolean(g.ich), farbe: FARBE[welche] });
      });
      return raus;
    }

    window.addEventListener("pagehide", stoppe);

    const steuerung = { runde, los, takt, ende, gegner, zeit, leiste };
    angemeldet.push({ spiel, art, steuerung, z });
    return steuerung;
  }

  const angemeldet = [];

  window.LernappGeist = {
    LEVEL, TAKT_MS, FARBE,
    fuer, wahl, setzeWahl, entpacke, abspieler, eigenerLauf,
    // Für die Prüfung im Browser: was die Spiele dieser Seite angemeldet haben.
    stand: () => angemeldet.map(({ spiel, art, z }) => ({
      spiel, art, laeuft: z.laeuft, punkte: z.punkte, proben: z.auf.p.length,
      stand: z.stand ? {
        aus: z.stand.aus,
        grund: z.stand.grund,
        erster: z.stand.erster ? { name: z.stand.erster.name, punkte: z.stand.erster.punkte, lauf: Boolean(z.stand.erster.lauf), ich: z.stand.erster.ich } : null,
        eigen: z.stand.eigen ? { punkte: z.stand.eigen.punkte, lauf: Boolean(z.stand.eigen.lauf) } : null,
      } : null,
    })),
  };
})();
