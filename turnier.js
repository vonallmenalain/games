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
  // So lange steht ein beendetes öffentliches Turnier noch auf der Startseite:
  // lange genug, dass alle das Ergebnis sehen – nicht so lange, dass die
  // Startseite zur Chronik wird.
  const NACHLESE_MS = 3 * TAG;

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
   * Die Gesamtwertung über alle Spiele des Turniers.
   *
   *   platz     Platzziffer: die Plätze zusammengezählt, die kleinste Summe
   *             gewinnt. Ein ausgelassenes Spiel zählt als Platz hinter dem
   *             Letzten – sonst gewänne, wer nur das Spiel spielt, das er
   *             kann.
   *   prozent   In jedem Spiel bekommt der Beste 100, alle anderen ihren
   *             Anteil an seiner Zahl. Die höchste Summe gewinnt. Anders als
   *             bei den Plätzen zählt hier, wie knapp jemand dran war.
   *
   * Die Punkte selbst zusammenzuzählen wäre sinnlos: 40 Blöcke im Turmbau und
   * 40 Fische im Teich sind nicht dasselbe.
   *
   * Dazu die Multiplayer, die zum Turnier gehören (live.js): Ihr Endstand
   * zählt wie ein weiteres Spiel, mal ihr Gewicht (×1, ×2, ×3; 0 zählt gar
   * nicht). Wer einen verpasst hat, steht dort hinter dem Letzten – wie bei
   * einem ausgelassenen Spiel. In einem Turnier, das nur im Multiplayer
   * gespielt wird, zählen nur sie.
   */
  function gesamtwertung(t, eintraege, abende = []) {
    const spiele = t.nurLive ? [] : t.spiele;
    const listen = new Map(spiele.map((spiel) => [spiel, rangliste(eintraege, spiel)]));
    const live = (abende || []).filter((a) => a && a.gewicht > 0 && Array.isArray(a.endstand) && a.endstand.length);
    const personen = new Map();
    const person = (name, eigen) => {
      const schluessel = String(name).toLocaleLowerCase("de");
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
      const gespielt = spiele.filter((spiel) => p.je[spiel]).length + live.filter((a) => p.abende[a.id]).length;
      const wert = prozent
        ? Math.round(spiele.reduce((summe, spiel) => summe + (p.je[spiel]?.prozent || 0), 0)
          + live.reduce((summe, a) => summe + (p.abende[a.id]?.prozent || 0) * a.gewicht, 0))
        : spiele.reduce((summe, spiel) => summe + (p.je[spiel]?.platz || listen.get(spiel).length + 1), 0)
          + live.reduce((summe, a) => summe + (p.abende[a.id]?.platz || a.endstand.length + 1) * a.gewicht, 0);
      return { ...p, gespielt, wert };
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

  function verweis(text, ziel, klasse) {
    const node = el("a", `mini-knopf ${klasse || ""}`.trim(), text);
    node.href = ziel;
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

  function streifen(zahlen) {
    const wrap = el("div", "mini-streifen");
    zahlen.forEach(([wert, wort]) => {
      const kasten = el("div");
      kasten.append(el("strong", "", String(wert)), el("span", "", wort));
      wrap.append(kasten);
    });
    return wrap;
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
        description: `Turnier der Mini-Games: ${t.name}`,
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

  // ---------------------------------------------------------------------------
  // Die Turnierseite
  // ---------------------------------------------------------------------------
  function turnierSeite(wirt) {
    const id = ausDerAdresse("t");
    const stand = { t: null, eintraege: [], abende: [], zeiger: null, geladenMs: 0, lage: "" };

    wirt.innerHTML = "";
    const kopf = el("header", "mini-kopf tn-kopf");
    const text = el("div");
    const ueberschrift = el("h1", "", "Turnier");
    const status = el("p", "tn-status");
    text.append(el("p", "mini-marke", "Turnier"), ueberschrift, status);
    kopf.append(text);
    const zumAdmin = mini()?.adminKnopf?.();
    if (zumAdmin) kopf.append(zumAdmin);
    const voll = window.LernappVollbild?.knopf?.("mini-vollbild");
    if (voll) kopf.append(voll);
    wirt.append(kopf);

    // Unter wessen Namen hier gespielt wird. Ein neuer Name ist im Turnier
    // ein neuer Mitspieler: Was schon gespielt ist, bleibt beim alten Namen,
    // und wer vorne liegt, hängt an der Kennung – darum zeichnet die Seite
    // sich danach neu.
    const wer = mini()?.namensZeile?.({ klasse: "tn-wer", beiWechsel: () => { if (stand.t) zeichne(); } });
    if (wer) wirt.append(wer);

    const inhalt = el("div", "tn-inhalt");
    wirt.append(inhalt);

    // Kein Weg hinaus zu den anderen Spielen und der Hall of Fame: Ein
    // Turnier ist ein Raum für sich, gerade eines, das nur kennt, wer den
    // Link hat.

    function hinweis(satz) {
      inhalt.innerHTML = "";
      inhalt.append(el("p", "mini-hinweis", satz));
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
        ueberschrift.textContent = "Kein Turnier";
        hinweis("Dieses Turnier gibt es nicht (mehr). Vielleicht wurde es gelöscht – frag, wer dir den Link geschickt hat.");
        return;
      }
      merke(id);
      alsApp(stand.t);
      zeichne();
      schauLive();
    }

    // Läuft gerade ein Multiplayer zu diesem Turnier? Dann steht ganz oben der
    // Weg hinein. Gefragt wird beim Laden und dann alle 20 Sekunden, solange
    // die Seite zu sehen ist.
    async function schauLive() {
      let zeiger = null;
      try { zeiger = await cloud().liveZeiger?.(id); } catch { zeiger = null; }
      const vorher = JSON.stringify(stand.zeiger);
      stand.zeiger = zeiger || null;
      if (stand.t && JSON.stringify(stand.zeiger) !== vorher) zeichne();
    }
    window.setInterval(() => { if (document.visibilityState === "visible" && stand.t) schauLive(); }, 20000);

    function zeichne() {
      const t = stand.t;
      const jetzt = Date.now();
      stand.lage = lage(t, jetzt);
      const vorbei = stand.lage === "beendet";
      const verdeckt = t.verdeckt && !vorbei;
      const { personen, listen, abende, teile } = gesamtwertung(t, stand.eintraege, stand.abende);

      document.title = `${t.name} · Turnier · Mini-Games`;
      ueberschrift.textContent = t.name;
      status.textContent = statusZeile(t, jetzt);
      inhalt.innerHTML = "";

      // Ein Multiplayer läuft: ganz oben der Weg hinein.
      if (stand.zeiger) inhalt.append(liveHinweis(stand.zeiger));

      inhalt.append(streifen([
        [t.spiele.length, t.spiele.length === 1 ? "Spiel" : "Spiele"],
        [personen.length, "Spieler"],
        t.nurLive
          ? [abende.length || "–", "Multiplayer"]
          : t.spitzeWartet
            ? ["∞", "Versuche – wer vorne liegt, wartet"]
            : [t.versuche || "∞", t.versuche === 1 ? "Versuch je Spiel" : "Versuche je Spiel"],
      ]));

      if (t.beschreibung) inhalt.append(el("p", "tn-beschreibung", t.beschreibung));

      const spieleBlock = el("section", "mini-block");
      spieleBlock.append(el("h2", "", t.spiele.length === 1 ? "Das Spiel" : "Die Spiele"));
      const karten = el("div", "mini-karten");
      t.spiele.forEach((spiel) => karten.append(spielKarte(t, spiel, listen.get(spiel) || [], stand.eintraege, { jetzt, verdeckt })));
      spieleBlock.append(karten);
      inhalt.append(spieleBlock);

      // Die Multiplayer, die schon gezählt haben: je ihr Endstand.
      if (stand.abende.length) inhalt.append(liveAbende(stand.abende, verdeckt));

      // Mit einem einzigen Spiel ist dessen Liste schon die Gesamtwertung –
      // eine zweite Tabelle darunter sagte dasselbe noch einmal. Mit einem
      // Multiplayer dazu nicht mehr.
      if (teile > 1 || (t.nurLive && teile > 0)) {
        const gesamt = el("section", "mini-block");
        gesamt.append(el("h2", "", vorbei ? "Endstand" : "Gesamtwertung"));
        gesamt.append(gesamtTabelle(t, personen, verdeckt, abende));
        inhalt.append(gesamt);
      }

      // Keine Regeln in Sätzen und kein Block zum Weitersagen: Was zählt –
      // wie lange, wie viele Versuche – steht schon oben im Kopf und im
      // Streifen darunter. Den Link zum Weitergeben gibt es im Adminbereich.
    }

    // Die Uhr läuft auf der Seite mit, ohne die Liste neu zu lesen: Wie lange
    // noch, ändert sich jede Minute – wer wo steht, nur, wenn jemand spielt.
    // Und wer spielt, kommt danach über einen neuen Seitenaufruf hierher
    // zurück oder holt die Seite aus dem Hintergrund.
    window.setInterval(() => {
      if (!stand.t) return;
      const jetzt = Date.now();
      if (lage(stand.t, jetzt) !== stand.lage) { zeichne(); return; }
      status.textContent = statusZeile(stand.t, jetzt);
    }, 15000);
    const auffrischen = () => {
      if (document.visibilityState === "visible" && Date.now() - stand.geladenMs > 20000) laden();
    };
    document.addEventListener("visibilitychange", auffrischen);
    window.addEventListener("pageshow", (ereignis) => { if (ereignis.persisted) laden(); });

    laden();
  }

  // Ein Multiplayer zu diesem Turnier läuft gerade (live.js): der Weg hinein.
  function liveHinweis(zeiger) {
    const box = el("section", "tn-live");
    const text = el("div", "tn-live-text");
    const marke = el("strong", "tn-live-marke");
    marke.append(el("span", "tn-live-punkt"), el("span", "", "Multiplayer läuft"));
    text.append(marke, el("span", "", zeiger.name));
    box.append(text, verweis("Mitspielen", `/live?code=${encodeURIComponent(zeiger.code)}`, "mini-knopf-voll"));
    return box;
  }

  // Die Multiplayer, die zum Turnier gehören: je ihr Endstand und wie sie
  // zählen. Bei einer verdeckten Rangliste nur, dass es sie gab.
  function liveAbende(abende, verdeckt) {
    const block = el("section", "mini-block");
    block.append(el("h2", "", "Multiplayer"));
    const karten = el("div", "mini-karten");
    abende.forEach((a) => {
      const karte = el("article", "mini-karte tn-karte tn-live-karte");
      const kopf = el("header", "mini-karte-kopf");
      kopf.append(el("h3", "", a.name), el("span", "mini-karte-zahl", !a.gewicht ? "zählt nicht" : a.gewicht === 1 ? "zählt wie ein Spiel" : `zählt ×${a.gewicht}`));
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
      karten.append(karte);
    });
    block.append(karten);
    return block;
  }

  function spielKarte(t, spiel, liste, eintraege, { jetzt, verdeckt }) {
    if (window.LernappVorschau?.hat?.(spiel) && mini()?.kachel) return spielKachel(t, spiel, liste, eintraege, { jetzt, verdeckt });
    const f = mini()?.farbe?.(spiel) || { hell: "#F5A623", dunkel: "#b9741a" };
    const karte = el("article", "mini-karte tn-karte");
    karte.style.setProperty("--mini-farbe", f.hell);
    karte.style.setProperty("--mini-farbe-dunkel", f.dunkel);

    // Je Spiel nur das Nötige: der Name, die Rangliste und der Knopf – oder
    // an seiner Stelle, warum es gerade nicht geht. Kein Satz über den eigenen
    // Stand: Der steht in der Liste.
    const kopf = el("header", "mini-karte-kopf");
    kopf.append(el("h3", "", titel(spiel)));
    karte.append(kopf);

    // Die Versuche hängen am Gerät, nicht am Namen – gezählt wird deshalb der
    // Eintrag dieses Geräts. Vorne liegen kann dagegen auch, wer auf einem
    // anderen Gerät mit demselben Namen gespielt hat (alleinVorne).
    const kennung = mini()?.kennungFallsDa?.() || "";
    const meiner = kennung ? eintraege.find((e) => e.game === spiel && e.spieler === kennung) : null;
    const uebrig = t.versuche ? Math.max(0, t.versuche - (meiner?.versuche || 0)) : Infinity;
    const vorne = Boolean(t.spitzeWartet) && alleinVorne(liste);

    const wirt = el("div", "mini-listen-wirt");
    let ganz = false;
    // Der ▶ bei jedem, der hier einen Lauf hat: seinen besten in diesem
    // Turnier anschauen (geist.js, zuschauer) – nicht, solange die Liste
    // verdeckt ist, und nicht in einem Turnier ohne Replays. Gefragt wird
    // nach denen, die gerade dastehen.
    const gezeigt = () => (ganz ? liste : mini()?.gezeigteEintraege?.(liste, 3) || liste.slice(0, 3));
    const ansehen = !verdeckt && !t.ohneReplay
      ? mini()?.ansehenFuer?.(spiel, gezeigt, () => zeichne(), { aus: t.id }) || null
      : null;
    const zeichne = () => {
      wirt.innerHTML = "";
      if (verdeckt) wirt.append(el("p", "tn-verdeckt", "Die Rangliste bleibt bis zum Schluss verdeckt."));
      else wirt.append(mini()?.listeBauen?.(liste, spiel, ganz ? { ansehen } : { max: 3, ansehen }) || el("span"));
      ansehen?.frage?.();
    };
    zeichne();
    karte.append(wirt);

    const aktionen = el("div", "mini-karte-aktionen");
    const l = lage(t, jetzt);
    if (t.nurLive) aktionen.append(el("span", "tn-fertig", "Wird im Multiplayer gespielt"));
    else if (l === "laeuft" && vorne) aktionen.append(el("span", "tn-fertig", "Du liegst vorne"));
    else if (l === "laeuft" && uebrig > 0) aktionen.append(verweis("Spielen", spielLink(t.id, spiel), "mini-knopf-voll"));
    else if (l === "laeuft") aktionen.append(el("span", "tn-fertig", "Alle Versuche gespielt"));
    else if (l === "geplant") aktionen.append(el("span", "tn-fertig", `Ab ${datum(t.startMs)}`));
    if (!verdeckt && liste.length > 3) {
      const mehr = knopf("Ganze Liste", "mini-knopf-still", () => {
        ganz = !ganz;
        zeichne();
        mehr.textContent = ganz ? "Nur die ersten drei" : "Ganze Liste";
      });
      aktionen.append(mehr);
    }
    if (aktionen.children.length) karte.append(aktionen);
    return karte;
  }

  // Die Spielkachel mit Film (mini-games.js, kachel): Der Play-Knopf führt ins
  // Turnier – solange es läuft und Versuche übrig sind. Sonst steht an seiner
  // Stelle, warum nicht, und der Film läuft trotzdem: Er zeigt, was hier
  // gespielt wird, auch wenn man gerade nicht darf.
  function spielKachel(t, spiel, liste, eintraege, { jetzt, verdeckt }) {
    const kennung = mini()?.kennungFallsDa?.() || "";
    const meiner = kennung ? eintraege.find((e) => e.game === spiel && e.spieler === kennung) : null;
    const uebrig = t.versuche ? Math.max(0, t.versuche - (meiner?.versuche || 0)) : Infinity;
    const vorne = Boolean(t.spitzeWartet) && alleinVorne(liste);
    const l = lage(t, jetzt);
    let link = "";
    let sperre = null;
    if (t.nurLive) sperre = { text: "Wird im Multiplayer gespielt" };
    else if (l === "laeuft" && vorne) sperre = { text: "Du liegst vorne", art: "vorne" };
    else if (l === "laeuft" && uebrig > 0) link = spielLink(t.id, spiel);
    else if (l === "laeuft") sperre = { text: "Alle Versuche gespielt" };
    else if (l === "geplant") sperre = { text: `Ab ${datum(t.startMs)}` };
    else if (l === "angehalten") sperre = { text: "Turnier angehalten" };
    else sperre = { text: "Turnier vorbei" };

    // Wie viele mitspielen – und kein Satz über den eigenen Stand (wie viele
    // Versuche übrig sind, wo man liegt): Der steht in der Liste, und die
    // Versuche je Spiel stehen oben im Streifen.
    return mini().kachel(spiel, liste, {
      klasse: "tn-karte",
      link,
      sperre,
      chips: [{ icon: "leute", text: liste.length ? `${liste.length} Spieler` : "noch frei" }],
      aus: t.id,
      ansehbar: !t.ohneReplay,
      verdeckt,
    });
  }

  function gesamtTabelle(t, personen, verdeckt, abende = []) {
    const spiele = t.nurLive ? [] : t.spiele;
    if (verdeckt) {
      return el("p", "mini-hinweis tn-verdeckt", personen.length
        ? `Die Gesamtwertung bleibt bis zum Schluss verdeckt. Bisher ${personen.length === 1 ? "ist 1 Spieler" : `sind ${personen.length} Spieler`} dabei.`
        : "Die Gesamtwertung bleibt bis zum Schluss verdeckt. Noch hat niemand gespielt.");
    }
    if (!personen.length) return el("p", "mini-hinweis", "Noch hat niemand gespielt. Der erste Name hier könnte deiner sein.");

    const prozent = t.wertung === "prozent";
    const tabelle = el("table", "mini-tabelle tn-tabelle");
    const kopf = el("thead");
    const kopfZeile = el("tr");
    [["Spieler", ""], ["Spiele", "zahl"], [prozent ? "Punkte" : "Plätze", "zahl"]]
      .forEach(([wort, klasse]) => kopfZeile.append(el("th", klasse, wort)));
    kopf.append(kopfZeile);
    tabelle.append(kopf);

    const koerper = el("tbody");
    personen.forEach((person) => {
      const zeile = el("tr", `${person.platz === 1 ? "ist-erster" : ""}${person.eigen ? " ist-ich" : ""}`.trim());
      const namensZelle = el("td", "mini-tabelle-name");
      namensZelle.append(el("span", "mini-rangzahl", String(person.platz)));
      const wer = el("span", "tn-wer");
      wer.append(el("span", "", person.name));
      // Woraus sich die Zahl zusammensetzt, klein darunter: Eine Summe, deren
      // Teile man nicht sieht, glaubt man weniger.
      const teile = spiele.map((spiel) => {
        const je = person.je[spiel];
        if (!je) return `${titel(spiel)} –`;
        return prozent ? `${titel(spiel)} ${Math.round(je.prozent)}` : `${titel(spiel)} ${je.platz}.`;
      });
      // Die Multiplayer, mit ihrem Gewicht.
      abende.forEach((a) => {
        const je = person.abende?.[a.id];
        const mal = a.gewicht > 1 ? ` ×${a.gewicht}` : "";
        if (!je) teile.push(`«${a.name}» –`);
        else teile.push(prozent ? `«${a.name}» ${Math.round(je.prozent)}${mal}` : `«${a.name}» ${je.platz}.${mal}`);
      });
      wer.append(el("small", "tn-teile", teile.join(" · ")));
      namensZelle.append(wer);
      zeile.append(namensZelle);
      zeile.append(el("td", "zahl", `${person.gespielt}/${spiele.length + abende.length}`));
      zeile.append(el("td", "zahl tn-wert", String(person.wert)));
      koerper.append(zeile);
    });
    tabelle.append(koerper);
    return tabelle;
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
   * an der Stelle des Knopfs, warum (spielKarte). Und dort, nicht nebenan,
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
    hier.anmeldung = nacheinander(anmelden).then((stand) => {
      hier.gespielt = Math.max(hier.gespielt, stand.versuche);
      return stand;
    }, (fehler) => {
      // Nicht angemeldet heisst nicht gezählt – ausser, das Gerät hatte schon
      // alle, nur wusste diese Seite es nicht (ein zweiter Tab, ein zweites
      // Gerät mit derselben Kennung).
      hier.gespielt = fehler?.code === "turnier/keine-versuche" ? t.versuche : Math.max(0, hier.gespielt - 1);
      throw fehler;
    });
    // Ob die Anmeldung geklappt hat, sagt erst das Ergebnis. Bis dahin soll
    // ein Fehlschlag nicht als unbehandelter Fehler in der Konsole stehen.
    hier.anmeldung.catch(() => {});
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
    lage, dauer, datum, zeitraum, statusText, gesamtwertung, alleinVorne,
    OHNE_ENDE, ohneEnde,
    seitenLink, spielLink, volleAdresse,
    aufSpielseite, anBuehne, rundeBeginnt, neuStart, ergebnis, nochmalKnopf, ziel, geistLage,
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

  if (aufSpielseite()) ladeSpielseite();
  if (aufTurnierseite()) {
    const wirt = document.querySelector("[data-turnier]");
    if (wirt) turnierSeite(wirt);
  }
  document.querySelectorAll("[data-turnier-hinweis]").forEach((platz) => hinweis(platz));
})();
