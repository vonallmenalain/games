/*
 * turnier.js – Der Turniermodus.
 * ---------------------------------------------------------------------------
 * Ein Turnier ist eine Bestenliste mit einem Anfang und einem Ende. Angelegt
 * wird es im Adminbereich (admin.js): welche Spiele, wie lange, wie viele
 * Versuche, wie gewertet wird – und ob es auf der Startseite steht oder nur
 * über seinen Link zu finden ist. Hier wird es gespielt.
 *
 * Drei Orte, drei Aufgaben:
 *
 *   /turnier?t=<id>        die Turnierseite: wie lange noch, die Spiele mit
 *                          ihrer Rangliste, die Gesamtwertung, die Regeln in
 *                          ganzen Sätzen und der Link zum Weitergeben.
 *   /                      die Startseite: ein Hinweis auf jedes öffentliche
 *                          Turnier, das läuft, bald beginnt oder eben zu Ende
 *                          gegangen ist.
 *   /turmbau?turnier=<id>  ein Spiel im Turnier: erst eine Tafel mit dem Stand
 *                          und einem Knopf, dann das Spiel wie immer. Ein
 *                          Versuch zählt ab seinem Beginn; sein Ergebnis geht
 *                          ins Turnier und in die ewige Liste.
 *
 * Mitspielen geht ohne Konto, wie alles hier: Name und Kennung gehören dem
 * Gerät (mini-games.js). Was das Turnier gegen Schummeln schützt und was
 * nicht, steht in firestore.rules.
 */
