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
  const spielLink = (id, spiel) => `${mini()?.spielLink?.(spiel) || "/"}?turnier=${encodeURIComponent(id)}`;
  const ohneTurnier = (spiel) => mini()?.spielLink?.(spiel) || "/";
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
    const bis = new Date(t.endeMs);
    const gleicherTag = new Date(t.startMs).toDateString() === bis.toDateString();
    return `${datum(t.startMs)} bis ${gleicherTag ? uhr(bis) : datum(t.endeMs)}`;
  }

  function statusText(t, jetzt = Date.now()) {
    switch (lage(t, jetzt)) {
      case "laeuft": return t.endeMs - jetzt < MINUTE ? "endet gleich" : `läuft noch ${dauer(t.endeMs - jetzt)}`;
      case "geplant": return t.startMs - jetzt < MINUTE ? "beginnt gleich" : `beginnt in ${dauer(t.startMs - jetzt)}`;
      case "angehalten": return "angehalten";
      case "beendet": return `beendet ${datum(t.endeMs)}`;
      default: return "";
    }
  }

  // Die Zeile unter dem Namen: wie lange noch, und bis wann genau.
  function statusZeile(t, jetzt = Date.now()) {
    const l = lage(t, jetzt);
    if (l === "laeuft") return `${statusText(t, jetzt)} · bis ${datum(t.endeMs)}`;
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

  function versucheWort(t) {
    if (!t.versuche) return "beliebig viele Versuche";
    return t.versuche === 1 ? "einen Versuch" : `${t.versuche} Versuche`;
  }

  // Was die Tafel vor dem Spiel und die Turnierseite sagen. Ganze Sätze statt
  // Stichworte: Wer über einen Link hereinkommt, hat das Turnier nicht
  // angelegt und kennt keine der Einstellungen.
  function wieGezaehltWird(t) {
    if (t.zaehlt === "summe") return "Deine Versuche werden zusammengezählt.";
    return t.versuche === 1 ? "Es zählt, was du in diesem einen Versuch schaffst." : "Es zählt dein bester Versuch.";
  }

  function regeln(t) {
    const saetze = [`Es läuft ${zeitraum(t)}.`];
    saetze.push(t.versuche
      ? `Je Spiel hast du ${versucheWort(t)}. Ein Versuch zählt, sobald er beginnt – auch wenn du mittendrin aufhörst.`
      : "Jedes Spiel darfst du so oft spielen, wie du willst, solange das Turnier läuft.");
    saetze.push(wieGezaehltWird(t));
    if (t.aufgaben === "gleich") {
      saetze.push(t.versuche === 1
        ? "Alle bekommen dieselbe Aufgabe."
        : "Alle bekommen dieselben Aufgaben: Dein erster Versuch ist derselbe wie der erste aller anderen, dein zweiter wie deren zweiter.");
    } else {
      saetze.push("Die Aufgaben werden jedes Mal neu gewürfelt.");
    }
    if (t.spiele.length > 1) {
      saetze.push(t.wertung === "prozent"
        ? "Gesamtwertung: In jedem Spiel bekommt der Beste 100 Punkte, alle anderen so viele, wie sie in Prozent von ihm geschafft haben. Die höchste Summe gewinnt."
        : "Gesamtwertung: Die Plätze aus allen Spielen werden zusammengezählt, die kleinste Summe gewinnt. Wer ein Spiel auslässt, bekommt dort den Platz hinter dem Letzten.");
    }
    if (t.verdeckt) saetze.push("Die Rangliste bleibt bis zum Schluss verdeckt – wer vorne liegt, zeigt sich erst am Ende.");
    return saetze;
  }

  // ---------------------------------------------------------------------------
  // Die Wertung
  // ---------------------------------------------------------------------------
  // Die Rangliste eines Spiels im Turnier – dieselbe Rechnung wie in der
  // ewigen Liste (mini-games.js): ein Name eine Zeile, gleiche Zahl gleicher
  // Platz, wer früher dort war, steht bei Gleichstand oben.
  const rangliste = (eintraege, spiel) => mini()?.rangliste?.(eintraege.filter((e) => e.game === spiel)) || [];

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
   */
  function gesamtwertung(t, eintraege) {
    const listen = new Map(t.spiele.map((spiel) => [spiel, rangliste(eintraege, spiel)]));
    const personen = new Map();
    for (const [spiel, liste] of listen) {
      const bester = liste.reduce((max, e) => Math.max(max, Number(e.punkte) || 0), 0);
      for (const e of liste) {
        const schluessel = e.name.toLocaleLowerCase("de");
        if (!personen.has(schluessel)) personen.set(schluessel, { name: e.name, eigen: false, je: {} });
        const person = personen.get(schluessel);
        person.eigen = person.eigen || Boolean(e.eigen);
        const punkte = Number(e.punkte) || 0;
        person.je[spiel] = { platz: e.platz, punkte, prozent: bester > 0 ? (punkte / bester) * 100 : 0 };
      }
    }

    const prozent = t.wertung === "prozent";
    const alle = [...personen.values()].map((person) => {
      const gespielt = t.spiele.filter((spiel) => person.je[spiel]).length;
      const wert = prozent
        ? Math.round(t.spiele.reduce((summe, spiel) => summe + (person.je[spiel]?.prozent || 0), 0))
        : t.spiele.reduce((summe, spiel) => summe + (person.je[spiel]?.platz || listen.get(spiel).length + 1), 0);
      return { ...person, gespielt, wert };
    });
    alle.sort((a, b) => (prozent ? b.wert - a.wert : a.wert - b.wert)
      || b.gespielt - a.gespielt
      || a.name.localeCompare(b.name, "de"));

    let platz = 0;
    alle.forEach((person, i) => {
      if (i === 0 || person.wert !== alle[i - 1].wert) platz = i + 1;
      person.platz = platz;
    });
    return { personen: alle, listen };
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

  // In die Zwischenablage – und wo der Browser das nicht erlaubt (ohne https,
  // in manchen eingebauten Browsern), über das markierte Feld.
  async function kopiere(text, feld) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        feld?.select?.();
        return document.execCommand("copy");
      } catch { return false; }
    }
  }

  // ---------------------------------------------------------------------------
  // Die Turnierseite
  // ---------------------------------------------------------------------------
  function turnierSeite(wirt) {
    const id = ausDerAdresse("t");
    const stand = { t: null, eintraege: [], geladenMs: 0, lage: "" };

    wirt.innerHTML = "";
    const kopf = el("header", "mini-kopf tn-kopf");
    const text = el("div");
    const ueberschrift = el("h1", "", "Turnier");
    const status = el("p", "tn-status");
    text.append(el("p", "mini-marke", "Turnier"), ueberschrift, status);
    kopf.append(text);
    const zumAdmin = mini()?.adminKnopf?.();
    if (zumAdmin) kopf.append(zumAdmin);
    wirt.append(kopf);

    const inhalt = el("div", "tn-inhalt");
    wirt.append(inhalt);

    const fuss = el("p", "tn-fuss");
    const halle = el("a", "", "Alle Mini-Games und die Hall of Fame");
    halle.href = mini()?.uebersichtLink?.() || "/";
    fuss.append(halle);
    wirt.append(fuss);

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
        const [t, eintraege] = await Promise.all([cloud().turnier(id), cloud().turnierErgebnisse(id)]);
        stand.t = t || null;
        stand.eintraege = Array.isArray(eintraege) ? eintraege : [];
        stand.geladenMs = Date.now();
      } catch (fehler) {
        console.warn("Das Turnier war nicht zu lesen", fehler);
        if (!stand.t) hinweis("Das Turnier ist gerade nicht zu haben. Probier es später noch einmal.");
        return;
      }
      if (!stand.t) {
        ueberschrift.textContent = "Kein Turnier";
        hinweis("Dieses Turnier gibt es nicht (mehr). Vielleicht wurde es gelöscht – frag, wer dir den Link geschickt hat.");
        return;
      }
      zeichne();
    }

    function zeichne() {
      const t = stand.t;
      const jetzt = Date.now();
      stand.lage = lage(t, jetzt);
      const vorbei = stand.lage === "beendet";
      const verdeckt = t.verdeckt && !vorbei;
      const { personen, listen } = gesamtwertung(t, stand.eintraege);

      document.title = `${t.name} · Turnier · Mini-Games`;
      ueberschrift.textContent = t.name;
      status.textContent = statusZeile(t, jetzt);
      inhalt.innerHTML = "";

      inhalt.append(streifen([
        [t.spiele.length, t.spiele.length === 1 ? "Spiel" : "Spiele"],
        [personen.length, "Spieler"],
        [t.versuche || "∞", t.versuche === 1 ? "Versuch je Spiel" : "Versuche je Spiel"],
      ]));

      if (t.beschreibung) inhalt.append(el("p", "tn-beschreibung", t.beschreibung));

      const spieleBlock = el("section", "mini-block");
      spieleBlock.append(el("h2", "", t.spiele.length === 1 ? "Das Spiel" : "Die Spiele"));
      const karten = el("div", "mini-karten");
      t.spiele.forEach((spiel) => karten.append(spielKarte(t, spiel, listen.get(spiel) || [], stand.eintraege, { jetzt, verdeckt })));
      spieleBlock.append(karten);
      inhalt.append(spieleBlock);

      // Mit einem einzigen Spiel ist dessen Liste schon die Gesamtwertung –
      // eine zweite Tabelle darunter sagte dasselbe noch einmal.
      if (t.spiele.length > 1) {
        const gesamt = el("section", "mini-block");
        gesamt.append(el("h2", "", vorbei ? "Endstand" : "Gesamtwertung"));
        gesamt.append(gesamtTabelle(t, personen, verdeckt));
        inhalt.append(gesamt);
      }

      const regelBlock = el("section", "mini-block tn-regeln");
      regelBlock.append(el("h2", "", "So wird gespielt"));
      const liste = el("ul", "tn-regel-liste");
      regeln(t).forEach((satz) => liste.append(el("li", "", satz)));
      regelBlock.append(liste);
      const wer = mini()?.name?.();
      regelBlock.append(el("p", "tn-klein", wer
        ? `Du spielst als ${wer}.`
        : "Beim ersten Spiel trägst du deinen Namen ein – ein Konto braucht es nicht."));
      inhalt.append(regelBlock);

      if (!vorbei) inhalt.append(teilenBlock(t));
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

  function spielKarte(t, spiel, liste, eintraege, { jetzt, verdeckt }) {
    const f = mini()?.farbe?.(spiel) || { hell: "#F5A623", dunkel: "#b9741a" };
    const karte = el("article", "mini-karte tn-karte");
    karte.style.setProperty("--mini-farbe", f.hell);
    karte.style.setProperty("--mini-farbe-dunkel", f.dunkel);

    const kopf = el("header", "mini-karte-kopf");
    kopf.append(el("h3", "", titel(spiel)));
    kopf.append(el("span", "mini-karte-zahl", liste.length ? zahlWort(liste.length, "Spieler", "Spieler") : "noch frei"));
    karte.append(kopf);

    // Der eigene Stand. Die Versuche hängen am Gerät, nicht am Namen – gezählt
    // wird deshalb der Eintrag dieses Geräts.
    const kennung = mini()?.kennungFallsDa?.() || "";
    const meiner = kennung ? eintraege.find((e) => e.game === spiel && e.spieler === kennung) : null;
    const gespielt = meiner?.versuche || 0;
    const uebrig = t.versuche ? Math.max(0, t.versuche - gespielt) : Infinity;
    let mein;
    if (!meiner) mein = t.versuche ? `Du hast ${versucheWort(t)}.` : "Du hast noch nicht gespielt.";
    else {
      const versuche = t.versuche ? `${gespielt} von ${t.versuche} Versuchen` : zahlWort(gespielt, "Versuch", "Versuche");
      mein = `Du: ${meiner.punkte} ${einheit(spiel)} · ${versuche}`;
    }
    karte.append(el("p", "tn-mein", mein));

    const wirt = el("div", "mini-listen-wirt");
    let ganz = false;
    const zeichne = () => {
      wirt.innerHTML = "";
      if (verdeckt) wirt.append(el("p", "tn-verdeckt", "Die Rangliste bleibt bis zum Schluss verdeckt."));
      else wirt.append(mini()?.listeBauen?.(liste, spiel, ganz ? {} : { max: 3 }) || el("span"));
    };
    zeichne();
    karte.append(wirt);

    const aktionen = el("div", "mini-karte-aktionen");
    const l = lage(t, jetzt);
    if (l === "laeuft" && uebrig > 0) aktionen.append(verweis("Spielen", spielLink(t.id, spiel), "mini-knopf-voll"));
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

  function gesamtTabelle(t, personen, verdeckt) {
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
      const teile = t.spiele.map((spiel) => {
        const je = person.je[spiel];
        if (!je) return `${titel(spiel)} –`;
        return prozent ? `${titel(spiel)} ${Math.round(je.prozent)}` : `${titel(spiel)} ${je.platz}.`;
      });
      wer.append(el("small", "tn-teile", teile.join(" · ")));
      namensZelle.append(wer);
      zeile.append(namensZelle);
      zeile.append(el("td", "zahl", `${person.gespielt}/${t.spiele.length}`));
      zeile.append(el("td", "zahl tn-wert", String(person.wert)));
      koerper.append(zeile);
    });
    tabelle.append(koerper);
    return tabelle;
  }

  function teilenBlock(t) {
    const block = el("section", "mini-block tn-teilen");
    block.append(el("h2", "", "Weitersagen"));
    block.append(el("p", "tn-klein", t.sichtbar === "alle"
      ? "Das Turnier steht auch auf der Startseite. Mit diesem Link kommt man direkt hierher:"
      : "Dieses Turnier steht nirgends aufgeführt – finden kann es nur, wer den Link hat:"));
    const adresse = volleAdresse(t.id);
    const zeile = el("div", "tn-link");
    const feld = el("input", "tn-link-feld");
    feld.type = "text";
    feld.readOnly = true;
    feld.value = adresse;
    feld.setAttribute("aria-label", "Link zum Turnier");
    feld.addEventListener("focus", () => feld.select());
    zeile.append(feld);
    const kopieren = knopf("Link kopieren", "mini-knopf-voll", async () => {
      kopieren.textContent = (await kopiere(adresse, feld)) ? "Kopiert" : "Bitte von Hand kopieren";
      window.setTimeout(() => { kopieren.textContent = "Link kopieren"; }, 2200);
    });
    zeile.append(kopieren);
    if (typeof navigator.share === "function") {
      zeile.append(knopf("Teilen", "mini-knopf-hell", () => {
        navigator.share({ title: t.name, text: `Spiel mit im Turnier «${t.name}»!`, url: adresse }).catch(() => {});
      }));
    }
    block.append(zeile);
    return block;
  }

  // ---------------------------------------------------------------------------
  // Auf der Startseite
  // ---------------------------------------------------------------------------
  // Ein Hinweis je öffentliches Turnier, das läuft, bald beginnt oder eben zu
  // Ende ging – ganz oben, über den Spielen: Ein Turnier, das man erst unter
  // elf Karten findet, findet niemand. Turniere "nur mit Link" stehen hier
  // nie; die Regeln liessen die Frage nach ihnen gar nicht zu.
  //
  // mini-games.js stellt dafür einen Platz bereit ([data-turnier-hinweis]).
  // Wer von beiden zuerst da ist, ist gleich: Die Startseite ruft hinweis()
  // auf, wenn es diese Datei schon gibt, und diese Datei füllt jeden Platz,
  // den sie beim Laden vorfindet.
  async function hinweis(platz) {
    if (!platz || platz.dataset.turnierGefuellt) return;
    platz.dataset.turnierGefuellt = "ja";
    let liste = [];
    try { liste = (await cloud()?.oeffentlicheTurniere?.()) || []; }
    catch (fehler) { console.warn("Die Turniere waren nicht zu lesen", fehler); return; }
    const jetzt = Date.now();
    const reihe = { laeuft: 0, geplant: 1, beendet: 2 };
    const zeigen = liste
      .filter((t) => t.aktiv && t.endeMs > jetzt - NACHLESE_MS)
      .sort((a, b) => {
        const la = lage(a, jetzt);
        const lb = lage(b, jetzt);
        if (la !== lb) return reihe[la] - reihe[lb];
        if (la === "geplant") return a.startMs - b.startMs;
        if (la === "beendet") return b.endeMs - a.endeMs;
        return a.endeMs - b.endeMs;
      })
      .slice(0, 3);
    zeigen.forEach((t) => platz.append(hinweisKarte(t, jetzt)));
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
    return fragen.then(([t, eintrag]) => {
      hier.t = t || null;
      hier.gespielt = Math.max(hier.gespielt, eintrag?.versuche || 0);
      hier.punkte = eintrag?.punkte || 0;
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
  function stelleZufall() {
    zufall()?.stelle?.({ runde: hier.gespielt + 1, frei: hier.t?.aufgaben === "zufall" });
  }

  function spielbar(jetzt = Date.now()) {
    const t = hier.t;
    if (!t || lage(t, jetzt) !== "laeuft" || !t.spiele.includes(spielHier())) return false;
    return !t.versuche || hier.gespielt < t.versuche;
  }

  function versuchText(t) {
    const naechster = hier.gespielt + 1;
    return t.versuche ? `Versuch ${naechster} von ${t.versuche}` : `Versuch ${naechster}`;
  }

  // Die Tafel liegt über der Bühne, bis jemand "Los geht's" drückt – und
  // wieder, wenn nichts mehr geht: alle Versuche gespielt, das Turnier vorbei.
  // Sie ist ein eigenes Element und nicht die Tafel der Bühne: Die Spiele
  // räumen jene bei jedem Neustart ab (closeOverlay), diese aber muss bleiben,
  // bis das Turnier sie wegnimmt.
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
    fuelleTafel(hier.tor.firstChild);
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

  function fuelleTafel(box) {
    box.innerHTML = "";
    box.append(pokal("tn-tafel-pokal"));
    box.append(el("p", "tn-marke", "Turnier"));
    const spiel = spielHier();
    const t = hier.t;
    const satz = (text, klasse = "tn-tafel-text") => box.append(el("p", klasse, text));
    const knoepfe = (...liste) => {
      const zeile = el("div", "tn-tafel-knoepfe");
      liste.forEach((k) => zeile.append(k));
      box.append(zeile);
    };
    const zumTurnier = (wort = "Zum Turnier", klasse = "mini-knopf-hell") => verweis(wort, seitenLink(hier.id), klasse);
    const ohne = (wort = "Ohne Turnier spielen") => verweis(wort, ohneTurnier(spiel), "mini-knopf-still");

    if (!hier.geladen) { satz("Das Turnier wird geladen..."); return; }
    if (hier.fehler) {
      satz("Das Turnier ist gerade nicht zu haben – vielleicht fehlt die Verbindung.");
      knoepfe(knopf("Noch einmal laden", "mini-knopf-voll", () => { ladeSpielseite(); zeigeTor(); }), ohne());
      return;
    }
    if (!t) {
      satz("Dieses Turnier gibt es nicht (mehr).");
      knoepfe(ohne());
      return;
    }

    box.append(el("h2", "tn-tafel-titel", t.name));
    const jetzt = Date.now();
    const l = lage(t, jetzt);
    if (!t.spiele.includes(spiel)) {
      satz(`«${titel(spiel)}» gehört nicht zu diesem Turnier.`);
      knoepfe(zumTurnier(), ohne());
      return;
    }
    if (l === "geplant") {
      satz(`Es beginnt ${datum(t.startMs)} – in ${dauer(t.startMs - jetzt)}.`);
      knoepfe(zumTurnier(), ohne("Schon mal üben"));
      return;
    }
    if (l === "angehalten") {
      satz("Das Turnier ist gerade angehalten. Schau später wieder vorbei.");
      knoepfe(zumTurnier(), ohne());
      return;
    }
    if (l === "beendet") {
      satz("Das Turnier ist vorbei.");
      knoepfe(zumTurnier("Zur Rangliste", "mini-knopf-voll"), ohne());
      return;
    }
    if (!spielbar(jetzt)) {
      satz(`Du hast ${versucheWort(t) === "einen Versuch" ? "deinen Versuch" : `alle ${versucheWort(t)}`} in «${titel(spiel)}» gespielt.`);
      if (hier.punkte) satz(`Im Turnier steht für dich: ${hier.punkte} ${einheit(spiel)}.`, "tn-tafel-stand");
      knoepfe(zumTurnier("Zum Turnier", "mini-knopf-voll"), ohne("Ohne Turnier weiterspielen"));
      return;
    }

    satz(`${titel(spiel)} · ${versuchText(t)} · ${statusText(t, jetzt)}`, "tn-tafel-spiel");
    if (t.versuche) satz("Ein Versuch zählt, sobald er beginnt.");
    satz(wieGezaehltWird(t));

    const form = el("form", "tn-tafel-form");
    let feld = null;
    const zeigeFeld = (frage) => {
      form.querySelector(".tn-tafel-name")?.remove();
      feld = el("input");
      feld.type = "text";
      feld.maxLength = mini()?.NAME_MAX || 24;
      feld.placeholder = "Dein Name";
      feld.value = mini()?.name?.() || "";
      feld.autocomplete = "nickname";
      feld.setAttribute("aria-label", "Dein Name im Turnier");
      const zeile = el("div", "mini-namensfeld");
      zeile.append(feld);
      form.prepend(el("p", "tn-tafel-text", frage), zeile);
      feld.focus();
    };
    const wer = mini()?.name?.();
    if (wer) {
      const zeile = el("p", "tn-tafel-name");
      zeile.append(document.createTextNode(`Du spielst als ${wer}. `));
      zeile.append(knopf("Ändern", "mini-knopf-klein", () => zeigeFeld("Wie sollen die anderen dich nennen?")));
      form.append(zeile);
    }
    const los = el("button", "mini-knopf mini-knopf-voll tn-los", "Los geht's");
    los.type = "submit";
    const zeile = el("div", "tn-tafel-knoepfe");
    zeile.append(los, zumTurnier());
    form.append(zeile);
    form.addEventListener("submit", (ereignis) => {
      ereignis.preventDefault();
      losGehts(feld);
    });
    box.append(form);
    // Ohne Namen kein Turnier: Die Liste fasst nach Namen zusammen, und ein
    // Versuch ohne Namen gehörte niemandem.
    if (!wer) zeigeFeld("Unter welchem Namen spielst du mit?");
  }

  function losGehts(feld) {
    const vorher = mini()?.name?.() || "";
    if (feld) {
      // Erst prüfen, dann merken: Ein leeres Feld soll den Namen, der schon
      // dasteht, nicht wegwischen.
      if (!String(feld.value || "").trim()) { feld.focus(); return; }
      mini()?.setzeName?.(feld.value);
    }
    const wie = mini()?.name?.() || "";
    if (!wie || !spielbar()) { zeigeTor(); return; }
    // Ein neuer Name gilt überall, wo dieses Gerät steht – in der ewigen
    // Liste wie in diesem Turnier. Sonst stünde derselbe Mensch in der
    // Gesamtwertung zweimal: mit dem alten Namen im einen, mit dem neuen im
    // anderen Spiel.
    if (wie !== vorher) mini()?.benenneUm?.()?.catch?.(() => {});
    const spieler = mini()?.kennung?.();
    nacheinander(() => cloud()?.turnierUmbenennen?.(hier.id, { spieler, name: wie })).catch(() => {});

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
    hier.anmeldung = nacheinander(() => cloud().turnierVersuch(hier.id, wer)).then((stand) => {
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

  function fehlerBeimAnmelden(fehler) {
    if (fehler?.code === "turnier/keine-versuche") return "Alle Versuche waren schon gespielt – vielleicht auf einem anderen Gerät. Diese Runde zählt nicht.";
    if (fehler?.code === "permission-denied") return "Das Turnier hat diese Runde nicht angenommen – es ist vorbei oder angehalten.";
    return "Der Versuch liess sich nicht anmelden – ohne Verbindung zählt er nicht fürs Turnier.";
  }

  function ergebnisSatz(t, stand, spiel) {
    const e = einheit(spiel);
    if (t.zaehlt === "summe") {
      return stand.versuche === 1
        ? `Eingetragen: ${stand.punkte} ${e}.`
        : `Eingetragen. Zusammen: ${stand.punkte} ${e} aus ${stand.versuche} Versuchen.`;
    }
    if (stand.versuche === 1) return `Eingetragen: ${stand.punkte} ${e}.`;
    if (stand.rekord) return `Dein bester Versuch bisher – ${stand.punkte} ${e}!`;
    return `Eingetragen. Es bleibt dein bester Versuch: ${stand.punkte} ${e}.`;
  }

  /*
   * Der Block unter dem Ergebnis, im Turnier. Statt Namensfeld und ewiger
   * Liste: was ins Turnier eingetragen wurde, die Liste dieses Spiels im
   * Turnier, und wie viele Versuche noch bleiben.
   *
   * In die ewige Liste geht die Runde trotzdem (mini-games.js, melde) – eine
   * Runde ist eine Runde, und ein Rekord im Turnier ist auch einer in der
   * Hall of Fame.
   */
  function ergebnis({ punkte, geist = null }) {
    const spiel = spielHier();
    const t = hier.t;
    const block = el("div", "mini-ergebnis tn-ergebnis");
    const meldung = el("p", "mini-meldung");
    const platz = el("p", "tn-platz");
    const listenWirt = el("div", "mini-listen-wirt");
    const rest = el("p", "tn-rest");
    block.append(el("p", "tn-marke", t ? `Turnier · ${t.name}` : "Turnier"), meldung, platz, listenWirt, rest);

    mini()?.melde?.(spiel, punkte, geist)?.catch?.((fehler) => console.warn("Die Runde kam nicht in die ewige Liste", fehler));

    function restZeile() {
      if (!t) return;
      const l = lage(t);
      if (l !== "laeuft") { rest.textContent = l === "beendet" ? "Das Turnier ist vorbei." : "Das Turnier ist gerade angehalten."; return; }
      if (!t.versuche) { rest.textContent = "Du kannst weiterspielen, solange das Turnier läuft."; return; }
      const uebrig = Math.max(0, t.versuche - hier.gespielt);
      rest.textContent = uebrig === 0 ? "Das war dein letzter Versuch in diesem Spiel."
        : uebrig === 1 ? "Noch ein Versuch." : `Noch ${uebrig} Versuche.`;
    }

    function zeigeListe() {
      if (t.verdeckt && lage(t) !== "beendet") {
        listenWirt.append(el("p", "tn-verdeckt", "Die Rangliste bleibt bis zum Schluss verdeckt."));
        return;
      }
      cloud().turnierErgebnisse(hier.id, { game: spiel }).then((alle) => {
        const liste = rangliste(alle, spiel);
        listenWirt.innerHTML = "";
        listenWirt.append(mini().listeBauen(liste, spiel, { max: 5 }));
        const eigen = liste.find((e) => e.eigen);
        if (eigen) platz.textContent = eigen.platz === 1 ? "Platz 1 im Turnier!" : `Platz ${eigen.platz} von ${liste.length} im Turnier.`;
      }).catch(() => {
        listenWirt.textContent = "Die Rangliste des Turniers ist gerade nicht zu haben.";
      });
    }

    if (!t || !hier.laeuft || !hier.anmeldung) {
      meldung.textContent = t && lage(t) === "beendet"
        ? "Das Turnier ist vorbei – diese Runde zählt nicht mehr."
        : "Diese Runde zählt nicht fürs Turnier.";
      restZeile();
      return block;
    }

    hier.laeuft = false;
    const anmeldung = hier.anmeldung;
    hier.anmeldung = null;
    const eintrag = { game: spiel, spieler: mini().kennung(), name: mini().name(), punkte, zaehlt: t.zaehlt };
    const eintragen = () => cloud().turnierErgebnis(hier.id, eintrag);

    function zeige(weg) {
      meldung.textContent = "Wird ins Turnier eingetragen...";
      block.querySelector(".tn-nochmal")?.remove();
      weg.then((stand) => {
        hier.punkte = stand.punkte;
        meldung.textContent = ergebnisSatz(t, stand, spiel);
        restZeile();
        zeigeListe();
        // Das Turnier noch einmal lesen, für den nächsten Neustart: Wurde es
        // inzwischen angehalten oder beendet, soll die Tafel das sagen, statt
        // eine Runde anzubieten, die nicht mehr zählt.
        cloud().turnier(hier.id).then((frisch) => { if (frisch) hier.t = frisch; }, () => {});
      }, (fehler) => {
        restZeile();
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

  // Was der Lautsprecher nach einer Runde im Turnier sagt.
  function sprache({ punkte, label }) {
    const wort = String(label || "Punkte").replace(/^Deine?\s+/i, "");
    return `${punkte} ${wort}. Die Runde zählt fürs Turnier.`;
  }

  // Wohin der Weg oben links und der Pokal unter dem Ergebnis führen: im
  // Turnier zurück zum Turnier, nicht in die Hall of Fame.
  function ziel() {
    if (!aufSpielseite()) return null;
    return { link: seitenLink(ausDerAdresse("turnier")), wort: "Turnier", titel: "Zurück zum Turnier" };
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  window.LernappTurnier = {
    lage, dauer, datum, zeitraum, statusText, regeln, gesamtwertung,
    seitenLink, spielLink, volleAdresse,
    aufSpielseite, anBuehne, rundeBeginnt, neuStart, ergebnis, sprache, ziel,
    hinweis,
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
