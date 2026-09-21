/*
 * strecke.js – Streckenlauf: dasselbe Level, immer wieder, und neben dir die
 * drei Besten.
 *
 * Alle anderen Spiele hier würfeln. Dieses nicht: Die Strecke ist eine Tabelle
 * (STRECKE weiter unten), bei jedem Lauf dieselbe, Meter für Meter. Genau das
 * ist die Bedingung dafür, dass ein Lauf sich aufheben und neben dem nächsten
 * noch einmal abspielen lässt – und darum geht es hier. Wer die Seite öffnet,
 * läuft nicht allein: Neben ihm laufen die drei, die oben in der Bestenliste
 * stehen, so wie sie damals gelaufen sind.
 *
 * Gespielt wird mit einem Finger. Tippen springt, und wer den Finger länger
 * liegen lässt, springt höher – dieselbe Taste für einen kleinen Hüpfer und
 * einen weiten Satz. Mehr Tasten hätte das Spiel nicht vertragen; eine Hand
 * hält das Gerät.
 *
 * Die Kisten sind keine Wände, sondern Podeste: Wer oben aufkommt, läuft oben
 * weiter. Nur wer seitlich hineinläuft, stolpert – dann fällt die Kiste um,
 * man läuft hindurch und verliert Tempo. Stehenbleiben kann man nirgends, und
 * das ist Absicht: Ein Lauf, der sich festfahren kann, ist neben einem Geist
 * kein Rennen mehr.
 *
 * Schneller wird man von selbst, solange nichts schiefgeht (TEMPO_ZUWACHS).
 * Damit kostet ein Fehler zweimal: die Zeit des Stolperns und den Schwung, der
 * wieder aufgebaut werden muss.
 *
 * Die Punkte sind Zeitguthaben: Wer im Ziel ankommt, bekommt, was von
 * ZEITLIMIT übrig ist, dazu die Kohle, die er eingesammelt hat. Wer nicht
 * ankommt, bekommt seine Strecke – weniger als jeder, der ankommt, und das
 * ist die richtige Reihenfolge.
 *
 * Gezeichnet wird auf eine Leinwand, wie beim Turmbau: Landschaft, Schienen,
 * Hindernisse, vier Läufer und eine Positionsleiste sind zu viele Kästen für
 * den Seitenaufbau.
 *
 * Gerechnet wird in Metern. Im Bild stehen immer SICHT_M Meter – auf dem Handy
 * dieselben wie am grossen Bildschirm, nur kleiner. Sonst sähe der eine
 * weiter als der andere, und dasselbe Level wäre nicht dasselbe Spiel.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "track") return;

  const host = document.querySelector("#sl-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const art = window.LernappTrainArt;
  if (!host || !shellApi || !art) return;

  const kids = () => window.LernappKids || null;
  const mini = () => window.LernappMini || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // ---------------------------------------------------------------------------
  // Die Fassung des Levels
  // ---------------------------------------------------------------------------
  // Ein Geist ist die Aufzeichnung eines Laufs durch GENAU diese Strecke.
  // Ändert sich unten eine Zahl, passt keine alte Aufzeichnung mehr: Der Geist
  // spränge, wo keine Lücke ist, und liefe durch Kisten. Deshalb trägt jede
  // Aufzeichnung ihre Fassung, und gezeigt werden nur die, die passen.
  //
  // Wer die Strecke ändert, zählt hier hoch. Die alten Geister verschwinden
  // damit aus dem Bild – das ist der Preis, und er ist der richtige.
  const LEVEL = "v1";

  // ---------------------------------------------------------------------------
  // Masse und Regeln
  // ---------------------------------------------------------------------------
  const ZIEL_M = 640;              // so lang ist die Strecke
  // So viel Strecke steht im Bild. Die Zahl ist ein Handel: Weiter sehen
  // heisst mehr Zeit zum Reagieren, aber einen kleineren Läufer – und wer
  // seinen Läufer nicht deutlich sieht, springt daneben. Vierunddreissig
  // Meter lassen bei Höchsttempo knapp anderthalb Sekunden Vorschau; für ein
  // Level, das man kennenlernt, ist das genug.
  const SICHT_M = 34;
  const LAEUFER_X = 0.3;           // wo der Läufer im Bild steht, als Anteil
  const ZEITLIMIT_MS = 100000;

  const TEMPO_START = 11;          // Meter je Sekunde
  const TEMPO_MAX = 16.5;
  const TEMPO_ZUWACHS = 0.28;      // je Sekunde ohne Fehler
  const TEMPO_STOLPER = 5.5;       // so langsam läuft man nach einem Stolpern

  // Der Sprung. Aus SPRUNG_V und SCHWERE folgt alles andere: 2,5 Meter hoch,
  // 0,78 Sekunden lang, und damit gut acht Meter weit bei Anfangstempo und
  // knapp dreizehn bei Höchsttempo.
  const SPRUNG_V = 13.2;
  const SCHWERE = 34;
  // Loslassen schneidet den Aufstieg ab. Das ist der Unterschied zwischen
  // einem Hüpfer über eine Kiste und einem Satz über eine Lücke – mit
  // derselben Berührung.
  const SPRUNG_KURZ = 0.42;
  // Ein Sprung geht auch noch kurz nachdem der Boden weg ist. Ohne diese
  // Nachsicht fühlt sich jede Kante ungerecht an; mit ihr merkt es niemand.
  const NACHSICHT_MS = 90;

  const LAEUFER_B = 0.7;           // wie breit der Läufer ist, in Metern
  const FIGUR_MIN = 34;            // so gross wird eine Figur mindestens gezeichnet
  const STOLPER_MS = 520;
  const STURZ_MS = 900;
  const TIEF = -4;                 // so tief fällt man, bevor der Sturz zählt

  const KOHLE_PUNKTE = 12;
  const ANKUNFT_PUNKTE = 200;      // dafür, überhaupt anzukommen

  // Wie oft die Bahn aufgezeichnet wird. Fünfzig Millisekunden sind zwanzig
  // Stellungen je Sekunde – genug, dass ein Sprung ein Sprung bleibt, und bei
  // hundert Sekunden immer noch unter der Grenze, die firestore.rules setzt.
  const SCHRITT_MS = 50;
  // So viele Stellungen höchstens. Zweitausendsechshundert sind 7800 Bytes und
  // damit 10400 Zeichen Base64 – unter der Grenze, die firestore.rules setzt
  // (12000). Die Runde endet ohnehin nach ZEITLIMIT_MS, also nach zweitausend.
  const AUFZEICHNUNG_MAX = 2600;

  const GEISTER_ZAHL = 3;
  const GEIST_FARBEN = ["#e0a92f", "#8d99a6", "#b9773f"];  // Gold, Silber, Bronze

  // ---------------------------------------------------------------------------
  // Die Strecke
  // ---------------------------------------------------------------------------
  // Von Hand gelegt, nicht gewürfelt. Die Reihenfolge ist die Schwierigkeit:
  // vorne einzelne Hindernisse mit viel Platz, hinten Kisten direkt hinter
  // Lücken und Lücken direkt hintereinander. Schneller wird der Läufer von
  // selbst – der Platz zum Reagieren wird also immer knapper, ohne dass ein
  // Hindernis schwerer würde.
  //
  //   schwelle  hierher kommt zurück, wer in eine Lücke fällt
  //   luecke    b Meter ohne Boden
  //   kiste     ein Podest, 1,2 auf 1,4 Meter
  //   hoch      dasselbe, 2,0 Meter hoch – darüber muss man richtig springen
  //   kohle     ein Punkt zum Einsammeln, in der Höhe y
  const STRECKE = [
    ["schwelle", 0],
    ["kohle", 20, 0.7], ["kohle", 25, 0.7],
    ["kiste", 38],
    ["kohle", 52, 2.0],
    ["luecke", 66, 4.5],
    ["kiste", 84],

    ["schwelle", 90],
    ["luecke", 104, 5.5],
    ["kohle", 118, 0.7], ["kohle", 122, 0.7],
    ["kiste", 134],
    ["kiste", 146],
    ["hoch", 162],
    ["kohle", 172, 2.2],

    ["schwelle", 180],
    ["luecke", 192, 6],
    ["kiste", 206],
    ["kohle", 216, 2.2],
    ["luecke", 228, 5],
    ["kiste", 242],
    ["kohle", 252, 0.7],
    ["hoch", 262],

    ["schwelle", 270],
    ["luecke", 282, 5.5],
    ["luecke", 298, 5.5],
    ["kohle", 312, 2.2],
    ["kiste", 322],
    ["kiste", 332],
    ["luecke", 346, 6],

    ["schwelle", 360],
    ["kohle", 372, 2.2], ["kohle", 377, 2.2],
    ["hoch", 388],
    ["luecke", 402, 6.5],
    ["kiste", 416],
    ["kohle", 426, 0.7],
    ["luecke", 438, 6],

    ["schwelle", 450],
    ["kiste", 460],
    ["luecke", 472, 6],
    ["kiste", 486],
    ["hoch", 498],
    ["luecke", 512, 6.5],
    ["kohle", 526, 2.2],
    ["kiste", 536],

    ["schwelle", 545],
    ["luecke", 556, 6.5],
    ["kiste", 570],
    ["luecke", 582, 7],
    ["kohle", 596, 2.2],
    ["kiste", 606],
    ["luecke", 618, 6],
    ["kohle", 632, 0.7],
  ];

  const KISTE_B = 1.2;
  const KISTE_H = 1.4;
  const HOCH_H = 2.0;

  // Aus der Tabelle werden drei Listen, jede nach x sortiert: Danach fragt das
  // Spiel bei jedem Bild, und eine Liste, die man durchsuchen muss, ist bei
  // sechzig Bildern in der Sekunde zu langsam gedacht.
  const luecken = [];
  const kisten = [];
  const kohlen = [];
  const schwellen = [];
  STRECKE.forEach(([art_, x, wert]) => {
    if (art_ === "luecke") luecken.push({ von: x, bis: x + wert });
    else if (art_ === "kiste") kisten.push({ x, b: KISTE_B, h: KISTE_H });
    else if (art_ === "hoch") kisten.push({ x, b: KISTE_B, h: HOCH_H });
    else if (art_ === "kohle") kohlen.push({ x, y: wert });
    else if (art_ === "schwelle") schwellen.push(x);
  });
  [luecken, kisten, kohlen].forEach((liste) => liste.sort((a, b) => (a.von ?? a.x) - (b.von ?? b.x)));
  schwellen.sort((a, b) => a - b);
  const KOHLE_GESAMT = kohlen.length;

  const HELP = [
    "Streckenlauf. Du läufst von selbst los, immer geradeaus.",
    "Tippe aufs Bild, dann springst du. Hältst du den Finger länger, springst du höher.",
    "Über die Lücken musst du springen. Auf die Kisten kannst du auch draufspringen.",
    "Läufst du seitlich in eine Kiste, stolperst du und verlierst Tempo.",
    "Sammle unterwegs die Kohle ein.",
    "Neben dir laufen die drei Besten, so wie sie damals gelaufen sind. Versuch, vor ihnen zu bleiben.",
    "Je schneller du im Ziel bist, desto mehr Punkte gibt es.",
  ].join(" ");

  // ---------------------------------------------------------------------------
  // Bestenliste
  // ---------------------------------------------------------------------------
  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.strecke", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
    : {
      read: () => ({ runs: 0, scores: [] }),
      write(data) { return data; },
      update(fn) { return fn(this.read()); },
      onChange() { return () => {}; },
    };

  function recordRun(score) {
    return store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), score].sort((a, b) => b - a).slice(0, TOP_COUNT),
    }));
  }

  // ---------------------------------------------------------------------------
  // Die Bahn: aufzeichnen und wieder lesen
  // ---------------------------------------------------------------------------
  // Drei Bytes je Stellung: x in Dezimetern als zwei Bytes (die Strecke ist
  // 640 Meter lang, das sind 6400 Dezimeter), y in Dezimetern als eines, um
  // 100 verschoben, damit auch ein Sturz unter die Schienen hineinpasst.
  //
  // Absolut, nicht als Unterschied zum vorherigen: Unterschiede wären kleiner,
  // aber ein Sprung zurück zur Schwelle ist ein grosser Sprung, und eine
  // Kodierung, die dabei abschneidet, lässt den Geist danach an der falschen
  // Stelle laufen. Zweitausend Stellungen sind so sechstausend Bytes – gross
  // genug, um es nicht in die Bestenliste zu legen, klein genug, um sich keine
  // Mühe zu geben.
  function base64Aus(bytes) {
    let roh = "";
    const stueck = 4096;
    for (let i = 0; i < bytes.length; i += stueck) {
      roh += String.fromCharCode(...bytes.subarray(i, i + stueck));
    }
    return btoa(roh);
  }

  function bahnKodieren(stellungen) {
    const bytes = new Uint8Array(stellungen.length * 3);
    stellungen.forEach((p, i) => {
      const xd = Math.max(0, Math.min(65535, Math.round(p.x * 10)));
      const yd = Math.max(0, Math.min(255, Math.round(p.y * 10) + 100));
      bytes[i * 3] = xd >> 8;
      bytes[i * 3 + 1] = xd & 255;
      bytes[i * 3 + 2] = yd;
    });
    return base64Aus(bytes);
  }

  function bahnLesen(text) {
    let roh;
    try { roh = atob(String(text || "")); } catch { return null; }
    const anzahl = Math.floor(roh.length / 3);
    if (!anzahl) return null;
    const bahn = new Float32Array(anzahl * 2);
    for (let i = 0; i < anzahl; i += 1) {
      bahn[i * 2] = ((roh.charCodeAt(i * 3) << 8) | roh.charCodeAt(i * 3 + 1)) / 10;
      bahn[i * 2 + 1] = (roh.charCodeAt(i * 3 + 2) - 100) / 10;
    }
    return bahn;
  }

  // Wo ein Geist zu einem Zeitpunkt war. Zwischen zwei Stellungen wird
  // gemittelt – ohne das ruckelte er zwanzigmal in der Sekunde, während der
  // eigene Läufer weich läuft.
  function geistBei(bahn, ms) {
    const anzahl = bahn.length / 2;
    const stelle = ms / SCHRITT_MS;
    if (stelle <= 0) return { x: bahn[0], y: bahn[1], fertig: false };
    if (stelle >= anzahl - 1) {
      return { x: bahn[(anzahl - 1) * 2], y: bahn[(anzahl - 1) * 2 + 1], fertig: true };
    }
    const i = Math.floor(stelle);
    const t = stelle - i;
    return {
      x: bahn[i * 2] + (bahn[(i + 1) * 2] - bahn[i * 2]) * t,
      y: bahn[i * 2 + 1] + (bahn[(i + 1) * 2 + 1] - bahn[i * 2 + 1]) * t,
      fertig: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Die Welt: was ist an dieser Stelle unter mir?
  // ---------------------------------------------------------------------------
  const inLuecke = (x) => luecken.some((l) => x > l.von && x < l.bis);

  // Die Oberkante dessen, worauf man an dieser Stelle stehen kann. Über einer
  // Lücke gibt es nichts – dafür steht hier eine Zahl, die tief genug liegt,
  // dass niemand sie je erreicht, bevor der Sturz zählt.
  function bodenBei(x) {
    if (inLuecke(x)) return -99;
    let hoch = 0;
    for (const kiste of kisten) {
      if (kiste.umgefallen) continue;
      if (x >= kiste.x && x <= kiste.x + kiste.b) hoch = Math.max(hoch, kiste.h);
    }
    return hoch;
  }

  const letzteSchwelle = (x) => {
    let s = 0;
    for (const stelle of schwellen) { if (stelle <= x) s = stelle; else break; }
    return s;
  };

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  const state = {
    phase: "intro",
    x: 0, y: 0, vy: 0, tempo: TEMPO_START,
    amBoden: true,
    bodenSeit: 0,            // wann zuletzt Boden unter den Füssen war
    kohle: 0,
    stolpertBis: 0,
    sturzBis: 0,
    start: 0,
    zeit: 0,
    imZiel: false,
    lauf: [],                // die eigene Aufzeichnung
    naechsteAufzeichnung: 0,
    vorigeZeit: 0, vorigeX: 0, vorigeY: 0,   // das Bild davor, für den Takt
    geister: [],
    schritt: 0,              // für die Beine
  };

  let shell = null;
  let leinwand = null;
  let stift = null;
  let frame = null;
  let letzteZeit = 0;
  let stepTimer = null;
  let geisterGeladen = null;

  const clearStep = () => { if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; } };
  const stopLoop = () => { if (frame) { window.cancelAnimationFrame(frame); frame = null; } };

  // ---------------------------------------------------------------------------
  // Springen
  // ---------------------------------------------------------------------------
  function springe() {
    if (state.phase !== "play") return;
    if (performance.now() < state.sturzBis) return;
    const frisch = state.amBoden || (performance.now() - state.bodenSeit) < NACHSICHT_MS;
    if (!frisch) return;
    state.vy = SPRUNG_V;
    state.amBoden = false;
    state.bodenSeit = -99999;
    kids()?.vibrate?.(8);
  }

  function loslassen() {
    // Nur den Aufstieg abschneiden, nie den Fall beschleunigen. Wer den
    // Finger liegen lässt, springt die volle Höhe; wer ihn gleich wieder
    // hebt, macht einen Hüpfer.
    if (state.vy > 0) state.vy *= SPRUNG_KURZ;
  }

  // ---------------------------------------------------------------------------
  // Ein Bild
  // ---------------------------------------------------------------------------
  function schritt(now) {
    frame = window.requestAnimationFrame(schritt);
    if (state.phase !== "play") return;
    const dt = Math.min(0.05, Math.max(0, (now - letzteZeit) / 1000));
    letzteZeit = now;
    state.zeit = Date.now() - state.start;

    const stuerzt = now < state.sturzBis;
    const stolpert = now < state.stolpertBis;

    if (!stuerzt) {
      // --- Tempo ---------------------------------------------------------------
      if (stolpert) state.tempo = TEMPO_STOLPER;
      else state.tempo = Math.min(TEMPO_MAX, Math.max(TEMPO_START, state.tempo + TEMPO_ZUWACHS * dt));

      const vorher = state.x;
      state.x += state.tempo * dt;

      // --- Fallen und Landen ---------------------------------------------------
      state.vy -= SCHWERE * dt;
      state.y += state.vy * dt;
      const boden = bodenBei(state.x);
      if (state.vy <= 0 && state.y <= boden) {
        state.y = boden;
        state.vy = 0;
        state.amBoden = true;
        state.bodenSeit = now;
      } else if (state.y > boden) {
        if (state.amBoden) state.bodenSeit = now;
        state.amBoden = false;
      }

      // --- Seitlich in eine Kiste ----------------------------------------------
      // Nur von der Seite, und nur, wenn man wirklich tiefer ist als ihre
      // Oberkante. Wer oben aufkommt, hat sie geschafft.
      for (const kiste of kisten) {
        if (kiste.umgefallen) continue;
        if (state.x + LAEUFER_B / 2 < kiste.x || vorher - LAEUFER_B / 2 > kiste.x + kiste.b) continue;
        if (state.y >= kiste.h - 0.06) continue;
        kiste.umgefallen = true;
        state.stolpertBis = now + STOLPER_MS;
        state.tempo = TEMPO_STOLPER;
        kids()?.playJingle?.("retry");
        kids()?.vibrate?.([16, 40, 16]);
        break;
      }

      // --- Kohle ---------------------------------------------------------------
      for (const stueck of kohlen) {
        if (stueck.weg) continue;
        if (Math.abs(stueck.x - state.x) > 0.9) continue;
        if (Math.abs(stueck.y - state.y) > 1.1) continue;
        stueck.weg = true;
        state.kohle += 1;
        shell.setCount(state.kohle);
        kids()?.playJingle?.("correct");
      }

      // --- In eine Lücke gefallen ----------------------------------------------
      if (state.y < TIEF) {
        const zurueck = letzteSchwelle(state.x);
        state.x = zurueck;
        state.y = 0;
        state.vy = 0;
        state.amBoden = true;
        state.tempo = TEMPO_START;
        state.sturzBis = now + STURZ_MS;
        // Nicht über den Rücksprung hinweg mitteln – sonst stünde in der
        // Aufzeichnung eine Stellung mitten in der Lücke, die es nie gab.
        state.vorigeZeit = state.zeit;
        state.vorigeX = state.x;
        state.vorigeY = state.y;
        kids()?.playJingle?.("retry");
        kids()?.vibrate?.([24, 60, 24]);
      }

      // --- Im Ziel --------------------------------------------------------------
      if (state.x >= ZIEL_M) {
        state.x = ZIEL_M;
        state.imZiel = true;
        fertig();
        return;
      }
      state.schritt += state.tempo * dt;
    }

    // --- Aufzeichnen -----------------------------------------------------------
    // Auf den Takt genau, nicht auf das Bild genau: Ein Bild fällt irgendwann
    // zwischen zwei Takte, und wer seine Stellung mit der Takt-Zeit
    // beschriftet, verschiebt den Geist um bis zu ein Bild. Auf dem Weg nach
    // oben sind das zwei Dezimeter – sichtbar wäre das kaum, aber eine
    // Aufzeichnung, die etwas anderes behauptet als sie zeigt, ist eine
    // schlechte Grundlage für ein Rennen. Also wird zwischen dem Bild davor
    // und diesem auf den Takt gerechnet.
    while (state.zeit >= state.naechsteAufzeichnung && state.lauf.length < AUFZEICHNUNG_MAX) {
      const ziel = state.naechsteAufzeichnung;
      const spanne = state.zeit - state.vorigeZeit;
      const t = spanne > 0 ? Math.max(0, Math.min(1, (ziel - state.vorigeZeit) / spanne)) : 1;
      state.lauf.push({
        x: state.vorigeX + (state.x - state.vorigeX) * t,
        y: state.vorigeY + (state.y - state.vorigeY) * t,
      });
      state.naechsteAufzeichnung += SCHRITT_MS;
    }
    state.vorigeZeit = state.zeit;
    state.vorigeX = state.x;
    state.vorigeY = state.y;

    zeichne(now);
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  function masse() {
    const breit = leinwand.width / (window.devicePixelRatio || 1);
    const hoch = leinwand.height / (window.devicePixelRatio || 1);
    const proM = breit / SICHT_M;
    // Die Schienen liegen im unteren Drittel: darüber Platz für den Sprung,
    // darunter genug, dass man einen Sturz auch sieht.
    const bodenY = hoch * 0.74;
    return { breit, hoch, proM, bodenY };
  }

  /*
   * Ein Läufer.
   *
   * Kein Strichmännchen: Der Rumpf ist eine Fläche, Arme und Beine sind dick
   * genug, dass man sie in Bewegung noch sieht, und die Mütze gibt dem Kopf
   * eine Richtung. Auf einem Handy ist die ganze Figur vierzig Bildpunkte
   * hoch – was dort dünn gezeichnet ist, ist dort nicht zu sehen.
   *
   * Der Schatten am Boden ist kein Schmuck, sondern die Hilfe, die ein
   * Sprungspiel braucht: An ihm liest man ab, wo man aufkommen wird. Über
   * einer Lücke gibt es keinen – und genau dann weiss man, dass man noch in
   * der Luft sein muss.
   */
  function laeufer(ctx, bx, by, proM, farben, phase, durchsichtig, bodenY) {
    // Die Figur ist 1,7 Meter gross – aber nie kleiner als FIGUR_MIN
    // Bildpunkte. Auf einem schmalen Gerät wären das sonst zwanzig Punkte,
    // und was man nicht sieht, kann man nicht springen lassen. Gerechnet wird
    // weiter in Metern; grösser gezeichnet ist nur das Bild, nicht die Figur.
    const h = Math.max(FIGUR_MIN, 1.7 * proM);
    const schwung = Math.sin(phase * 2.2);

    // Der Schatten: dort, wo unter dem Läufer Boden ist.
    if (bodenY !== null && bodenY !== undefined) {
      const hoehe = Math.max(0, (bodenY - by) / proM);
      const breite = h * 0.3 * Math.max(0.35, 1 - hoehe * 0.16);
      ctx.save();
      ctx.globalAlpha = (durchsichtig ? 0.12 : 0.25) * Math.max(0.25, 1 - hoehe * 0.14);
      ctx.fillStyle = "#243047";
      ctx.beginPath();
      ctx.ellipse(bx, bodenY - 1, breite, breite * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = durchsichtig ? 0.5 : 1;
    ctx.translate(bx, by);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Beine
    ctx.strokeStyle = farben.bein;
    ctx.lineWidth = Math.max(2.4, h * 0.13);
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.4);
    ctx.lineTo(h * 0.26 * schwung, -h * 0.02);
    ctx.moveTo(0, -h * 0.4);
    ctx.lineTo(-h * 0.26 * schwung, -h * 0.02);
    ctx.stroke();

    // Rumpf als Fläche, leicht nach vorn geneigt
    ctx.fillStyle = farben.leib;
    ctx.beginPath();
    ctx.moveTo(-h * 0.13, -h * 0.38);
    ctx.lineTo(h * 0.13, -h * 0.38);
    ctx.lineTo(h * 0.16, -h * 0.72);
    ctx.lineTo(-h * 0.1, -h * 0.72);
    ctx.closePath();
    ctx.fill();

    // Arme
    ctx.strokeStyle = farben.leib;
    ctx.lineWidth = Math.max(2, h * 0.1);
    ctx.beginPath();
    ctx.moveTo(h * 0.04, -h * 0.66);
    ctx.lineTo(h * 0.26 * -schwung, -h * 0.46);
    ctx.moveTo(h * 0.04, -h * 0.66);
    ctx.lineTo(h * 0.2 * schwung, -h * 0.5);
    ctx.stroke();

    // Kopf
    ctx.fillStyle = farben.kopf;
    ctx.beginPath();
    ctx.arc(h * 0.03, -h * 0.84, h * 0.15, 0, Math.PI * 2);
    ctx.fill();
    // Mütze mit Schirm nach vorn
    ctx.fillStyle = farben.muetze;
    ctx.beginPath();
    ctx.arc(h * 0.03, -h * 0.87, h * 0.155, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(h * 0.03, -h * 0.9, h * 0.24, h * 0.055);
    ctx.restore();
  }

  const ICH = { leib: "#3b4657", bein: "#2a323d", kopf: "#f3d7b8", muetze: "#e2694f" };
  const geistFarben = (farbe) => ({ leib: farbe, bein: farbe, kopf: farbe, muetze: farbe });

  function zeichne(now) {
    if (!stift || !leinwand) return;
    const { breit, hoch, proM, bodenY } = masse();
    const ctx = stift;
    const kamera = state.x - SICHT_M * LAEUFER_X;
    const bildX = (m) => (m - kamera) * proM;

    ctx.clearRect(0, 0, breit, hoch);

    // --- Himmel ---------------------------------------------------------------
    const himmel = ctx.createLinearGradient(0, 0, 0, bodenY);
    himmel.addColorStop(0, "#8fd0ee");
    himmel.addColorStop(1, "#dff1fa");
    ctx.fillStyle = himmel;
    ctx.fillRect(0, 0, breit, bodenY);

    // --- Wolken ---------------------------------------------------------------
    // Ganz langsam, fast stehend: Sie sollen nicht sagen, wie schnell man ist
    // – das tun die Masten –, sondern nur, dass oben nicht nichts ist.
    if (!ruhig()) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
      for (let i = 0; i < 4; i += 1) {
        const m = i * 61 + 18;
        const px = ((m - kamera * 0.08) % 240 + 240) % 240 / 240 * (breit + 200) - 100;
        const py = bodenY * (0.14 + 0.1 * ((i * 7) % 3));
        const r = bodenY * 0.055;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.arc(px + r * 1.1, py + r * 0.2, r * 0.8, 0, Math.PI * 2);
        ctx.arc(px - r * 1.05, py + r * 0.25, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // --- Hügel, zwei Ebenen ---------------------------------------------------
    // Sie laufen langsamer als der Läufer. Ohne das wirkte die Strecke wie ein
    // Laufband; mit ihm sieht man, dass man vorankommt.
    const hügel = (versatz, hoehe, farbe) => {
      ctx.fillStyle = farbe;
      ctx.beginPath();
      ctx.moveTo(0, bodenY);
      const schritt = 24;
      for (let px = 0; px <= breit + schritt; px += schritt) {
        const m = kamera * versatz + px / proM;
        const y = bodenY - hoehe * (0.6 + 0.4 * Math.sin(m * 0.06) * Math.cos(m * 0.021));
        ctx.lineTo(px, y);
      }
      ctx.lineTo(breit, bodenY);
      ctx.closePath();
      ctx.fill();
    };
    if (!ruhig()) {
      hügel(0.22, hoch * 0.22, "#a9cfae");
      hügel(0.48, hoch * 0.14, "#87b98f");
    } else {
      ctx.fillStyle = "#a9cfae";
      ctx.fillRect(0, bodenY - hoch * 0.14, breit, hoch * 0.14);
    }

    // --- Telegrafenmasten -----------------------------------------------------
    // Sie stehen an der Strecke und laufen deshalb mit ihr, nicht langsamer.
    // Zusammen mit den Hügeln dahinter sagen sie, wie schnell man ist – ein
    // Bild ohne etwas, das vorbeizieht, sieht bei jedem Tempo gleich aus.
    for (let m = Math.floor(kamera / 25) * 25; m < kamera + SICHT_M + 25; m += 25) {
      const px = bildX(m);
      if (px < -30 || px > breit + 30) continue;
      const hoeheM = 4.6 * proM;
      ctx.fillStyle = "#8a7f6d";
      ctx.fillRect(px - 1.5, bodenY - hoeheM, 3, hoeheM);
      ctx.fillRect(px - 9, bodenY - hoeheM, 18, 2.5);
      ctx.fillRect(px - 7, bodenY - hoeheM + 7, 14, 2);
      // Die Leitung zum nächsten Mast, leicht durchhängend.
      ctx.strokeStyle = "rgba(90, 100, 110, 0.5)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px, bodenY - hoeheM + 2);
      ctx.quadraticCurveTo(px + 12.5 * proM, bodenY - hoeheM + 12, px + 25 * proM, bodenY - hoeheM + 2);
      ctx.stroke();
    }

    // --- Der Damm -------------------------------------------------------------
    ctx.fillStyle = "#c8b48d";
    ctx.fillRect(0, bodenY, breit, hoch - bodenY);
    // Ein Streifen Gras an der Oberkante: ohne ihn stösst der Schotter hart
    // gegen den Himmel, und man sieht nicht, wo der Boden anfängt.
    ctx.fillStyle = "#93b87c";
    ctx.fillRect(0, bodenY - 3, breit, 5);

    // --- Lücken ---------------------------------------------------------------
    for (const l of luecken) {
      const x1 = bildX(l.von);
      const x2 = bildX(l.bis);
      if (x2 < -20 || x1 > breit + 20) continue;
      ctx.fillStyle = "#6b7f93";
      ctx.fillRect(x1, bodenY, x2 - x1, hoch - bodenY);
      ctx.fillStyle = "rgba(24, 38, 54, 0.45)";
      ctx.fillRect(x1, bodenY, x2 - x1, Math.min(14, (hoch - bodenY) * 0.3));
    }

    // --- Schwellen und Schiene ------------------------------------------------
    ctx.fillStyle = "#8a7355";
    for (let m = Math.floor(kamera) - 2; m < kamera + SICHT_M + 2; m += 1) {
      if (inLuecke(m + 0.5)) continue;
      ctx.fillRect(bildX(m + 0.15), bodenY + 4, 0.7 * proM, 6);
    }
    ctx.fillStyle = "#6f6558";
    for (let m = Math.floor(kamera) - 2; m < kamera + SICHT_M + 2; m += 1) {
      if (inLuecke(m)) continue;
      ctx.fillRect(bildX(m), bodenY - 2, proM, 4);
    }

    // --- Schwellen als Wegmarken ----------------------------------------------
    for (const s of schwellen) {
      const px = bildX(s);
      if (px < -30 || px > breit + 30) continue;
      ctx.fillStyle = "#4f5b6b";
      ctx.fillRect(px - 1.5, bodenY - 26, 3, 26);
      ctx.fillStyle = "#e8eef4";
      ctx.fillRect(px - 1.5, bodenY - 26, 3, 8);
    }

    // --- Kisten ---------------------------------------------------------------
    for (const kiste of kisten) {
      const px = bildX(kiste.x);
      if (px < -60 || px > breit + 60) continue;
      const b = kiste.b * proM;
      const h = kiste.h * proM;
      ctx.save();
      if (kiste.umgefallen) {
        // Sie liegt, sie schwebt nicht: gekippt auf die Seite, Oberkante am
        // Boden. Schräg in der Luft sah sie aus wie ein Fehler im Bild.
        ctx.globalAlpha = 0.75;
        ctx.translate(px + b, bodenY - b);
        ctx.rotate(Math.PI / 2);
      } else {
        ctx.translate(px, bodenY - h);
      }
      ctx.fillStyle = "#8a6a45";
      ctx.fillRect(0, 0, b, h);
      ctx.fillStyle = "#a07f55";
      ctx.fillRect(0, 0, b, Math.min(6, h * 0.16));
      ctx.strokeStyle = "#5d472e";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, b - 2, h - 2);
      ctx.restore();
    }

    // --- Kohle ----------------------------------------------------------------
    for (const stueck of kohlen) {
      if (stueck.weg) continue;
      const px = bildX(stueck.x);
      if (px < -20 || px > breit + 20) continue;
      const py = bodenY - (stueck.y + 0.45) * proM;
      ctx.fillStyle = "#3f4756";
      ctx.beginPath();
      ctx.arc(px, py, Math.max(5, 0.28 * proM), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.beginPath();
      ctx.arc(px - 0.08 * proM, py - 0.08 * proM, Math.max(2, 0.09 * proM), 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Das Ziel -------------------------------------------------------------
    const zielX = bildX(ZIEL_M);
    if (zielX > -40 && zielX < breit + 40) {
      ctx.fillStyle = "#3b4657";
      ctx.fillRect(zielX - 2, bodenY - 70, 4, 70);
      for (let i = 0; i < 4; i += 1) {
        ctx.fillStyle = i % 2 ? "#ffffff" : "#d0392b";
        ctx.fillRect(zielX + 2, bodenY - 70 + i * 9, 26, 9);
      }
    }

    // --- Die Geister ----------------------------------------------------------
    // Sie kollidieren mit nichts und sammeln nichts ein; sie laufen nur noch
    // einmal so, wie sie gelaufen sind.
    state.geister.forEach((geist, i) => {
      const stand = geistBei(geist.bahn, state.zeit);
      const px = bildX(stand.x);
      if (px < -60 || px > breit + 60) return;
      laeufer(ctx, px, bodenY - stand.y * proM, proM,
        geistFarben(GEIST_FARBEN[i] || "#9aa7b4"), stand.x * 1.6, true, null);
    });

    // --- Der eigene Läufer ----------------------------------------------------
    const stuerzt = now < state.sturzBis;
    const unterMir = inLuecke(state.x) ? null : bodenY - bodenBei(state.x) * proM;
    ctx.save();
    if (stuerzt) ctx.globalAlpha = 0.5;
    laeufer(ctx, bildX(state.x), bodenY - state.y * proM, proM, ICH, state.schritt * 1.6, false, unterMir);
    ctx.restore();

    // --- Die Positionsleiste --------------------------------------------------
    // Ein Geist ist meistens nicht im Bild – vierzig Meter Vorsprung sind eine
    // Bildbreite. Ohne diese Leiste wäre das Rennen unsichtbar, sobald es
    // interessant wird.
    const leisteY = 16;
    const leisteL = breit * 0.08;
    const leisteR = breit * 0.92;
    ctx.strokeStyle = "rgba(36, 48, 71, 0.25)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(leisteL, leisteY);
    ctx.lineTo(leisteR, leisteY);
    ctx.stroke();
    const marke = (anteil, farbe, gross) => {
      const px = leisteL + (leisteR - leisteL) * Math.max(0, Math.min(1, anteil));
      ctx.fillStyle = farbe;
      ctx.beginPath();
      ctx.arc(px, leisteY, gross ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
    };
    state.geister.forEach((geist, i) => {
      marke(geistBei(geist.bahn, state.zeit).x / ZIEL_M, GEIST_FARBEN[i] || "#9aa7b4", false);
    });
    marke(state.x / ZIEL_M, "#243047", true);
  }

  // ---------------------------------------------------------------------------
  // Die Leinwand an die Fläche anpassen
  // ---------------------------------------------------------------------------
  function passeAn() {
    if (!leinwand) return;
    const kasten = leinwand.getBoundingClientRect();
    if (!kasten.width || !kasten.height) return;
    const dpr = window.devicePixelRatio || 1;
    leinwand.width = Math.round(kasten.width * dpr);
    leinwand.height = Math.round(kasten.height * dpr);
    stift = leinwand.getContext("2d");
    stift.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (state.phase !== "intro") zeichne(performance.now());
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function ladeGeister() {
    if (geisterGeladen) return geisterGeladen;
    geisterGeladen = Promise.resolve(mini()?.geister?.("trackRun", { anzahl: GEISTER_ZAHL, level: LEVEL }) || [])
      .then((liste) => liste
        .map((g) => ({ ...g, bahn: bahnLesen(g.bahn) }))
        .filter((g) => g.bahn && g.bahn.length >= 6))
      .catch(() => []);
    return geisterGeladen;
  }

  function showIntro() {
    clearStep();
    stopLoop();
    shell.stopClock();
    shell.closeOverlay();
    shell.setPhase("intro");
    state.phase = "intro";
    shell.setCount(0);
    leinwand = null;
    stift = null;

    shell.clear();
    shell.play.append(shell.el("p", "cm-prompt", "Tippen springt. Länger halten springt höher."));

    const wer = shell.el("p", "sl-geister", "Die Besten werden geholt …");
    wer.setAttribute("role", "status");
    shell.play.append(wer);

    const start = shell.el("button", "cm-start", "Starten");
    start.type = "button";
    start.addEventListener("click", beginRound);
    shell.play.append(start);

    ladeGeister().then((liste) => {
      if (state.phase !== "intro") return;
      if (!liste.length) {
        wer.textContent = "Noch läuft niemand hier. Dein Lauf wird der erste Geist.";
        return;
      }
      const namen = liste.map((g, i) => `${["Gold", "Silber", "Bronze"][i] || "Geist"}: ${g.name}`).join(" · ");
      wer.textContent = `Neben dir laufen ${liste.length === 1 ? "einer" : liste.length} – ${namen}`;
    });
  }

  function beginRound() {
    clearStep();
    stopLoop();
    state.phase = "play";
    state.x = 0;
    state.y = 0;
    state.vy = 0;
    state.tempo = TEMPO_START;
    state.amBoden = true;
    state.bodenSeit = performance.now();
    state.kohle = 0;
    state.stolpertBis = 0;
    state.sturzBis = 0;
    state.imZiel = false;
    state.lauf = [];
    state.naechsteAufzeichnung = 0;
    state.vorigeZeit = 0;
    state.vorigeX = 0;
    state.vorigeY = 0;
    state.schritt = 0;
    state.zeit = 0;
    kisten.forEach((k) => { k.umgefallen = false; });
    kohlen.forEach((k) => { k.weg = false; });

    shell.setPhase("play");
    shell.setCount(0);
    shell.clear();

    leinwand = document.createElement("canvas");
    leinwand.className = "sl-canvas";
    shell.play.append(leinwand);
    passeAn();

    // Die Geister, die schon geladen sind. Wer sofort auf Starten tippt, läuft
    // beim ersten Mal allein – und beim zweiten sind sie da.
    ladeGeister().then((liste) => { state.geister = liste.slice(0, GEISTER_ZAHL); });

    state.start = Date.now();
    letzteZeit = performance.now();
    frame = window.requestAnimationFrame(schritt);
    shell.startClock(ZEITLIMIT_MS, () => fertig());
  }

  function punkteFuer() {
    if (!state.imZiel) return Math.round(ANKUNFT_PUNKTE * Math.max(0, Math.min(1, state.x / ZIEL_M)));
    const rest = Math.max(0, ZEITLIMIT_MS - state.zeit);
    return ANKUNFT_PUNKTE + Math.round(rest / 100) + state.kohle * KOHLE_PUNKTE;
  }

  const sekunden = (ms) => (ms / 1000).toFixed(1).replace(".", ",");

  function resultSpeech(punkte) {
    if (!state.imZiel) {
      return `Die Zeit war um. Du bist ${Math.round(state.x)} von ${ZIEL_M} Metern weit gekommen. ${punkte} Punkte.`;
    }
    return `Im Ziel nach ${sekunden(state.zeit)} Sekunden, mit ${state.kohle} von ${KOHLE_GESAMT} Kohlestücken. ${punkte} Punkte.`;
  }

  function fertig() {
    if (state.phase !== "play") return;
    state.phase = "over";
    state.zeit = Math.min(ZEITLIMIT_MS, Date.now() - state.start);
    stopLoop();
    shell.stopClock();
    const punkte = punkteFuer();
    recordRun(punkte);
    if (state.imZiel) {
      kids()?.playJingle?.("win");
      if (!ruhig()) kids()?.burstConfetti?.();
    } else {
      kids()?.playJingle?.("retry");
    }

    // Die Aufzeichnung geht denselben Weg wie die Punktzahl (mini-games.js).
    // Nur ein Lauf, der ankommt, wird zum Geist: Ein Geist, der auf halber
    // Strecke stehen bleibt, ist für den nächsten kein Gegner, sondern ein
    // Rätsel.
    const geist = state.imZiel && state.lauf.length > 4
      ? { level: LEVEL, bahn: bahnKodieren(state.lauf) }
      : null;

    shell.showResult({
      label: "Punkte",
      points: punkte,
      detail: state.imZiel
        ? `${sekunden(state.zeit)} s · ${state.kohle} von ${KOHLE_GESAMT} Kohle`
        : `${Math.round(state.x)} von ${ZIEL_M} m · die Zeit war um`,
      speech: resultSpeech(punkte),
      geist,
    });
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Streckenlauf",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    help: HELP,
    onRestart: showIntro,
  });

  showIntro();

  // --- Der eine Finger -------------------------------------------------------
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    springe();
  });
  host.addEventListener("pointerup", loslassen);
  host.addEventListener("pointercancel", loslassen);
  host.addEventListener("pointerleave", loslassen);

  document.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "ArrowUp" && event.key !== "Enter") return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (state.phase === "intro") { beginRound(); return; }
    if (state.phase === "play" && !event.repeat) springe();
  });
  document.addEventListener("keyup", (event) => {
    if (event.key === " " || event.key === "ArrowUp" || event.key === "Enter") loslassen();
  });

  // Weggehen beendet den Lauf. Im Hintergrund hält der Browser die Bilder an,
  // die Uhr der Bühne läuft aber weiter: Der Läufer bliebe stehen, während die
  // Zeit abläuft. Das kostet zwar nur Punkte – aber es sähe beim Zurückkommen
  // aus wie ein Fehler des Spiels, und die Geister liefen derweil weiter.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.phase === "play") fertig();
  });

  window.addEventListener("resize", passeAn);
  window.addEventListener("orientationchange", passeAn);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Was von aussen zu sehen ist. Dieselbe Handvoll wie bei Blätter im Strom –
  // die Masse der Strecke und, hier zusätzlich, ein Blick auf den Stand und
  // die beiden Übersetzer der Bahn.
  //
  // Der Stand ist nicht Zierde: Ein Spiel, dessen Lauf sich aufzeichnen und
  // wieder abspielen lässt, muss sich auch nachspielen lassen – sonst bliebe
  // "der Geist läuft dieselbe Linie" eine Behauptung. scripts/check-spiele.mjs
  // und die Prüfungen von Hand fahren die Strecke darüber wirklich ab.
  // Geschrieben wird hier nichts: Es ist eine Abschrift, kein Griff.
  window.LernappStrecke = {
    LEVEL, ZIEL_M, SICHT_M, SCHRITT_MS, STRECKE, KOHLE_GESAMT,
    SPRUNG_V, SCHWERE, TEMPO_START, TEMPO_MAX, LAEUFER_B,
    bahnKodieren, bahnLesen,
    stand: () => ({
      phase: state.phase,
      x: state.x, y: state.y, tempo: state.tempo,
      amBoden: state.amBoden, kohle: state.kohle,
      zeit: state.zeit, imZiel: state.imZiel,
      geister: state.geister.length,
      stellungen: state.lauf.length,
    }),
  };
})();
