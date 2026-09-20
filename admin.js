/*
 * admin.js – Der Adminbereich: anmelden und aufräumen.
 * ---------------------------------------------------------------------------
 * Zwei Dinge kann er, und beide darf sonst niemand: die Spiele auswählen, die
 * auf der Startseite stehen, und Einträge aus der Bestenliste löschen.
 *
 * Wozu das gut ist: Eine Liste, in die jeder ohne Konto schreiben darf, ist
 * irgendwann eine Liste, in der ein Name steht, den man dort nicht haben will.
 * Dann braucht es jemanden, der ihn wegnehmen kann. Genau dafür – und für
 * nichts anderes – gibt es hier überhaupt eine Anmeldung.
 *
 * Drei Wege hinein, alle drei in Firebase eingeschaltet:
 *
 *   Google        ein Klick, Adresse von sich aus bestätigt
 *   E-Mail-Link   Link kommt per Mail, kein Passwort im Kopf
 *   Passwort      klassisch; die Adresse muss bestätigt sein, sonst gilt sie
 *                 den Regeln nicht (firestore.rules, istAdmin)
 *
 * Wer Admin ist, entscheidet nicht diese Datei, sondern firestore.rules.
 * Hier steht dieselbe Adresse noch einmal – aber nur, um dem Angemeldeten
 * sagen zu können, woran es liegt. Wer sie hier hineinschriebe, käme trotzdem
 * an keinen Eintrag: Die Datenbank fragt nicht den Browser.
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "admin") return;

  const ADMINS = ["alain.sc2@gmail.com"];
  const MAIL_KEY = "mini.admin.mail";
  const MAX_EINTRAEGE = 2000;

  const cloud = () => window.MiniCloud || null;
  const hs = () => window.LernappHighscore || null;
  const mini = () => window.LernappMini || null;

  const wirt = document.querySelector("[data-admin]");
  if (!wirt) return;

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
    const node = el("button", `adm-knopf ${klasse || ""}`.trim(), text);
    node.type = "button";
    node.addEventListener("click", beiKlick);
    return node;
  }

  function feld(art, platzhalter, autocomplete) {
    const node = el("input", "adm-feld");
    node.type = art;
    node.placeholder = platzhalter;
    if (autocomplete) node.autocomplete = autocomplete;
    return node;
  }

  const titel = (id) => hs()?.titel?.(id) || id;
  const zahlWort = (anzahl, eins, viele) => `${anzahl} ${anzahl === 1 ? eins : viele}`;
  const einheit = (id) => hs()?.spiel?.(id)?.einheit || "Punkte";
  function farbe(id) {
    const bereich = hs()?.spiel?.(id)?.bereich || "geschwindigkeit";
    return mini()?.FARBEN?.[bereich] || { hell: "#F5A623", dunkel: "#b9741a" };
  }

  function wann(ms) {
    const zahl = Number(ms) || 0;
    if (!zahl) return "–";
    try {
      return new Date(zahl).toLocaleString("de-CH", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch { return new Date(zahl).toISOString().slice(0, 16).replace("T", " "); }
  }

  // ---------------------------------------------------------------------------
  // Anmeldung
  // ---------------------------------------------------------------------------
  const istAdmin = (nutzer) => Boolean(nutzer?.email)
    && nutzer.emailVerified
    && ADMINS.includes(String(nutzer.email).toLowerCase());

  function auth() {
    const app = cloud()?.app?.();
    if (!app || !window.firebase?.auth) return null;
    return window.firebase.auth(app);
  }

  // Wohin der E-Mail-Link zurückführt: genau auf diese Seite. Ohne Suchteil –
  // Firebase hängt seinen eigenen an, und zwei Fragezeichen vertragen sich
  // nicht.
  const hierher = () => `${window.location.origin}${window.location.pathname}`;

  function merkeMail(adresse) {
    try { localStorage.setItem(MAIL_KEY, adresse); } catch { /* privater Modus */ }
  }
  function gemerkteMail() {
    try { return localStorage.getItem(MAIL_KEY) || ""; } catch { return ""; }
  }

  function fehlerText(fehler) {
    const code = String(fehler?.code || "");
    if (code === "auth/invalid-email") return "Diese Adresse sieht nicht wie eine Adresse aus.";
    if (code === "auth/missing-password") return "Ohne Passwort geht es nicht.";
    if (code === "auth/weak-password") return "Das Passwort ist zu kurz – mindestens sechs Zeichen.";
    if (code === "auth/email-already-in-use") return "Für diese Adresse gibt es schon ein Konto. Melde dich damit an.";
    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
      return "Adresse oder Passwort stimmen nicht.";
    }
    if (code === "auth/too-many-requests") return "Zu viele Versuche. Warte einen Moment.";
    if (code === "auth/popup-closed-by-user") return "Das Fenster wurde geschlossen, bevor die Anmeldung durch war.";
    if (code === "auth/unauthorized-domain") {
      return `Diese Adresse (${window.location.hostname}) ist in Firebase nicht freigegeben. Authentication → Settings → Authorized domains.`;
    }
    if (code === "auth/operation-not-allowed") return "Diese Anmeldeart ist in Firebase nicht eingeschaltet.";
    return fehler?.message ? String(fehler.message) : "Das hat nicht geklappt.";
  }

  function zeigeAnmeldung(hinweis) {
    wirt.innerHTML = "";
    const karte = el("section", "adm-karte adm-anmeldung");
    karte.append(el("h1", "adm-titel", "Adminbereich"));
    karte.append(el("p", "adm-lead", "Die Bestenliste der Mini-Games – ansehen und aufräumen."));

    const meldung = el("p", "adm-meldung");
    if (hinweis) meldung.textContent = hinweis;
    karte.append(meldung);
    const sage = (text, art = "") => {
      meldung.textContent = text;
      meldung.className = `adm-meldung ${art}`.trim();
    };

    // --- Google ---------------------------------------------------------------
    const google = knopf("Mit Google anmelden", "adm-knopf-voll", async () => {
      const a = auth();
      if (!a) { sage("Firebase ist nicht geladen.", "ist-fehler"); return; }
      sage("Fenster öffnet sich...");
      const anbieter = new window.firebase.auth.GoogleAuthProvider();
      try {
        await a.signInWithPopup(anbieter);
      } catch (fehler) {
        // Ein blockiertes Fenster ist kein Fehler des Nutzers – dann eben
        // über eine Weiterleitung.
        if (["auth/popup-blocked", "auth/cancelled-popup-request", "auth/operation-not-supported-in-this-environment"].includes(fehler?.code)) {
          try { await a.signInWithRedirect(anbieter); return; } catch (zweiter) { sage(fehlerText(zweiter), "ist-fehler"); return; }
        }
        sage(fehlerText(fehler), "ist-fehler");
      }
    });
    karte.append(google);

    karte.append(el("p", "adm-trenner", "oder"));

    // --- E-Mail-Link ----------------------------------------------------------
    const mailForm = el("form", "adm-form");
    const mailFeld = feld("email", "deine@adresse.ch", "email");
    mailFeld.value = gemerkteMail();
    mailFeld.required = true;
    const mailKnopf = el("button", "adm-knopf adm-knopf-hell", "Link per E-Mail");
    mailKnopf.type = "submit";
    mailForm.append(mailFeld, mailKnopf);
    mailForm.addEventListener("submit", async (ereignis) => {
      ereignis.preventDefault();
      const a = auth();
      const adresse = mailFeld.value.trim();
      if (!a || !adresse) return;
      sage("Link wird verschickt...");
      try {
        await a.sendSignInLinkToEmail(adresse, { url: hierher(), handleCodeInApp: true });
        merkeMail(adresse);
        sage(`Der Link ist unterwegs an ${adresse}. Öffne ihn auf diesem Gerät.`, "ist-gut");
      } catch (fehler) {
        sage(fehlerText(fehler), "ist-fehler");
      }
    });
    karte.append(mailForm);

    // --- Passwort -------------------------------------------------------------
    const pwForm = el("form", "adm-form adm-form-pw");
    const pwMail = feld("email", "deine@adresse.ch", "email");
    pwMail.value = gemerkteMail();
    pwMail.required = true;
    const pwFeld = feld("password", "Passwort", "current-password");
    pwFeld.required = true;
    const pwKnopf = el("button", "adm-knopf adm-knopf-hell", "Anmelden");
    pwKnopf.type = "submit";
    pwForm.append(pwMail, pwFeld, pwKnopf);
    pwForm.addEventListener("submit", async (ereignis) => {
      ereignis.preventDefault();
      const a = auth();
      if (!a) return;
      sage("Wird angemeldet...");
      try {
        await a.signInWithEmailAndPassword(pwMail.value.trim(), pwFeld.value);
        merkeMail(pwMail.value.trim());
      } catch (fehler) {
        sage(fehlerText(fehler), "ist-fehler");
      }
    });
    karte.append(pwForm);

    // Beim allerersten Mal gibt es das Konto noch nicht. Das Anlegen steht
    // klein daneben statt als eigener Weg: Wer hier landet, meldet sich in
    // aller Regel an und legt nichts an.
    const nebenbei = el("p", "adm-klein");
    nebenbei.append(document.createTextNode("Noch kein Konto mit Passwort? "));
    nebenbei.append(knopf("Anlegen", "adm-knopf-text", async () => {
      const a = auth();
      if (!a) return;
      const adresse = pwMail.value.trim();
      if (!adresse || !pwFeld.value) { sage("Adresse und Passwort ausfüllen, dann anlegen.", "ist-fehler"); return; }
      sage("Konto wird angelegt...");
      try {
        const { user } = await a.createUserWithEmailAndPassword(adresse, pwFeld.value);
        merkeMail(adresse);
        await user.sendEmailVerification({ url: hierher() });
        sage("Konto angelegt. Bestätige die Adresse über den Link in der Mail – vorher gilt sie den Regeln nicht.", "ist-gut");
      } catch (fehler) {
        sage(fehlerText(fehler), "ist-fehler");
      }
    }));
    karte.append(nebenbei);

    const zurueck = el("a", "adm-klein-link", "Zurück zu den Mini-Games");
    zurueck.href = "/";
    karte.append(zurueck);

    wirt.append(karte);
  }

  function zeigeKeinAdmin(nutzer) {
    wirt.innerHTML = "";
    const karte = el("section", "adm-karte adm-anmeldung");
    karte.append(el("h1", "adm-titel", "Adminbereich"));
    karte.append(el("p", "adm-meldung ist-fehler", nutzer.emailVerified
      ? `Angemeldet als ${nutzer.email} – aber das ist kein Admin dieser Site.`
      : `Angemeldet als ${nutzer.email}, aber die Adresse ist noch nicht bestätigt. Ohne Bestätigung gilt sie den Regeln nicht.`));
    if (!nutzer.emailVerified) {
      karte.append(knopf("Bestätigungsmail noch einmal schicken", "adm-knopf-voll", async () => {
        try {
          await nutzer.sendEmailVerification({ url: hierher() });
          karte.querySelector(".adm-meldung").textContent = "Die Mail ist unterwegs. Nach dem Klick auf den Link diese Seite neu laden.";
        } catch (fehler) {
          karte.querySelector(".adm-meldung").textContent = fehlerText(fehler);
        }
      }));
    }
    karte.append(knopf("Abmelden", "adm-knopf-hell", () => auth()?.signOut()));
    wirt.append(karte);
  }

  // ---------------------------------------------------------------------------
  // Der Adminbereich selbst
  // ---------------------------------------------------------------------------
  // Gelesen wird die ganze Sammlung, nicht Spiel für Spiel: Hier sollen auch
  // die Einträge auftauchen, deren Spiel es gar nicht mehr gibt – die sieht
  // sonst niemand, und aufräumen kann man nur, was man sieht.
  async function alleEintraege() {
    const db = cloud()?.db?.();
    if (!db) throw new Error("Firestore ist nicht bereit.");
    const schnappschuss = await db.collection("miniScores").limit(MAX_EINTRAEGE).get();
    const liste = [];
    schnappschuss.forEach((doc) => {
      const eintrag = cloud().lies(doc);
      if (eintrag) liste.push(eintrag);
    });
    return liste;
  }

  async function loesche(id) {
    const db = cloud()?.db?.();
    if (!db) throw new Error("Firestore ist nicht bereit.");
    await db.collection("miniScores").doc(id).delete();
  }

  async function benenneUm(id, name) {
    const db = cloud()?.db?.();
    if (!db) throw new Error("Firestore ist nicht bereit.");
    await db.collection("miniScores").doc(id).set({
      name,
      updatedAtMs: Date.now(),
      updatedAt: window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || null,
    }, { merge: true });
  }

  // ---------------------------------------------------------------------------
  // Welche Spiele gespielt werden können
  // ---------------------------------------------------------------------------
  // Ein Haken je Spiel. Was angehakt ist, steht auf der Startseite und in der
  // Hall of Fame; was nicht, verschwindet dort. Gespeichert wird als eine
  // Liste in config/miniGames – und zwar sofort beim Klick, nicht erst auf
  // einen "Speichern"-Knopf: Ein Haken, der nichts tut, bis man ihn bestätigt,
  // ist ein Haken, den man vergisst.
  //
  // Wer den Link zu einem abgewählten Spiel hat, kann es weiter öffnen und
  // spielen – die Adresse bleibt, die Seite bleibt. Nur aufgeführt wird es
  // nicht mehr. Das ist Absicht: Ein Link, den jemand verschickt hat, soll
  // nicht ins Leere laufen.
  function baueAuswahl(offen, neuLaden) {
    const block = el("section", "adm-block");
    const kopf = el("header", "adm-block-kopf");
    kopf.append(el("h2", "", "Welche Spiele gespielt werden"));
    const zahl = el("span", "adm-block-zahl", `${offen.length} von ${(mini()?.SPIELE || []).length} angehakt`);
    kopf.append(zahl);
    block.append(kopf);
    block.append(el("p", "adm-hinweis", "Angehakt heisst: steht auf der Startseite und in der Hall of Fame. Abgewählt heisst nur, dass es dort nicht mehr auftaucht – wer den Link hat, kann weiterspielen."));

    const meldung = el("p", "adm-meldung");
    block.append(meldung);

    const gitter = el("div", "adm-auswahl");
    const gewaehlt = new Set(offen);

    async function sichern() {
      meldung.textContent = "Wird gespeichert...";
      meldung.className = "adm-meldung";
      try {
        await cloud().setzeOffeneSpiele([...gewaehlt]);
        meldung.textContent = "Gespeichert.";
        meldung.className = "adm-meldung ist-gut";
        zahl.textContent = `${gewaehlt.size} von ${(mini()?.SPIELE || []).length} angehakt`;
      } catch (fehler) {
        meldung.textContent = fehlerText(fehler);
        meldung.className = "adm-meldung ist-fehler";
        neuLaden();
      }
    }

    (mini()?.SPIELE || []).forEach((spiel) => {
      const f = farbe(spiel.id);
      const zeile = el("label", "adm-wahl");
      zeile.style.setProperty("--adm-farbe", f.hell);
      const haken = el("input");
      haken.type = "checkbox";
      haken.checked = gewaehlt.has(spiel.id);
      haken.addEventListener("change", () => {
        if (haken.checked) gewaehlt.add(spiel.id);
        else gewaehlt.delete(spiel.id);
        zeile.classList.toggle("ist-an", haken.checked);
        sichern();
      });
      zeile.classList.toggle("ist-an", haken.checked);
      zeile.append(haken, el("span", "adm-wahl-name", titel(spiel.id)));
      gitter.append(zeile);
    });
    block.append(gitter);

    const alleAn = knopf("Alle anhaken", "adm-knopf-klein", () => {
      gitter.querySelectorAll("input").forEach((h) => { if (!h.checked) h.click(); });
    });
    const alleAus = knopf("Alle abwählen", "adm-knopf-klein", () => {
      gitter.querySelectorAll("input").forEach((h) => { if (h.checked) h.click(); });
    });
    const zeile = el("div", "adm-kopf-aktionen");
    zeile.append(alleAn, alleAus);
    block.append(zeile);
    return block;
  }

  function streifen(zahlen) {
    const wrap = el("div", "adm-streifen");
    zahlen.forEach(([wert, wort]) => {
      const kasten = el("div");
      kasten.append(el("strong", "", String(wert)), el("span", "", wort));
      wrap.append(kasten);
    });
    return wrap;
  }

  function baueSpiel(spiel, eintraege, neuLaden, bekannt) {
    const f = farbe(spiel);
    const block = el("section", "adm-block");
    block.style.setProperty("--adm-farbe", f.hell);
    block.style.setProperty("--adm-farbe-dunkel", f.dunkel);

    const kopf = el("header", "adm-block-kopf");
    kopf.append(el("h2", "", bekannt ? titel(spiel) : `${spiel} (kein Spiel mehr)`));
    const runden = eintraege.reduce((summe, e) => summe + Math.max(1, e.versuche), 0);
    kopf.append(el("span", "adm-block-zahl",
      `${zahlWort(eintraege.length, "Eintrag", "Einträge")} · ${zahlWort(runden, "Runde", "Runden")}`));
    block.append(kopf);

    const tabelle = el("table", "adm-tabelle");
    const kopfZeile = el("tr");
    ["Name", einheit(spiel), "Runden", "Zuletzt", ""].forEach((text, i) => {
      kopfZeile.append(el("th", i > 0 && i < 4 ? "zahl" : "", text));
    });
    const thead = el("thead");
    thead.append(kopfZeile);
    tabelle.append(thead);

    const body = el("tbody");
    eintraege
      .slice()
      .sort((a, b) => b.punkte - a.punkte || a.updatedAtMs - b.updatedAtMs)
      .forEach((eintrag) => {
        const zeile = el("tr");
        const name = el("td", "adm-name");
        name.append(el("span", "", eintrag.name));
        const kennung = el("small", "adm-kennung", eintrag.spieler);
        name.append(kennung);
        zeile.append(name);
        zeile.append(el("td", "zahl", String(eintrag.punkte)));
        zeile.append(el("td", "zahl", String(eintrag.versuche)));
        zeile.append(el("td", "zahl", wann(eintrag.updatedAtMs)));

        const aktionen = el("td", "adm-aktionen");
        aktionen.append(knopf("Namen ändern", "adm-knopf-klein", async () => {
          const neu = window.prompt("Neuer Name (höchstens 24 Zeichen):", eintrag.name);
          if (neu === null) return;
          const sauber = String(neu).replace(/\s+/g, " ").trim().slice(0, 24);
          if (!sauber) return;
          try { await benenneUm(eintrag.id, sauber); neuLaden(); }
          catch (fehler) { window.alert(`Das ging nicht: ${fehlerText(fehler)}`); }
        }));
        // Löschen fragt nach. Ein Eintrag ist weg, wenn er weg ist – und die
        // beiden Knöpfe liegen nebeneinander.
        aktionen.append(knopf("Löschen", "adm-knopf-weg", async () => {
          if (!window.confirm(`"${eintrag.name}" aus ${bekannt ? titel(spiel) : spiel} löschen?`)) return;
          try { await loesche(eintrag.id); neuLaden(); }
          catch (fehler) { window.alert(`Das ging nicht: ${fehlerText(fehler)}`); }
        }));
        zeile.append(aktionen);
        body.append(zeile);
      });
    tabelle.append(body);
    block.append(tabelle);
    return block;
  }

  function baueSpieler(alle, neuLaden) {
    const block = el("section", "adm-block");
    block.append(el("h2", "", "Die Spieler"));

    const nachName = new Map();
    alle.forEach((eintrag) => {
      const schluessel = eintrag.name.toLocaleLowerCase("de");
      if (!nachName.has(schluessel)) nachName.set(schluessel, { name: eintrag.name, spiele: 0, runden: 0, eintraege: [] });
      const person = nachName.get(schluessel);
      person.spiele += 1;
      person.runden += Math.max(1, eintrag.versuche);
      person.eintraege.push(eintrag);
    });
    const personen = [...nachName.values()].sort((a, b) => b.runden - a.runden || a.name.localeCompare(b.name, "de"));

    if (!personen.length) {
      block.append(el("p", "adm-hinweis", "Noch hat niemand gespielt."));
      return block;
    }

    const tabelle = el("table", "adm-tabelle");
    const kopfZeile = el("tr");
    ["Name", "Spiele", "Runden", ""].forEach((text, i) => kopfZeile.append(el("th", i > 0 && i < 3 ? "zahl" : "", text)));
    const thead = el("thead");
    thead.append(kopfZeile);
    tabelle.append(thead);

    const body = el("tbody");
    personen.forEach((person) => {
      const zeile = el("tr");
      zeile.append(el("td", "adm-name", person.name));
      zeile.append(el("td", "zahl", String(person.spiele)));
      zeile.append(el("td", "zahl", String(person.runden)));
      const aktionen = el("td", "adm-aktionen");
      // Der Weg für den Tag, an dem jemand einen Namen einträgt, den man hier
      // nicht haben will: alles von ihm auf einmal.
      const wieViele = zahlWort(person.spiele, "Eintrag", "Einträge");
      aktionen.append(knopf(person.spiele === 1 ? "Eintrag löschen" : `Alle ${wieViele} löschen`, "adm-knopf-weg", async () => {
        if (!window.confirm(`Wirklich ${person.spiele === 1 ? "den Eintrag" : `alle ${wieViele}`} von "${person.name}" löschen?`)) return;
        try {
          for (const eintrag of person.eintraege) await loesche(eintrag.id);
          neuLaden();
        } catch (fehler) { window.alert(`Das ging nicht: ${fehlerText(fehler)}`); }
      }));
      zeile.append(aktionen);
      body.append(zeile);
    });
    tabelle.append(body);
    block.append(tabelle);
    return block;
  }

  async function zeigeAdmin(nutzer) {
    wirt.innerHTML = "";

    const kopf = el("header", "adm-kopf");
    const links = el("div");
    links.append(el("h1", "adm-titel", "Adminbereich"), el("p", "adm-klein", `${nutzer.email} · ${cloud()?.projektId || ""}`));
    kopf.append(links);
    const rechts = el("div", "adm-kopf-aktionen");
    const neu = knopf("Neu laden", "adm-knopf-hell", () => zeigeAdmin(nutzer));
    const zuDenSpielen = el("a", "adm-knopf adm-knopf-hell", "Zu den Spielen");
    zuDenSpielen.href = "/";
    rechts.append(neu, zuDenSpielen, knopf("Abmelden", "adm-knopf-still", () => auth()?.signOut()));
    kopf.append(rechts);
    wirt.append(kopf);

    const laedt = el("p", "adm-hinweis", "Die Einträge werden geladen...");
    wirt.append(laedt);

    const bekannte = (mini()?.SPIELE || []).map((s) => s.id);

    let alle = [];
    let offen = [];
    try {
      let gewaehlt;
      [alle, gewaehlt] = await Promise.all([alleEintraege(), cloud().offeneSpiele()]);
      // null heisst "es wurde nie etwas ausgewählt" – dann gelten alle, und
      // genau so steht es dann auch angehakt da.
      // Sonst wird gefiltert wie in der Übersicht (mini-games.js, offeneSpiele):
      // Stünde in der Liste ein Spiel, das es nicht mehr gibt, zählte die Zahl
      // hier eine Karte mit, die drüben keine ist.
      offen = gewaehlt === null || gewaehlt === undefined
        ? bekannte
        : bekannte.filter((id) => gewaehlt.includes(id));
    }
    catch (fehler) {
      laedt.textContent = `Die Einträge sind nicht zu haben: ${fehlerText(fehler)}`;
      laedt.className = "adm-hinweis ist-fehler";
      return;
    }
    laedt.remove();

    const namen = new Set(alle.map((e) => e.name.toLocaleLowerCase("de")));
    const runden = alle.reduce((summe, e) => summe + Math.max(1, e.versuche), 0);
    const mitEintraegen = new Set(alle.map((e) => e.game));
    wirt.append(streifen([
      [alle.length, alle.length === 1 ? "Eintrag" : "Einträge"],
      [namen.size, namen.size === 1 ? "Spieler" : "Spieler"],
      [runden, runden === 1 ? "Runde" : "Runden"],
      [offen.length, `von ${bekannte.length} Spielen offen`],
    ]));

    const neuLaden = () => zeigeAdmin(nutzer);
    wirt.append(baueAuswahl(offen, neuLaden));

    if (!alle.length) {
      wirt.append(el("p", "adm-hinweis", "Die Bestenliste ist leer. Sobald jemand spielt und seinen Namen einträgt, steht er hier."));
      return;
    }

    wirt.append(baueSpieler(alle, neuLaden));

    // Erst die Spiele, die es gibt, in der Reihenfolge der Liste – dann, was
    // von Spielen übrig ist, die es nicht mehr gibt.
    const gespielt = bekannte.filter((id) => mitEintraegen.has(id));
    const verwaist = [...mitEintraegen].filter((id) => !bekannte.includes(id)).sort();
    for (const spiel of gespielt) {
      wirt.append(baueSpiel(spiel, alle.filter((e) => e.game === spiel), neuLaden, true));
    }
    for (const spiel of verwaist) {
      wirt.append(baueSpiel(spiel, alle.filter((e) => e.game === spiel), neuLaden, false));
    }
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  async function los() {
    const a = auth();
    if (!a) {
      wirt.innerHTML = "";
      wirt.append(el("p", "adm-hinweis ist-fehler", "Firebase liess sich nicht laden. Ohne Netz geht der Adminbereich nicht."));
      return;
    }

    let hinweis = "";

    // Zurück von der Google-Weiterleitung.
    try { await a.getRedirectResult(); } catch (fehler) { hinweis = fehlerText(fehler); }

    // Zurück vom E-Mail-Link. Die Adresse steht auf dem Gerät; wurde der Link
    // auf einem anderen geöffnet, muss sie noch einmal getippt werden.
    if (a.isSignInWithEmailLink(window.location.href)) {
      let adresse = gemerkteMail();
      if (!adresse) adresse = window.prompt("Auf welche Adresse wurde der Link geschickt?") || "";
      if (adresse) {
        try {
          await a.signInWithEmailLink(adresse.trim(), window.location.href);
          merkeMail(adresse.trim());
          // Den Link aus der Adresszeile nehmen: Er gilt nur einmal, und beim
          // Neuladen stünde sonst eine Fehlermeldung statt des Bereichs.
          window.history.replaceState({}, "", hierher());
        } catch (fehler) {
          hinweis = fehlerText(fehler);
        }
      }
    }

    a.onAuthStateChanged((nutzer) => {
      if (!nutzer) { zeigeAnmeldung(hinweis); hinweis = ""; return; }
      if (!istAdmin(nutzer)) { zeigeKeinAdmin(nutzer); return; }
      zeigeAdmin(nutzer);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", los);
  else los();
})();
