/*
 * rotoren.js – Zwei Rotoren.
 * ---------------------------------------------------------------------------
 * Eine Renndrohne bei Nacht über den Dächern der Stadt, von der Seite
 * gesehen. Sie hat zwei Rotoren, und jeder hat seinen Daumen: Wer links aufs
 * Bild hält, lässt den linken laufen, wer rechts hält, den rechten (am
 * Rechner A oder Pfeil links, L oder Pfeil rechts).
 *
 *   beide      Die Drohne richtet sich auf und steigt.
 *   einer      Sie kippt von ihm weg und zieht zur Seite – der linke Rotor
 *              schiebt nach rechts, der rechte nach links – und hält dabei
 *              knapp nicht die Höhe.
 *   keiner     Sie fällt.
 *
 * Mehr gibt es nicht, aber es reicht: Geflogen wird durch einen Parcours aus
 * Lichttoren, eines nach dem andern, und das nächste leuchtet. Die Tore
 * stehen quer zum Weg – mal aufrecht, mal liegend (dann geht es von unten
 * oder von oben hindurch). Sie stehen still; schwer wird es durch den Weg:
 * Er geht auf und ab, und je weiter man kommt, desto höher hinauf und tiefer
 * hinunter liegt das nächste Tor (HUB). Wer einen Pfosten berührt oder ein
 * Dach, ist draussen.
 *
 * Die Uhr ist der Akku: Er reicht für ein paar Sekunden, und jedes Tor lädt
 * ihn nach – mit jedem Tor etwas weniger. Wer trödelt, dem gehen die
 * Rotoren aus (vor dem ersten Tor läuft er halb so schnell ab). Gezählt werden die Tore; wer mitten hindurchfliegt, fliegt
 * «mittig», und das zählt mehr: in Folge immer mehr (bis KETTE_MAX dazu),
 * dazu lädt es den Akku ein Stück weiter.
 *
 * Gebaut wird der Parcours aus dem Zufall (zufall.js): ohne Turnier jedes
 * Mal ein anderer, im Turnier für alle im selben Versuch derselbe.
 *
 * Gerechnet wird in Metern, y nach oben. Die Drohne ist ein Körper mit Lage
 * (x, y), Fahrt und Neigung w; die Neigung folgt den Daumen wie an einer
 * straffen Feder, der Schub zeigt immer nach «oben» aus Sicht der Drohne.
 *
 * Die Gegner (geist.js) fliegen als Drohne aus Licht mit – genau so, wie sie
 * in ihrer besten Runde geflogen sind, durch ihren eigenen Parcours (a, b:
 * der Ort in Dezimetern, c: die Neigung). Und die besten Läufe lassen sich
 * anschauen (?zuschauen=, geist.js): mit derselben Saat derselbe Parcours.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "rotors") return;

  const host = document.querySelector("#zr-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall: nur der Parcours – die Tore. Funken, Sterne
  // und der Sog der Rotoren nehmen Math.random oder feste Zahlen.
  const zufall = window.LernappZufall?.fuer?.("twinRotor") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Die Schrauben
  // ---------------------------------------------------------------------------
  const TAKT = 1 / 240;            // gerechnet wird in festen kleinen Schritten
  const GRAD = Math.PI / 180;
  const TAU = Math.PI * 2;

  // Der Flug.
  const G = 9.81;
  const SCHUB = 10.4;              // so kräftig schiebt ein Rotor (m/s²)
  const KIPP = 36 * GRAD;          // so weit kippt die Drohne mit einem Rotor
  const KIPP_FEDER = 210;          // wie straff die Neigung den Daumen folgt …
  const KIPP_DAEMPF = 23;          // … und wie schnell sie zur Ruhe kommt
  const LUFT_X = 0.75;             // die Luft bremst: quer …
  const LUFT_Y = 0.95;             // … und in der Höhe
  const ARM = 0.78;                // so weit sitzt ein Rotor von der Mitte (m)

  // Die Drohne, wie sie getroffen wird: drei Kreise in ihrem eigenen Bild (x
  // zum rechten Rotor, y nach oben) – der Rumpf und die beiden Rotoren.
  const HUELLE = [{ x: 0, y: 0, r: 0.4 }, { x: -ARM, y: 0.1, r: 0.3 }, { x: ARM, y: 0.1, r: 0.3 }];

  // Die Tore.
  const PFOSTEN = 0.24;            // Halbmesser eines Pfostens (m)
  const MITTIG = 0.17;             // so nah an der Mitte ist «mittig» (Anteil der Öffnung)
  const KETTE_MAX = 3;             // so viel zählt «mittig» in Folge höchstens dazu
  const START = { x: 0, y: 14 };
  const HOCH_MIN = 9;              // tiefer liegt kein Tor …
  const HOCH_MAX = 30;             // … und höher keines

  // Der Akku: so viele Sekunden fasst er, und so viel lädt das n-te Tor nach –
  // am Anfang reichlich, mit jedem Tor weniger, am Ende zu wenig.
  // AKKU_TEMPO sagt, wie schnell er abläuft: Bei 1 fasst er zehn Sekunden und
  // das erste Tor lädt drei nach; bei 1,36 ist alles um diesen Teil knapper –
  // der Akku ist 1,36-mal so schnell leer (bis November 2026 1,2; dann kurz
  // 1,56, das war zu knapp – jetzt hält er wieder rund 1,15-mal so lang).
  // Gerechnet und angezeigt wird immer in echten Sekunden.
  const AKKU_TEMPO = 1.36;
  const AKKU_MAX = 10 / AKKU_TEMPO;
  const AKKU_MITTIG = 0.5 / AKKU_TEMPO;
  const akkuLaden = (n) => Math.max(0.9, 3 - 0.055 * n) / AKKU_TEMPO;

  // Wie schwer es beim n-ten Tor ist (0 … gegen 1).
  const schwere = (n) => 1 - Math.exp(-Math.max(0, n) / 24);

  // Wie weit es zum n-ten Tor hinauf oder hinunter geht (m): am Anfang ein
  // paar Meter, mit jedem Tor mehr – bis fast über die ganze Höhe.
  const HUB = [3.5, 17];
  const hub = (n) => lerp(HUB[0], HUB[1], 1 - Math.exp(-Math.max(0, n - 2) / 14));

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.rotoren", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
    : {
      read: () => ({ runs: 0, scores: [] }),
      write(data) { return data; },
      update(fn) { return fn(this.read()); },
      onChange() { return () => {}; },
    };

  // ---------------------------------------------------------------------------
  // Kleine Rechnungen
  // ---------------------------------------------------------------------------
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, k) => a + (b - a) * k;
  const weich = (u) => u * u * (3 - 2 * u);

  // Immer dieselbe Zahl zu derselben Eingabe: Fenster, Sterne und Antennen
  // stehen bei jedem Bild am selben Platz, ohne den Zufall des Parcours
  // anzufassen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------------------------------------------------------------------------
  // Der Parcours
  // ---------------------------------------------------------------------------
  /*
   * Die Tore liegen an einem Weg nach rechts durch die Nacht, der auf und ab
   * führt: meist im Zickzack – hinauf, dann wieder hinunter –, manchmal
   * zweimal in dieselbe Richtung. Wie weit, sagt hub: erst ein paar Meter,
   * mit jedem Tor mehr, bis es zwischen HOCH_MIN und HOCH_MAX fast über die
   * ganze Höhe geht. Reicht der Platz nach der einen Seite nicht, geht es
   * zur andern. Jedes Tor steht quer zum Weg – seine Öffnung ist die
   * Strecke zwischen zwei Pfosten, halb Meter nach jeder Seite der Mitte. Am
   * Scheitel eines Zickzacks steht es aufrecht, auf einer langen Steigung
   * liegt es fast flach (dann geht es von unten oder oben hindurch) und ist
   * etwas breiter: Die Drohne ist quer breiter als hoch.
   *
   * Die Tore stehen still. (Bis November 2026 schoben sich manche hin und
   * her oder wiegten sich um ihre Mitte – schwer wird es jetzt durch den Weg.)
   */
  function neueWelt() {
    return { tore: [], daecher: [], richtung: 0, sinn: 1, dachBis: -60, dachNr: 0 };
  }

  function naechstesTor(W) {
    const n = W.tore.length;
    const k = schwere(n - 2);
    const vor = W.tore[n - 1];
    const vx = vor ? vor.x : START.x;
    const vy = vor ? vor.y : START.y;
    const wurf = [zufall.zahl(), zufall.zahl(), zufall.zahl(), zufall.zahl()];
    let y = vy;
    if (n === 1) {
      // Das zweite Tor: noch fast auf derselben Höhe.
      y = vy + (wurf[0] * 2 - 1) * 2;
    } else if (n >= 2) {
      // Meist die andere Richtung als zuletzt, mit der Zeit immer öfter.
      let sinn = wurf[0] < lerp(0.6, 0.85, k) ? -W.sinn : W.sinn;
      const weit = hub(n) * lerp(0.75, 1, wurf[1]);
      const platz = sinn > 0 ? HOCH_MAX - vy : vy - HOCH_MIN;
      if (platz < weit * 0.6) sinn = -sinn;
      y = vy + sinn * weit;
      W.sinn = sinn;
    }
    y = clamp(y, HOCH_MIN, HOCH_MAX);
    const x = vx + (n === 0 ? 13 : Math.max(4.5, lerp(11.5, 9.5, k) * lerp(0.9, 1.3, wurf[2])));
    const wahr = Math.atan2(y - vy, x - vx);       // die Richtung des Wegs hinein
    // Das Tor steht quer zum Weg – zur Mitte aus dem Weg hinein und dem
    // hinaus. Der Weg hinaus steht noch nicht fest: Das vorige Tor wird
    // deshalb jetzt gerichtet, dieses vorerst nach dem Weg hinein.
    if (vor) {
      const mitte = (vor.hinein + wahr) / 2;
      vor.w = mitte + Math.PI / 2;
      vor.halb = vor.grund + 0.5 * Math.abs(Math.sin(mitte));
    }
    const tor = {
      nr: n, x, y, hinein: wahr, w: wahr + Math.PI / 2,
      grund: lerp(2.35, 1.3, k) * lerp(0.94, 1.08, wurf[3]),
      halb: 2.3,
      durch: false, mittig: false, zeit: 0,
    };
    tor.halb = tor.grund + 0.5 * Math.abs(Math.sin(wahr));
    W.tore.push(tor);
    W.richtung = wahr;
  }

  function toreBis(W, n) {
    while (W.tore.length <= n + 1) naechstesTor(W);
  }

  // Wo ein Tor steht: seine Mitte und die Richtung seiner Öffnung (in o.x,
  // o.y, o.w). Die Tore stehen still – t bleibt, damit es nicht darauf
  // ankommt, wer fragt.
  function torLage(tor, t, o) {
    o.w = tor.w;
    o.x = tor.x;
    o.y = tor.y;
    return o;
  }

  // Die Dächer unter dem Parcours: Häuser nebeneinander, jedes mit seiner
  // Höhe. Sie hängen an festen Zahlen, nicht am Zufall der Runde – und
  // bleiben immer unter den Toren.
  function daecherBis(W, x) {
    while (W.dachBis < x) {
      const i = W.dachNr;
      const breit = 5 + 9 * hash01(i * 3.7 + 1);
      const hoch = 1.6 + 4.4 * hash01(i * 5.3 + 2) * hash01(i * 1.9 + 4);
      W.daecher.push({ x0: W.dachBis, x1: W.dachBis + breit, hoch, nr: i });
      W.dachBis += breit + (hash01(i * 7.1) < 0.25 ? 1.5 + 2 * hash01(i * 2.3) : 0);
      W.dachNr += 1;
    }
  }

  function dachBei(W, x) {
    daecherBis(W, x + 20);
    const liste = W.daecher;
    // Die Dächer liegen der Reihe nach: von hinten gesucht, denn gefragt
    // wird fast immer vorn.
    for (let i = liste.length - 1; i >= 0; i -= 1) {
      if (liste[i].x0 <= x) return x <= liste[i].x1 ? liste[i].hoch : 0;
    }
    return 0;
  }

  // Die gewürfelte Welt in Worten (für die Prüfung): die ersten Tore.
  function weltText(W = state.welt) {
    toreBis(W, 24);
    return W.tore.slice(0, 22).map((t) => `${t.x.toFixed(1)}/${t.y.toFixed(1)}/${t.halb.toFixed(2)}`).join(" ");
  }

  // ---------------------------------------------------------------------------
  // Der Flug
  // ---------------------------------------------------------------------------
  // Eine Drohne. Alles, was den Flug ausmacht, steht in diesem einen Ding –
  // so lässt sie sich kopieren und vorausrechnen (pilot).
  function neueDrohne() {
    return {
      x: START.x - 9, y: START.y, vx: 0, vy: 0, w: 0, dw: 0,
      t: 0,                // die Uhr der Runde – nach ihr schieben sich die Tore
      tor: 0,              // das nächste Tor
      akku: AKKU_MAX,
      punkte: 0, kette: 0, mittige: 0,
      aus: "",             // warum der Flug zu Ende ist
      ereignis: null,      // was der letzte Schritt brachte: { art: "tor", mittig, bonus, u }
    };
  }

  const ort = { x: 0, y: 0, w: 0 };

  /*
   * Ein Schritt des Flugs. links, rechts: ob der Rotor läuft. Ist der Akku
   * leer, läuft keiner mehr. streng (0 oder 1) rechnet mit etwas dickeren
   * Pfosten und höheren Dächern – für den, der vorausrechnet (pilot).
   */
  function schritt(W, d, links, rechts, h, streng = 0) {
    if (d.aus) return;
    d.ereignis = null;
    d.t += h;
    // Bis zum ersten Tor läuft er halb so schnell ab: Zeit, die Daumen zu finden.
    d.akku = Math.max(0, d.akku - h * (d.tor ? 1 : 0.5));
    if (d.akku <= 0) { links = false; rechts = false; }
    // Die Neigung folgt den Daumen: Der rechte Rotor hebt die rechte Seite
    // (w wächst, die Drohne zieht nach links), der linke die linke.
    const ziel = KIPP * ((rechts ? 1 : 0) - (links ? 1 : 0));
    d.dw += (KIPP_FEDER * (ziel - d.w) - KIPP_DAEMPF * d.dw) * h;
    d.w += d.dw * h;
    const n = (links ? 1 : 0) + (rechts ? 1 : 0);
    const x0 = d.x;
    const y0 = d.y;
    d.vx += (-Math.sin(d.w) * SCHUB * n - LUFT_X * d.vx) * h;
    d.vy += (Math.cos(d.w) * SCHUB * n - G - LUFT_Y * d.vy) * h;
    d.x += d.vx * h;
    d.y += d.vy * h;

    const c = Math.cos(d.w);
    const s = Math.sin(d.w);
    const dick = 0.1 * streng;
    // Das nächste Tor: hindurch – oder an einen Pfosten. Auch die Pfosten
    // des Tors davor stehen noch im Weg.
    toreBis(W, d.tor + 1);
    for (let i = Math.max(0, d.tor - 1); i <= d.tor + 1; i += 1) {
      const tor = W.tore[i];
      torLage(tor, d.t, ort);
      const ux = Math.cos(ort.w);
      const uy = Math.sin(ort.w);
      for (const seite of [-1, 1]) {
        const px = ort.x + ux * (tor.halb + PFOSTEN) * seite;
        const py = ort.y + uy * (tor.halb + PFOSTEN) * seite;
        for (const k of HUELLE) {
          const kx = d.x + k.x * c - k.y * s;
          const ky = d.y + k.x * s + k.y * c;
          const r = k.r + PFOSTEN + dick;
          if ((kx - px) * (kx - px) + (ky - py) * (ky - py) < r * r) { d.aus = "pfosten"; return; }
        }
      }
      if (i !== d.tor) continue;
      // Hindurch: Der Weg dieses Schritts kreuzt die Öffnung.
      const vorher = (x0 - ort.x) * -uy + (y0 - ort.y) * ux;
      const nachher = (d.x - ort.x) * -uy + (d.y - ort.y) * ux;
      if ((vorher < 0) !== (nachher < 0)) {
        const f = vorher / (vorher - nachher);
        const laengs = ((x0 + (d.x - x0) * f - ort.x) * ux + (y0 + (d.y - y0) * f - ort.y) * uy) / tor.halb;
        if (Math.abs(laengs) < 1) {
          const mittig = Math.abs(laengs) <= MITTIG * 2;
          d.kette = mittig ? d.kette + 1 : 0;
          const bonus = mittig ? Math.min(d.kette, KETTE_MAX) : 0;
          if (mittig) d.mittige += 1;
          d.punkte += 1 + bonus;
          d.akku = Math.min(AKKU_MAX, d.akku + akkuLaden(tor.nr) + (mittig ? AKKU_MITTIG : 0));
          d.ereignis = { art: "tor", nr: tor.nr, mittig, bonus, laengs };
          d.tor += 1;
        }
      }
    }
    // Die Dächer.
    if (d.y < 8) {
      for (const k of HUELLE) {
        const kx = d.x + k.x * c - k.y * s;
        const ky = d.y + k.x * s + k.y * c;
        if (ky - k.r - dick < dachBei(W, kx)) { d.aus = d.akku <= 0 ? "akku" : "dach"; return; }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Vorausrechnen
  // ---------------------------------------------------------------------------
  /*
   * Der Pilot (für die Prüfung und die Vorführung): Welche Rotoren sollen
   * jetzt laufen? Er hat ein Ziel – die Mitte des nächsten Tors – und eine
   * Linie dorthin: quer durch die Öffnung. Daraus folgt, wie er an jedem Ort
   * fliegen möchte (wunsch): auf die Linie zu und ihr entlang, mit Abstand,
   * solange er noch neben der Öffnung ist, und weg von jedem Pfosten. Dann
   * probiert er alle Folgen aus zwei kurzen Griffen durch (4 × 4), rechnet
   * jede voraus und nimmt die, nach der er dem Wunsch am nächsten ist – und
   * nirgends angestossen.
   */
  const GRIFFE = [[false, false], [true, false], [false, true], [true, true]];
  const zielOrt = { x: 0, y: 0, w: 0 };

  // Wie die Drohne an ihrem Ort fliegen möchte: die Fahrt (in o.vx, o.vy).
  const wunschFahrt = { vx: 0, vy: 0, rest: 0 };
  function wunsch(W, d, o = wunschFahrt) {
    toreBis(W, d.tor + 1);
    const tor = W.tore[d.tor];
    // Wo das Tor gleich steht – es kann sich schieben und wiegen.
    torLage(tor, d.t + 0.3, zielOrt);
    // Hindurch geht es quer zur Öffnung, in der Richtung des Wegs.
    let nx = Math.sin(zielOrt.w);
    let ny = -Math.cos(zielOrt.w);
    if (nx * Math.cos(tor.hinein) + ny * Math.sin(tor.hinein) < 0) { nx = -nx; ny = -ny; }
    const dx = d.x - zielOrt.x;
    const dy = d.y - zielOrt.y;
    const vor = -(dx * nx + dy * ny);              // so weit liegt das Tor noch vorn
    const quer = -dx * ny + dy * nx;               // so weit ist die Drohne neben der Linie
    const neben = Math.abs(quer) / tor.halb;
    // Neben der Öffnung: Abstand halten, bis die Drohne vor ihr steht – sonst
    // flöge sie von der Seite in einen Pfosten. Vor der Öffnung: hindurch,
    // je genauer auf der Linie, desto schneller.
    const halten = clamp((vor - 3.2) * 1.6, -4.5, 5);
    const durch = clamp(9.5 - 9 * Math.max(0, neben - 0.2) * clamp(3 / Math.max(0.6, vor), 0.4, 2), 2.4, 9.5);
    const entlang = lerp(durch, halten, weich(clamp((neben - 0.45) / 0.45, 0, 1)));
    const hinueber = -clamp(quer * 2.8, -6.5, 6.5);
    o.vx = nx * entlang - ny * hinueber;
    o.vy = ny * entlang + nx * hinueber;
    // Wie weit es noch ist – erst hinüber, dann hindurch gerechnet.
    o.rest = Math.abs(quer) * 1.5 + Math.abs(vor);
    // Weg von den Pfosten in der Nähe – auch von denen des Tors, das eben
    // geschafft ist.
    for (let i = Math.max(0, d.tor - 1); i <= d.tor; i += 1) {
      const t = W.tore[i];
      torLage(t, d.t, zielOrt);
      for (const seite of [-1, 1]) {
        const px = zielOrt.x + Math.cos(zielOrt.w) * (t.halb + PFOSTEN) * seite;
        const py = zielOrt.y + Math.sin(zielOrt.w) * (t.halb + PFOSTEN) * seite;
        const weit = Math.hypot(d.x - px, d.y - py);
        if (weit < 2.5) {
          const stoss = ((2.5 - weit) / Math.max(0.3, weit)) * 5.5;
          o.vx += (d.x - px) * stoss;
          o.vy += (d.y - py) * stoss;
        }
      }
    }
    // Nicht in die Dächer.
    if (d.y < 7 && o.vy < 2) o.vy = 2;
    return o;
  }

  function pilot(W, d0) {
    let best = null;
    const h = 1 / 60;
    for (let a = 0; a < 4; a += 1) {
      for (let b = 0; b < 4; b += 1) {
        const d = { ...d0 };
        let kosten = 0;
        for (let n = 0; n < 22 && !d.aus; n += 1) {
          const g = GRIFFE[n < 8 ? a : b];
          schritt(W, d, g[0], g[1], h, 1);
          if (n === 7 || n === 21) {
            wunsch(W, d);
            kosten += (d.vx - wunschFahrt.vx) ** 2 + (d.vy - wunschFahrt.vy) ** 2;
            // Und näher soll sie sein: Das hilft über die Stellen hinweg, an
            // denen der Wunsch gerade umschlägt.
            if (n === 21) kosten += 2.5 * wunschFahrt.rest;
          }
        }
        if (d.aus) kosten += 1e5;
        // Jedes Tor in dieser Zeit ist viel wert, mittig noch mehr.
        kosten -= (d.tor - d0.tor) * 40 + (d.kette > d0.kette ? 12 : 0);
        if (!best || kosten < best.kosten) best = { kosten, griff: GRIFFE[a] };
      }
    }
    return best.griff;
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase: "bereit" (noch nichts gedrückt), "spiel", "zuschauen", "ende"
  const state = {
    phase: "bereit",
    welt: null,
    d: null,               // die Drohne (neueDrohne)
    punkte: 0,
    grund: "",             // warum die Runde endete
    endet: 0,              // seit wann sie endet (Bildzeit), 0: läuft
    leerSeit: 0,           // seit wann der Akku leer ist (Uhr der Runde)
    zeit: 0,               // die Bildzeit – läuft immer
    links: false,          // welche Rotoren gerade laufen (fürs Bild und den Klang)
    rechts: false,
    dreh: [0, 0],          // wie schnell sich die beiden Rotoren drehen (0 … 1)
    kam: { x: 0, y: 0 },
    stoss: 0,
    spur: [],
    funken: [], sterne: [], schriften: [],
    wrack: null,
    letzterPiep: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  // Welche Finger wo liegen: die Kennung jedes Zeigers und seine Seite.
  const finger = new Map();
  const tasten = { links: false, rechts: false };
  let gegner = null;
  let zuschauer = null;
  let klRotor = null;
  let knopfLinks = null;
  let knopfRechts = null;

  const view = { dpr: 1, cssW: 0, cssH: 0, frei: 0, s: 20, hoch: false, guete: 1 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  const haeltLinks = () => tasten.links || [...finger.values()].includes("links");
  const haeltRechts = () => tasten.rechts || [...finger.values()].includes("rechts");

  // ---------------------------------------------------------------------------
  // Klang
  // ---------------------------------------------------------------------------
  const zuletzt = new Map();
  function ton(id, o = {}, pause = 70) {
    const ms = performance.now();
    if (ms - (zuletzt.get(id) ?? -1e9) < pause) return;
    zuletzt.set(id, ms);
    klang()?.ton?.(id, o);
  }

  function rotorAn() {
    klRotor = klang()?.kulisse?.("rotoren.rotor", { laut: 0 }) || null;
  }

  function rotorAus() {
    klRotor?.stop();
    klRotor = null;
  }

  // Das Surren hängt daran, wie viele Rotoren laufen.
  function rotorStellen() {
    const n = (state.links ? 1 : 0) + (state.rechts ? 1 : 0);
    const an = state.phase !== "bereit" && !state.endet && state.d.akku > 0;
    klRotor?.setze(n === 2 ? 0.95 : n === 1 ? 0.65 : 0.2);
    klRotor?.laut(an ? (n === 2 ? 1 : n === 1 ? 0.75 : 0.3) : 0);
  }

  // ---------------------------------------------------------------------------
  // Funken, Sterne, Schriften
  // ---------------------------------------------------------------------------
  function funke(x, y, vx, vy, leben, farbe = 0) {
    if (state.funken.length > (ruhig() ? 40 : 150)) return;
    state.funken.push({ x, y, vx, vy, leben, max: leben, farbe });
  }

  function schrift(text, farbe, gross = 22, dauer = 1.4) {
    state.schriften.push({ text, farbe, gross, leben: dauer, max: dauer, x: state.d.x, y: state.d.y });
    if (state.schriften.length > 4) state.schriften.shift();
  }

  // ---------------------------------------------------------------------------
  // Was unterwegs geschieht
  // ---------------------------------------------------------------------------
  // Durch ein Tor: Es leuchtet auf, der Akku lädt – und mittig gibt es mehr.
  function torGeschafft(e) {
    const W = state.welt;
    const d = state.d;
    const tor = W.tore[e.nr];
    tor.durch = true;
    tor.mittig = e.mittig;
    tor.zeit = state.zeit;
    torLage(tor, d.t, ort);
    const viele = ruhig() ? 6 : e.mittig ? 26 : 12;
    for (let i = 0; i < viele; i += 1) {
      const w = Math.random() * TAU;
      const v = 2 + Math.random() * (e.mittig ? 9 : 5);
      funke(d.x, d.y, Math.cos(w) * v + d.vx * 0.3, Math.sin(w) * v + d.vy * 0.3, 0.35 + Math.random() * 0.45, e.mittig ? 1 : 2);
    }
    if (e.mittig) {
      schrift(e.bonus > 1 ? `Mittig! ×${e.bonus}` : "Mittig!", "#ffd23f", 24);
      schrift(`+${1 + e.bonus}`, "#fff3c4", 16);
    } else schrift("+1", "#bff4ff", 18, 1);
    if (state.phase === "spiel") {
      if (e.mittig) ton("perfekt", { laut: 0.8 }, 150); else ton("rotoren.tor", { laut: 0.7 }, 80);
      kids()?.vibrate?.(e.mittig ? [8, 30, 12] : 8);
    }
  }

  const GRUND_TEXT = {
    pfosten: "Am Pfosten hängen geblieben",
    dach: "Auf dem Dach gelandet",
    akku: "Der Akku ist leer",
    zeit: "Die Zeit ist um",
  };
  const GRUND_KURZ = { pfosten: "Pfosten!", dach: "Dach!", akku: "Akku leer!" };

  // Das Ende: Die Drohne zerlegt sich – oder trudelt mit leerem Akku davon.
  function absturz(grund) {
    if (state.endet) return;
    const d = state.d;
    state.grund = grund;
    state.endet = state.zeit;
    state.links = false;
    state.rechts = false;
    if (grund !== "akku" || d.y < 9) {
      state.stoss = 1;
      state.wrack = {
        teile: [0, 1, 2, 3].map((i) => ({
          x: d.x + (i - 1.5) * 0.4, y: d.y, vx: d.vx * 0.4 + (Math.random() - 0.5) * 9, vy: d.vy * 0.2 + 2 + Math.random() * 6,
          w: Math.random() * TAU, dw: (Math.random() - 0.5) * 22, art: i,
        })),
      };
      for (let i = 0; i < (ruhig() ? 14 : 46); i += 1) {
        const w = Math.random() * TAU;
        const v = 2 + Math.random() * 13;
        funke(d.x, d.y, Math.cos(w) * v, Math.sin(w) * v + 2, 0.35 + Math.random() * 0.6, i % 3);
      }
    }
    if (GRUND_KURZ[grund]) schrift(GRUND_KURZ[grund], "#ff8a70", 26, 2.2);
    if (state.phase === "spiel") {
      ton(grund === "akku" ? "rotoren.leer" : "rotoren.crash", { laut: 1 });
      ton("fehler", { verzoegerung: 0.3 }, 300);
      kids()?.vibrate?.([30, 40, 60]);
      klRotor?.laut(0);
      stepTimer = window.setTimeout(finish, 1500);
    }
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  function flugTakt(dt) {
    const W = state.welt;
    const d = state.d;
    const links = haeltLinks();
    const rechts = haeltRechts();
    state.links = links && d.akku > 0;
    state.rechts = rechts && d.akku > 0;
    const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
    const h = dt / n;
    for (let i = 0; i < n && !d.aus; i += 1) {
      schritt(W, d, links, rechts, h);
      if (d.ereignis) torGeschafft(d.ereignis);
      // Mit leerem Akku trudelt sie noch einen Augenblick – dann ist Schluss.
      if (d.akku <= 0) {
        if (!state.leerSeit) {
          state.leerSeit = d.t;
          if (state.phase === "spiel") ton("rotoren.leer", { laut: 0.9 });
        } else if (d.t - state.leerSeit > 1.6 && !d.aus) d.aus = "akku";
      }
    }
    if (d.aus) absturz(d.aus);
    if (d.punkte !== state.punkte) {
      state.punkte = d.punkte;
      shell.setCount(d.punkte);
    }
    // Der Akku warnt, wenn er zur Neige geht.
    if (!d.aus && d.akku > 0 && d.akku < 3 && state.zeit - state.letzterPiep > (d.akku < 1.5 ? 0.3 : 0.6)) {
      state.letzterPiep = state.zeit;
      if (state.phase === "spiel") ton("rotoren.akku", { laut: 0.5 }, 100);
    }
  }

  function nebenbei(dt) {
    const d = state.d;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.4);
    state.dreh[0] += ((state.links ? 1 : 0.12) - state.dreh[0]) * Math.min(1, dt * 12);
    state.dreh[1] += ((state.rechts ? 1 : 0.12) - state.dreh[1]) * Math.min(1, dt * 12);
    // Der Sog unter einem laufenden Rotor: kurze Striche nach «unten» aus
    // Sicht der Drohne.
    if (!state.endet && state.phase !== "bereit" && !ruhig()) {
      const c = Math.cos(d.w);
      const s = Math.sin(d.w);
      for (const [an, seite] of [[state.links, -1], [state.rechts, 1]]) {
        if (!an || Math.random() > dt * 55) continue;
        const rx = d.x + (seite * ARM + (Math.random() - 0.5) * 0.5) * c - 0.1 * s;
        const ry = d.y + (seite * ARM) * s + 0.1 * c;
        funke(rx, ry, d.vx * 0.5 + s * 9 + (Math.random() - 0.5) * 2, d.vy * 0.5 - c * 9, 0.14 + Math.random() * 0.12, 3);
      }
    }
    // Die Leuchtspur.
    if (state.phase !== "bereit" && !state.endet) {
      state.spur.push({ x: d.x, y: d.y });
      if (state.spur.length > 34) state.spur.shift();
    } else if (state.spur.length) state.spur.shift();

    for (let i = state.funken.length - 1; i >= 0; i -= 1) {
      const f = state.funken[i];
      if (f.farbe !== 3) f.vy -= 9 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.leben -= dt;
      if (f.leben <= 0) { state.funken[i] = state.funken[state.funken.length - 1]; state.funken.pop(); }
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
    if (state.wrack) {
      for (const t of state.wrack.teile) {
        t.vy -= G * dt;
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        t.w += t.dw * dt;
        const dach = dachBei(state.welt, t.x) + 0.15;
        if (t.y < dach) { t.y = dach; t.vy = -t.vy * 0.3; t.vx *= 0.6; t.dw *= 0.5; }
      }
    }
  }

  // Die Kamera schaut dorthin, wo es hingeht: zwischen Drohne und nächstem
  // Tor, aber nie so weit, dass die Drohne aus der Mitte des Bildes gerät.
  function kameraTakt(dt, sofort = false) {
    const W = state.welt;
    const d = state.d;
    const tor = W.tore[Math.min(d.tor, W.tore.length - 1)];
    const breit = view.cssW / view.s;
    const hoch = (view.cssH - view.frei) / view.s;
    const zx = d.x + clamp((tor.x - d.x) * 0.42, -breit * 0.22, breit * 0.26);
    const zy = Math.max(hoch * 0.5 - 1.5, d.y + clamp((tor.y - d.y) * 0.42, -hoch * 0.2, hoch * 0.2));
    if (sofort) { state.kam.x = zx; state.kam.y = zy; return; }
    state.kam.x += (zx - state.kam.x) * (1 - Math.exp(-dt * 3.2));
    state.kam.y += (zy - state.kam.y) * (1 - Math.exp(-dt * 3.2));
  }

  function takt(dt) {
    state.zeit += dt;
    if (state.phase === "zuschauen") zuschauenTakt(dt);
    else if (state.phase === "spiel" && !state.endet) flugTakt(dt);
    else if (state.phase === "bereit") {
      // Vor dem ersten Druck schwebt sie auf der Stelle.
      const d = state.d;
      d.y = START.y + Math.sin(state.zeit * 2.2) * (ruhig() ? 0 : 0.18);
      d.w = Math.sin(state.zeit * 1.3) * (ruhig() ? 0 : 0.03);
    }
    toreBis(state.welt, state.d.tor + 6);
    nebenbei(dt);
    kameraTakt(dt);
    rotorStellen();
    if (knopfLinks) knopfLinks.classList.toggle("ist-an", haeltLinks());
    if (knopfRechts) knopfRechts.classList.toggle("ist-an", haeltRechts());
    if (state.phase === "spiel" && !state.endet) {
      const d = state.d;
      gegner?.takt(state.punkte, { a: Math.round(d.x * 10), b: Math.round(d.y * 10), c: Math.round(d.w * 100) });
    }
  }

  // Flüssig vor scharf: Stockt das Bild über eine gute Sekunde, wird es
  // gröber gemalt statt langsamer – und bleibt so für den Rest des Besuchs.
  let bildZeit = 1 / 60;
  let zaeh = 0;
  function gueteTakt(sekunden) {
    if (sekunden > 0.2 || document.hidden) { zaeh = 0; return; }
    bildZeit += (sekunden - bildZeit) * 0.06;
    zaeh = bildZeit > 0.024 ? zaeh + sekunden : 0;
    if (zaeh > 1.2 && view.guete > 0.5) {
      view.guete *= 0.8;
      view.cssW = 0;
      zaeh = 0;
      bildZeit = 1 / 60;
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    gueteTakt((now - last) / 1000);
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    messen();
    takt(dt);
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  // Ein Rotor als Zeichen für die beiden Knöpfe unten.
  function rotorZeichen() {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const blatt = document.createElementNS(ns, "path");
    blatt.setAttribute("d", "M12 12c-2.5-4.5-7-5-9-2 3 1 6 2 9 2zm0 0c2.5 4.5 7 5 9 2-3-1-6-2-9-2zm0 0c4.5-2.5 5-7 2-9-1 3-2 6-2 9zm0 0c-4.5 2.5-5 7-2 9 1-3 2-6 2-9z");
    blatt.setAttribute("fill", "currentColor");
    svg.append(blatt);
    return svg;
  }

  function buildPlatz() {
    const platz = shell.el("div", "zr-platz");
    feld = shell.el("div", "zr-feld");
    canvas = document.createElement("canvas");
    canvas.className = "zr-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");
    // Die zwei Knöpfe: unten links der linke Rotor, unten rechts der rechte.
    // Gedrückt wird die ganze Hälfte des Bildes; die Knöpfe zeigen nur, wo,
    // und leuchten, solange ein Finger darauf liegt.
    const tipp = shell.el("div", "zr-tipp");
    tipp.setAttribute("aria-hidden", "true");
    knopfLinks = shell.el("span", "zr-knopf zr-knopf-links");
    knopfRechts = shell.el("span", "zr-knopf zr-knopf-rechts");
    knopfLinks.append(rotorZeichen());
    knopfRechts.append(rotorZeichen());
    tipp.append(knopfLinks, knopfRechts);
    feld.append(tipp);
    platz.append(feld);
    return platz;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    // Bis zur doppelten Pixeldichte, und nie viel mehr Bildpunkte als gut
    // zweieinhalb Millionen: Das Bild lebt von weichen Lichtern.
    const dpr = clamp(Math.min(shellApi.geraetDpr(), Math.sqrt(2.6e6 / (cssW * cssH))), 1, 2) * view.guete;
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    view.hoch = cssH > cssW * 1.1;
    // Der Massstab: Quer stehen mindestens sechzehn Meter im Bild, in der
    // Höhe mindestens neunzehn – auf jedem Gerät sieht man das nächste Tor.
    view.s = Math.min(cssW / 16, (cssH - frei) / 19);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    himmelAlt = null;
    stadtAlt = [null, null];
  }

  const sx = (x) => (x - state.kam.x) * view.s + view.cssW * 0.5;
  const sy = (y) => view.frei + (view.cssH - view.frei) * 0.5 - (y - state.kam.y) * view.s;

  // ---------------------------------------------------------------------------
  // Licht aus der Dose
  // ---------------------------------------------------------------------------
  // Ein Schein ist ein fertiges Bild (ein weicher Kreis in einer Farbe), das
  // hell über die Szene gelegt wird – viel billiger als ein Schatten oder ein
  // Verlauf je Lampe.
  const SCHEIN_FARBEN = {
    cyan: [90, 230, 255], gold: [255, 210, 80], gruen: [90, 255, 150], rot: [255, 70, 60], weiss: [235, 240, 255],
    pink: [255, 90, 190], blau: [80, 120, 255], mond: [200, 215, 255], warm: [255, 190, 110],
  };
  const scheinBilder = {};
  function scheinBild(name) {
    if (scheinBilder[name]) return scheinBilder[name];
    const c = SCHEIN_FARBEN[name] || SCHEIN_FARBEN.cyan;
    const bild = document.createElement("canvas");
    bild.width = 128;
    bild.height = 128;
    const q = bild.getContext("2d");
    const v = q.createRadialGradient(64, 64, 0, 64, 64, 64);
    v.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},1)`);
    v.addColorStop(0.2, `rgba(${c[0]},${c[1]},${c[2]},0.6)`);
    v.addColorStop(0.55, `rgba(${c[0]},${c[1]},${c[2]},0.16)`);
    v.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    q.fillStyle = v;
    q.fillRect(0, 0, 128, 128);
    scheinBilder[name] = bild;
    return bild;
  }

  // Die Lichter eines Bildes: beim Zeichnen gesammelt, am Schluss hell
  // darübergelegt.
  const lichter = [];
  let lichtZahl = 0;
  function licht(x, y, r, name, a) {
    if (lichtZahl >= 120) return;
    const l = lichter[lichtZahl] || (lichter[lichtZahl] = {});
    l.x = x; l.y = y; l.r = r; l.name = name; l.a = a;
    lichtZahl += 1;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Nacht und die Stadt
  // ---------------------------------------------------------------------------
  let himmelAlt = null;
  let stadtAlt = [null, null];

  // Der Himmel ändert sich nie: Er wird einmal klein gemalt und für jedes
  // Bild bloss gestreckt.
  function himmelBild() {
    if (himmelAlt) return himmelAlt;
    const bild = document.createElement("canvas");
    const w = Math.max(48, Math.round(view.cssW / 5));
    const h = Math.max(48, Math.round(view.cssH / 5));
    bild.width = w;
    bild.height = h;
    const q = bild.getContext("2d");
    const v = q.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, "#04061a");
    v.addColorStop(0.45, "#0d1238");
    v.addColorStop(0.78, "#2a1750");
    v.addColorStop(1, "#5a2358");
    q.fillStyle = v;
    q.fillRect(0, 0, w, h);
    const gross = Math.max(w, h);
    q.globalAlpha = 0.3;
    q.drawImage(scheinBild("pink"), w * 0.5 - gross * 0.9, h * 1.05 - gross * 0.55, gross * 1.8, gross * 1.1);
    q.globalAlpha = 0.22;
    q.drawImage(scheinBild("mond"), w * 0.78 - gross * 0.3, h * 0.2 - gross * 0.3, gross * 0.6, gross * 0.6);
    himmelAlt = bild;
    return bild;
  }

  /*
   * Die Stadt dahinter: zwei Lagen Hochhäuser mit hellen Fenstern. Jede Lage
   * ist ein breites Bild, das sich wiederholt – einmal gemalt, dann nur noch
   * verschoben. lage 0 liegt weit hinten (blass, klein), lage 1 näher.
   */
  function stadtBild(lage) {
    if (stadtAlt[lage]) return stadtAlt[lage];
    const bild = document.createElement("canvas");
    const hoch = Math.round(view.cssH * (lage ? 0.5 : 0.42));
    const breit = 1024;
    bild.width = breit;
    bild.height = Math.max(40, hoch);
    const q = bild.getContext("2d");
    const grund = lage ? "#0a0d24" : "#141a40";
    let x = 0;
    let i = 0;
    while (x < breit) {
      const a = hash01(i * 3.3 + lage * 91);
      const b = hash01(i * 7.7 + lage * 13);
      const w = Math.min(breit - x, Math.round((lage ? 46 : 30) + (lage ? 70 : 44) * a));
      const h = Math.round(hoch * (0.25 + 0.7 * b * (0.5 + 0.5 * hash01(i * 1.3 + lage))));
      q.fillStyle = grund;
      q.fillRect(x, hoch - h, w - 2, h);
      // Ein Aufbau auf dem Dach.
      if (a > 0.5) q.fillRect(x + w * 0.3, hoch - h - 6 - 8 * b, w * 0.25, 6 + 8 * b);
      if (b > 0.7) q.fillRect(x + w * 0.7, hoch - h - 14 - 16 * a, 2, 14 + 16 * a);
      // Fenster: ein Raster, hier und da eines hell.
      const zelle = lage ? 9 : 6;
      for (let fy = hoch - h + 6; fy < hoch - 4; fy += zelle + 3) {
        for (let fx = x + 4; fx < x + w - zelle; fx += zelle + 2) {
          const f = hash01(fx * 0.37 + fy * 1.13 + i + lage * 5);
          if (f > (lage ? 0.17 : 0.13)) continue;
          q.fillStyle = f < 0.02 ? `rgba(120, 230, 255, ${lage ? 0.8 : 0.5})` : f < 0.035 ? `rgba(255, 120, 200, ${lage ? 0.75 : 0.45})` : `rgba(255, ${200 + Math.round(200 * f)}, 130, ${lage ? 0.62 : 0.34})`;
          q.fillRect(fx, fy, zelle * (f < 0.08 ? 1 : 0.6), zelle * 0.62);
        }
      }
      x += w;
      i += 1;
    }
    stadtAlt[lage] = bild;
    return bild;
  }

  const STERNE = Array.from({ length: 70 }, (_, i) => ({ x: hash01(i * 3.1 + 1), y: hash01(i * 5.7 + 2) * 0.62, r: 0.6 + hash01(i * 7.3 + 3) * 1.2, t: hash01(i * 2.9) * 6 }));

  function zeichneNacht() {
    const W = view.cssW;
    const H = view.cssH;
    g.drawImage(himmelBild(), 0, 0, W, H);
    // Sterne, die leise funkeln.
    g.fillStyle = "#ffffff";
    for (const s of STERNE) {
      g.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(state.zeit * 0.7 + s.t));
      g.fillRect(s.x * W, s.y * H, s.r, s.r);
    }
    g.globalAlpha = 1;
    // Der Mond.
    const mx = W * 0.78 - state.kam.x * view.s * 0.004;
    const my = H * 0.2;
    const mr = Math.max(14, Math.min(W, H) * 0.045);
    g.fillStyle = "#e9edff";
    g.beginPath();
    g.arc(mx, my, mr, 0, TAU);
    g.fill();
    g.fillStyle = "rgba(170, 180, 220, 0.5)";
    g.beginPath();
    g.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.22, 0, TAU);
    g.arc(mx + mr * 0.25, my + mr * 0.3, mr * 0.16, 0, TAU);
    g.fill();
    // Die Stadt, zwei Lagen: je höher die Kamera, desto tiefer sinkt sie.
    for (const lage of [0, 1]) {
      const bild = stadtBild(lage);
      const tempo = lage ? 0.16 : 0.07;
      const unten = H + clamp((state.kam.y - 8) * view.s * (lage ? 0.1 : 0.05), -20, H * 0.22) + (lage ? 0 : -H * 0.1);
      const versatz = ((state.kam.x * view.s * tempo) % bild.width + bild.width) % bild.width;
      for (let x = -versatz; x < W; x += bild.width) g.drawImage(bild, x, unten - bild.height);
      // Dunst zwischen den Lagen.
      if (!lage) {
        g.fillStyle = "rgba(60, 30, 90, 0.25)";
        g.fillRect(0, unten - bild.height * 0.5, W, bild.height * 0.5 + 40);
      }
    }
  }

  // Die Dächer unter dem Parcours: Was man sieht, trifft auch.
  function zeichneDaecher() {
    const W = state.welt;
    const H = view.cssH;
    const s = view.s;
    const links = state.kam.x - view.cssW * 0.5 / s - 2;
    const rechts = state.kam.x + view.cssW * 0.5 / s + 2;
    daecherBis(W, rechts + 20);
    if (sy(7) < 0 - 40) return;
    for (const dach of W.daecher) {
      if (dach.x1 < links) continue;
      if (dach.x0 > rechts) break;
      const x0 = sx(dach.x0);
      const x1 = sx(dach.x1);
      const oben = sy(dach.hoch);
      const i = dach.nr;
      g.fillStyle = "#070912";
      g.fillRect(x0, oben, x1 - x0, H - oben + 4);
      // Die Dachkante im Mondlicht.
      g.fillStyle = "rgba(150, 175, 255, 0.55)";
      g.fillRect(x0, oben, x1 - x0, Math.max(1, s * 0.06));
      // Fenster an der Fassade.
      const zelle = s * 0.55;
      for (let fy = oben + zelle * 0.8; fy < H; fy += zelle * 1.6) {
        for (let fx = x0 + zelle * 0.6; fx < x1 - zelle; fx += zelle * 1.5) {
          const f = hash01(Math.round(fx - x0) * 0.71 + Math.round(fy - oben) * 1.9 + i * 13);
          if (f > 0.2) continue;
          g.fillStyle = f < 0.03 ? "rgba(120, 230, 255, 0.8)" : "rgba(255, 214, 140, 0.7)";
          g.fillRect(fx, fy, zelle * 0.7, zelle * 0.8);
        }
      }
      // Was auf dem Dach steht: eine Antenne mit rotem Licht, ein Tank, eine
      // Leuchtschrift.
      const a = hash01(i * 4.1 + 9);
      const mitte = (x0 + x1) / 2;
      if (a < 0.4 && dach.hoch < 5) {
        const hoch = s * (1 + 1.2 * hash01(i * 2.2));
        g.strokeStyle = "#0b0e1c";
        g.lineWidth = Math.max(1.5, s * 0.08);
        g.beginPath();
        g.moveTo(mitte, oben);
        g.lineTo(mitte, oben - hoch);
        g.stroke();
        const an = Math.sin(state.zeit * 3 + i) > 0.3 ? 1 : 0.25;
        g.fillStyle = `rgba(255, 80, 70, ${an})`;
        g.fillRect(mitte - 1.5, oben - hoch - 1.5, 3, 3);
        licht(mitte, oben - hoch, s * 1.2, "rot", 0.7 * an);
      } else if (a < 0.65) {
        g.fillStyle = "#0b0e1c";
        g.fillRect(x0 + (x1 - x0) * 0.2, oben - s * 0.9, s * 1.3, s * 0.9);
        g.fillRect(x0 + (x1 - x0) * 0.2 + s * 0.1, oben - s * 1.25, s * 1.1, s * 0.35);
      } else if (a > 0.86 && x1 - x0 > s * 5) {
        const farbe = a > 0.93 ? "pink" : "cyan";
        g.fillStyle = a > 0.93 ? "rgba(255, 110, 200, 0.95)" : "rgba(110, 235, 255, 0.95)";
        g.fillRect(mitte - s * 1.5, oben - s * 0.8, s * 3, s * 0.16);
        g.fillRect(mitte - s * 1.5, oben - s * 0.5, s * 2, s * 0.16);
        licht(mitte, oben - s * 0.6, s * 3.4, farbe, 0.55 + 0.15 * Math.sin(state.zeit * 7 + i));
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Tore
  // ---------------------------------------------------------------------------
  /*
   * Ein Tor: zwei leuchtende Pfosten, dazwischen ein Schleier aus Licht –
   * und in seiner Mitte, heller, das Stück, das als «mittig» zählt. Das
   * nächste Tor leuchtet und pulsiert, die danach sind blass, die geschafften
   * verglimmen (golden, wenn es mittig war).
   */
  function zeichneTore() {
    const W = state.welt;
    const d = state.d;
    const s = view.s;
    for (let i = Math.max(0, d.tor - 3); i < Math.min(W.tore.length - 1, d.tor + 5); i += 1) {
      const tor = W.tore[i];
      torLage(tor, d.t, ort);
      const mx = sx(ort.x);
      const my = sy(ort.y);
      if (mx < -s * 6 || mx > view.cssW + s * 6) continue;
      const ux = Math.cos(ort.w) * s;
      const uy = -Math.sin(ort.w) * s;
      const dran = i === d.tor && !state.endet;
      const alter = tor.durch ? state.zeit - tor.zeit : 0;
      let farbe = "cyan";
      let hell = 0.3;
      if (tor.durch) {
        farbe = tor.mittig ? "gold" : "gruen";
        hell = clamp(1 - alter / 1.6, 0.12, 1);
      } else if (dran) hell = 0.8 + 0.2 * Math.sin(state.zeit * 7);
      else if (i === d.tor + 1) hell = 0.4;
      const c = SCHEIN_FARBEN[farbe];
      const rgbText = `${c[0]}, ${c[1]}, ${c[2]}`;
      // Der Schleier zwischen den Pfosten.
      const h = tor.halb;
      g.lineCap = "round";
      g.strokeStyle = `rgba(${rgbText}, ${0.2 * hell})`;
      g.lineWidth = Math.max(3, s * 0.5);
      g.beginPath();
      g.moveTo(mx - ux * h, my - uy * h);
      g.lineTo(mx + ux * h, my + uy * h);
      g.stroke();
      g.strokeStyle = `rgba(${rgbText}, ${0.5 * hell})`;
      g.lineWidth = Math.max(1, s * 0.07);
      g.stroke();
      // Die Mitte: Hier zählt es mehr.
      if (!tor.durch) {
        const m = h * MITTIG * 2;
        g.strokeStyle = `rgba(255, 220, 110, ${dran ? 0.95 : 0.35})`;
        g.lineWidth = Math.max(2, s * 0.16);
        g.beginPath();
        g.moveTo(mx - ux * m, my - uy * m);
        g.lineTo(mx + ux * m, my + uy * m);
        g.stroke();
        if (dran) licht(mx, my, s * 1.6, "gold", 0.45);
      }
      // Die Pfosten.
      for (const seite of [-1, 1]) {
        const px = mx + ux * (h + PFOSTEN) * seite;
        const py = my + uy * (h + PFOSTEN) * seite;
        g.fillStyle = `rgba(${rgbText}, ${0.35 + 0.65 * hell})`;
        g.beginPath();
        g.arc(px, py, PFOSTEN * s, 0, TAU);
        g.fill();
        g.fillStyle = `rgba(255, 255, 255, ${0.25 + 0.7 * hell})`;
        g.beginPath();
        g.arc(px, py, PFOSTEN * s * 0.5, 0, TAU);
        g.fill();
        licht(px, py, s * (dran ? 2.6 : 1.7), farbe, (dran ? 0.9 : 0.5) * hell);
      }
      // Eben geschafft: ein Ring, der aufgeht.
      if (tor.durch && alter < 0.5) {
        g.strokeStyle = `rgba(${rgbText}, ${1 - alter / 0.5})`;
        g.lineWidth = Math.max(2, s * 0.12);
        g.beginPath();
        g.arc(mx, my, (h + alter * 6) * s, 0, TAU);
        g.stroke();
      }
    }
  }

  // Liegt das nächste Tor ausserhalb des Bildes, zeigt ein Pfeil am Rand hin.
  function zeichnePfeil() {
    const d = state.d;
    if (state.endet || state.phase === "ende") return;
    const tor = state.welt.tore[d.tor];
    torLage(tor, d.t, ort);
    const tx = sx(ort.x);
    const ty = sy(ort.y);
    const rand = 34;
    if (tx > rand && tx < view.cssW - rand && ty > view.frei + rand && ty < view.cssH - rand) return;
    const px = clamp(tx, rand, view.cssW - rand);
    const py = clamp(ty, view.frei + rand, view.cssH - rand);
    const w = Math.atan2(ty - py, tx - px);
    g.save();
    g.translate(px, py);
    g.rotate(w);
    g.fillStyle = `rgba(110, 235, 255, ${0.7 + 0.3 * Math.sin(state.zeit * 8)})`;
    g.beginPath();
    g.moveTo(14, 0);
    g.lineTo(-8, -10);
    g.lineTo(-3, 0);
    g.lineTo(-8, 10);
    g.closePath();
    g.fill();
    g.restore();
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Drohne
  // ---------------------------------------------------------------------------
  /*
   * Die Drohne in ihrem eigenen Bild: x zum rechten Rotor, y nach oben –
   * dieselben Masse wie HUELLE. Links leuchtet sie rot, rechts grün, wie ein
   * Schiff bei Nacht: So sieht man auch, welcher Daumen welcher Rotor ist.
   * opt.geist: nur der Umriss, in dieser Farbe.
   */
  function zeichneDrohne(px, py, w, opt = {}) {
    const s = view.s;
    g.save();
    g.translate(px, py);
    g.rotate(-w);
    g.scale(s, -s);
    if (opt.geist) {
      g.fillStyle = opt.geist;
      g.beginPath();
      g.ellipse(0, 0, 0.42, 0.24, 0, 0, TAU);
      g.fill();
      g.fillRect(-ARM - 0.3, 0.04, ARM * 2 + 0.6, 0.12);
      g.fillRect(-ARM - 0.4, 0.26, 0.8, 0.07);
      g.fillRect(ARM - 0.4, 0.26, 0.8, 0.07);
      g.restore();
      return;
    }
    const dreh = opt.dreh || [0, 0];
    // Die Kufen.
    g.strokeStyle = "#aab4d4";
    g.lineWidth = 0.055;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-0.26, -0.14); g.lineTo(-0.4, -0.44);
    g.moveTo(0.26, -0.14); g.lineTo(0.4, -0.44);
    g.moveTo(-0.54, -0.44); g.lineTo(-0.26, -0.44);
    g.moveTo(0.26, -0.44); g.lineTo(0.54, -0.44);
    g.stroke();
    // Die Arme: hell abgesetzt, damit man die Lage auch vor dunklem Himmel liest.
    g.strokeStyle = "#dfe6ff";
    g.lineWidth = 0.15;
    g.beginPath();
    g.moveTo(-ARM, 0.1);
    g.lineTo(ARM, 0.1);
    g.stroke();
    g.strokeStyle = "#39415f";
    g.lineWidth = 0.08;
    g.stroke();
    // Der Rumpf: eine helle Haube über dunklem Bauch, vorn das Auge der Kamera.
    g.fillStyle = "#f2f5ff";
    g.beginPath();
    g.ellipse(0, 0.02, 0.46, 0.28, 0, 0, TAU);
    g.fill();
    g.fillStyle = "#232a45";
    g.beginPath();
    g.ellipse(0, -0.03, 0.42, 0.22, 0, Math.PI, TAU);
    g.fill();
    g.fillStyle = "#ffb52e";
    g.fillRect(-0.3, 0.02, 0.6, 0.06);
    g.fillStyle = "#5ad8ff";
    g.beginPath();
    g.arc(0, -0.1, 0.1, 0, TAU);
    g.fill();
    g.fillStyle = "#0a0e1c";
    g.beginPath();
    g.arc(0, -0.1, 0.05, 0, TAU);
    g.fill();
    // Die Motoren, ihre Lichter und die Rotoren.
    for (const seite of [-1, 1]) {
      const rx = seite * ARM;
      g.fillStyle = "#c9d2f0";
      g.fillRect(rx - 0.1, 0.02, 0.2, 0.24);
      g.fillStyle = seite < 0 ? "#ff4a3a" : "#3dff86";
      g.beginPath();
      g.arc(rx, -0.04, 0.085, 0, TAU);
      g.fill();
      // Der Rotor: steht er fast, sieht man das Blatt; läuft er, eine Scheibe.
      const lauf = dreh[seite < 0 ? 0 : 1];
      const breit = lauf > 0.5 ? 0.46 : 0.46 * (0.35 + 0.65 * Math.abs(Math.sin(state.zeit * 9 + seite)));
      g.fillStyle = `rgba(225, 238, 255, ${0.45 + 0.4 * lauf})`;
      g.beginPath();
      g.ellipse(rx, 0.31, breit, 0.04 + 0.025 * lauf, 0, 0, TAU);
      g.fill();
    }
    g.restore();
  }

  let neigung = 0;
  function zeichneDrohneImBild() {
    const d = state.d;
    const s = view.s;
    if (state.wrack) {
      // Was davonfliegt: zwei Rotoren, ein Arm, der Rumpf.
      const t = state.zeit - state.endet;
      g.globalAlpha = clamp(2.2 - t, 0, 1);
      for (const teil of state.wrack.teile) {
        g.save();
        g.translate(sx(teil.x), sy(teil.y));
        g.rotate(teil.w);
        if (teil.art === 0) {
          g.fillStyle = "#1a2036";
          g.beginPath();
          g.ellipse(0, 0, 0.44 * s, 0.26 * s, 0, 0, TAU);
          g.fill();
        } else if (teil.art === 1) {
          g.fillStyle = "#2c3350";
          g.fillRect(-0.5 * s, -0.05 * s, s, 0.1 * s);
        } else {
          g.fillStyle = "rgba(200, 225, 255, 0.7)";
          g.fillRect(-0.4 * s, -0.03 * s, 0.8 * s, 0.06 * s);
        }
        g.restore();
      }
      g.globalAlpha = 1;
      return;
    }
    neigung += (d.w - neigung) * 0.6;
    const px = sx(d.x);
    const py = sy(d.y);
    zeichneDrohne(px, py, neigung, { dreh: state.dreh });
    // Ihre Lichter: links rot, rechts grün, und hell, wo ein Rotor läuft.
    const c = Math.cos(neigung);
    const sn = Math.sin(neigung);
    for (const seite of [-1, 1]) {
      const lx = px + c * seite * ARM * s;
      const ly = py - sn * seite * ARM * s;
      const lauf = state.dreh[seite < 0 ? 0 : 1];
      licht(lx, ly + 0.05 * s, s * (0.5 + 0.35 * lauf), seite < 0 ? "rot" : "gruen", 0.4 + 0.3 * lauf);
    }
    // Der Akku: ein Ring um die Drohne, der abläuft – rot, wenn es eng wird.
    if (state.phase !== "bereit" && !state.endet) {
      const anteil = clamp(d.akku / AKKU_MAX, 0, 1);
      const eng = d.akku < 3;
      const r = s * 1.75;
      g.lineCap = "round";
      g.strokeStyle = "rgba(255, 255, 255, 0.13)";
      g.lineWidth = Math.max(2.5, s * 0.13);
      g.beginPath();
      g.arc(px, py, r, 0, TAU);
      g.stroke();
      if (anteil > 0 && !(eng && Math.sin(state.zeit * 18) > 0.4)) {
        g.strokeStyle = eng ? "#ff5a48" : d.akku < AKKU_MAX * 0.55 ? "#ffd23f" : "#52e08a";
        g.beginPath();
        g.arc(px, py, r, -Math.PI / 2, -Math.PI / 2 + TAU * anteil);
        g.stroke();
      }
    }
  }

  // Die Leuchtspur hinter der Drohne.
  function zeichneSpur() {
    const spur = state.spur;
    if (spur.length < 2) return;
    g.lineCap = "round";
    for (let i = 1; i < spur.length; i += 1) {
      const k = i / spur.length;
      g.strokeStyle = `rgba(110, 235, 255, ${0.5 * k * k})`;
      g.lineWidth = Math.max(1, view.s * 0.22 * k);
      g.beginPath();
      g.moveTo(sx(spur[i - 1].x), sy(spur[i - 1].y));
      g.lineTo(sx(spur[i].x), sy(spur[i].y));
      g.stroke();
    }
  }

  // Die Gegner als Geist (geist.js): eine Drohne aus Licht auf ihrem Weg –
  // durch ihren eigenen Parcours, nicht durch diesen.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    orte.forEach((o) => {
      // Wem im Live-Modus zugeschaut wird, der ist die Figur selbst – kein
      // Geist dazu, nur sein Name (geist.js, namen).
      if (o.ziel) return;
      g.globalAlpha = 0.6 * o.blass;
      zeichneDrohne(sx(o.a / 10), sy(o.b / 10), (o.c || 0) / 100, { geist: o.farbe });
    });
    g.globalAlpha = 1;
    window.LernappGeist.namen(g, orte.map((o) => {
      const dx = o.a / 10 - state.d.x;
      return { ...o, sx: sx(o.a / 10), sy: sy(o.b / 10 + 1.4), weit: `${dx > 0 ? "+" : ""}${Math.round(dx)} m` };
    }), { breit: view.cssW, hoch: view.cssH });
  }

  // Funken und der Sog der Rotoren: helle Striche, hell übereinandergelegt.
  const FUNKEN_FARBE = ["#fff3c8", "#ffd23f", "#8ff1ff", "rgba(190, 220, 255, 0.55)"];
  function zeichneFunken() {
    if (!state.funken.length) return;
    const s = view.s;
    g.lineCap = "round";
    for (const f of state.funken) {
      const k = clamp(f.leben / f.max, 0, 1);
      const px = sx(f.x);
      const py = sy(f.y);
      g.strokeStyle = FUNKEN_FARBE[f.farbe];
      g.globalAlpha = Math.min(1, k * 1.6);
      g.lineWidth = Math.max(1, s * (f.farbe === 3 ? 0.04 : 0.07));
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px - f.vx * 0.03 * s, py + f.vy * 0.03 * s);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  function zeichneLicht() {
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < lichtZahl; i += 1) {
      const l = lichter[i];
      if (l.a <= 0.04 || l.x < -l.r || l.x > view.cssW + l.r || l.y < -l.r || l.y > view.cssH + l.r) continue;
      g.globalAlpha = Math.min(1, l.a);
      g.drawImage(scheinBild(l.name), l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    g.globalAlpha = 1;
    zeichneSpur();
    zeichneFunken();
    g.globalCompositeOperation = "source-over";
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: die Anzeige
  // ---------------------------------------------------------------------------
  function pille(x, y, w, h, farbe) {
    g.fillStyle = farbe;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, h / 2); else g.rect(x, y, w, h);
    g.fill();
  }

  function zeichneAnzeige() {
    const W = view.cssW;
    const H = view.cssH;
    const d = state.d;
    const u = clamp(Math.min(W, H) / 420, 0.85, 1.35);
    // Die Schriften über der Drohne.
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((s, i) => {
      const k = clamp(s.leben / s.max, 0, 1);
      const px = clamp(sx(d.x), 70, W - 70);
      const py = sy(d.y) - (62 + i * 22) * u - (1 - k) * 26 * u;
      g.globalAlpha = Math.min(1, k * 2.4);
      g.font = `900 ${Math.round(s.gross * u)}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(4, 6, 22, 0.8)";
      g.strokeText(s.text, px, py);
      g.fillStyle = s.farbe;
      g.fillText(s.text, px, py);
    });
    g.globalAlpha = 1;

    // Oben links: die Punkte, darunter der Akku und die Reihe.
    g.save();
    g.translate(0, view.frei);
    const gross = clamp(H * 0.055, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    const text = `${state.punkte}`;
    const breit = g.measureText(text).width + gross * 1.1;
    pille(12, 12, breit, gross * 1.6, "rgba(4, 6, 22, 0.6)");
    g.fillStyle = "#ffffff";
    g.fillText(text, 12 + gross * 0.55, 12 + gross * 0.84);
    if (state.phase !== "bereit") {
      const klein = Math.round(gross * 0.6);
      const y2 = 12 + gross * 1.6 + 6;
      g.font = `800 ${klein}px system-ui, sans-serif`;
      const eng = d.akku < 3;
      const bw = Math.max(96, gross * 5.4);
      pille(12, y2, bw, klein * 1.8, eng && Math.sin(state.zeit * 14) > 0 ? "rgba(120, 20, 14, 0.85)" : "rgba(4, 6, 22, 0.6)");
      g.fillStyle = eng ? "#ff5a48" : d.akku < AKKU_MAX * 0.55 ? "#ffd23f" : "#52e08a";
      const innen = bw - 8;
      g.beginPath();
      const voll = Math.max(3, innen * clamp(d.akku / AKKU_MAX, 0, 1));
      if (g.roundRect) g.roundRect(16, y2 + klein * 1.8 - 7, voll, 3, 1.5); else g.rect(16, y2 + klein * 1.8 - 7, voll, 3);
      g.fill();
      g.fillStyle = "#ffffff";
      g.fillText(`Akku ${d.akku.toFixed(1)} s`, 12 + klein * 0.6, y2 + klein * 0.8);
      if (d.kette >= 2) {
        const y3 = y2 + klein * 1.8 + 6;
        const t3 = `Mittig ×${Math.min(d.kette, KETTE_MAX)}`;
        const w3 = g.measureText(t3).width + klein * 1.2;
        pille(12, y3, w3, klein * 1.8, "#ffd23f");
        g.fillStyle = "#3a2400";
        g.fillText(t3, 12 + klein * 0.6, y3 + klein * 0.95);
      }
    }
    g.restore();
    zeichnePfeil();
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: alles zusammen
  // ---------------------------------------------------------------------------
  function zeichnen() {
    if (!g || !state.welt) return;
    lichtZahl = 0;
    const wackel = ruhig() ? 0 : state.stoss * 7;
    const dx = wackel ? Math.sin(state.zeit * 71) * wackel : 0;
    const dy = wackel ? Math.cos(state.zeit * 57) * wackel : 0;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    zeichneNacht();
    g.setTransform(view.dpr, 0, 0, view.dpr, dx * view.dpr, dy * view.dpr);
    zeichneDaecher();
    zeichneTore();
    zeichneGeister();
    zeichneDrohneImBild();
    zeichneLicht();
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Ein aufgezeichneter Flug durch seinen eigenen Parcours: Der Zufall hält
  // die Saat (geist.js, zuschauer), startRun baut damit dieselben Tore, die
  // Uhr läuft wie damals (nach ihr schieben sie sich), und die Drohne steht
  // Bild für Bild dort, wo sie war.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    shell.setPhase("play");
    zuschauer.los();
    rotorAn();
  }

  function zuschauenTakt() {
    const s = zuschauer.stand();
    if (!s || state.endet) return;
    const W = state.welt;
    const d = state.d;
    d.x = (s.a || 0) / 10;
    d.y = (s.b || 0) / 10;
    d.w = (s.c || 0) / 100;
    d.vx = s.va / 10;
    d.vy = s.vb / 10;
    d.t = s.t / 1000;
    // Welche Rotoren liefen, sagt die Neigung – und ob es nach oben zog.
    const hoch = s.ab / 10 + G + LUFT_Y * d.vy;
    state.links = d.w < -0.12 || (Math.abs(d.w) <= 0.12 && hoch > 6);
    state.rechts = d.w > 0.12 || (Math.abs(d.w) <= 0.12 && hoch > 6);
    // Jedes Mal, wenn die Zahl steigt, ist ein Tor geschafft.
    const punkte = Math.max(0, Math.round(s.punkte));
    if (punkte > state.punkte) {
      toreBis(W, d.tor + 1);
      const plus = punkte - state.punkte;
      d.kette = plus > 1 ? d.kette + 1 : 0;
      torGeschafft({ nr: d.tor, mittig: plus > 1, bonus: plus - 1 });
      d.tor += 1;
      state.punkte = punkte;
      d.punkte = punkte;
      shell.setCount(punkte);
    }
    // Der Akku lässt sich nicht nachrechnen: Im Bild steht er still.
    d.akku = AKKU_MAX;
    if (!zuschauer.weiter()) {
      absturz("pfosten");
      state.schriften.length = 0;
      rotorAus();
    }
  }

  // ---------------------------------------------------------------------------
  // Die Daumen
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.d.y = START.y;
    state.d.w = 0;
    shell.setPhase("play");
    gegner?.los();
    rotorAn();
    kids()?.vibrate?.(8);
  }

  function druecken(seite, kennung = "taste") {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    if (kennung === "taste") tasten[seite] = true; else finger.set(kennung, seite);
    if (state.phase === "bereit" && !shell.live) losGehts();
  }

  function loslassen(seite, kennung = "taste") {
    if (kennung === "taste") { if (seite) tasten[seite] = false; else { tasten.links = false; tasten.rechts = false; } } else finger.delete(kennung);
  }

  function allesLos() {
    finger.clear();
    tasten.links = false;
    tasten.rechts = false;
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    rotorAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    const W = neueWelt();
    toreBis(W, 12);
    state.welt = W;
    state.d = neueDrohne();
    state.phase = "bereit";
    state.punkte = 0;
    state.grund = "";
    state.endet = 0;
    state.leerSeit = 0;
    state.zeit = 0;
    state.links = false;
    state.rechts = false;
    state.dreh = [0, 0];
    state.stoss = 0;
    state.spur = [];
    state.funken = [];
    state.schriften = [];
    state.wrack = null;
    state.letzterPiep = 0;
    neigung = 0;
    allesLos();
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt zr-prompt", "Links der linke Rotor, rechts der rechte. Beide: steigen.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    kameraTakt(0, true);

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(800, 200 + ziel * 8);
    const start = performance.now();
    zahl.textContent = "0";
    const lauf = (now) => {
      if (!zahl.isConnected) return;
      const k = Math.min(1, (now - start) / dauer);
      zahl.textContent = String(Math.round(ziel * (1 - (1 - k) * (1 - k))));
      if (k < 1) window.requestAnimationFrame(lauf);
    };
    window.requestAnimationFrame(lauf);
  }

  function finish() {
    if (state.phase === "zuschauen") return;
    clearStep();
    stopLoop();
    rotorAus();
    if (state.phase === "ende") return;
    // Im Live-Modus endet die Runde, wenn die Zeit des Abends um ist.
    if (!state.grund) state.grund = "zeit";
    state.phase = "ende";
    allesLos();
    const d = state.d;
    const punkte = state.punkte;
    const geist = gegner?.ende(punkte) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const tore = d.tor === 1 ? "1 Tor" : `${d.tor} Tore`;
    const mittig = d.mittige ? `${d.mittige}× mittig` : "";
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord
        ? ["Neuer Rekord!", tore, mittig].filter(Boolean).join(" · ")
        : [GRUND_TEXT[state.grund] || "", [tore, mittig].filter(Boolean).join(", "), vorher ? `Bestwert ${vorher}` : ""].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("zr-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Zwei Rotoren",
    area: "konzentration",
    accent: "#00A5B5",
    accentDark: "#00707c",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "twinRotor", fassung: "t2", zufall, nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "twinRotor", host, art: "tempo", fassung: "t2", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Jeder Finger zählt für die Hälfte des Bildes, auf der er aufsetzt – auch
  // wenn er danach hinüberrutscht.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    const r = host.getBoundingClientRect();
    druecken(event.clientX < r.left + r.width / 2 ? "links" : "rechts", event.pointerId);
  });
  const fingerWeg = (event) => loslassen(null, event.pointerId);
  window.addEventListener("pointerup", fingerWeg);
  window.addEventListener("pointercancel", fingerWeg);
  // Wer das Fenster verlässt, nimmt auch die Daumen von den Rotoren.
  window.addEventListener("blur", allesLos);

  const TASTE_SEITE = { a: "links", A: "links", ArrowLeft: "links", l: "rechts", L: "rechts", ArrowRight: "rechts", d: "rechts", D: "rechts" };
  const BEIDE = new Set([" ", "ArrowUp", "w", "W"]);
  document.addEventListener("keydown", (event) => {
    const seite = TASTE_SEITE[event.key];
    if (!seite && !BEIDE.has(event.key)) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    if (seite) druecken(seite); else { druecken("links"); druecken("rechts"); }
  });
  document.addEventListener("keyup", (event) => {
    const seite = TASTE_SEITE[event.key];
    if (seite) loslassen(seite); else if (BEIDE.has(event.key)) loslassen(null);
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); rotorAus(); });

  // Für die Prüfskripte und die Vorführung.
  window.LernappRotoren = {
    TAKT, AKKU_MAX, AKKU_TEMPO, KIPP, MITTIG, PFOSTEN, HOCH_MIN, HOCH_MAX,
    state, view, takt, zeichnen, druecken, loslassen, allesLos, losGehts, weltText, toreBis,
    neueDrohne, schritt, pilot, wunsch, torLage, dachBei, akkuLaden,
    haelt: () => [haeltLinks(), haeltRechts()],
  };
})();
