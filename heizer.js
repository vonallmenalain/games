/*
 * heizer.js – Der Heizer: mehrere Kessel, ein Paar Hände.
 *
 * Auf jedem Kessel steht ein Manometer, und jeder Zeiger fällt. Ein Tipp legt
 * Kohle nach und hebt ihn um KOHLE Striche. Fällt einer auf null, geht das
 * Feuer aus und die Schicht ist vorbei.
 *
 * Damit wäre es ein Spiel, das man durch schnelles Tippen gewinnt. Deshalb die
 * zweite Hälfte der Regel: Über GEFAHR darf nicht nachgelegt werden. Wer es
 * doch tut, treibt den Druck über den Anschlag, das Ventil platzt, und die
 * Schicht ist genauso vorbei. Der rote Bogen oben auf jedem Zifferblatt ist
 * genau diese Grenze – er ist nicht Zierde, er ist die Regel.
 *
 * Damit ist das Spiel kein Klopfen mehr, sondern ein Verteilen: Wer ist als
 * nächster dran, und wer sieht nur so aus. Alle neun Sekunden kommt ein Kessel
 * dazu, bis fünf nebeneinander stehen, und der Verbrauch steigt langsam mit.
 *
 * Zwei Dinge soll man kommen sehen, bevor sie da sind. Das eine ist der
 * nächste Kessel. Er kündigt sich VORSCHAU_MS vorher als Umriss genau an der
 * Stelle an, an der er gleich stehen wird, und ein Ring darin füllt sich, bis
 * es so weit ist. Dann hält die Reihe HALT_MS lang die Luft an: Kein Zeiger
 * fällt, während der neue aufgeht. Diese halbe Sekunde zählt nicht mit – die
 * Punkte sind gespielte Zeit, nicht Zeit auf der Wanduhr. Sonst wäre jeder
 * Kessel, der dazukommt, ein kleines Geschenk, und drei Geschenke stünden in
 * der Rangliste vor einem guten Lauf ohne sie.
 *
 * Das andere ist ein Kessel, der gleich ausgeht. Der rote Bogen unten am Rand
 * sagt das zwar, aber er sagt es spät und immer gleich laut. Deshalb färbt
 * sich ab TOENUNG_AB das Zifferblatt selbst: Je tiefer der Zeiger steht, desto
 * röter wird das Weiss, bis die ganze Uhr glüht. Das ist dieselbe Zahl ein
 * zweites Mal, aber als Fläche – und eine Fläche sieht man aus dem
 * Augenwinkel, eine Nadel nicht.
 *
 * Getippt wird nicht nur auf das Zifferblatt, sondern auch auf die Klappe
 * darunter. Ein Daumen ist breiter, als er aussieht: Wer auf die Uhr tippt,
 * verdeckt genau das, worauf es ankommt. Die Klappe ist derselbe Knopf, nur
 * ein Stück tiefer – die Hand liegt unter der Anzeige statt darauf.
 *
 * Die Form ist die von Blätter im Strom: eine Runde, eine Uhr, eine Zahl.
 * Anders als dort endet sie nicht nur an der Uhr, sondern meistens vorher – an
 * einem Kessel, den man übersehen hat.
 *
 * Gezählt wird in Zehntelsekunden, nicht in Nachlegungen. Zwei Gründe: Die
 * Zahl steigt sichtbar, solange man durchhält, und sie ist fein genug, dass
 * zwei gute Läufe fast nie gleich ausgehen – was in einem Turnier den
 * Unterschied zwischen einer Rangliste und einem Losentscheid macht.
 *
 * Die Zahlen unten sind ausgespielt, nicht ausgerechnet: mit einem
 * nachgebildeten Heizer, der immer den dringendsten Kessel wählt und um eine
 * feste Zeit zu spät kommt. Wer 320 Millisekunden braucht, hält im Mittel
 * 38 Sekunden durch, wer 220 braucht 51, wer 160 braucht 67.
 *
 * Die Schicht ist bei SCHICHT_MS zu Ende. Das ist kein Ziel, sondern ein
 * Deckel, und er soll keines werden: Ein Automat, der neunmal in der Sekunde
 * tippt und jeden Zeiger genau kennt, kommt auf 103 Sekunden – ein Mensch
 * nicht in die Nähe. Stünden oben in einem Turnier fünf Leute mit derselben
 * Höchstzahl, wäre die Rangliste ein Losentscheid.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "boiler") return;

  const host = document.querySelector("#hz-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const art = window.LernappTrainArt;
  if (!host || !shellApi || !art) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Ohne Turnier in der Adresse ist das Math.random; in einem
  // Turnier bekommt jeder dieselbe Schicht (zufall.js).
  const zufall = window.LernappZufall?.fuer?.("boilerRoom") || {
    fest: false, neu() {}, zahl: Math.random,
    ganz: (n) => Math.floor(Math.random() * n),
    von: (a, b) => a + Math.random() * (b - a),
  };

  // ---------------------------------------------------------------------------
  // Die Regeln
  // ---------------------------------------------------------------------------
  const VOLL = 100;                 // der Anschlag des Manometers
  const START_WERT = 70;            // so steht ein frisch angefeuerter Kessel
  const KOHLE = 30;                 // so viel hebt ein Tipp
  // Über dieser Marke platzt das Ventil, wenn nachgelegt wird. Es ist genau
  // VOLL - KOHLE: Die Grenze ist damit keine zweite Zahl, die man sich merken
  // müsste, sondern die Stelle, ab der ein Tipp nicht mehr passt.
  const GEFAHR = VOLL - KOHLE;
  // Wie schnell ein Kessel leerläuft, in Strichen je Sekunde. Fünf
  // verschiedene Werte, und der dritte ist der hungrigste: Sonst wäre die
  // Reihenfolge immer dieselbe, und der Blick müsste nicht wandern.
  const TEMPO = [12.5, 15.5, 18, 14.5, 17];
  const KESSEL_MAX = 5;
  const KESSEL_START = 2;
  const KESSEL_DAZU_MS = 9000;      // alle neun Sekunden einer mehr
  // Der Verbrauch steigt mit der Zeit: nach einer Minute zweieinhalbmal so
  // viel, nach zwei Minuten mehr als das Vierfache. Ohne das liefe ein guter
  // Heizer ewig, denn fünf Kessel in einem festen Takt sind irgendwann
  // Routine – und eine Runde ohne Ende passt in kein Turnier.
  const ZUNAHME = 0.026;            // je Sekunde 2,6 % mehr
  // Das Ende der Schicht. Nicht als Ziel gedacht, sondern als Deckel: Eine
  // Runde, die zehn Minuten dauern kann, passt in kein Turnier – und in keinen
  // Feierabend.
  const SCHICHT_MS = 120000;

  // So lange vorher steht der Umriss des nächsten Kessels schon da. Lang genug,
  // um den Blick einmal über die Reihe wandern zu lassen, kurz genug, dass er
  // nicht zum Möbelstück wird.
  const VORSCHAU_MS = 2600;
  // Und so lange steht die Reihe still, wenn er da ist. Eine halbe Sekunde ist
  // ein Atemzug: genug, um zu sehen, wo er steht, zu wenig, um zu planen.
  const HALT_MS = 500;

  // Ab hier läuft das Zifferblatt von Weiss nach Rot. Der Wert ist bewusst
  // höher als MAHNUNG: Die Tönung ist die Vorwarnung, der pochende Ring darunter
  // der Ruf. Bei Grundtempo sind das rund zweieinhalb Sekunden Vorlauf.
  const TOENUNG_AB = 40;
  const BLATT_HELL = [255, 253, 247];
  const BLATT_ROT = [206, 43, 28];
  const RAND_HELL = [247, 241, 228];
  const RAND_ROT = [143, 32, 21];

  // Zwei Farben mischen: t = 0 ist die erste, t = 1 die zweite.
  const mische = (a, b, t) => `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;

  // Jeder Kessel schwankt ein wenig um sein Tempo – dieselbe Schicht fühlt
  // sich sonst beim zweiten Mal an wie auswendig gelernt. Im Turnier ist das
  // Schwanken für alle dasselbe (zufall.js).
  const STREUUNG = 0.12;

  const HELP = [
    "Der Heizer. Auf jedem Kessel steht ein Manometer, und jeder Zeiger fällt.",
    "Tippe auf einen Kessel, dann legst du Kohle nach und sein Zeiger steigt.",
    "Tippen kannst du auf die Uhr oder auf die glühende Klappe darunter – dort liegt dein Finger nicht im Weg.",
    "Je tiefer ein Zeiger steht, desto röter wird seine Uhr. Wird eine ganz rot, ist sie als nächste dran.",
    "Fällt ein Zeiger auf null, geht das Feuer aus und die Schicht ist vorbei.",
    "Aber Achtung: Im roten Feld oben darfst du nicht nachlegen, sonst platzt das Ventil.",
    "Alle neun Sekunden kommt ein Kessel dazu, bis fünf nebeneinander stehen.",
    "Er meldet sich vorher: Sein Umriss stellt sich daneben, und ein Ring darin füllt sich, bis er da ist.",
    "Bleib dabei: Wer die Seite verlässt, lässt den Kessel allein, und die Schicht ist zu Ende.",
    "Halte durch, so lange du kannst.",
  ].join(" ");

  // ---------------------------------------------------------------------------
  // Bestenliste – nur für diese Seite, die grosse steht in mini-games.js
  // ---------------------------------------------------------------------------
  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.heizer", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  // Das Zifferblatt
  // ---------------------------------------------------------------------------
  // Der Zeiger läuft über 260 Grad, von unten links nach unten rechts. Null
  // liegt links: ein fallender Zeiger wandert gegen den Uhrzeigersinn, und
  // "fast leer" sieht aus wie "fast leer".
  const MITTE_X = 50;
  const MITTE_Y = 52;
  const RADIUS = 34;
  const BOGEN = 260;

  const winkel = (wert) => -BOGEN / 2 + (BOGEN * Math.max(0, Math.min(VOLL, wert))) / VOLL;

  function punkt(wert, r) {
    const rad = (winkel(wert) * Math.PI) / 180;
    return [MITTE_X + Math.sin(rad) * r, MITTE_Y - Math.cos(rad) * r];
  }

  // Ein Stück Skala als Pfad. gross ist das Flag für Bögen über 180 Grad –
  // hier nie der Fall, aber der Pfad ist ohne es nicht vollständig.
  function bogen(von, bis, r) {
    const [x1, y1] = punkt(von, r);
    const [x2, y2] = punkt(bis, r);
    const gross = Math.abs(winkel(bis) - winkel(von)) > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${gross} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }

  // Unter welchem Wert das Feuer ausgeht, ist keine eigene Zahl – null ist
  // null. Der untere rote Bogen ist trotzdem breiter als ein Strich: Er sagt
  // "der ist als nächster dran", und das soll man aus dem Augenwinkel sehen.
  const MAHNUNG = 22;

  // Die Klappe unter der Uhr. Sie ist kein zweiter Knopf, sondern derselbe –
  // nur der Teil davon, auf dem ein Daumen liegen darf, ohne die Anzeige zu
  // verdecken. Deshalb ist sie auch nicht klein: Ihre Höhe hat unten eine
  // Grenze in Pixeln, damit sie auf einem schmalen Telefon nicht mit den
  // Kesseln mitschrumpft (styles.css, .hz-griff).
  //
  // Die Nummer steht im glühenden Schlitz. Sie ist für die Tastatur da – am
  // Schreibtisch tippt niemand mit zwei Daumen auf fünf Ziele –, und auf der
  // Klappe steht sie wie eingestanzt, statt der Uhr im Weg zu sein.
  function baueGriff(nummer) {
    const griff = shell.el("span", "hz-griff");
    griff.setAttribute("aria-hidden", "true");
    const schlitz = shell.el("span", "hz-schlitz");
    if (nummer) schlitz.append(shell.el("span", "hz-nummer", String(nummer)));
    griff.append(schlitz);
    return griff;
  }

  function baueKessel(kessel) {
    const knopf = shell.el("button", "hz-kessel");
    knopf.type = "button";
    if (kessel.nummer) knopf.setAttribute("aria-label", `Kessel ${kessel.nummer}: Kohle nachlegen`);
    else knopf.setAttribute("aria-hidden", "true");

    // Rand und Zifferblatt bleiben greifbar: Ihre Füllung ist keine feste
    // Farbe mehr, sondern die Anzeige selbst (zeichne).
    const rand = art.el("circle", { cx: MITTE_X, cy: MITTE_Y, r: RADIUS + 9, fill: mische(RAND_HELL, RAND_ROT, 0), stroke: "#8c7a62", "stroke-width": 3 });
    const blatt = art.el("circle", { cx: MITTE_X, cy: MITTE_Y, r: RADIUS + 3, fill: mische(BLATT_HELL, BLATT_ROT, 0), stroke: "#d9cbb3", "stroke-width": 1.5 });

    const svg = art.el("svg", { viewBox: "0 0 100 100", class: "hz-uhr", "aria-hidden": "true" }, [
      rand,
      blatt,
      // Die drei Felder: unten rot (fast aus), in der Mitte grün, oben rot
      // (hier nicht nachlegen).
      art.el("path", { d: bogen(0, MAHNUNG, RADIUS), fill: "none", stroke: "#e2694f", "stroke-width": 7, "stroke-linecap": "butt" }),
      art.el("path", { d: bogen(MAHNUNG, GEFAHR, RADIUS), fill: "none", stroke: "#5fb87a", "stroke-width": 7, "stroke-linecap": "butt" }),
      art.el("path", { d: bogen(GEFAHR, VOLL, RADIUS), fill: "none", stroke: "#d0392b", "stroke-width": 7, "stroke-linecap": "butt" }),
      // Der Strich, an dem der Tipp nicht mehr passt.
      art.el("path", { d: bogen(GEFAHR, GEFAHR + 0.6, RADIUS + 8), fill: "none", stroke: "#8c1c12", "stroke-width": 4, "stroke-linecap": "round" }),
    ]);

    const zeiger = art.el("g", { class: "hz-zeiger" }, [
      art.el("path", {
        d: `M ${MITTE_X} ${MITTE_Y + 8} L ${MITTE_X} ${MITTE_Y - RADIUS + 4}`,
        fill: "none", stroke: "#243047", "stroke-width": 4, "stroke-linecap": "round",
      }),
      art.el("circle", { cx: MITTE_X, cy: MITTE_Y, r: 5.5, fill: "#243047" }),
    ]);
    svg.append(zeiger);

    // Das Feld um die Uhr trägt alles, was rund sein muss: den Warnring, den
    // Funken, das Glühen. Am Knopf selbst hinge beides an einem Kasten, der
    // seit der Klappe höher als breit ist – aus einem Kreis würde ein Ei.
    const feld = shell.el("span", "hz-uhr-feld");
    feld.append(svg);
    // Das Glühen nach aussen: dieselbe Zahl wie die Tönung, aber neben dem
    // Kessel statt darin. Aus dem Augenwinkel sieht man das zuerst.
    const halo = shell.el("span", "hz-halo");
    halo.setAttribute("aria-hidden", "true");
    feld.append(halo);
    // Der Funke beim Nachlegen: ein kurzes Aufleuchten, kein Ton. Bei vier
    // Tipps in der Sekunde wäre jeder Ton ein Geräusch.
    const funke = shell.el("span", "hz-funke");
    funke.setAttribute("aria-hidden", "true");
    feld.append(funke);
    knopf.append(feld, baueGriff(kessel.nummer));

    knopf.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      nachlegen(kessel);
    });

    kessel.node = knopf;
    kessel.zeiger = zeiger;
    kessel.blatt = blatt;
    kessel.rand = rand;
    return knopf;
  }

  // ---------------------------------------------------------------------------
  // Der Umriss: hier steht gleich einer
  // ---------------------------------------------------------------------------
  // Bisher stand der neue Kessel plötzlich da, und die Reihe rückte im selben
  // Bild zusammen. Jetzt stellt sich VORSCHAU_MS vorher sein Umriss an genau
  // die Stelle, an der er stehen wird, und schiebt den Platz langsam auf. Der
  // Ring darin füllt sich, bis es so weit ist – die Frage "wann" ist damit
  // beantwortet, ohne dass irgendwo eine Zahl herunterzählt.
  const UMFANG = 2 * Math.PI * (RADIUS + 9);

  function bauePlatz() {
    const node = shell.el("div", "hz-platz");
    node.setAttribute("aria-hidden", "true");

    platzBogen = art.el("circle", {
      class: "hz-platz-bogen", cx: MITTE_X, cy: MITTE_Y, r: RADIUS + 9, fill: "none",
      "stroke-width": 5, "stroke-linecap": "round",
      "stroke-dasharray": UMFANG.toFixed(1),
      "stroke-dashoffset": UMFANG.toFixed(1),
      // Der Ring füllt sich von oben im Uhrzeigersinn – wie jede Uhr.
      transform: `rotate(-90 ${MITTE_X} ${MITTE_Y})`,
    });

    const wort = art.el("text", { class: "hz-platz-wort", x: MITTE_X, y: MITTE_Y + 6, "text-anchor": "middle" });
    wort.textContent = "gleich";

    const feld = shell.el("span", "hz-uhr-feld");
    feld.append(art.el("svg", { viewBox: "0 0 100 100", class: "hz-uhr hz-platz-uhr" }, [
      art.el("circle", {
        cx: MITTE_X, cy: MITTE_Y, r: RADIUS + 9, fill: "rgba(255, 253, 247, 0.62)",
        stroke: "#9b8a72", "stroke-width": 2.5, "stroke-dasharray": "6 8", "stroke-linecap": "round",
      }),
      platzBogen,
      wort,
    ]));

    // Auch der Umriss bekommt eine Klappe. Nicht zum Tippen – sondern damit er
    // genau so hoch ist wie ein Kessel und die Reihe nicht springt, wenn der
    // eine den anderen ablöst.
    node.append(feld, baueGriff(null));
    return node;
  }

  function zeigePlatz(anteil) {
    if (!platz) {
      platz = bauePlatz();
      reihe?.append(platz);
    }
    const voll = Math.max(0, Math.min(1, anteil));
    platzBogen?.setAttribute("stroke-dashoffset", (UMFANG * (1 - voll)).toFixed(1));
    platz.classList.toggle("ist-nah", voll > 0.7);
  }

  function raeumePlatz() {
    platz?.remove();
    platz = null;
    platzBogen = null;
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // halt ist, was vom Atemzug noch übrig ist; pause, was bisher stillstand.
  // faellig sagt, bei welcher gespielten Zeit der nächste Kessel dran ist –
  // eine Marke, die mitwandert, statt einer Rechnung aus der Wanduhr: Sonst
  // müssten die Pausen zweimal abgezogen werden.
  const state = {
    phase: "intro", kessel: [], start: 0, gelaufen: 0, kohle: 0, ende: null,
    halt: 0, pause: 0, faellig: 0,
  };
  let shell = null;
  let reihe = null;
  let platz = null;
  let platzBogen = null;
  let frame = null;
  let letzteZeit = 0;
  let stepTimer = null;

  // Die gespielte Zeit: die Wanduhr ohne die Atempausen. Sie ist die Punktzahl,
  // und sie ist der Takt, nach dem der Verbrauch steigt und der nächste Kessel
  // kommt – alle drei müssen dieselbe Zeit meinen.
  const spielzeit = () => Date.now() - state.start - state.pause;

  const clearStep = () => { if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; } };
  const stopLoop = () => { if (frame) { window.cancelAnimationFrame(frame); frame = null; } };

  // Was von einem angekündigten Kessel übrig ist, wenn die Schicht endet: der
  // Umriss und der angehaltene Atem. Beides gehört nicht auf ein Standbild.
  function stillstand() {
    state.halt = 0;
    reihe?.classList.remove("ist-halt");
    raeumePlatz();
  }

  function neuerKessel() {
    const nummer = state.kessel.length + 1;
    const kessel = {
      nummer,
      wert: START_WERT,
      // Das Grundtempo des Kessels, einmal je Runde gewürfelt.
      tempo: TEMPO[nummer - 1] * zufall.von(1 - STREUUNG, 1 + STREUUNG),
      node: null,
      zeiger: null,
      blatt: null,
      rand: null,
      gefahr: false,
      not: null,
    };
    state.kessel.push(kessel);
    reihe?.append(baueKessel(kessel));
    zeichne(kessel);
    return kessel;
  }

  function zeichne(kessel) {
    kessel.zeiger?.setAttribute("transform", `rotate(${winkel(kessel.wert).toFixed(2)} ${MITTE_X} ${MITTE_Y})`);

    // Wie tief die Anzeige steht, sagt ab TOENUNG_AB nicht mehr nur der Zeiger,
    // sondern das Zifferblatt: Das Weiss läuft stetig nach Rot, der Rand
    // dunkler mit. Stetig ist der Punkt – ein Schwellwert sagt "jetzt", eine
    // Tönung sagt "und wie dringend".
    //
    // Das Hoch macht den Anfang zurückhaltend und das Ende deutlich: Bei halbem
    // Weg ist die Farbe erst zu vier Zehnteln da. Sonst sähe die halbe Reihe
    // dauernd rosa aus, und Rot hiesse nichts mehr.
    const not = Math.min(1, Math.max(0, (TOENUNG_AB - kessel.wert) / TOENUNG_AB)) ** 1.3;
    // In zwanzig Stufen statt Bild für Bild: Ein Attribut, das sich sechzigmal
    // in der Sekunde um ein Tausendstel ändert, kostet Arbeit und sieht gleich
    // aus.
    const stufe = Math.round(not * 20) / 20;
    if (stufe !== kessel.not) {
      kessel.not = stufe;
      kessel.blatt?.setAttribute("fill", mische(BLATT_HELL, BLATT_ROT, stufe));
      kessel.rand?.setAttribute("fill", mische(RAND_HELL, RAND_ROT, stufe));
      kessel.node?.style.setProperty("--hz-not", String(stufe));
    }

    // Zwei Zustände, die man aus dem Augenwinkel erkennen muss: "gleich aus"
    // und "Finger weg". Beides steht am Knopf, nicht nur am Zeiger – ein
    // Rahmen ist grösser als eine Nadel.
    const gefahr = kessel.wert > GEFAHR;
    const knapp = kessel.wert < MAHNUNG;
    if (gefahr !== kessel.gefahr) {
      kessel.node?.classList.toggle("is-gefahr", gefahr);
      kessel.gefahr = gefahr;
    }
    kessel.node?.classList.toggle("is-knapp", knapp && !gefahr);
  }

  // ---------------------------------------------------------------------------
  // Nachlegen
  // ---------------------------------------------------------------------------
  function nachlegen(kessel) {
    if (state.phase !== "play") return;
    if (kessel.wert > GEFAHR) { ende("platzt", kessel); return; }
    kessel.wert = Math.min(VOLL, kessel.wert + KOHLE);
    state.kohle += 1;
    zeichne(kessel);
    kids()?.vibrate?.(8);
    if (!ruhig()) {
      kessel.node?.classList.remove("ist-kohle");
      // Neu anstossen: Ohne das Auslösen des Umbruchs läuft die Bewegung beim
      // zweiten Tipp innerhalb einer Sekunde nicht noch einmal.
      void kessel.node?.offsetWidth;
      kessel.node?.classList.add("ist-kohle");
    }
  }

  // ---------------------------------------------------------------------------
  // Die Schicht
  // ---------------------------------------------------------------------------
  // Der neue Kessel ist da: erst den Umriss weg, dann ihn hin – in dieser
  // Reihenfolge, sonst stünde er hinter seinem eigenen Umriss. Und die Reihe
  // hält die Luft an, damit man ihn ansehen kann, ohne dass es woanders brennt.
  function kesselKommt() {
    raeumePlatz();
    const kessel = neuerKessel();
    state.faellig += KESSEL_DAZU_MS;
    state.halt = HALT_MS;
    reihe?.classList.add("ist-halt");
    // ist-kohle dazu: Der neue Kessel wird angefeuert, und das sieht aus wie
    // Anfeuern. Wer weniger Bewegung eingestellt hat, sieht beides nicht –
    // gehalten wird trotzdem, denn der Atemzug ist Spiel, nicht Zierde.
    kessel.node?.classList.add("ist-neu", "ist-kohle");
    kids()?.playJingle?.("star");
    kids()?.vibrate?.(14);
  }

  function step(now) {
    frame = window.requestAnimationFrame(step);
    if (state.phase !== "play") return;

    // Der Schritt wird gedeckelt: Bleibt ein Bild einmal aus – eine lange
    // Rechenpause, ein ruckelndes Gerät –, fielen die Zeiger sonst auf einen
    // Schlag. Für den längeren Fall, den Tab im Hintergrund, reicht der Deckel
    // nicht; darum steht weiter unten, dass Weggehen die Schicht beendet.
    let dt = Math.min(0.05, Math.max(0, (now - letzteZeit) / 1000));
    letzteZeit = now;

    // Der Atemzug nach einem neuen Kessel. Was von diesem Bild noch übrig ist,
    // läuft danach ganz normal weiter – so ist der Halt auf die Millisekunde
    // so lang, wie er sein soll, und kein Bruchteil geht verloren.
    if (state.halt > 0) {
      const still = Math.min(state.halt, dt * 1000);
      state.halt -= still;
      state.pause += still;
      dt -= still / 1000;
      if (state.halt <= 0) {
        state.halt = 0;
        reihe?.classList.remove("ist-halt");
      }
    }

    const gelaufen = spielzeit();
    const faktor = 1 + ZUNAHME * (gelaufen / 1000);

    if (dt > 0) {
      for (const kessel of state.kessel) {
        kessel.wert -= kessel.tempo * faktor * dt;
        if (kessel.wert <= 0) { kessel.wert = 0; zeichne(kessel); ende("aus", kessel); return; }
        zeichne(kessel);
      }
    }

    if (state.kessel.length < KESSEL_MAX) {
      const bis = state.faellig - gelaufen;
      if (bis <= 0) kesselKommt();
      else if (bis <= VORSCHAU_MS) zeigePlatz(1 - bis / VORSCHAU_MS);
    }

    shell.setCount(Math.floor(gelaufen / 1000));
  }

  function ende(grund, kessel) {
    if (state.phase !== "play") return;
    state.phase = "over";
    state.ende = grund;
    // Jetzt stehenbleiben, nicht erst auf der Ergebnistafel: Der Nachlauf, in
    // dem der erloschene Kessel noch zu sehen ist, gehört nicht zur Schicht.
    state.gelaufen = spielzeit();
    stillstand();
    stopLoop();
    shell.stopClock();
    if (kessel?.node) kessel.node.classList.add(grund === "platzt" ? "ist-geplatzt" : "ist-aus");
    kids()?.playJingle?.("retry");
    kids()?.vibrate?.([20, 40, 20]);
    // Einen Wimpernschlag stehen lassen: Man soll sehen, welcher Kessel es war.
    stepTimer = window.setTimeout(() => ergebnis(), 700);
  }

  function schichtEnde() {
    if (state.phase !== "play") return;
    state.phase = "over";
    state.ende = "schicht";
    // Wer die ganze Schicht steht, bekommt die ganze Schicht: Die Uhr der Bühne
    // läuft nach der Wanduhr, die Punkte nach der gespielten Zeit, und um die
    // Atemzüge dazwischen wird hier nicht gefeilscht.
    state.gelaufen = SCHICHT_MS;
    stillstand();
    stopLoop();
    kids()?.playJingle?.("win");
    if (!ruhig()) kids()?.burstConfetti?.();
    stepTimer = window.setTimeout(() => ergebnis(), 600);
  }

  const sekundenWort = (zehntel) => (zehntel / 10).toFixed(1).replace(".", ",");

  function grundText() {
    if (state.ende === "platzt") return "Das Ventil ist geplatzt.";
    if (state.ende === "aus") return "Ein Feuer ist ausgegangen.";
    if (state.ende === "weg") return "Du hast den Kessel allein gelassen.";
    return "Die Schicht ist zu Ende – durchgehalten bis zum Schluss.";
  }

  function resultSpeech(zehntel, rekord) {
    const wie = `Du hast ${sekundenWort(zehntel)} Sekunden durchgehalten.`;
    const lob = rekord ? "Das ist dein bester Lauf." : "";
    return `${wie} ${grundText()} ${lob}`.trim();
  }

  function ergebnis() {
    clearStep();
    const punkte = Math.max(0, Math.round(Math.min(SCHICHT_MS, state.gelaufen) / 100));
    const vorher = Math.max(0, ...(store.read().scores || [0]));
    recordRun(punkte);
    shell.showResult({
      label: "Punkte",
      points: punkte,
      detail: `${sekundenWort(punkte)} Sekunden · ${state.kohle} Mal Kohle`,
      speech: resultSpeech(punkte, punkte > vorher),
    });
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function showIntro() {
    clearStep();
    stopLoop();
    shell.stopClock();
    shell.closeOverlay();
    shell.setPhase("intro");
    state.phase = "intro";
    state.kessel = [];
    state.kohle = 0;
    state.ende = null;
    state.halt = 0;
    state.pause = 0;
    shell.setCount(0);
    raeumePlatz();
    reihe = null;

    shell.clear();
    shell.play.append(shell.el("p", "cm-prompt", "Halte die Kessel am Leben."));

    // Zwei Zifferblätter als Beispiel, ohne ein Wort dazu: links einer, der
    // gleich ausgeht, rechts einer, bei dem der Zeiger im roten Feld steht.
    // Was zu tun und was zu lassen ist, sieht man daran schneller als an
    // einem Satz.
    const demo = shell.el("div", "hz-demo");
    [
      { wert: 10, text: "nachlegen" },
      { wert: 88, text: "Finger weg" },
    ].forEach((beispiel) => {
      const kachel = shell.el("div", "hz-demo-kessel");
      // Ohne Nummer: Auf der Tastatur führt hier keine Taste hin.
      const platte = { nummer: null, wert: beispiel.wert };
      const knopf = baueKessel(platte);
      knopf.disabled = true;
      // Dieselbe Hand wie im Spiel: zeichne setzt Zeiger, Tönung und Ring. Wer
      // die glühend rote Uhr einmal im Startbild gesehen hat, erkennt sie
      // später, ohne hinzusehen.
      zeichne(platte);
      kachel.append(knopf, shell.el("span", "hz-demo-wort", beispiel.text));
      demo.append(kachel);
    });
    shell.play.append(demo);

    const start = shell.el("button", "cm-start", "Starten");
    start.type = "button";
    start.addEventListener("click", beginRound);
    shell.play.append(start);
  }

  function beginRound() {
    clearStep();
    stopLoop();
    // Im Turnier ist der zweite Versuch dieselbe Schicht wie der erste.
    zufall.neu();
    state.phase = "play";
    state.kessel = [];
    state.kohle = 0;
    state.ende = null;
    state.gelaufen = 0;
    state.halt = 0;
    state.pause = 0;
    state.faellig = KESSEL_DAZU_MS;
    state.start = Date.now();
    letzteZeit = performance.now();
    shell.setPhase("play");
    shell.setCount(0);

    shell.clear();
    shell.play.append(shell.el("p", "cm-prompt hz-tafel", "Nie auf null. Nie ins Rote tippen."));
    raeumePlatz();
    reihe = shell.el("div", "hz-reihe");
    shell.play.append(reihe);

    for (let i = 0; i < KESSEL_START; i += 1) neuerKessel();

    frame = window.requestAnimationFrame(step);
    shell.startClock(SCHICHT_MS, schichtEnde);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Der Heizer",
    area: "konzentration",
    accent: "#00A5B5",
    accentDark: "#00707c",
    help: HELP,
    onRestart: showIntro,
  });

  showIntro();

  // --- Tastatur --------------------------------------------------------------
  // Mit einer Maus ist Tippen auf fünf Ziele langsamer als mit zwei Daumen.
  // Die Zifferntasten sind kein Komfort, sie halten das Spiel am Schreibtisch
  // spielbar.
  document.addEventListener("keydown", (event) => {
    if (state.phase === "play") {
      const nummer = Number(event.key);
      if (nummer >= 1 && nummer <= KESSEL_MAX) {
        const kessel = state.kessel[nummer - 1];
        if (kessel) { event.preventDefault(); nachlegen(kessel); }
      }
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      if (document.activeElement?.tagName === "BUTTON") return;
      event.preventDefault();
      if (state.phase === "intro") beginRound();
    }
  });

  // --- Weggehen beendet die Schicht ------------------------------------------
  // Ein Tab im Hintergrund bekommt keine Bilder mehr: Die Zeiger fielen nicht,
  // die Uhr der Bühne liefe nach der Wanduhr weiter, und nach zwei Minuten
  // stünde die volle Punktzahl da für eine Schicht, in der niemand Kohle
  // nachgelegt hat. Auf einer Bestenliste, in die jeder ohne Konto schreiben
  // darf, ist das kein Schönheitsfehler, sondern der kürzeste Weg nach oben.
  //
  // Die Runde deswegen anzuhalten und beim Zurückkommen weiterlaufen zu lassen
  // wäre die freundlichere Lösung – aber dann wäre jeder Wechsel eine Pause
  // zum Nachdenken, und Nachdenken ist hier genau das, wofür die Zeit nicht
  // reicht. Also endet die Schicht, und was bis dahin geschafft ist, zählt.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.phase === "play") ende("weg");
  });

  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });
})();