(() => {
  "use strict";

  const cloud = () => window.MiniCloud || null;
  const mini = () => window.LernappMini || null;
  const hs = () => window.LernappHighscore || null;
  const zufall = () => window.LernappZufall || null;

  // ---------------------------------------------------------------------------
  // Wo sind wir?
  // ---------------------------------------------------------------------------
  const seite = () => document.body?.dataset?.page || "";
  const spielHier = () => document.body?.dataset?.spiel || "";

  function ausDerAdresse(name) {
    try { return (new URLSearchParams(window.location.search).get(name) || "").trim().slice(0, 64); }
    catch { return ""; }
  }

  // Auf einer Spielseite heisst der Parameter "turnier" – so hat ihn zufall.js
  // schon immer gelesen, für die Saat. Auf der Turnierseite ist es das kurze
  // "t": Diesen Link schickt man herum.
  const aufSpielseite = () => Boolean(spielHier() && ausDerAdresse("turnier"));
  const aufTurnierseite = () => seite() === "turnier";

  const seitenLink = (id) => `/turnier?t=${encodeURIComponent(id)}`;

  // ---------------------------------------------------------------------------
  // Die Turnier-App: ein Raum ohne Ausgang
  // ---------------------------------------------------------------------------
  /*
   * Wer ein Turnier als App auf dem Startbildschirm hat (alsApp), bleibt
   * darin – kein Weg führt in die Hall of Fame. Das Fenster merkt sich, mit
   * welchem Turnier es begann (sessionStorage: nur dieses Fenster der App,
   * nicht der Browser daneben): War die erste Seite die eines Turniers und
   * läuft die Seite als App, ist das Turnier ihr Zuhause (heim). Dann
   *
   *   - führt der Weg zurück in jedem Spiel zum Turnier (ziel), auch beim
   *     Anschauen eines Laufs und in einem Spiel ohne ?turnier=,
   *   - und wer trotzdem auf der Startseite oder in einem Spiel ausserhalb
   *     des Turniers landet – ein vergessener Link, die Ersatzseite des
   *     Service Workers ohne Netz –, kommt sofort zurück ins Turnier.
   *
   * Im Browser bleibt alles, wie es ist: Dort gibt es eine Adresszeile, und
   * wer das Turnier nur mit Link kennt, soll trotzdem die Hall of Fame
   * öffnen können.
   */
  const HEIM_KEY = "mini.heimTurnier";
  const SITZUNG_KEY = "mini.sitzung";

  function alsAppOffen() {
    try {
      if (window.navigator.standalone === true) return true;
      const passt = (frage) => Boolean(window.matchMedia?.(frage).matches);
      if (passt("(display-mode: standalone)") || passt("(display-mode: minimal-ui)")) return true;
      // Ein Browser im Vollbild meldet dasselbe wie eine App – beim Laden der
      // ersten Seite hat aber noch niemand das Vollbild verlangt.
      return passt("(display-mode: fullscreen)") && !document.fullscreenElement && !document.webkitFullscreenElement;
    } catch { return false; }
  }

  const heim = (() => {
    try {
      let id = sessionStorage.getItem(HEIM_KEY) || "";
      if (!sessionStorage.getItem(SITZUNG_KEY)) {
        sessionStorage.setItem(SITZUNG_KEY, "1");
        const erste = seite() === "turnier" ? ausDerAdresse("t") : ausDerAdresse("turnier");
        if (erste && alsAppOffen()) {
          sessionStorage.setItem(HEIM_KEY, erste);
          id = erste;
        }
      }
      return /^[a-z0-9-]{1,64}$/.test(id) ? id : "";
    } catch { return ""; }
  })();

  // Zuhause ist das Turnier: Die Startseite und ein Spiel, das zu keinem
  // Turnier gehört, führen sofort dorthin zurück. Erlaubt bleiben ein Spiel
  // im Turnier, das Anschauen eines Laufs daraus (aus=), eine Runde eines
  // Multiplayers (live=), der Multiplayer selbst und der Adminbereich.
  if (heim) {
    let frei = true;
    try {
      const p = new URLSearchParams(window.location.search);
      const hier = seite();
      frei = hier === "turnier" || hier === "live" || hier === "admin"
        || (spielHier() && (p.has("turnier") || p.has("aus") || p.has("live")));
    } catch { frei = true; }
    if (!frei) window.location.replace(seitenLink(heim));
  }
  const spielLink = (id, spiel) => `${mini()?.spielLink?.(spiel) || "/"}?turnier=${encodeURIComponent(id)}`;
  const volleAdresse = (id) => `${window.location.origin}${seitenLink(id)}`;

  // ---------------------------------------------------------------------------
  // Die Uhr des Turniers
  // ---------------------------------------------------------------------------
  const MINUTE = 60 * 1000;
  const STUNDE = 60 * MINUTE;
  const TAG = 24 * STUNDE;
  // So lange steht ein beendetes Turnier noch auf der Startseite: lange
  // genug, dass alle am Abend oder am Morgen danach das Ergebnis sehen –
  // nicht so lange, dass die Startseite zur Chronik wird. Bis Oktober 2026
  // waren es drei Tage. Wer mitgespielt hat, findet es danach unter seinem
  // Namen oben rechts (meineTurniere).
  const NACHLESE_MS = 12 * STUNDE;

  // Ein Turnier ohne Zeitlimite läuft, bis es angehalten, beendet oder
  // gelöscht wird. Ein Ende hat es trotzdem – so weit draussen, dass es nie
  // kommt: Die Regeln rechnen mit endeMs (firestore.rules, imZeitraum), und so
  // rechnen sie weiter, ohne etwas Neues lernen zu müssen. Wo ein Ende so weit
  // weg liegt, steht überall "ohne Zeitlimite" statt eines Datums.
  // "Jetzt beenden" setzt das Ende auf jetzt – dann ist es ein Turnier wie
  // jedes andere, das vorbei ist.
  const OHNE_ENDE = Date.UTC(9999, 11, 31);
  const ohneEnde = (t) => (Number(t?.endeMs) || 0) >= OHNE_ENDE;

  // Wo ein Turnier gerade steht. Ein beendetes ist beendet, auch wenn es
  // zuletzt angehalten war: Dann gilt die Liste, wie sie ist.
  function lage(t, jetzt = Date.now()) {
    if (!t) return "fehlt";
    if (jetzt >= t.endeMs) return "beendet";
    if (!t.aktiv) return "angehalten";
    if (jetzt < t.startMs) return "geplant";
    return "laeuft";
  }

  // "2 Tage", "1 Tag 5 Std.", "3 Std. 20 Min.", "7 Min." – genau genug für
  // eine Frage, die man beim Vorbeigehen stellt.
  function dauer(ms) {
    const rest = Math.max(0, ms);
    if (rest >= 2 * TAG) return `${Math.floor(rest / TAG)} Tage`;
    if (rest >= TAG) {
      const std = Math.floor((rest - TAG) / STUNDE);
      return std ? `1 Tag ${std} Std.` : "1 Tag";
    }
    if (rest >= STUNDE) {
      const std = Math.floor(rest / STUNDE);
      const min = Math.floor((rest % STUNDE) / MINUTE);
      return min ? `${std} Std. ${min} Min.` : `${std} Std.`;
    }
    return `${Math.max(1, Math.ceil(rest / MINUTE))} Min.`;
  }

  // Von Hand statt toLocaleString: "Sa 27.09., 14:00" soll auf jedem Gerät
  // gleich aussehen, und die Browser sind sich bei den Kurzformen nicht einig.
  const WOCHENTAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const zwei = (n) => String(n).padStart(2, "0");
  const uhr = (d) => `${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
  function datum(ms) {
    const d = new Date(ms);
    return `${WOCHENTAG[d.getDay()]} ${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}., ${uhr(d)}`;
  }

  function zeitraum(t) {
    if (ohneEnde(t)) return `ab ${datum(t.startMs)}, ohne Zeitlimite`;
    const bis = new Date(t.endeMs);
    const gleicherTag = new Date(t.startMs).toDateString() === bis.toDateString();
    return `${datum(t.startMs)} bis ${gleicherTag ? uhr(bis) : datum(t.endeMs)}`;
  }

  function statusText(t, jetzt = Date.now()) {
    switch (lage(t, jetzt)) {
      case "laeuft":
        if (ohneEnde(t)) return "läuft ohne Zeitlimite";
        return t.endeMs - jetzt < MINUTE ? "endet gleich" : `läuft noch ${dauer(t.endeMs - jetzt)}`;
      case "geplant": return t.startMs - jetzt < MINUTE ? "beginnt gleich" : `beginnt in ${dauer(t.startMs - jetzt)}`;
      case "angehalten": return "angehalten";
      case "beendet": return `beendet ${datum(t.endeMs)}`;
      default: return "";
    }
  }

  // Die Zeile unter dem Namen: wie lange noch, und bis wann genau.
  function statusZeile(t, jetzt = Date.now()) {
    const l = lage(t, jetzt);
    if (l === "laeuft") return ohneEnde(t) ? `${statusText(t, jetzt)} · seit ${datum(t.startMs)}` : `${statusText(t, jetzt)} · bis ${datum(t.endeMs)}`;
    if (l === "geplant") return `${statusText(t, jetzt)} · ${zeitraum(t)}`;
    if (l === "angehalten") return `angehalten · ${zeitraum(t)}`;
    return statusText(t, jetzt);
  }

  // ---------------------------------------------------------------------------
  // Die Regeln in Worten
  // ---------------------------------------------------------------------------
  const titel = (spiel) => hs()?.titel?.(spiel) || spiel;
  const einheit = (spiel) => hs()?.spiel?.(spiel)?.einheit || "Punkte";
  const zahlWort = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;

  // ---------------------------------------------------------------------------
  // Die Wertung
  // ---------------------------------------------------------------------------
  // Die Rangliste eines Spiels im Turnier – dieselbe Rechnung wie in der
  // ewigen Liste (mini-games.js): ein Name eine Zeile, gleiche Zahl gleicher
  // Platz, wer früher dort war, steht bei Gleichstand oben.
  const rangliste = (eintraege, spiel) => mini()?.rangliste?.(eintraege.filter((e) => e.game === spiel)) || [];
  // Ein Name eine Person – so, wie die Gesamtwertung Namen zusammenfasst.
  const namensSchluessel = (name) => String(name || "").toLocaleLowerCase("de");

  // Darf man in diesem Turnier zuschauen – live (mitschauen) wie beim
  // Replay? Nicht ohne Replays und nicht, solange die Rangliste verdeckt ist:
  // Zuschauen hiesse sonst, die Punkte doch zu sehen.
  const mitschauenErlaubt = (t) => Boolean(t) && !t.ohneReplay && !(t.verdeckt && lage(t) !== "beendet");
  // Der Weg in den Beobachtungsmodus (geist.js, mitschauer): das Spiel, das
  // er gerade spielt – oder, spielt er nicht, das erste des Turniers. Von
  // dort folgt die Seite ihm von selbst.
  const mitschauLink = (t, spieler, name, spiel = "") => `${mini()?.spielLink?.(spiel || t.spiele[0]) || "/"}?mitschauen=${encodeURIComponent(spieler)}&aus=${encodeURIComponent(t.id)}&wer=${encodeURIComponent(name)}`;

  /*
   * "Nur wer nicht vorne liegt" (spitzeWartet): Wer in einem Spiel allein auf
   * Platz 1 steht, wartet dort, bis ihn jemand einholt oder überholt. Die
   * anderen spielen, so oft sie wollen. Wer überall vorne liegt, hat keinen
   * Versuch mehr – bis jemand nachzieht.
   *
   * Allein vorne heisst: der einzige Name auf Platz 1, und mit mehr als null.
   * Bei Gleichstand an der Spitze führt niemand, dann dürfen alle weiter, die
   * gleichauf sind – sonst stünden zwei, die gleich viel haben, für immer
   * still, und der Gleichstand liesse sich nie mehr brechen. Und wer mit null
   * oben steht, weil sonst noch niemand gespielt hat, liegt nicht vorne: Ein
   * abgebrochener erster Versuch soll niemanden aussperren.
   *
   * Das prüft die Seite, nicht die Datenbank: Wer vorne liegt, steht in allen
   * Einträgen eines Spiels, und eine Regel kann keine Liste befragen
   * (firestore.rules, istTurnier).
   */
  function alleinVorne(liste) {
    const vorne = liste.filter((e) => e.platz === 1);
    return vorne.length === 1 && Boolean(vorne[0].eigen) && (Number(vorne[0].punkte) || 0) > 0;
  }

  /*
   * Wer gerade spielt – aus den Einträgen mit offenem Versuch (cloud.js,
   * turnierAmSpielen). Offen heisst noch nicht spielend: Wer mittendrin
   * weggeht, lässt seinen Versuch offen, bis zum nächsten. Gespielt wird,
   * solange das Spiel seine Uhrzeit neu setzt (lebenszeichen, alle zwanzig
   * Sekunden) – wer seit AKTIV_MS keines mehr gegeben hat, spielt nicht mehr.
   *
   * Verglichen wird nicht nur die Uhr des Spielers mit der eigenen: Geht eine
   * der beiden falsch, stimmte das nie. Ändert sich die Zeit eines Eintrags
   * zwischen zwei Blicken, hat sich das Spiel eben gemeldet – das zählt ab
   * dem Blick, der es sah. Nur beim ersten Blick bleibt die Uhrzeit selbst.
   *
   * Das eigene Gerät spielt nie: Wer die Turnierseite ansieht, spielt nicht
   * gerade – ein offener Versuch von ihm ist einer, den er liegen liess.
   */
  const AKTIV_MS = 50000;
  const beobachtet = new Map();
  function amSpielen(offen, jetzt = Date.now(), ohne = "") {
    const da = new Set();
    const spielen = [];
    (offen || []).forEach((e) => {
      if (!e?.id) return;
      da.add(e.id);
      const stempel = Number(e.updatedAtMs) || 0;
      const alt = beobachtet.get(e.id);
      if (!alt || alt.stempel !== stempel) beobachtet.set(e.id, { stempel, seitMs: alt ? jetzt : Math.min(jetzt, stempel) });
      if (e.offen === false || (ohne && e.spieler === ohne)) return;
      if (jetzt - beobachtet.get(e.id).seitMs < AKTIV_MS) spielen.push({ name: e.name, game: e.game, spieler: e.spieler });
    });
    [...beobachtet.keys()].forEach((k) => { if (!da.has(k)) beobachtet.delete(k); });
    return spielen.sort((a, b) => a.name.localeCompare(b.name, "de") || a.game.localeCompare(b.game));
  }

  /*
   * Die Gesamtwertung über alle Spiele des Turniers.
   *
   *   platz     Platz im Schnitt: der Durchschnitt der Plätze aus den
   *             Spielen, die jemand gespielt hat. Der kleinste gewinnt.
   *   prozent   In jedem Spiel bekommt der Beste 100, alle anderen ihren
   *             Anteil an seiner Zahl. Der höchste Schnitt gewinnt. Anders
   *             als bei den Plätzen zählt hier, wie knapp jemand dran war.
   *
   * Gezählt wird nur, was jemand gespielt hat – wie in der Hall of Fame
   * (mini-games.js, auswertung). Wer erst ein Spiel von dreien gespielt hat,
   * steht deshalb nicht hinter allen, die alle drei haben. Bis Oktober 2026
   * zählte ein ausgelassenes Spiel als Platz hinter dem Letzten (bei Prozent
   * als 0) – wer später dazukam oder ein Spiel nicht mochte, lag damit fast
   * sicher hinten. Bei gleichem Schnitt steht vorne, wer mehr gespielt hat;
   * den Platz teilen sie sich trotzdem.
   *
   * Die Punkte selbst zusammenzuzählen wäre sinnlos: 40 Blöcke im Turmbau und
   * 40 Fische im Teich sind nicht dasselbe.
   *
   * Dazu die Multiplayer, die zum Turnier gehören (live.js): Ihr Endstand
   * zählt wie ein weiteres Spiel, mal ihr Gewicht (×1, ×2, ×3; 0 zählt gar
   * nicht) – im Schnitt also wie zwei oder drei Spiele. Wer einen verpasst
   * hat, für den zählt er nicht, wie ein ausgelassenes Spiel. In einem
   * Turnier, das nur im Multiplayer gespielt wird, zählen nur sie.
   *
   * wert ist die Zahl, nach der geordnet wird (der Schnitt, auf zwei
   * Stellen), wertText dieselbe zum Zeigen: «1,33» oder «87».
   */
  function gesamtwertung(t, eintraege, abende = []) {
    const spiele = t.nurLive ? [] : t.spiele;
    const listen = new Map(spiele.map((spiel) => [spiel, rangliste(eintraege, spiel)]));
    const live = (abende || []).filter((a) => a && a.gewicht > 0 && Array.isArray(a.endstand) && a.endstand.length);
    const personen = new Map();
    const person = (name, eigen) => {
      const schluessel = namensSchluessel(name);
      if (!personen.has(schluessel)) personen.set(schluessel, { name, eigen: false, je: {}, abende: {} });
      const p = personen.get(schluessel);
      p.eigen = p.eigen || Boolean(eigen);
      return p;
    };
    const kennung = mini()?.kennungFallsDa?.() || "";
    live.forEach((a) => {
      const bester = a.endstand.reduce((max, e) => Math.max(max, Number(e.punkte) || 0), 0);
      a.endstand.forEach((e) => {
        const p = person(e.name, kennung && e.spieler === kennung);
        const punkte = Number(e.punkte) || 0;
        p.abende[a.id] = { platz: e.platz, punkte, prozent: bester > 0 ? (punkte / bester) * 100 : 0 };
      });
    });
    for (const [spiel, liste] of listen) {
      const bester = liste.reduce((max, e) => Math.max(max, Number(e.punkte) || 0), 0);
      for (const e of liste) {
        const p = person(e.name, e.eigen);
        const punkte = Number(e.punkte) || 0;
        p.je[spiel] = { platz: e.platz, punkte, prozent: bester > 0 ? (punkte / bester) * 100 : 0 };
      }
    }

    const prozent = t.wertung === "prozent";
    const alle = [...personen.values()].map((p) => {
      // Was gespielt ist, mit seinem Gewicht: ein Spiel 1, ein Multiplayer
      // so viel, wie er zählt.
      const teile = [
        ...spiele.filter((spiel) => p.je[spiel]).map((spiel) => [p.je[spiel], 1]),
        ...live.filter((a) => p.abende[a.id]).map((a) => [p.abende[a.id], a.gewicht]),
      ];
      const gewicht = teile.reduce((summe, [, g]) => summe + g, 0) || 1;
      const schnitt = teile.reduce((summe, [je, g]) => summe + (prozent ? je.prozent : je.platz) * g, 0) / gewicht;
      const wert = prozent ? Math.round(schnitt) : Math.round(schnitt * 100) / 100;
      return { ...p, gespielt: teile.length, wert, wertText: String(wert).replace(".", ",") };
    });
    alle.sort((a, b) => (prozent ? b.wert - a.wert : a.wert - b.wert)
      || b.gespielt - a.gespielt
      || a.name.localeCompare(b.name, "de"));

    let platz = 0;
    alle.forEach((person, i) => {
      if (i === 0 || person.wert !== alle[i - 1].wert) platz = i + 1;
      person.platz = platz;
    });
    return { personen: alle, listen, abende: live, teile: spiele.length + live.length };
  }

  // ---------------------------------------------------------------------------
  // Bausteine
  // ---------------------------------------------------------------------------
  function el(tag, klasse, text) {
    const knoten = document.createElement(tag);
    if (klasse) knoten.className = klasse;
    if (text !== undefined) knoten.textContent = text;
    return knoten;
  }

  function knopf(text, klasse, beiKlick) {
    const node = el("button", `mini-knopf ${klasse || ""}`.trim(), text);
    node.type = "button";
    node.addEventListener("click", beiKlick);
    return node;
  }

  // Der Pokal, derselbe wie unter dem Ergebnis (game-shell.js).
  function pokal(klasse = "tn-pokal") {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", klasse);
    const teil = (d, voll) => {
      const weg = document.createElementNS(NS, "path");
      weg.setAttribute("d", d);
      if (voll) weg.setAttribute("fill", "currentColor");
      else {
        weg.setAttribute("fill", "none");
        weg.setAttribute("stroke", "currentColor");
        weg.setAttribute("stroke-width", "2.2");
        weg.setAttribute("stroke-linecap", "round");
      }
      svg.append(weg);
    };
    teil("M7 4h10v4a5 5 0 0 1-10 0z", true);
    teil("M7 6H4.5v1.5A3.5 3.5 0 0 0 8 11M17 6h2.5v1.5A3.5 3.5 0 0 1 16 11", false);
    teil("M12 13v4m-3.5 3h7", false);
    return svg;
  }

  // ---------------------------------------------------------------------------
  // Das Turnier als eigene App
  // ---------------------------------------------------------------------------
  /*
   * Wer im Turnier "Zum Startbildschirm" wählt, soll dort das Turnier haben:
   * mit seinem Namen und direkt auf der Turnierseite – nicht die Mini-Games
   * mit der Hall of Fame. Das Manifest der Site sagt "Mini-Games" und "/";
   * sobald das Turnier gelesen ist, bekommt die Seite ein eigenes. Gebaut
   * wird es hier, im Browser, als Blob: Ein Turnier "nur mit Link" steht so
   * auf keinem Server in einer Datei. Die Adressen darin sind vollständig –
   * ein Blob hat keine eigene, gegen die sich "/" auflösen liesse – und die
   * id ist die des Turniers, damit es neben den Mini-Games als zweite App
   * Platz hat.
   *
   * Safari auf dem iPhone liest ein solches Manifest nicht. Es nimmt den
   * Namen aus apple-mobile-web-app-title und als Start die Seite, auf der
   * man gerade ist – und die steht ja im Turnier.
   */
  let appFuer = "";
  function alsApp(t) {
    if (!t?.id || !t.name) return;
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute("content", t.name);
    document.querySelector('meta[name="application-name"]')?.setAttribute("content", t.name);
    const link = document.querySelector('link[rel="manifest"]');
    const schluessel = `${t.id}\n${t.name}`;
    if (!link || appFuer === schluessel || typeof Blob !== "function" || !window.URL?.createObjectURL) return;
    appFuer = schluessel;
    const quelle = link.dataset.quelle || link.href;
    link.dataset.quelle = quelle;
    fetch(quelle).then((antwort) => antwort.json()).then((basis) => {
      if (appFuer !== schluessel) return;
      const voll = (pfad) => new URL(pfad, quelle).href;
      const start = voll(seitenLink(t.id));
      const manifest = {
        ...basis,
        id: start,
        name: t.name,
        short_name: t.name,
        description: `Turnier in der arcade: ${t.name}`,
        start_url: start,
        scope: voll(basis.scope || "/"),
        icons: (Array.isArray(basis.icons) ? basis.icons : []).map((icon) => ({ ...icon, src: voll(icon.src) })),
      };
      const alt = link.href;
      link.href = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }));
      if (alt.startsWith("blob:")) URL.revokeObjectURL(alt);
    }).catch(() => { appFuer = ""; });
  }

  // ---------------------------------------------------------------------------
  // Die Turniere, die dieses Gerät kennt
  // ---------------------------------------------------------------------------
  /*
   * Jedes Turnier, das hier geöffnet wird – auch eines nur mit Link –, merkt
   * sich das Gerät, das zuletzt geöffnete zuerst. Die Startseite zeigt es
   * dann neben den öffentlichen (hinweis): Wer die App auf dem
   * Startbildschirm hat und den Link einmal angeklickt hat, findet das
   * Turnier dort wieder, ohne den Link noch einmal zu suchen.
   *
   * Auf Android teilen sich der Browser und die installierte App diesen
   * Speicher. Auf dem iPhone nicht: Dort kennt die App auf dem
   * Startbildschirm nur, was in ihr selbst geöffnet wurde.
   */
  const GEMERKT_KEY = "mini.turniere";
  const GEMERKT_MAX = 10;

  function gemerkteTurniere() {
    try {
      const roh = JSON.parse(localStorage.getItem(GEMERKT_KEY) || "[]");
      return Array.isArray(roh) ? roh.filter((id) => typeof id === "string" && id) : [];
    } catch { return []; }
  }

  function schreibeGemerkte(liste) {
    try { localStorage.setItem(GEMERKT_KEY, JSON.stringify(liste.slice(0, GEMERKT_MAX))); } catch { /* privater Modus */ }
  }

  const merke = (id) => { if (id) schreibeGemerkte([id, ...gemerkteTurniere().filter((x) => x !== id)]); };
  const vergiss = (id) => schreibeGemerkte(gemerkteTurniere().filter((x) => x !== id));

  /*
   * Deine Turniere: die, in denen auf diesem Gerät gespielt wurde – unter dem
   * eigenen Namen oben rechts auf der Startseite (mini-games.js, nameChip),
   * auch wenn sie längst nicht mehr in der Zeile stehen (NACHLESE_MS).
   *
   * Gemerkt wird auf dem Gerät, nicht in der Datenbank: Ein Konto gibt es
   * nicht, und über alle Turniere hinweg nach einem Namen zu fragen, liessen
   * die Regeln nicht zu. Dabei ist ein Turnier, sobald hier ein Versuch
   * beginnt (rundeBeginnt) – oder sobald die Turnierseite den eigenen Namen
   * in der Gesamtwertung findet: So steht es auch da, wenn man unter
   * demselben Namen auf einem anderen Gerät gespielt hat und hier nur
   * hineinschaut.
   */
  const DABEI_KEY = "mini.turniere.dabei";
  const DABEI_MAX = 30;
  function dabeiListe() {
    try {
      const roh = JSON.parse(localStorage.getItem(DABEI_KEY) || "[]");
      return Array.isArray(roh) ? roh.filter((id) => typeof id === "string" && /^[a-z0-9-]{1,64}$/.test(id)) : [];
    } catch { return []; }
  }
  function merkeDabei(id) {
    if (!id) return;
    const liste = dabeiListe();
    if (liste[0] === id) return;
    try { localStorage.setItem(DABEI_KEY, JSON.stringify([id, ...liste.filter((x) => x !== id)].slice(0, DABEI_MAX))); } catch { /* privater Modus */ }
  }
  function vergissDabei(id) {
    const liste = dabeiListe();
    if (!liste.includes(id)) return;
    try { localStorage.setItem(DABEI_KEY, JSON.stringify(liste.filter((x) => x !== id))); } catch { /* egal */ }
  }

  /*
   * Die Liste dazu, für das Fenster unter dem Namen: je Turnier sein Name,
   * wie es steht, und der eigene Platz in der Gesamtwertung (bei einer
   * verdeckten bis zum Schluss nicht). Die laufenden zuerst, dann die
   * zuletzt beendeten. Gelesen wird erst, wenn das Fenster aufgeht.
   */
  const DABEI_ZEIGEN = 8;
  function meineTurniere() {
    const ids = dabeiListe();
    if (!ids.length || !cloud()?.turnier) return null;
    const block = el("section", "tn-meine");
    block.append(el("h3", "tn-meine-titel", "Deine Turniere"));
    const liste = el("ol", "tn-meine-liste");
    liste.append(el("li", "tn-meine-leer", "Wird geladen..."));
    block.append(liste);
    const wolke = cloud();
    Promise.all(ids.map((id) => wolke.turnier(id).then((t) => {
      if (!t) vergissDabei(id);
      return t;
    }, () => null))).then(async (turniere) => {
      const jetzt = Date.now();
      const vorbei = (t) => (lage(t, jetzt) === "laeuft" ? 0 : 1);
      const da = turniere.filter(Boolean)
        .sort((a, b) => vorbei(a) - vorbei(b) || b.endeMs - a.endeMs)
        .slice(0, DABEI_ZEIGEN);
      liste.replaceChildren();
      if (!da.length) { block.remove(); return; }
      const zeilen = da.map((t) => {
        const zeile = el("li");
        const link = el("a", "tn-meine-zeile");
        link.href = seitenLink(t.id);
        const texte = el("span", "tn-meine-texte");
        texte.append(el("strong", "", t.name), el("span", "", statusText(t, jetzt)));
        const platz = el("span", "tn-meine-platz");
        link.append(pokal("tn-meine-pokal"), texte, platz);
        zeile.append(link);
        liste.append(zeile);
        return { t, platz };
      });
      // Der eigene Platz: je Turnier seine Einträge – nur für die, die hier
      // stehen, und erst jetzt, wo jemand das Fenster offen hat.
      await Promise.all(zeilen.map(async ({ t, platz }) => {
        if (t.verdeckt && lage(t) !== "beendet") return;
        try {
          const [eintraege, abende] = await Promise.all([
            wolke.turnierErgebnisse(t.id),
            Promise.resolve(wolke.turnierLive?.(t.id)).catch(() => []),
          ]);
          const { personen } = gesamtwertung(t, eintraege || [], abende || []);
          const ich = personen.find((p) => p.eigen);
          if (!ich) return;
          platz.textContent = `${ich.platz}.`;
          platz.title = `Platz ${ich.platz} von ${personen.length}`;
          if (ich.platz <= 3) platz.classList.add(`ist-platz-${ich.platz}`);
          platz.classList.add("ist-da");
        } catch { /* dann eben ohne Platz */ }
      }));
    });
    return block;
  }

  // ---------------------------------------------------------------------------
  // Die Turnierseite
  // ---------------------------------------------------------------------------
  /*
   * Sie sieht aus wie die Startseite und ist ein Bildschirm wie sie
   * (mini-games.js, arcadeBuehne): das Bild des gewählten Spiels, darunter
   * Rangliste und Play, unten die Spiele des Turniers in einer Zeile. Ein
   * Tipp aufs Bild oder auf Play spielt im Turnier.
   *
   * Oben, statt der Marke: der Name des Turniers und in einer Zeile, wie
   * lange es läuft und wie viele Versuche es gibt. Daneben (schmal: darunter)
   * die Gesamtwertung über alle Spiele, die ersten drei – sie zählt im
   * Turnier mehr als jede einzelne Liste. Ein Tipp öffnet die ganze Tabelle,
   * mit der Beschreibung und den Multiplayern des Turniers.
   *
   * Kein Weg hinaus zu den anderen Spielen und der Hall of Fame: Ein Turnier
   * ist ein Raum für sich, gerade eines, das nur kennt, wer den Link hat.
   */
  function turnierSeite(wirt) {
    const id = ausDerAdresse("t");
    const stand = { t: null, eintraege: [], abende: [], zeiger: null, geladenMs: 0, lage: "", spielen: [] };
    const m = mini();
    const { signal } = new AbortController();

    wirt.innerHTML = "";
    wirt.classList.add("ar-seite", "ist-turnier");
    document.body.classList.add("ar");

    // Der Kopf: links Name und Stand des Turniers, rechts der Name, unter dem
    // hier gespielt wird. Ein neuer Name ist im Turnier ein neuer Mitspieler:
    // Was schon gespielt ist, bleibt beim alten Namen, und wer vorne liegt,
    // hängt an der Kennung – darum zeichnet die Seite sich danach neu.
    //
    // Davor, nur bei einem öffentlichen Turnier, das Logo – der Weg zur
    // Startseite. Eines nur mit Link bleibt ein Raum für sich, ohne Weg
    // hinaus; ebenso jedes in seiner eigenen App (heim).
    const titelBlock = el("div", "tn-titel");
    const titelTexte = el("div", "tn-titel-texte");
    const ueberschrift = el("h1", "", "Turnier");
    const status = el("p", "tn-status");
    titelTexte.append(ueberschrift, status);
    titelBlock.append(titelTexte);
    let logo = null;
    const zeigeLogo = (t) => {
      const soll = t?.sichtbar === "alle" && !heim;
      if (soll && !logo) {
        logo = m.marke?.("tn-marke-oben") || null;
        if (logo) titelBlock.prepend(logo);
      } else if (!soll && logo) {
        logo.remove();
        logo = null;
      }
    };
    const { kopf, rechts } = m.arcadeKopf({ signal, links: titelBlock, mitPokal: false, beiNamen: () => { if (stand.t) zeichne(); } });
    // Zwischen Name und Knöpfen: ein Multiplayer, der gerade läuft, und die
    // Gesamtwertung.
    const oben = el("div", "tn-oben");
    kopf.insertBefore(oben, rechts);
    wirt.append(kopf);

    const hinweisZeile = el("p", "mini-hinweis ar-leer");
    function hinweis(satz) {
      hinweisZeile.textContent = satz;
      if (!hinweisZeile.isConnected) wirt.append(hinweisZeile);
    }

    if (!id) {
      hinweis("Hier fehlt, welches Turnier gemeint ist – der Link ist wohl nicht ganz angekommen.");
      return;
    }

    async function laden() {
      if (!stand.t) hinweis("Das Turnier wird geladen...");
      try {
        const [t, eintraege, abende] = await Promise.all([
          cloud().turnier(id),
          cloud().turnierErgebnisse(id),
          // Die Multiplayer dürfen fehlen – das Turnier steht auch ohne sie.
          Promise.resolve(cloud().turnierLive?.(id)).catch(() => []),
        ]);
        stand.t = t || null;
        stand.eintraege = Array.isArray(eintraege) ? eintraege : [];
        stand.abende = Array.isArray(abende) ? abende : [];
        stand.geladenMs = Date.now();
      } catch (fehler) {
        console.warn("Das Turnier war nicht zu lesen", fehler);
        if (!stand.t) hinweis("Das Turnier ist gerade nicht zu haben. Probier es später noch einmal.");
        return;
      }
      if (!stand.t) {
        vergiss(id);
        vergissDabei(id);
        ueberschrift.textContent = "Kein Turnier";
        hinweis("Dieses Turnier gibt es nicht (mehr). Vielleicht wurde es gelöscht – frag, wer dir den Link geschickt hat.");
        return;
      }
      merke(id);
      alsApp(stand.t);
      zeichne();
      schauLive();
      if (offenStand === null) schauSpielen();
    }

    /*
     * Wer gerade spielt (amSpielen): gefragt beim Laden und dann alle
     * fünfzehn Sekunden, solange die Seite zu sehen ist – nur nach den
     * offenen Versuchen, nicht nach der ganzen Liste. Ändert sich, wer einen
     * offen hat – jemand beginnt, jemand ist fertig –, wird auch die Liste
     * neu gelesen: So steht ein neues Ergebnis da, ohne dass jemand neu lädt.
     */
    let offenStand = null;
    async function schauSpielen() {
      if (!stand.t || !cloud()?.turnierAmSpielen) return;
      let offen = null;
      try { offen = await cloud().turnierAmSpielen(id); } catch { return; }
      if (!Array.isArray(offen)) return;
      const schluessel = offen.map((e) => `${e.id}:${e.versuche}`).sort().join("|");
      const vorher = offenStand;
      offenStand = schluessel;
      const spielen = amSpielen(offen, Date.now(), m.kennungFallsDa?.() || "");
      const anders = JSON.stringify(spielen) !== JSON.stringify(stand.spielen);
      stand.spielen = spielen;
      if (vorher !== null && vorher !== schluessel) laden();
      else if (anders) zeichneSpielen();
    }
    window.setInterval(() => { if (document.visibilityState === "visible" && stand.t) schauSpielen(); }, 15000);

    // Läuft gerade ein Multiplayer zu diesem Turnier? Dann steht oben der Weg
    // hinein – und ist er neu, geht einmal ein Fenster auf (liveFenster).
    // Gefragt wird beim Laden und dann alle 20 Sekunden, solange die Seite zu
    // sehen ist.
    async function schauLive() {
      let zeiger = null;
      try { zeiger = await cloud().liveZeiger?.(id); } catch { zeiger = null; }
      const vorher = JSON.stringify(stand.zeiger);
      stand.zeiger = zeiger || null;
      if (stand.t && JSON.stringify(stand.zeiger) !== vorher) zeichne();
      if (stand.t && stand.zeiger && document.visibilityState === "visible") liveFenster(stand.zeiger);
    }
    window.setInterval(() => { if (document.visibilityState === "visible" && stand.t) schauLive(); }, 20000);

    // Die Bühne steht einmal und bekommt danach nur neue Zahlen – ausser die
    // Spiele des Turniers ändern sich.
    let buehne = null;
    let buehneEnde = null;
    let buehneFuer = "";
    let wertung = null;

    // Wohin Play bei einem Spiel führt – oder warum es gerade nicht geht. Die
    // Versuche hängen am Gerät, nicht am Namen – gezählt wird deshalb der
    // Eintrag dieses Geräts. Vorne liegen kann dagegen auch, wer auf einem
    // anderen Gerät mit demselben Namen gespielt hat (alleinVorne).
    function wegFuer(spiel) {
      const t = stand.t;
      const liste = wertung?.listen.get(spiel) || [];
      const kennung = m.kennungFallsDa?.() || "";
      const meiner = kennung ? stand.eintraege.find((e) => e.game === spiel && e.spieler === kennung) : null;
      const uebrig = t.versuche ? Math.max(0, t.versuche - (meiner?.versuche || 0)) : Infinity;
      const vorne = Boolean(t.spitzeWartet) && alleinVorne(liste);
      const l = lage(t);
      if (t.nurLive) return { sperre: "Wird im Multiplayer gespielt" };
      if (l === "laeuft" && vorne) return { sperre: "Du liegst vorne" };
      if (l === "laeuft" && uebrig > 0) return { link: spielLink(t.id, spiel) };
      if (l === "laeuft") return { sperre: "Alle Versuche gespielt" };
      if (l === "geplant") return { sperre: `Ab ${datum(t.startMs)}` };
      if (l === "angehalten") return { sperre: "Turnier angehalten" };
      return { sperre: "Turnier vorbei" };
    }

    function zeichne() {
      const t = stand.t;
      const jetzt = Date.now();
      stand.lage = lage(t, jetzt);
      const vorbei = stand.lage === "beendet";
      const verdeckt = t.verdeckt && !vorbei;
      wertung = gesamtwertung(t, stand.eintraege, stand.abende);
      if (wertung.personen.some((p) => p.eigen)) merkeDabei(t.id);

      document.title = `${t.name} · Turnier · arcade`;
      zeigeLogo(t);
      ueberschrift.textContent = t.name;
      ueberschrift.title = t.name;
      zeigeStatus(jetzt);
      hinweisZeile.remove();

      zeichneOben();
      gesamtZeichnen?.();

      const spiele = t.spiele.filter((spiel) => m.SPIELE.some((s) => s.id === spiel));
      if (!spiele.length) {
        buehneEnde?.abort();
        wirt.querySelectorAll(":scope > .ar-buehne, :scope > .ar-auswahl").forEach((teil) => teil.remove());
        buehne = null;
        buehneFuer = "";
        hinweis(t.nurLive ? "Gespielt wird nur im Multiplayer." : "Zu diesem Turnier gehört gerade kein Spiel.");
        return;
      }
      if (!buehne || buehneFuer !== spiele.join()) {
        buehneEnde?.abort();
        wirt.querySelectorAll(":scope > .ar-buehne, :scope > .ar-auswahl").forEach((teil) => teil.remove());
        buehneEnde = new AbortController();
        buehneFuer = spiele.join();
        buehne = m.arcadeBuehne(wirt, {
          signal: buehneEnde.signal,
          reihenfolge: spiele,
          weg: wegFuer,
          aus: t.id,
          ansehbar: !t.ohneReplay,
          ...m.arcadeStart(spiele),
        });
      }
      buehne.daten({ listen: wertung.listen, verdeckt });
      buehne.neu();
      buehne.spielen(jeSpiel());
    }

    // Oben zwischen Name und Knöpfen: ein Multiplayer, der gerade läuft, die
    // Gesamtwertung und, wer gerade spielt.
    function zeichneOben() {
      const t = stand.t;
      const verdeckt = t.verdeckt && lage(t) !== "beendet";
      oben.innerHTML = "";
      if (stand.zeiger) oben.append(liveHinweis(stand.zeiger));
      oben.append(wertungsKnopf(t, wertung.personen, verdeckt));
      if (stand.spielen.length) oben.append(spielenHinweis(stand.spielen, t));
    }

    // Wer gerade spielt, je Spiel: für die Bühne (unter dem Namen des Spiels
    // und auf den Kacheln) – mit dem Weg zum Zuschauen, wo das geht.
    function jeSpiel() {
      const karte = new Map();
      const darf = mitschauenErlaubt(stand.t);
      stand.spielen.forEach(({ name, game, spieler }) => karte.set(game, [...(karte.get(game) || []), {
        name, link: darf && spieler ? mitschauLink(stand.t, spieler, name, game) : "",
      }]));
      return karte;
    }

    // Nur wer spielt, hat sich geändert: Kopf, Bühne und ein offenes Fenster
    // bekommen es mit, sonst bleibt alles stehen.
    function zeichneSpielen() {
      if (!stand.t || !wertung) return;
      zeichneOben();
      buehne?.spielen(jeSpiel());
      gesamtZeichnen?.();
    }

    // Die Zeile unter dem Namen: wie lange es läuft, und was gilt.
    function zeigeStatus(jetzt) {
      const t = stand.t;
      const regel = t.nurLive ? "nur im Multiplayer"
        : t.spitzeWartet ? "wer vorne liegt, wartet"
          : t.versuche ? `${zahlWort(t.versuche, "Versuch", "Versuche")} je Spiel` : "";
      status.textContent = regel && lage(t, jetzt) !== "beendet" ? `${statusZeile(t, jetzt)} · ${regel}` : statusZeile(t, jetzt);
    }

    /*
     * Die Gesamtwertung im Fenster, mit zwei Reitern oben:
     *
     *   Gesamtwertung   zuerst: die Beschreibung, das Podest und alle Ränge
     *                   (gesamtAnsicht)
     *   Spiele          jedes Spiel mit seiner ganzen Rangliste, dazu die
     *                   Multiplayer, die schon gezählt haben (spieleAnsicht)
     *
     * Wer gerade spielt, steht in beiden – das Fenster zeichnet sich neu, wenn
     * sich das ändert (zeichneSpielen), und behält dabei den Reiter und
     * welcher Rang aufgeklappt ist.
     */
    let gesamtZeichnen = null;
    function gesamtZeigen() {
      const inhalt = el("div", "ar-gesamt");
      let erstesMal = true;
      let offen = "";
      let reiter = "gesamt";
      // Wer sich je Spiel anschauen lässt (der ▶), über das Neuzeichnen
      // hinweg.
      const laeufe = new Map();
      const ansehen = (spiel, gezeigt) => {
        if (!laeufe.has(spiel)) laeufe.set(spiel, m.ansehenFuer?.(spiel, gezeigt, () => gesamtZeichnen?.(), { aus: stand.t.id }) || null);
        return laeufe.get(spiel);
      };
      const zeichneFenster = () => {
        const t = stand.t;
        const vorbei = lage(t) === "beendet";
        const verdeckt = t.verdeckt && !vorbei;
        const { personen, abende } = wertung;
        inhalt.innerHTML = "";
        // Beim Öffnen steigt das Podest auf; beim Neuzeichnen steht es.
        inhalt.classList.toggle("ist-neu", erstesMal);
        erstesMal = false;
        // Die Reiter – nur, wo es unter «Spiele» etwas zu sehen gibt.
        const mitReitern = !verdeckt && personen.length > 0 && (!t.nurLive || stand.abende.length > 0);
        if (mitReitern) {
          const leiste = el("div", "tn-reiter");
          leiste.setAttribute("role", "tablist");
          [["gesamt", "Gesamtwertung"], ["spiele", t.nurLive ? "Multiplayer" : "Spiele"]].forEach(([art, wort]) => {
            const knopf = el("button", `tn-reiter-knopf${reiter === art ? " ist-an" : ""}`, wort);
            knopf.type = "button";
            knopf.dataset.reiter = art;
            knopf.setAttribute("role", "tab");
            knopf.setAttribute("aria-selected", reiter === art ? "true" : "false");
            knopf.addEventListener("click", () => {
              if (reiter === art) return;
              reiter = art;
              zeichneFenster();
              inhalt.querySelector(`.tn-reiter-knopf[data-reiter="${art}"]`)?.focus({ preventScroll: true });
              inhalt.closest(".ar-fenster-inhalt")?.scrollTo({ top: 0 });
            });
            leiste.append(knopf);
          });
          inhalt.append(leiste);
        }
        if (mitReitern && reiter === "spiele") {
          inhalt.append(spieleAnsicht(t, wertung.listen, stand.spielen, { ansehen }));
          if (stand.abende.length) inhalt.append(liveAbende(stand.abende, verdeckt));
          return;
        }
        if (t.beschreibung) inhalt.append(el("p", "tn-beschreibung", t.beschreibung));
        if (verdeckt && stand.spielen.length) inhalt.append(spielenHinweis(stand.spielen, t));
        inhalt.append(gesamtAnsicht(t, personen, verdeckt, abende, stand.spielen, {
          // Wer nicht gerade spielt: seine Kennung aus dem Eintrag, in dem er
          // zuletzt gespielt hat.
          kennungVon: (name) => stand.eintraege
            .filter((e) => namensSchluessel(e.name) === namensSchluessel(name) && e.spieler)
            .sort((a, b) => (Number(b.updatedAtMs) || 0) - (Number(a.updatedAtMs) || 0))[0]?.spieler || "",
          offen,
          // Der Fokus bleibt auf dem Rang, der eben angetippt wurde.
          waehle: (wer) => {
            const vorher = offen;
            offen = wer;
            zeichneFenster();
            inhalt.querySelector(`[data-wer="${CSS.escape(wer || vorher)}"]`)?.focus({ preventScroll: true });
          },
        }));
        // Ohne Reiter (verdeckt) stehen die Multiplayer hier.
        if (!mitReitern && stand.abende.length) inhalt.append(liveAbende(stand.abende, verdeckt));
      };
      zeichneFenster();
      gesamtZeichnen = zeichneFenster;
      const dlg = m.fenster(lage(stand.t) === "beendet" ? "Endstand" : "Gesamtwertung", inhalt, { ueber: stand.t.name, klasse: "ist-gesamt" });
      dlg.addEventListener("close", () => { if (gesamtZeichnen === zeichneFenster) gesamtZeichnen = null; });
    }

    // Der Knopf zur Gesamtwertung: der Pokal und die ersten drei – oder,
    // solange sie verdeckt ist, wie viele schon dabei sind.
    function wertungsKnopf(t, personen, verdeckt) {
      const knopfWertung = el("button", "tn-wertung");
      knopfWertung.type = "button";
      knopfWertung.setAttribute("aria-haspopup", "dialog");
      knopfWertung.append(m.mitIcon("span", "tn-wertung-pokal", verdeckt ? "schloss" : "pokal"));
      const vorne = personen.filter((p) => p.platz <= 3).slice(0, 3);
      let satz = "";
      if (verdeckt) {
        satz = personen.length ? `Verdeckt bis zum Schluss · ${zahlWort(personen.length, "Spieler", "Spieler")}` : "Verdeckt bis zum Schluss";
        knopfWertung.append(el("span", "tn-wertung-text tn-verdeckt", satz));
      } else if (!vorne.length) {
        satz = "Noch hat niemand gespielt";
        knopfWertung.append(el("span", "tn-wertung-text", satz));
      } else {
        const podest = el("ol", "tn-podest");
        const spielend = new Set(stand.spielen.map((s) => namensSchluessel(s.name)));
        vorne.forEach((p) => {
          // Wer davon gerade spielt: ein grüner Punkt an seiner Medaille.
          const spielt = spielend.has(namensSchluessel(p.name));
          const zeile = el("li", `ist-platz-${p.platz}${p.eigen ? " ist-ich" : ""}${spielt ? " ist-am-spielen" : ""}`);
          zeile.append(el("span", "tn-medaille", String(p.platz)), el("span", "tn-podest-name", p.name));
          if (spielt) zeile.title = `${p.name} spielt gerade`;
          podest.append(zeile);
        });
        knopfWertung.append(podest);
        // Wer selbst weiter hinten steht, sieht seinen Platz daneben.
        const ich = personen.find((p) => p.eigen);
        if (ich && ich.platz > 3) knopfWertung.append(el("span", "tn-wertung-ich", `Du ${ich.platz}.`));
        satz = vorne.map((p) => `${p.platz}. ${p.name}`).join(", ") + (ich && ich.platz > 3 ? `, du ${ich.platz}.` : "");
      }
      knopfWertung.append(m.mitIcon("span", "tn-wertung-mehr", "pfeil"));
      const wort = lage(t) === "beendet" ? "Endstand" : "Gesamtwertung";
      knopfWertung.title = wort;
      knopfWertung.setAttribute("aria-label", `${wort}: ${satz}`);
      knopfWertung.addEventListener("click", gesamtZeigen);
      return knopfWertung;
    }

    // Die Uhr läuft auf der Seite mit, ohne die Liste neu zu lesen: Wie lange
    // noch, ändert sich jede Minute – wer wo steht, nur, wenn jemand spielt.
    // Und wer spielt, kommt danach über einen neuen Seitenaufruf hierher
    // zurück oder holt die Seite aus dem Hintergrund.
    window.setInterval(() => {
      if (!stand.t) return;
      const jetzt = Date.now();
      if (lage(stand.t, jetzt) !== stand.lage) { zeichne(); return; }
      zeigeStatus(jetzt);
    }, 15000);
    const auffrischen = () => {
      if (document.visibilityState === "visible" && Date.now() - stand.geladenMs > 20000) laden();
    };
    document.addEventListener("visibilitychange", auffrischen);
    window.addEventListener("pageshow", (ereignis) => { if (ereignis.persisted) laden(); });

    laden();
  }

  // ---------------------------------------------------------------------------
  // Ein Multiplayer zum Turnier
  // ---------------------------------------------------------------------------
  /*
   * Hängt am Turnier ein Multiplayer (live.js, turnierLive/<turnier>), soll
   * ihn sehen, wer im Turnier ist – ob er für alle offen ist oder nur mit
   * Link:
   *
   *   auf der Turnierseite   oben der Weg hinein (liveHinweis); kommt er neu
   *                          dazu, geht einmal ein Fenster auf (liveFenster)
   *   in den Spielen         unten ein Band (liveBand), solange keine Runde
   *                          läuft – wer mitten im Spiel ist, wird nicht
   *                          gestört; nach der Runde steht es wieder da
   *
   * Das Fenster kommt je Multiplayer einmal (sessionStorage): Wer «Später»
   * sagt, hat den Hinweis oben noch.
   */
  const GESEHEN_KEY = "mini.turnier.live.gesehen";
  function gesehen() {
    try { return (sessionStorage.getItem(GESEHEN_KEY) || "").split(",").filter(Boolean); } catch { return []; }
  }
  function merkeGesehen(code) {
    try { sessionStorage.setItem(GESEHEN_KEY, [...gesehen().filter((c) => c !== code), code].slice(-20).join(",")); } catch { /* dann eben noch einmal */ }
  }
  const liveLink = (zeiger) => `/live?code=${encodeURIComponent(zeiger.code)}`;

  function liveFenster(zeiger) {
    const m = mini();
    if (!m?.fenster || gesehen().includes(zeiger.code) || document.querySelector("dialog[open]")) return;
    merkeGesehen(zeiger.code);
    const inhalt = el("div", "tn-live-fenster");
    const marke = el("p", "tn-live-marke");
    marke.append(el("span", "tn-live-punkt"), el("span", "", "Jetzt live"));
    inhalt.append(marke, el("p", "tn-live-fenster-text", "Alle spielen zur selben Zeit dasselbe Spiel. Komm dazu!"));
    const knoepfe = el("div", "tn-live-fenster-knoepfe");
    const los = el("a", "mini-knopf mini-knopf-voll tn-live-fenster-los", "Mitspielen");
    los.href = liveLink(zeiger);
    knoepfe.append(los);
    inhalt.append(knoepfe);
    const dlg = m.fenster(zeiger.name, inhalt, { ueber: "Multiplayer im Turnier", klasse: "tn-live-dialog" });
    const spaeter = el("button", "mini-knopf mini-knopf-still", "Später");
    spaeter.type = "button";
    spaeter.addEventListener("click", () => dlg?.close?.());
    knoepfe.append(spaeter);
  }

  // In einem Spiel des Turniers: das Band unten. Gefragt wird wie auf der
  // Turnierseite – beim Laden und alle 20 Sekunden, solange die Seite zu
  // sehen ist.
  function liveBand() {
    let band = null;
    let bisher = "";
    async function schau() {
      let zeiger = null;
      try { zeiger = await cloud()?.liveZeiger?.(hier.id); } catch { zeiger = null; }
      const jetzt = zeiger ? JSON.stringify(zeiger) : "";
      if (jetzt === bisher) return;
      bisher = jetzt;
      band?.remove();
      band = null;
      if (!zeiger) return;
      band = liveHinweis(zeiger);
      band.classList.add("tn-live-band");
      document.body.append(band);
    }
    schau();
    window.setInterval(() => { if (document.visibilityState === "visible") schau(); }, 20000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") schau(); });
  }

  // Ein Multiplayer zu diesem Turnier läuft gerade (live.js): der Weg hinein.
  function liveHinweis(zeiger) {
    const box = el("a", "tn-live");
    box.href = liveLink(zeiger);
    const text = el("span", "tn-live-text");
    const marke = el("strong", "tn-live-marke");
    marke.append(el("span", "tn-live-punkt"), el("span", "", "Multiplayer läuft"));
    text.append(marke, el("span", "tn-live-name", zeiger.name));
    // Wo der Platz knapp ist, bleiben nur der Punkt und «Mitspielen».
    box.append(el("span", "tn-live-punkt"), text, el("span", "tn-live-los", "Mitspielen"));
    box.title = `Multiplayer läuft: ${zeiger.name}`;
    return box;
  }

  // Die Multiplayer, die zum Turnier gehören: je ihr Endstand und wie sie
  // zählen. Bei einer verdeckten Rangliste nur, dass es sie gab.
  function liveAbende(abende, verdeckt) {
    const block = el("section", "tn-abende");
    block.append(el("h3", "", "Multiplayer"));
    abende.forEach((a) => {
      const karte = el("article", "tn-live-karte");
      const kopf = el("header", "tn-live-kopf");
      kopf.append(el("strong", "", a.name), el("span", "mini-karte-zahl", !a.gewicht ? "zählt nicht" : a.gewicht === 1 ? "zählt wie ein Spiel" : `zählt ×${a.gewicht}`));
      karte.append(kopf);
      if (verdeckt) {
        karte.append(el("p", "tn-verdeckt", "Die Rangliste bleibt bis zum Schluss verdeckt."));
      } else {
        const ol = el("ol", "tn-live-liste");
        const kennung = mini()?.kennungFallsDa?.() || "";
        a.endstand.slice(0, 5).forEach((e) => {
          const li = el("li", kennung && e.spieler === kennung ? "ist-ich" : "");
          li.append(el("span", "mini-rangzahl", String(e.platz)), el("span", "tn-live-name", e.name), el("span", "tn-live-wert", String(e.punkte)));
          ol.append(li);
        });
        karte.append(ol);
        if (a.endstand.length > 5) karte.append(el("p", "tn-fertig", `und ${a.endstand.length - 5} weitere`));
      }
      block.append(karte);
    });
    return block;
  }

  // Wer gerade spielt, in einem Satz mit grünem Punkt: oben auf der
  // Turnierseite (breit neben der Gesamtwertung) und im Fenster einer
  // verdeckten Wertung.
  function spielenHinweis(spielen, t = null) {
    const box = el("p", "tn-spielen");
    const namen = [...new Set(spielen.map((s) => s.name))];
    const text = el("span", "tn-spielen-text");
    const zeile = namenZumZuschauen(spielen, t);
    zeile.classList.add("tn-spielen-namen");
    text.append(el("strong", "tn-spielen-marke", namen.length === 1 ? "Spielt gerade" : "Spielen gerade"), zeile);
    box.append(el("span", "ar-live-punkt"), text);
    box.title = spielen.map((s) => `${s.name}: ${titel(s.game)}`).join(" · ");
    return box;
  }

  // Wer gerade spielt, als Namen zum Antippen: Jeder führt in den
  // Beobachtungsmodus (mitschauLink) – wo das Turnier Zuschauen erlaubt.
  // «Joshua», «Joshua und Mia», «Joshua, Mia und 2 weitere».
  function namenZumZuschauen(spielen, t = null) {
    const zeile = el("span", "tn-zuschau-namen");
    const je = [];
    spielen.forEach((s) => { if (!je.some((x) => namensSchluessel(x.name) === namensSchluessel(s.name))) je.push(s); });
    const zeigen = je.length > 3 ? je.slice(0, 2) : je;
    zeigen.forEach((s, i) => {
      if (i > 0) zeile.append(i === zeigen.length - 1 && je.length <= 3 ? " und " : ", ");
      if (t && s.spieler && mitschauenErlaubt(t)) {
        const link = el("a", "tn-zuschauen", s.name);
        link.href = mitschauLink(t, s.spieler, s.name, s.game);
        link.title = `${s.name} zuschauen`;
        zeile.append(link);
      } else {
        zeile.append(s.name);
      }
    });
    if (je.length > 3) zeile.append(` und ${je.length - 2} weitere`);
    return zeile;
  }

  // Ein Kreis mit zwei Buchstaben, je Name in einer eigenen Farbe – dieselbe
  // auf jedem Gerät, weil sie aus dem Namen kommt.
  function avatar(name, klasse = "") {
    const kreis = el("span", `tn-avatar ${klasse}`.trim(), mini()?.kuerzel?.(name) || String(name).slice(0, 2));
    let summe = 0;
    for (const zeichen of namensSchluessel(name)) summe = (summe * 31 + zeichen.codePointAt(0)) % 360;
    kreis.style.setProperty("--tn-farbton", String(summe));
    kreis.setAttribute("aria-hidden", "true");
    return kreis;
  }

  /*
   * Die Gesamtwertung im Fenster, ihr erster Reiter: vorne steht nur, was
   * zuerst zählt – das Podest, die ersten drei gross, Platz 1 in der Mitte
   * und am höchsten, mit Krone, und darunter alle weiteren Ränge. Je Person
   * nur Name und Schnitt. Ein Tipp auf einen Rang klappt auf, woraus sich
   * sein Schnitt zusammensetzt: der Platz in jedem Spiel, die Rechnung, und
   * wie gezählt wird. Die Ranglisten der Spiele hat der zweite Reiter
   * (spieleAnsicht).
   *
   * Bis Oktober 2026 stand hier eine Tabelle mit allen Plätzen in Worten
   * («Tunnelflug 1. · Drift-Rennen 3. · …»); das war zu viel auf einmal.
   *
   * Wer gerade spielt (amSpielen), trägt einen grünen Punkt an seinem Kreis.
   *
   *   offen    der Name (klein), dessen Einzelheiten aufgeklappt sind
   *   waehle   was ein Tipp auf einen Rang tut
   */
  function gesamtAnsicht(t, personen, verdeckt, abende = [], spielen = [], { offen = "", waehle = () => {}, kennungVon = () => "" } = {}) {
    if (verdeckt) {
      return el("p", "mini-hinweis tn-verdeckt", personen.length
        ? `Die Gesamtwertung bleibt bis zum Schluss verdeckt. Bisher ${personen.length === 1 ? "ist 1 Spieler" : `sind ${personen.length} Spieler`} dabei.`
        : "Die Gesamtwertung bleibt bis zum Schluss verdeckt. Noch hat niemand gespielt.");
    }
    if (!personen.length) return el("p", "mini-hinweis", "Noch hat niemand gespielt. Der erste Name hier könnte deiner sein.");

    const spiele = t.nurLive ? [] : t.spiele.filter((spiel) => mini()?.SPIELE?.some((s) => s.id === spiel) ?? true);
    const prozent = t.wertung === "prozent";
    const amZug = new Map();
    spielen.forEach((s) => {
      const k = namensSchluessel(s.name);
      amZug.set(k, [...(amZug.get(k) || []), s]);
    });
    const wertWort = prozent ? "Ø von 100" : "Ø Platz";

    // Ein Rang lässt sich antippen: Er klappt seine Einzelheiten auf (und
    // wieder zu).
    function antippbar(knoten, person) {
      const k = namensSchluessel(person.name);
      knoten.dataset.wer = k;
      knoten.setAttribute("role", "button");
      knoten.tabIndex = 0;
      knoten.setAttribute("aria-expanded", k === offen ? "true" : "false");
      knoten.addEventListener("click", () => waehle(k === offen ? "" : k));
      knoten.addEventListener("keydown", (ereignis) => {
        if (ereignis.key !== "Enter" && ereignis.key !== " ") return;
        ereignis.preventDefault();
        waehle(k === offen ? "" : k);
      });
    }
    function kreis(person, klasse = "") {
      const k = avatar(person.name, klasse);
      const was = amZug.get(namensSchluessel(person.name));
      if (was) {
        k.classList.add("ist-am-spielen");
        k.title = `${person.name} spielt gerade ${was.map((s) => titel(s.game)).join(", ")}`;
      }
      return k;
    }

    // Die Einzelheiten eines Rangs: je Spiel sein Platz, die Rechnung, und
    // wie gezählt wird.
    function einzelheiten(person) {
      const box = el("div", "tn-detail");
      const kopf = el("p", "tn-detail-kopf");
      const teileGesamt = spiele.length + abende.length;
      kopf.append(el("strong", "", person.name), el("span", "", `${person.gespielt} von ${zahlWort(teileGesamt, abende.length && !spiele.length ? "Multiplayer" : "Spiel", abende.length && !spiele.length ? "Multiplayern" : "Spielen")} gespielt`));
      box.append(kopf);
      const was = amZug.get(namensSchluessel(person.name));
      if (was) {
        const live = el("p", "tn-detail-live");
        live.append(el("span", "ar-live-punkt"), el("span", "", `Spielt gerade ${was.map((s) => titel(s.game)).join(", ")}`));
        box.append(live);
      }
      // Zuschauen – live, und danach jede weitere Runde (geist.js,
      // mitschauer). Spielt er gerade nicht, wartet die Seite auf ihn.
      const kennung = was?.[0]?.spieler || kennungVon(person.name);
      if (!person.eigen && kennung && mitschauenErlaubt(t)) {
        const link = el("a", "tn-detail-zuschauen", was ? "Live zuschauen" : "Zuschauen");
        link.href = mitschauLink(t, kennung, person.name, was?.[0]?.game || "");
        box.append(link);
      }
      const liste = el("ul", "tn-detail-liste");
      const teile = [];
      let gewicht = 0;
      const zeile = (bild, wort, je, mal = 1) => {
        const wert = !je ? "nicht gespielt" : prozent ? String(Math.round(je.prozent)) : `${je.platz}.`;
        const medaille = je && !prozent && je.platz <= 3 ? ` ist-platz-${je.platz}` : "";
        const li = el("li", `tn-detail-zeile${je ? "" : " ist-leer"}`);
        li.append(bild, el("span", "tn-detail-spiel", wort), el("span", `tn-detail-platz${medaille}`, wert));
        liste.append(li);
        if (!je) return;
        const zahl = prozent ? Math.round(je.prozent) : je.platz;
        teile.push(mal > 1 ? `${zahl} × ${mal}` : String(zahl));
        gewicht += mal;
      };
      spiele.forEach((spiel) => {
        const bild = el("img", "tn-detail-bild");
        bild.alt = "";
        bild.loading = "lazy";
        bild.decoding = "async";
        bild.src = mini()?.bildPfad?.(spiel, "klein") || "";
        bild.addEventListener("error", () => bild.classList.add("ist-leer"), { once: true });
        zeile(bild, titel(spiel), person.je[spiel]);
      });
      abende.forEach((a) => {
        zeile(el("span", "tn-detail-mp", "MP"), `«${a.name}»${a.gewicht > 1 ? ` · zählt ×${a.gewicht}` : ""}`, person.abende?.[a.id], a.gewicht);
      });
      box.append(liste);
      if (teile.length > 1) {
        box.append(el("p", "tn-detail-rechnung", `${wertWort} ${person.wertText}: (${teile.join(" + ")}) ÷ ${gewicht}`));
      }
      box.append(el("p", "tn-wie", prozent
        ? "In jedem Spiel bekommt der Beste 100, die anderen ihren Anteil daran. Es zählt der Schnitt über die Spiele, die jemand gespielt hat – der höchste gewinnt."
        : "Es zählt der Platz im Schnitt über die Spiele, die jemand gespielt hat – der kleinste gewinnt. Wer weniger gespielt hat, hat keinen Nachteil; bei Gleichstand liegt vorne, wer mehr gespielt hat."));
      return box;
    }

    const ansicht = el("div", "tn-gesamt");

    // --- Oben: das Podest und alle weiteren Ränge -----------------------------------
    // Die ersten drei der Liste (bei Gleichstand teilen sie den Platz und die
    // Farbe). In der Mitte der Erste, links der Zweite, rechts der Dritte.
    const raenge = el("section", "tn-raenge");
    raenge.setAttribute("aria-label", "Rangliste");
    const podest = el("ol", "tn-sieger");
    const oben = personen.slice(0, 3);
    oben.forEach((person, i) => {
      const stufe = Math.min(person.platz, 3);
      const k = namensSchluessel(person.name);
      const li = el("li", `tn-person tn-stufe ist-platz-${stufe} ist-stelle-${i + 1}${person.eigen ? " ist-ich" : ""}${k === offen ? " ist-gewaehlt" : ""}`);
      antippbar(li, person);
      const wer = el("div", "tn-stufe-wer");
      if (stufe === 1) wer.append(mini()?.mitIcon?.("span", "tn-krone", "krone") || el("span", "tn-krone"));
      wer.append(kreis(person, "tn-avatar-gross"));
      const name = el("strong", "tn-person-name", person.name);
      name.title = person.name;
      wer.append(name);
      const wert = el("span", "tn-person-wert");
      wert.append(el("strong", "", person.wertText), el("small", "", wertWort));
      if (person.eigen) wert.append(el("span", "tn-du", "Du"));
      wer.append(wert);
      const sockel = el("div", "tn-sockel");
      sockel.append(el("span", "tn-sockel-platz", String(person.platz)));
      li.append(wer, sockel);
      podest.append(li);
    });
    raenge.append(podest);
    const obenOffen = oben.find((p) => namensSchluessel(p.name) === offen);
    if (obenOffen) raenge.append(einzelheiten(obenOffen));

    const rest = personen.slice(3);
    if (rest.length) {
      const liste = el("ol", "tn-rest");
      rest.forEach((person) => {
        const k = namensSchluessel(person.name);
        const li = el("li", `tn-person tn-reihe${person.eigen ? " ist-ich" : ""}${k === offen ? " ist-gewaehlt" : ""}`);
        const zeile = el("div", "tn-reihe-zeile");
        antippbar(zeile, person);
        zeile.append(el("span", "tn-reihe-platz", String(person.platz)), kreis(person));
        const name = el("strong", "tn-person-name", person.name);
        name.title = person.name;
        const wer = el("span", "tn-reihe-wer");
        wer.append(name);
        if (person.eigen) wer.append(el("span", "tn-du", "Du"));
        const wert = el("span", "tn-person-wert");
        wert.append(el("strong", "", person.wertText), el("small", "", wertWort));
        zeile.append(wer, wert, mini()?.mitIcon?.("span", "tn-reihe-mehr", "pfeil") || el("span", "tn-reihe-mehr"));
        li.append(zeile);
        if (k === offen) li.append(einzelheiten(person));
        liste.append(li);
      });
      raenge.append(liste);
    }
    ansicht.append(raenge);

    return ansicht;
  }

  /*
   * Der zweite Reiter im Fenster der Gesamtwertung: jedes Spiel mit seiner
   * ganzen Rangliste – wer dort vorne liegt, mit wie viel, wer es gerade
   * spielt, und (wo das Turnier es zulässt) der ▶ zum Anschauen des besten
   * Laufs.
   *
   *   ansehen   je Spiel, wer sich anschauen lässt (mini-games.js,
   *             ansehenFuer) – über das Neuzeichnen hinweg gemerkt, damit
   *             nicht bei jedem Blick neu gefragt wird
   */
  function spieleAnsicht(t, listen, spielen = [], { ansehen = null } = {}) {
    const spiele = t.nurLive ? [] : t.spiele.filter((spiel) => mini()?.SPIELE?.some((s) => s.id === spiel) ?? true);
    const teil = el("div", "tn-spiele");
    spiele.forEach((spiel) => {
      const karte = el("article", "tn-spiel");
      // Die Balken der Liste in der Farbe des Spiels, wie in seiner
      // eigenen Rangliste.
      const f = mini()?.farbe?.(spiel);
      if (f) {
        karte.style.setProperty("--mini-farbe", f.hell);
        karte.style.setProperty("--mini-farbe-dunkel", f.dunkel);
      }
      const kopf = el("header", "tn-spiel-kopf");
      const bild = el("img", "tn-spiel-bild");
      bild.alt = "";
      bild.loading = "lazy";
      bild.decoding = "async";
      bild.src = mini()?.bildPfad?.(spiel, "klein") || "";
      bild.addEventListener("error", () => bild.classList.add("ist-leer"), { once: true });
      const liste = listen.get(spiel) || [];
      const hier = spielen.filter((s) => s.game === spiel);
      const namen = hier.map((s) => s.name);
      const texte = el("span", "tn-spiel-texte");
      texte.append(el("strong", "tn-spiel-titel", titel(spiel)));
      if (namen.length) {
        const live = el("span", "tn-spiel-live");
        const satz = el("span", "");
        satz.append(namenZumZuschauen(hier, t), ` ${new Set(namen.map(namensSchluessel)).size === 1 ? "spielt" : "spielen"} gerade`);
        live.append(el("span", "ar-live-punkt"), satz);
        texte.append(live);
      } else {
        texte.append(el("span", "tn-spiel-zahl", liste.length ? zahlWort(liste.length, "Spieler", "Spieler") : "Noch niemand"));
      }
      kopf.append(bild, texte);
      const fuer = ansehen && !t.ohneReplay ? ansehen(spiel, () => listen.get(spiel) || []) : null;
      const spielt = new Set(namen.map(namensSchluessel));
      karte.append(kopf, mini()?.bestenliste?.(liste, spiel, { ansehen: fuer, spielt }) || el("p", "mini-hinweis", "Die Rangliste ist gerade nicht zu haben."));
      fuer?.frage?.();
      teil.append(karte);
    });
    return teil;
  }

  // ---------------------------------------------------------------------------
  // Auf der Startseite
  // ---------------------------------------------------------------------------
  // Ein Hinweis je öffentliches Turnier, das läuft, bald beginnt oder eben zu
  // Ende ging – ganz oben, über den Spielen: Ein Turnier, das man erst unter
  // elf Karten findet, findet niemand. Turniere "nur mit Link" stehen hier
  // nur für das Gerät, das sie schon einmal geöffnet hat (gemerkteTurniere) –
  // nach allen anderen liesse sich gar nicht fragen, die Regeln lassen es
  // nicht zu. Die eigenen stehen vorne, und sie stehen alle da.
  //
  // mini-games.js stellt dafür einen Platz bereit ([data-turnier-hinweis]).
  // Wer von beiden zuerst da ist, ist gleich: Die Startseite ruft hinweis()
  // auf, wenn es diese Datei schon gibt, und diese Datei füllt jeden Platz,
  // den sie beim Laden vorfindet.
  async function hinweis(platz) {
    if (!platz || platz.dataset.turnierGefuellt) return;
    platz.dataset.turnierGefuellt = "ja";
    const wolke = cloud();
    let liste = [];
    let eigene = [];
    try {
      [liste, eigene] = await Promise.all([
        wolke?.oeffentlicheTurniere?.() || [],
        // Ein eigenes, das nicht zu lesen ist, fehlt eben – es reisst die
        // anderen nicht mit. Eines, das es nicht mehr gibt, wird vergessen.
        Promise.all(wolke?.turnier ? gemerkteTurniere().map((id) => wolke.turnier(id).then((t) => {
          if (!t) vergiss(id);
          return t;
        }, () => null)) : []),
      ]);
    } catch (fehler) { console.warn("Die Turniere waren nicht zu lesen", fehler); return; }
    const jetzt = Date.now();
    const reihe = { laeuft: 0, geplant: 1, beendet: 2 };
    const sichtbar = (t) => t?.aktiv && t.endeMs > jetzt - NACHLESE_MS;
    const ordnung = (a, b) => {
      const la = lage(a, jetzt);
      const lb = lage(b, jetzt);
      if (la !== lb) return reihe[la] - reihe[lb];
      if (la === "geplant") return a.startMs - b.startMs;
      if (la === "beendet") return b.endeMs - a.endeMs;
      return a.endeMs - b.endeMs;
    };
    const meine = eigene.filter(sichtbar).sort(ordnung);
    const schonDa = new Set(meine.map((t) => t.id));
    const andere = (liste || []).filter((t) => sichtbar(t) && !schonDa.has(t.id)).sort(ordnung).slice(0, 3);
    [...meine, ...andere].forEach((t) => platz.append(hinweisKarte(t, jetzt)));
  }

  function hinweisKarte(t, jetzt) {
    const l = lage(t, jetzt);
    const karte = el("a", `tn-hinweis ist-${l}`);
    karte.href = seitenLink(t.id);
    karte.append(pokal());
    const text = el("span", "tn-hinweis-text");
    text.append(el("strong", "", t.name));
    text.append(el("span", "", `Turnier · ${statusText(t, jetzt)} · ${zahlWort(t.spiele.length, "Spiel", "Spiele")}`));
    karte.append(text);
    const wort = l === "laeuft" ? "Mitspielen" : l === "geplant" ? "Ansehen" : "Rangliste";
    karte.append(el("span", "mini-knopf mini-knopf-voll tn-hinweis-los", wort));
    return karte;
  }

  // ---------------------------------------------------------------------------
  // Ein Spiel im Turnier
  // ---------------------------------------------------------------------------
  // Was auf einer Spielseite mit ?turnier= gilt. game-shell.js fragt an vier
  // Stellen nach: beim Aufbauen der Bühne (anBuehne), wenn eine Runde beginnt
  // (rundeBeginnt), wenn jemand neu anfangen will (neuStart), und am Ende
  // (ergebnis, über mini-games.js).
  const hier = {
    id: "",
    t: null,
    geladen: false,
    fehler: false,
    gespielt: 0,          // begonnene Versuche dieses Geräts in diesem Spiel
    punkte: 0,            // was davon im Turnier steht
    vorne: false,         // allein auf Platz 1 – zählt nur mit spitzeWartet
    warten: null,         // ob die letzte Runde nach vorne führte, steht noch aus
    freigegeben: false,   // die Tafel wurde mit "Los geht's" verlassen
    laeuft: false,        // eine angemeldete Runde läuft gerade
    anmeldung: null,      // die Anmeldung dieser Runde (ein Promise)
    kette: Promise.resolve(), // was diese Seite ins Turnier schreibt, der Reihe nach
    buehne: null,         // { host, los } von game-shell.js
    tor: null,            // die Tafel vor dem Spiel
  };

  /*
   * Was diese Seite ins Turnier schreibt, geht in der Reihenfolge hinaus, in
   * der es geschah: Anmeldung, Ergebnis, nächste Anmeldung. Sonst überholt
   * bei langsamer Verbindung die Anmeldung des nächsten Versuchs das Ergebnis
   * des letzten – wer gleich nach der Runde "Noch einmal" drückt, meldet den
   * neuen Versuch an, bevor das alte Ergebnis draussen ist. Das alte Ergebnis
   * schlösse dann den neuen Versuch (offen → false), und dessen eigenes käme
   * nie mehr an.
   *
   * Die Runde wartet darauf nicht; nur die Schreibvorgänge warten
   * aufeinander. Ein Fehlschlag hält die Reihe nicht auf.
   */
  function nacheinander(schritt) {
    const lauf = hier.kette.then(schritt);
    hier.kette = lauf.catch(() => {});
    return lauf;
  }

  function ladeSpielseite() {
    hier.id = ausDerAdresse("turnier");
    hier.geladen = false;
    hier.fehler = false;
    const spiel = spielHier();
    const kennung = mini()?.kennungFallsDa?.() || "";
    const wolke = cloud();
    const fragen = wolke?.turnier
      ? Promise.all([
        wolke.turnier(hier.id),
        kennung ? wolke.meinTurnierEintrag(hier.id, { game: spiel, spieler: kennung }) : null,
      ])
      : Promise.reject(new Error("Firestore ist nicht geladen."));
    return fragen.then(async ([t, eintrag]) => {
      hier.t = t || null;
      if (t) { merke(hier.id); alsApp(t); } else vergiss(hier.id);
      hier.gespielt = Math.max(hier.gespielt, eintrag?.versuche || 0);
      hier.punkte = eintrag?.punkte || 0;
      // Ob dieses Gerät vorne liegt, sagt erst die ganze Liste des Spiels –
      // gelesen wird sie nur, wo es darauf ankommt.
      hier.vorne = t?.spitzeWartet ? alleinVorne(rangliste(await wolke.turnierErgebnisse(hier.id, { game: spiel }), spiel)) : false;
    }).catch((fehler) => {
      console.warn("Das Turnier war nicht zu lesen", fehler);
      hier.fehler = true;
    }).finally(() => {
      hier.geladen = true;
      if (hier.tor) zeigeTor();
    });
  }

  // Die Saat für den nächsten Versuch (zufall.js): Der wievielte er ist, und
  // ob das Turnier überhaupt feste Aufgaben will. Gilt ab dem neu() zu Beginn
  // der nächsten Runde.
  //
  // "wieErster" – gleiches Level wie Platz 1: Dann ist jeder Versuch der
  // erste, für alle. Wer gerade vorne liegt, hat seine Punkte also auf genau
  // dem Lauf geholt, den alle anderen spielen, auch im zehnten Versuch – und
  // wer ihn schlägt, ebenso. Die Aufzeichnung von Platz 1 (geist.js) läuft
  // so auf derselben Strecke mit.
  function stelleZufall() {
    const aufgaben = hier.t?.aufgaben;
    zufall()?.stelle?.({ runde: aufgaben === "wieErster" ? 1 : hier.gespielt + 1, frei: aufgaben === "zufall" });
  }

  function spielbar(jetzt = Date.now()) {
    const t = hier.t;
    if (!t || lage(t, jetzt) !== "laeuft" || !t.spiele.includes(spielHier())) return false;
    // Nur im Multiplayer: Gespielt wird dort, nicht hier.
    if (t.nurLive) return false;
    if (t.spitzeWartet && hier.vorne) return false;
    return !t.versuche || hier.gespielt < t.versuche;
  }

  // Liegt dieses Gerät gerade allein vorne? Frisch gelesen, nicht gemerkt:
  // Gefragt wird vor einer Runde und nach ihrem Ergebnis, und dazwischen
  // spielen die anderen.
  async function liegtVorne() {
    const spiel = spielHier();
    hier.vorne = alleinVorne(rangliste(await cloud().turnierErgebnisse(hier.id, { game: spiel }), spiel));
    return hier.vorne;
  }

  /*
   * Die Tafel über der Bühne. Wer spielen darf und einen Namen hat, sieht sie
   * nie: Das Turnier wird geladen, und das Spiel steht da wie ohne Turnier.
   * Gezählt wird ohnehin erst, wenn die Runde beginnt (rundeBeginnt).
   *
   * Wer gerade nicht spielen darf – allein vorne, alle Versuche gespielt,
   * noch nicht begonnen, angehalten, vorbei –, sieht sie auch nicht: Er
   * landet ohne ein Wort wieder auf der Turnierseite. Dort steht beim Spiel
   * an der Stelle von Play, warum (turnierSeite, wegFuer). Und dort, nicht nebenan,
   * wartet er, bis ihn jemand einholt.
   *
   * Sie steht nur noch, wenn der Name fehlt oder das Turnier nicht zu lesen
   * war. Sie ist ein eigenes Element und nicht die Tafel der Bühne: Die
   * Spiele räumen jene bei jedem Neustart ab (closeOverlay), diese aber muss
   * bleiben, bis das Turnier sie wegnimmt.
   *
   * Solange das Turnier lädt, liegt sie unsichtbar über der Bühne – sie hält
   * nur die Finger vom Spiel fern. "Wird geladen" zeigt sie erst, wenn es
   * dauert (styles.css, .tn-tor.ist-leise).
   */
  const direkt = () => hier.geladen && !hier.fehler && spielbar() && Boolean(mini()?.name?.());
  const gesperrt = () => hier.geladen && !hier.fehler && !spielbar();

  // Zurück zur Turnierseite: ersetzt, nicht dazu – sonst führte der
  // Zurück-Knopf gleich wieder hierher und von hier wieder weg. Über das
  // Objekt der Datei, damit die Prüfung im Browser den Weg abfangen kann.
  function zurueckZumTurnier() {
    window.LernappTurnier.weg(seitenLink(hier.id));
  }

  function zeigeTor() {
    const host = hier.buehne?.host;
    if (!host) return;
    if (!hier.tor) {
      hier.tor = el("div", "cm-overlay tn-tor");
      hier.tor.append(el("div", "cm-panel tn-tafel"));
      // Was auf der Tafel geschieht, bleibt auf der Tafel. Die Spiele hören
      // auf der ganzen Bühne auf Tipps und auf der ganzen Seite auf Tasten:
      // Ein Tipp neben einen Knopf liesse im Turmbau den ersten Block fallen,
      // ein Leerzeichen im Namen startete beim Signal eine Runde – und käme
      // selbst nie im Feld an.
      ["pointerdown", "pointermove", "pointerup", "pointercancel", "keydown", "keyup"]
        .forEach((typ) => hier.tor.addEventListener(typ, (ereignis) => ereignis.stopPropagation()));
    }
    host.append(hier.tor);
    const box = hier.tor.firstChild;
    hier.tor.classList.toggle("ist-leise", !hier.geladen || direkt() || gesperrt());
    if (gesperrt()) {
      box.innerHTML = "";
      zurueckZumTurnier();
      return;
    }
    if (direkt()) {
      box.innerHTML = "";
      // Nicht sofort: anBuehne kommt mitten aus dem Aufbau der Bühne
      // (game-shell.js, mount), und das Spiel, dessen Neustart hier ausgelöst
      // wird, ist dann selbst noch nicht fertig.
      window.setTimeout(() => {
        if (!hier.tor) return;
        if (direkt()) losGehts(null);
        else zeigeTor();
      }, 0);
      return;
    }
    fuelleTafel(box);
  }

  // Und eine Taste, die gar nicht auf der Tafel gedrückt wird – weil noch
  // nichts den Fokus hat –, geht auch nicht ans Spiel, solange die Tafel
  // steht. Hinter ihr soll keine Runde anlaufen, die niemand sieht.
  ["keydown", "keyup"].forEach((typ) => document.addEventListener(typ, (ereignis) => {
    if (hier.tor?.isConnected && !hier.tor.contains(ereignis.target)) ereignis.stopPropagation();
  }, { capture: true }));

  function schliesseTor() {
    hier.tor?.remove();
    hier.tor = null;
  }

  // Was auf der Tafel steht: "wird geladen", die Frage nach dem Namen oder,
  // ohne Verbindung, der Weg zum zweiten Versuch.
  function fuelleTafel(box) {
    box.innerHTML = "";
    if (!hier.geladen) {
      box.append(el("p", "tn-tafel-text", "Das Turnier wird geladen..."));
      return;
    }
    if (hier.fehler) {
      box.append(el("p", "tn-tafel-text", "Das Turnier ist gerade nicht zu haben – vielleicht fehlt die Verbindung."));
      const zeile = el("div", "tn-tafel-knoepfe");
      zeile.append(knopf("Noch einmal laden", "mini-knopf-voll", () => { ladeSpielseite(); zeigeTor(); }));
      box.append(zeile);
      return;
    }
    // Spielen darf, wer hier ist – es fehlt nur der Name. Ohne Namen kein
    // Turnier: Die Liste fasst nach Namen zusammen, und ein Versuch ohne
    // Namen gehörte niemandem.
    nachDemNamen(box);
  }

  function nachDemNamen(box) {
    const form = el("form", "tn-tafel-form");
    const feld = el("input");
    feld.type = "text";
    feld.maxLength = mini()?.NAME_MAX || 24;
    feld.placeholder = "Dein Name";
    feld.autocomplete = "nickname";
    feld.setAttribute("aria-label", "Dein Name im Turnier");
    const zeile = el("div", "mini-namensfeld");
    zeile.append(feld);
    const los = el("button", "mini-knopf mini-knopf-voll tn-los", "Los geht's");
    los.type = "submit";
    const knoepfe = el("div", "tn-tafel-knoepfe");
    knoepfe.append(los);
    form.append(el("p", "tn-tafel-text", "Unter welchem Namen spielst du mit?"), zeile, knoepfe);
    form.addEventListener("submit", (ereignis) => {
      ereignis.preventDefault();
      losGehts(feld);
    });
    box.append(form);
    feld.focus();
  }

  function losGehts(feld) {
    if (feld) {
      // Erst prüfen, dann merken: Ein leeres Feld soll den Namen, der schon
      // dasteht, nicht wegwischen.
      if (!String(feld.value || "").trim()) { feld.focus(); return; }
      mini()?.setzeName?.(feld.value);
    }
    const wie = mini()?.name?.() || "";
    if (!wie || !spielbar()) { zeigeTor(); return; }
    // Umbenannt wird hier nichts: Ein Name gilt für die Runden, die kommen
    // (mini-games.js, namenWechseln). Was schon in der Liste steht, bleibt.

    hier.freigegeben = true;
    hier.laeuft = false;
    hier.anmeldung = null;
    schliesseTor();
    stelleZufall();
    hier.buehne?.los?.();
  }

  // game-shell.js, beim Aufbauen der Bühne.
  function anBuehne({ host, los }) {
    if (!aufSpielseite() || !host) return;
    hier.buehne = { host, los };
    zeigeTor();
  }

  /*
   * Eine Runde beginnt (game-shell.js, setPhase("play")).
   *
   * Hier – und nicht am Ende – wird der Versuch angemeldet. Die Runde wartet
   * nicht darauf: Ein Kind, das "Starten" drückt, soll nicht zuerst einer
   * Datenbank beim Nachdenken zusehen. Ob es geklappt hat, sagt das Ergebnis.
   */
  function rundeBeginnt() {
    if (!aufSpielseite() || !hier.freigegeben || hier.laeuft || !spielbar()) return;
    const t = hier.t;
    hier.laeuft = true;
    hier.gespielt += 1;
    const wer = { game: spielHier(), spieler: mini().kennung(), name: mini().name(), grenze: t.versuche };
    // Wer vorne liegt, wartet – auch wenn diese Seite es noch nicht wusste:
    // ein zweiter Tab, in dem die Runde gespielt wurde, die nach vorne
    // führte. Gefragt wird deshalb vor der Anmeldung noch einmal.
    const anmelden = async () => {
      if (t.spitzeWartet && await liegtVorne()) {
        const vorne = new Error("Allein vorne – du wartest, bis dich jemand einholt.");
        vorne.code = "turnier/vorne";
        throw vorne;
      }
      return cloud().turnierVersuch(hier.id, wer);
    };
    const anmeldung = nacheinander(anmelden).then((stand) => {
      hier.gespielt = Math.max(hier.gespielt, stand.versuche);
      merkeDabei(hier.id);
      lebenszeichen(anmeldung, wer);
      return stand;
    }, (fehler) => {
      // Nicht angemeldet heisst nicht gezählt – ausser, das Gerät hatte schon
      // alle, nur wusste diese Seite es nicht (ein zweiter Tab, ein zweites
      // Gerät mit derselben Kennung).
      hier.gespielt = fehler?.code === "turnier/keine-versuche" ? t.versuche : Math.max(0, hier.gespielt - 1);
      throw fehler;
    });
    hier.anmeldung = anmeldung;
    // Ob die Anmeldung geklappt hat, sagt erst das Ergebnis. Bis dahin soll
    // ein Fehlschlag nicht als unbehandelter Fehler in der Konsole stehen.
    hier.anmeldung.catch(() => {});
  }

  /*
   * Das Lebenszeichen einer Runde: Solange sie läuft und im Bild ist, setzt
   * das Spiel alle zwanzig Sekunden die Uhrzeit seines Eintrags neu
   * (cloud.js, turnierLebenszeichen). Daran sieht die Turnierseite, wer
   * gerade spielt (amSpielen) – «offen» allein sagt das nicht: Offen bleibt
   * auch ein Versuch, den jemand mittendrin liegen gelassen hat.
   *
   * Es endet mit der Runde – mit ihrem Ergebnis oder einem Neustart, die
   * beide hier.anmeldung ersetzen –, und es schweigt, solange die Seite
   * nicht zu sehen ist: Wer das Handy weglegt, spielt nicht.
   */
  const LEBENSZEICHEN_MS = 20000;
  function lebenszeichen(anmeldung, wer) {
    const uhr = window.setInterval(() => {
      if (hier.anmeldung !== anmeldung || !hier.laeuft) { window.clearInterval(uhr); return; }
      if (document.visibilityState !== "visible") return;
      Promise.resolve(cloud()?.turnierLebenszeichen?.(hier.id, wer)).catch(() => {});
    }, LEBENSZEICHEN_MS);
  }

  // Live mitschauen (geist.js schreibt, was die Runde tut): in diesem
  // Turnier – aber nur auf einer Spielseite, die freigegeben ist, und nur,
  // wo zugeschaut werden darf. Sonst leer: Dann geht nichts hinaus, auch
  // nicht in die App.
  function mitschauenZiel() {
    return aufSpielseite() && hier.freigegeben && mitschauenErlaubt(hier.t) ? hier.id : "";
  }

  /*
   * Jemand will neu anfangen – über den Knopf oben (mitten) oder nach dem
   * Ergebnis. Eine angefangene Runde ist ein gebrauchter Versuch; das sagt
   * die Frage vorher. Und wer keinen Versuch mehr hat, bekommt die Tafel
   * statt einer neuen Runde.
   */
  function neuStart({ mitten = false, los }) {
    if (!hier.freigegeben) { los(); return; }
    // Steht noch aus, ob die letzte Runde nach vorne geführt hat (ergebnis,
    // spitzeWartet), wird das erst abgewartet: einen Augenblick – statt einer
    // ganzen Runde, die am Ende nicht zählen darf.
    if (hier.warten) { hier.warten.then(() => neuStart({ mitten, los })); return; }
    if (mitten && hier.laeuft && hier.t?.versuche) {
      if (!window.confirm("Neu anfangen? Der angefangene Versuch zählt trotzdem als gespielt.")) return;
    }
    hier.laeuft = false;
    hier.anmeldung = null;
    if (!spielbar()) {
      los();
      zeigeTor();
      return;
    }
    stelleZufall();
    los();
  }

  /*
   * Der Knopf "Noch einmal" unter dem Ergebnis (game-shell.js). Er steht nur,
   * wenn es noch einmal geht – sonst bleibt der Pokal, der zum Turnier
   * zurückführt. Ob jemand jetzt allein vorne liegt, sagt erst die frische
   * Liste (hier.warten); bis dahin steht er nicht da, statt kurz zu
   * erscheinen und wieder zu verschwinden.
   */
  function nochmalKnopf(knopf) {
    if (!aufSpielseite() || !hier.freigegeben || !knopf) return;
    knopf.hidden = true;
    const stelle = () => { knopf.hidden = !spielbar(); };
    (hier.warten || Promise.resolve()).then(stelle, stelle);
  }

  function fehlerBeimAnmelden(fehler) {
    if (fehler?.code === "turnier/keine-versuche") return "Alle Versuche waren schon gespielt – vielleicht auf einem anderen Gerät. Diese Runde zählt nicht.";
    if (fehler?.code === "turnier/vorne") return "Du lagst in diesem Spiel schon allein vorne – diese Runde zählt nicht.";
    if (fehler?.code === "permission-denied") return "Das Turnier hat diese Runde nicht angenommen – es ist vorbei oder angehalten.";
    return "Der Versuch liess sich nicht anmelden – ohne Verbindung zählt er nicht fürs Turnier.";
  }

  /*
   * Der Block unter dem Ergebnis, im Turnier. Statt Namensfeld und ewiger
   * Liste nur die Liste dieses Spiels im Turnier – kein Name des Turniers,
   * kein Satz, was eingetragen wurde, kein Platz in Worten: Die Liste sagt
   * das alles. Darüber «Neuer Rekord!», wenn diese Runde auf Platz 1 führt.
   * Worte gibt es nur, wenn etwas schiefging: wenn die Runde nicht zählt
   * oder nicht ankam.
   *
   * In die ewige Liste geht die Runde trotzdem (mini-games.js, melde) – eine
   * Runde ist eine Runde, und ein Rekord im Turnier ist auch einer in der
   * Hall of Fame.
   */
  function ergebnis({ punkte, geist = null }) {
    const spiel = spielHier();
    const t = hier.t;
    const block = el("div", "mini-ergebnis tn-ergebnis");
    const rekord = el("p", "tn-rekord");
    const meldung = el("p", "mini-meldung");
    const listenWirt = el("div", "mini-listen-wirt");
    block.append(rekord, meldung, listenWirt);

    mini()?.melde?.(spiel, punkte, geist)?.catch?.((fehler) => console.warn("Die Runde kam nicht in die ewige Liste", fehler));

    // Und der Lauf selbst, für die, die im Turnier gegen ihn spielen
    // (geist.js), und für die, die ihn anschauen (der ▶): als bester
    // einzelner Lauf dieses Spielers. Erst nach dem Ergebnis – ein Lauf ohne
    // Zeile im Turnier gehörte zu niemandem. Er darf scheitern, ohne die
    // Runde mitzunehmen. Ein Turnier ohne Gegner und ohne Replays braucht ihn
    // nicht.
    const laufHinterlegen = () => {
      if (!geist?.bahn || !t || (t.ohneGeist && t.ohneReplay)) return;
      cloud()?.speichereTurnierGeist?.(hier.id, {
        game: spiel, spieler: mini().kennung(), name: mini().name(), punkte, level: geist.level, bahn: geist.bahn,
      })?.catch?.((fehler) => console.warn("Der Lauf kam nicht ins Turnier", fehler));
    };

    // Die Liste dieses Spiels im Turnier, frisch nach dem Ergebnis. Mit
    // spitzeWartet sagt sie auch, ob dieses Gerät jetzt vorne liegt – dafür
    // wird sie selbst dann gelesen, wenn sie verdeckt bleibt.
    const verdeckt = () => t.verdeckt && lage(t) !== "beendet";
    const ladeListe = () => cloud().turnierErgebnisse(hier.id, { game: spiel }).then((alle) => {
      const liste = rangliste(alle, spiel);
      if (t.spitzeWartet) hier.vorne = alleinVorne(liste);
      return liste;
    });

    // "Neuer Rekord!" heisst hier: Diese Runde hat dich auf Platz 1 gebracht –
    // sie steht jetzt für dich in der Liste (beim Zusammenzählen: sie hat
    // dazugezählt), und vor dir ist niemand.
    function zeigeListe(geladen, stand) {
      if (verdeckt()) {
        listenWirt.append(el("p", "tn-verdeckt", "Die Rangliste bleibt bis zum Schluss verdeckt."));
        return;
      }
      geladen.then((liste) => {
        listenWirt.innerHTML = "";
        listenWirt.append(mini().listeBauen(liste, spiel, { max: 5 }));
        const eigen = liste.find((e) => e.eigen);
        const zaehlt = t.zaehlt === "summe" || stand.punkte === punkte;
        if (eigen?.platz === 1 && zaehlt && punkte > 0) rekord.textContent = "Neuer Rekord!";
      }).catch(() => {
        listenWirt.textContent = "Die Rangliste des Turniers ist gerade nicht zu haben.";
      });
    }

    if (!t || !hier.laeuft || !hier.anmeldung) {
      meldung.textContent = t && lage(t) === "beendet"
        ? "Das Turnier ist vorbei – diese Runde zählt nicht mehr."
        : "Diese Runde zählt nicht fürs Turnier.";
      return block;
    }

    hier.laeuft = false;
    const anmeldung = hier.anmeldung;
    hier.anmeldung = null;
    const eintrag = { game: spiel, spieler: mini().kennung(), name: mini().name(), punkte, zaehlt: t.zaehlt };
    const eintragen = () => cloud().turnierErgebnis(hier.id, eintrag);

    function zeige(weg) {
      meldung.textContent = "";
      block.querySelector(".tn-nochmal")?.remove();
      const fertig = weg.then((stand) => {
        hier.punkte = stand.punkte;
        laufHinterlegen();
        const geladen = t.spitzeWartet || !verdeckt() ? ladeListe() : null;
        zeigeListe(geladen, stand);
        // Das Turnier noch einmal lesen, für den nächsten Neustart: Wurde es
        // inzwischen angehalten oder beendet, soll die Tafel das sagen, statt
        // eine Runde anzubieten, die nicht mehr zählt.
        cloud().turnier(hier.id).then((frisch) => { if (frisch) hier.t = frisch; }, () => {});
        return t.spitzeWartet ? geladen : null;
      }, (fehler) => {
        if (fehler?.code === "turnier/nicht-angemeldet") {
          meldung.textContent = fehlerBeimAnmelden(fehler.ursache);
        } else if (fehler?.code === "turnier/kein-versuch") {
          meldung.textContent = "Zu dieser Runde gibt es keinen angemeldeten Versuch – sie zählt nicht.";
        } else if (fehler?.code === "permission-denied") {
          meldung.textContent = "Zu spät: Das Turnier nimmt keine Ergebnisse mehr an.";
        } else {
          // Angemeldet war der Versuch – sein Ergebnis darf also noch kommen.
          meldung.textContent = "Das Eintragen hat nicht geklappt.";
          const nochmal = knopf("Noch einmal eintragen", "mini-knopf-klein tn-nochmal", () => zeige(nacheinander(eintragen)));
          meldung.after(nochmal);
        }
      });
      // Wer vorne liegt, wartet: Bis die frische Liste sagt, ob das jetzt so
      // ist, wartet auch ein schnelles "Noch einmal" (neuStart).
      if (t.spitzeWartet) {
        const warten = fertig.catch(() => {}).finally(() => { if (hier.warten === warten) hier.warten = null; });
        hier.warten = warten;
      }
    }

    // Gleich jetzt in die Reihe, nicht erst, wenn die Anmeldung zurück ist:
    // Drückt jemand sofort "Noch einmal", geht die Anmeldung des nächsten
    // Versuchs so erst nach diesem Ergebnis hinaus (nacheinander).
    zeige(nacheinander(() => anmeldung.then(eintragen, (fehler) => {
      const nicht = new Error("Der Versuch wurde nicht angemeldet.");
      nicht.code = "turnier/nicht-angemeldet";
      nicht.ursache = fehler;
      throw nicht;
    })));
    return block;
  }

  // Für geist.js: ob das Turnier gelesen ist, und welches. Erst dann steht
  // fest, ob es Gegner zeigen will (ohneGeist) und ob seine Liste verdeckt ist.
  function geistLage() {
    return { geladen: Boolean(hier.geladen && !hier.fehler), id: hier.id, t: hier.t ? { ...hier.t } : null };
  }

  // Wohin der Weg oben links und der Pokal unter dem Ergebnis führen: im
  // Turnier zurück zum Turnier, nicht in die Hall of Fame – auch beim
  // Anschauen eines Laufs aus dem Turnier (?zuschauen=…&aus=<turnier>) und
  // überall in der Turnier-App (heim).
  function ziel() {
    if (!spielHier()) return null;
    const id = ausDerAdresse("turnier") || ausDerAdresse("aus") || heim;
    if (!id) return null;
    return { link: seitenLink(id), wort: "Turnier", titel: "Zurück zum Turnier" };
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  window.LernappTurnier = {
    lage, dauer, datum, zeitraum, statusText, gesamtwertung, alleinVorne, meineTurniere,
    OHNE_ENDE, ohneEnde,
    seitenLink, spielLink, volleAdresse,
    aufSpielseite, anBuehne, rundeBeginnt, neuStart, ergebnis, nochmalKnopf, ziel, geistLage, mitschauenZiel,
    // Das Turnier, in dem diese App lebt – leer, wenn sie keines hat.
    heim: () => heim,
    hinweis,
    // Der Weg zurück zur Turnierseite (zurueckZumTurnier). Die Prüfung im
    // Browser setzt hier einen eigenen ein, wenn sie die Seite nicht
    // verlassen will.
    weg: (adresse) => (window.LernappVollbild
      ? window.LernappVollbild.weiter(adresse, { ersetzen: true })
      : window.location.replace(adresse)),
    // Nur für die Prüfung im Browser: wie der Stand auf dieser Seite ist.
    stand: () => ({ ...hier, t: hier.t ? { ...hier.t } : null, buehne: Boolean(hier.buehne), tor: Boolean(hier.tor) }),
  };

  if (aufSpielseite()) {
    ladeSpielseite();
    liveBand();
  }
  if (aufTurnierseite()) {
    const wirt = document.querySelector("[data-turnier]");
    if (wirt) turnierSeite(wirt);
  }
  document.querySelectorAll("[data-turnier-hinweis]").forEach((platz) => hinweis(platz));
})();
