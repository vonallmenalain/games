/*
 * admin.js – Der Adminbereich: anmelden, aufräumen, Turniere ausrichten.
 * ---------------------------------------------------------------------------
 * Drei Dinge kann er, und alle darf sonst niemand: die Spiele auswählen, die
 * auf der Startseite stehen, Einträge aus der Bestenliste löschen – und
 * Turniere anlegen, anhalten, beenden und wieder wegräumen.
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
  // Dass hier ein Admin angemeldet ist – für den Knopf auf der Startseite
  // (mini-games.js, adminKnopf). Die Spielseiten können die Anmeldung nicht
  // selbst lesen: Sie laden firebase-auth gar nicht erst.
  const ADMIN_KEY = "mini.admin";
  const MAX_EINTRAEGE = 2000;

  const cloud = () => window.MiniCloud || null;
  const hs = () => window.LernappHighscore || null;
  const mini = () => window.LernappMini || null;
  const tn = () => window.LernappTurnier || null;

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

  // Gesetzt, solange Firebase einen Admin meldet; weg, sobald nicht mehr –
  // beim Abmelden, bei einem fremden Konto, bei einer abgelaufenen Anmeldung.
  function merkeAdmin(angemeldet) {
    try {
      if (angemeldet) localStorage.setItem(ADMIN_KEY, "ja");
      else localStorage.removeItem(ADMIN_KEY);
    } catch { /* privater Modus – dann eben ohne Knopf */ }
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

  // ---------------------------------------------------------------------------
  // Turniere
  // ---------------------------------------------------------------------------
  // Ein Turnier ist eine eigene Bestenliste mit Anfang und Ende. Hier wird es
  // eingestellt, gespielt wird es auf der Turnierseite (turnier.js). Die
  // Regeln der Datenbank prüfen jedes Feld noch einmal; was hier geprüft
  // wird, ist nur dafür da, dass eine verständliche Meldung kommt statt
  // "permission-denied".
  const MINUTE = 60 * 1000;
  const STUNDE = 60 * MINUTE;
  const TAG = 24 * STUNDE;
  const DAUERN = [
    ["30 Minuten", 30 * MINUTE],
    ["1 Stunde", STUNDE],
    ["2 Stunden", 2 * STUNDE],
    ["3 Stunden", 3 * STUNDE],
    ["1 Tag", TAG],
    ["2 Tage", 2 * TAG],
    ["3 Tage", 3 * TAG],
    ["1 Woche", 7 * TAG],
    ["2 Wochen", 14 * TAG],
    ["1 Monat", 30 * TAG],
  ];
  const VERSUCHE = [[1, "1"], [2, "2"], [3, "3"], [5, "5"], [10, "10"], [0, "unbegrenzt"]];

  const zwei = (n) => String(n).padStart(2, "0");
  // Für <input type="datetime-local">: Ortszeit, ohne Sekunden.
  function fuerFeld(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}T${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
  }
  function ausFeld(wert) {
    const ms = new Date(String(wert || "")).getTime();
    return Number.isFinite(ms) ? ms : NaN;
  }

  // Der Name eines Turniers ist zugleich sein Link. Vorne ein Stück vom
  // Namen, damit man ihn wiedererkennt; hinten acht Zeichen Zufall – bei
  // einem Turnier "nur mit Link" ist genau dieser Teil der Schlüssel. Ohne l,
  // o, 0 und 1: Wer einen Link abtippt, verwechselt sie.
  function neueTurnierId(name) {
    const stamm = String(name || "").toLocaleLowerCase("de")
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+/, "")
      .slice(0, 24)
      .replace(/-+$/, "");
    const zeichen = "abcdefghijkmnpqrstuvwxyz23456789";
    const zufall = new Uint8Array(8);
    window.crypto.getRandomValues(zufall);
    const schwanz = [...zufall].map((n) => zeichen[n % zeichen.length]).join("");
    return `${stamm || "turnier"}-${schwanz}`;
  }

  async function kopiere(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch { window.prompt("Der Link zum Kopieren:", text); return false; }
  }

  let formularNummer = 0;

  /*
   * Das Formular für ein Turnier – neu oder zum Ändern.
   *
   * Die Dauer ist eine Auswahl und kein zweites Datumsfeld: "ein Tag", "eine
   * Woche" ist das, was man sagen will. Wer ein krummes Ende braucht, wählt
   * "eigenes Ende" und bekommt das Feld dazu.
   */
  function turnierFormular(vorlage, { offen, sichern, abbrechen }) {
    const nr = (formularNummer += 1);
    const jetzt = Date.now();
    // Auf die nächsten fünf Minuten gerundet: 14:35 statt 14:32:17.
    const start = Math.ceil(jetzt / (5 * MINUTE)) * 5 * MINUTE;
    const t = vorlage || {
      name: "",
      beschreibung: "",
      spiele: offen,
      startMs: start,
      endeMs: start + TAG,
      versuche: 3,
      zaehlt: "bester",
      wertung: "platz",
      aufgaben: "gleich",
      sichtbar: "alle",
      verdeckt: false,
      aktiv: true,
    };

    const form = el("form", "adm-turnier-form");
    form.append(el("h3", "", vorlage ? `«${vorlage.name}» ändern` : "Neues Turnier"));

    // --- Name und Beschreibung ------------------------------------------------
    const nameFeld = feld("text", "Name, z. B. Herbstcup");
    nameFeld.maxLength = cloud()?.TURNIER_NAME_MAX || 60;
    nameFeld.value = t.name;
    nameFeld.required = true;
    const nameZeile = el("label", "adm-zeile");
    nameZeile.append(el("span", "adm-zeile-wort", "Name"), nameFeld);
    form.append(nameZeile);

    const beschreibung = el("textarea", "adm-feld adm-textfeld");
    beschreibung.rows = 3;
    beschreibung.maxLength = cloud()?.BESCHREIBUNG_MAX || 600;
    beschreibung.placeholder = "Freiwillig: was es zu gewinnen gibt, eigene Regeln, wer eingeladen ist …";
    beschreibung.value = t.beschreibung || "";
    const beschreibungZeile = el("label", "adm-zeile");
    beschreibungZeile.append(el("span", "adm-zeile-wort", "Beschreibung"), beschreibung);
    form.append(beschreibungZeile);

    // --- Spiele ----------------------------------------------------------------
    const spieleGruppe = el("fieldset", "adm-gruppe");
    const spieleTitel = el("legend", "");
    spieleGruppe.append(spieleTitel);
    const gitter = el("div", "adm-auswahl");
    const gewaehlt = new Set(t.spiele);
    const zaehle = () => { spieleTitel.textContent = `Spiele – ${gewaehlt.size} gewählt`; };
    const haken = [];
    (mini()?.SPIELE || []).forEach((spiel) => {
      const zeile = el("label", "adm-wahl");
      zeile.style.setProperty("--adm-farbe", farbe(spiel.id).hell);
      const box = el("input");
      box.type = "checkbox";
      box.value = spiel.id;
      box.checked = gewaehlt.has(spiel.id);
      box.addEventListener("change", () => {
        if (box.checked) gewaehlt.add(spiel.id);
        else gewaehlt.delete(spiel.id);
        zeile.classList.toggle("ist-an", box.checked);
        zaehle();
      });
      zeile.classList.toggle("ist-an", box.checked);
      zeile.append(box, el("span", "adm-wahl-name", titel(spiel.id)));
      gitter.append(zeile);
      haken.push(box);
    });
    zaehle();
    spieleGruppe.append(gitter);
    const setze = (ids) => haken.forEach((box) => {
      const soll = ids.includes(box.value);
      if (box.checked !== soll) box.click();
    });
    const auswahlKnoepfe = el("div", "adm-kopf-aktionen");
    auswahlKnoepfe.append(
      knopf("Alle", "adm-knopf-klein", () => setze(haken.map((b) => b.value))),
      knopf("Keine", "adm-knopf-klein", () => setze([])),
      knopf("Nur die offenen", "adm-knopf-klein", () => setze(offen)),
      // Ein Überraschungsturnier: drei Spiele, die niemand vorher kennt.
      knopf("3 zufällige", "adm-knopf-klein", () => {
        const topf = offen.length >= 3 ? [...offen] : haken.map((b) => b.value);
        for (let i = topf.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [topf[i], topf[j]] = [topf[j], topf[i]];
        }
        setze(topf.slice(0, 3));
      }),
    );
    spieleGruppe.append(auswahlKnoepfe);
    form.append(spieleGruppe);

    // --- Wann ------------------------------------------------------------------
    const wann = el("fieldset", "adm-gruppe");
    wann.append(el("legend", "", "Wann"));
    const beginn = feld("datetime-local", "");
    beginn.value = fuerFeld(t.startMs);
    const dauer = el("select", "adm-feld");
    DAUERN.forEach(([wort, ms]) => {
      const option = el("option", "", wort);
      option.value = String(ms);
      dauer.append(option);
    });
    const eigen = el("option", "", "eigenes Ende …");
    eigen.value = "eigen";
    dauer.append(eigen);
    const passend = DAUERN.find(([, ms]) => ms === t.endeMs - t.startMs);
    dauer.value = passend ? String(passend[1]) : "eigen";
    const ende = feld("datetime-local", "");
    ende.value = fuerFeld(t.endeMs);
    const endeZeile = el("label", "adm-zeile");
    endeZeile.append(el("span", "adm-zeile-wort", "Ende"), ende);
    const endeText = el("p", "adm-klein");

    const beginnZeile = el("label", "adm-zeile");
    beginnZeile.append(el("span", "adm-zeile-wort", "Beginn"), beginn);
    const jetztKnopf = knopf("jetzt", "adm-knopf-klein", () => { beginn.value = fuerFeld(Date.now()); nachziehen(); });
    beginnZeile.append(jetztKnopf);
    const dauerZeile = el("label", "adm-zeile");
    dauerZeile.append(el("span", "adm-zeile-wort", "Dauer"), dauer);

    function endeMs() {
      if (dauer.value === "eigen") return ausFeld(ende.value);
      return ausFeld(beginn.value) + Number(dauer.value);
    }
    function nachziehen() {
      const eigenesEnde = dauer.value === "eigen";
      endeZeile.hidden = !eigenesEnde;
      const bis = endeMs();
      endeText.textContent = !eigenesEnde && Number.isFinite(bis) ? `Endet ${tn()?.datum?.(bis) || new Date(bis).toLocaleString("de-CH")}.` : "";
    }
    beginn.addEventListener("input", nachziehen);
    dauer.addEventListener("change", () => {
      if (dauer.value === "eigen" && !Number.isFinite(ausFeld(ende.value))) ende.value = fuerFeld(ausFeld(beginn.value) + TAG);
      nachziehen();
    });
    ende.addEventListener("input", nachziehen);
    nachziehen();
    wann.append(beginnZeile, dauerZeile, endeZeile, endeText);
    form.append(wann);

    // --- Regeln ----------------------------------------------------------------
    function wahl(titelText, name, optionen, wert) {
      const gruppe = el("fieldset", "adm-gruppe");
      gruppe.append(el("legend", "", titelText));
      optionen.forEach(([w, wort, erklaerung]) => {
        const zeile = el("label", "adm-option");
        const radio = el("input");
        radio.type = "radio";
        radio.name = `${name}-${nr}`;
        radio.value = w;
        radio.checked = w === wert;
        const texte = el("span", "adm-option-text");
        texte.append(el("strong", "", wort));
        if (erklaerung) texte.append(el("small", "", erklaerung));
        zeile.append(radio, texte);
        gruppe.append(zeile);
      });
      return gruppe;
    }
    const gewaehlterWert = (name) => form.querySelector(`input[name="${name}-${nr}"]:checked`)?.value || "";

    const versuche = el("select", "adm-feld adm-feld-schmal");
    VERSUCHE.forEach(([zahl, wort]) => {
      const option = el("option", "", wort);
      option.value = String(zahl);
      versuche.append(option);
    });
    versuche.value = String(VERSUCHE.some(([zahl]) => zahl === t.versuche) ? t.versuche : 3);
    const versucheZeile = el("label", "adm-zeile");
    versucheZeile.append(el("span", "adm-zeile-wort", "Versuche je Spiel"), versuche);
    const versucheHinweis = el("p", "adm-klein", "Ein Versuch zählt, sobald er beginnt – wer mittendrin neu lädt, hat ihn trotzdem gebraucht.");
    const regeln = el("fieldset", "adm-gruppe");
    regeln.append(el("legend", "", "Versuche"), versucheZeile, versucheHinweis);
    form.append(regeln);

    const zaehlt = wahl("Was in einem Spiel zählt", "zaehlt", [
      ["bester", "Der beste Versuch", "Wer es dreimal probiert, dem zählt die beste Runde."],
      ["summe", "Alle Versuche zusammen", "Jede Runde zählt dazu – geht nur mit einer festen Zahl von Versuchen."],
    ], t.zaehlt);
    form.append(zaehlt);
    // Zusammenzählen ohne Grenze hiesse: Es gewinnt, wer am längsten spielt.
    const summeRadio = zaehlt.querySelector('input[value="summe"]');
    const besterRadio = zaehlt.querySelector('input[value="bester"]');
    const pruefeSumme = () => {
      const unbegrenzt = versuche.value === "0";
      summeRadio.disabled = unbegrenzt;
      if (unbegrenzt && summeRadio.checked) besterRadio.checked = true;
    };
    versuche.addEventListener("change", pruefeSumme);
    pruefeSumme();

    form.append(wahl("Gesamtwertung über alle Spiele", "wertung", [
      ["platz", "Platzziffer", "Die Plätze aus allen Spielen zusammengezählt – die kleinste Summe gewinnt. Wer ein Spiel auslässt, bekommt dort den Platz hinter dem Letzten."],
      ["prozent", "Prozent vom Besten", "Der Beste eines Spiels bekommt 100, alle anderen ihren Anteil an seiner Zahl – die höchste Summe gewinnt. Hier zählt, wie knapp jemand dran war."],
    ], t.wertung));

    form.append(wahl("Aufgaben", "aufgaben", [
      ["gleich", "Für alle gleich", "Der erste Versuch ist für alle derselbe Lauf, der zweite auch – aber ein anderer als der erste. Kein Glück mit dem Würfel."],
      ["zufall", "Jedes Mal neu gewürfelt", "Wie ausserhalb des Turniers."],
    ], t.aufgaben));

    form.append(wahl("Wer es sieht", "sichtbar", [
      ["alle", "Für alle in der App", "Steht auf der Startseite, solange es läuft, und noch drei Tage danach."],
      ["link", "Nur mit Link", "Steht nirgends. Mitspielen kann, wem du den Link schickst."],
    ], t.sichtbar));

    const schalter = el("fieldset", "adm-gruppe");
    schalter.append(el("legend", "", "Und"));
    const verdeckt = el("input");
    verdeckt.type = "checkbox";
    verdeckt.checked = t.verdeckt;
    const verdecktZeile = el("label", "adm-option");
    const verdecktText = el("span", "adm-option-text");
    verdecktText.append(el("strong", "", "Rangliste bis zum Schluss verdecken"), el("small", "", "Für die Spannung, nicht zur Geheimhaltung: Wer will, liest die Zahlen trotzdem aus der Datenbank."));
    verdecktZeile.append(verdeckt, verdecktText);
    const aktiv = el("input");
    aktiv.type = "checkbox";
    aktiv.checked = t.aktiv;
    const aktivZeile = el("label", "adm-option");
    const aktivText = el("span", "adm-option-text");
    aktivText.append(el("strong", "", "Aktiv"), el("small", "", "Ohne Haken ist das Turnier angehalten: Es steht nirgends, und niemand kann spielen, bis du es fortsetzt."));
    aktivZeile.append(aktiv, aktivText);
    schalter.append(verdecktZeile, aktivZeile);
    form.append(schalter);

    // --- Speichern ---------------------------------------------------------------
    const meldung = el("p", "adm-meldung");
    const knoepfe = el("div", "adm-kopf-aktionen");
    const speichern = el("button", "adm-knopf adm-knopf-voll", vorlage ? "Speichern" : "Turnier anlegen");
    speichern.type = "submit";
    knoepfe.append(speichern, knopf("Abbrechen", "adm-knopf-hell", abbrechen));
    form.append(meldung, knoepfe);

    const sage = (text, art = "") => {
      meldung.textContent = text;
      meldung.className = `adm-meldung ${art}`.trim();
    };

    form.addEventListener("submit", async (ereignis) => {
      ereignis.preventDefault();
      const daten = {
        name: nameFeld.value.replace(/\s+/g, " ").trim(),
        beschreibung: beschreibung.value.trim(),
        spiele: haken.filter((b) => b.checked).map((b) => b.value),
        startMs: ausFeld(beginn.value),
        endeMs: endeMs(),
        versuche: Number(versuche.value) || 0,
        zaehlt: gewaehlterWert("zaehlt") || "bester",
        wertung: gewaehlterWert("wertung") || "platz",
        aufgaben: gewaehlterWert("aufgaben") || "gleich",
        sichtbar: gewaehlterWert("sichtbar") || "alle",
        verdeckt: verdeckt.checked,
        aktiv: aktiv.checked,
        erstelltMs: vorlage?.erstelltMs || Date.now(),
      };
      if (!daten.name) { sage("Ohne Namen gibt es kein Turnier.", "ist-fehler"); nameFeld.focus(); return; }
      if (!daten.spiele.length) { sage("Mindestens ein Spiel muss dabei sein.", "ist-fehler"); return; }
      if (!Number.isFinite(daten.startMs) || !Number.isFinite(daten.endeMs)) { sage("Beginn und Ende brauchen ein Datum und eine Uhrzeit.", "ist-fehler"); return; }
      if (daten.endeMs <= daten.startMs) { sage("Das Ende muss nach dem Beginn liegen.", "ist-fehler"); return; }
      if (!vorlage && daten.endeMs <= Date.now()) { sage("Dieses Turnier wäre schon vorbei, bevor es jemand sieht.", "ist-fehler"); return; }
      if (daten.zaehlt === "summe" && !daten.versuche) { sage("Alle Versuche zusammenzählen geht nur mit einer festen Zahl von Versuchen.", "ist-fehler"); return; }
      speichern.disabled = true;
      sage("Wird gespeichert...");
      try {
        await sichern(daten);
      } catch (fehler) {
        sage(fehlerText(fehler), "ist-fehler");
        speichern.disabled = false;
      }
    });

    window.setTimeout(() => nameFeld.focus(), 0);
    return form;
  }

  // Wie ein Turnier gerade steht, in einem Wort und einer Farbe.
  const LAGE_WORT = { laeuft: "läuft", geplant: "geplant", angehalten: "angehalten", beendet: "beendet" };

  function turnierZeile(t, eintraege, { bearbeiten, speichere, loesche }) {
    const lage = tn()?.lage?.(t) || "laeuft";
    const karte = el("article", `adm-turnier ist-${lage}`);

    const kopf = el("header", "adm-turnier-kopf");
    kopf.append(el("h3", "", t.name));
    kopf.append(el("span", `adm-marke ist-${lage}`, tn()?.statusText?.(t) || LAGE_WORT[lage]));
    kopf.append(el("span", "adm-marke", t.sichtbar === "alle" ? "öffentlich" : "nur mit Link"));
    if (t.verdeckt) kopf.append(el("span", "adm-marke", "verdeckt"));
    karte.append(kopf);

    const eckdaten = [
      tn()?.zeitraum?.(t) || "",
      t.spiele.map(titel).join(", "),
      t.versuche ? `${t.versuche} ${t.versuche === 1 ? "Versuch" : "Versuche"}` : "unbegrenzt",
      t.zaehlt === "summe" ? "Versuche zusammen" : "bester Versuch",
      t.spiele.length > 1 ? (t.wertung === "prozent" ? "Prozent vom Besten" : "Platzziffer") : "",
      t.aufgaben === "gleich" ? "gleiche Aufgaben" : "gewürfelt",
    ].filter(Boolean);
    karte.append(el("p", "adm-klein", eckdaten.join(" · ")));

    // Wer vorne liegt – auch bei einem verdeckten Turnier: Der Admin muss die
    // Siegerehrung vorbereiten können.
    let stand = "Der Stand ist gerade nicht zu haben.";
    if (Array.isArray(eintraege)) {
      const wertung = tn()?.gesamtwertung?.(t, eintraege);
      const personen = wertung?.personen || [];
      stand = personen.length
        ? `${zahlWort(personen.length, "Spieler", "Spieler")} · vorne: ${personen.slice(0, 3).map((p) => `${p.platz}. ${p.name}`).join(", ")}`
        : "Noch hat niemand gespielt.";
    }
    karte.append(el("p", "adm-klein adm-turnier-stand", stand));

    const adresse = tn()?.volleAdresse?.(t.id) || `${window.location.origin}/turnier?t=${t.id}`;
    const aktionen = el("div", "adm-kopf-aktionen");
    const oeffnen = el("a", "adm-knopf adm-knopf-klein", "Öffnen");
    oeffnen.href = tn()?.seitenLink?.(t.id) || `/turnier?t=${t.id}`;
    aktionen.append(oeffnen);
    const kopieren = knopf("Link kopieren", "adm-knopf-klein", async () => {
      if (await kopiere(adresse)) {
        kopieren.textContent = "Kopiert";
        window.setTimeout(() => { kopieren.textContent = "Link kopieren"; }, 2000);
      }
    });
    aktionen.append(kopieren);
    aktionen.append(knopf("Ändern", "adm-knopf-klein", () => bearbeiten(t)));

    // Bei Bedarf aktivieren: Ein vorbereitetes Turnier startet mit einem Klick,
    // ein laufendes lässt sich anhalten, ein angehaltenes fortsetzen.
    if (lage === "geplant") {
      aktionen.append(knopf("Jetzt starten", "adm-knopf-klein", () => speichere({ ...t, startMs: Date.now() })));
    }
    if (lage === "laeuft" || lage === "geplant") {
      aktionen.append(knopf("Anhalten", "adm-knopf-klein", () => speichere({ ...t, aktiv: false })));
    }
    if (lage === "angehalten") {
      aktionen.append(knopf("Fortsetzen", "adm-knopf-klein", () => speichere({ ...t, aktiv: true })));
    }
    if (lage === "laeuft" || (lage === "angehalten" && Date.now() > t.startMs)) {
      aktionen.append(knopf("Jetzt beenden", "adm-knopf-klein", () => {
        if (!window.confirm(`«${t.name}» jetzt beenden? Danach zählt keine Runde mehr.`)) return;
        speichere({ ...t, endeMs: Date.now() });
      }));
    }
    aktionen.append(knopf("Löschen", "adm-knopf-weg", () => {
      if (!window.confirm(`«${t.name}» löschen – mitsamt ${Array.isArray(eintraege) ? zahlWort(eintraege.length, "Eintrag", "Einträgen") : "allen Einträgen"}? Das lässt sich nicht rückgängig machen.`)) return;
      loesche(t);
    }));
    karte.append(aktionen);
    return karte;
  }

  function baueTurniere(offen) {
    const block = el("section", "adm-block adm-turniere");
    const kopf = el("header", "adm-block-kopf");
    kopf.append(el("h2", "", "Turniere"));
    const neuKnopf = knopf("Neues Turnier", "adm-knopf-voll", () => oeffne(null));
    kopf.append(neuKnopf);
    block.append(kopf);
    block.append(el("p", "adm-hinweis", "Ein Turnier ist eine eigene Bestenliste mit Anfang und Ende: welche Spiele, wie lange, wie viele Versuche, wie gewertet wird. Öffentlich steht es auf der Startseite; nur mit Link findet es nur, wem du den Link schickst."));

    const formWirt = el("div", "adm-turnier-formwirt");
    const meldung = el("p", "adm-meldung");
    const liste = el("div", "adm-turnier-liste");
    block.append(formWirt, meldung, liste);

    const sage = (text, art = "") => {
      meldung.textContent = text;
      meldung.className = `adm-meldung ${art}`.trim();
    };

    function schliesse() {
      formWirt.innerHTML = "";
      neuKnopf.hidden = false;
    }

    function oeffne(vorlage) {
      formWirt.innerHTML = "";
      neuKnopf.hidden = true;
      sage("");
      formWirt.append(turnierFormular(vorlage, {
        offen,
        abbrechen: schliesse,
        sichern: async (daten) => {
          const id = vorlage?.id || neueTurnierId(daten.name);
          await cloud().setzeTurnier(id, daten);
          schliesse();
          const adresse = tn()?.volleAdresse?.(id) || `${window.location.origin}/turnier?t=${id}`;
          sage(vorlage ? `«${daten.name}» ist gespeichert.` : `«${daten.name}» ist angelegt. Der Link: ${adresse}`, "ist-gut");
          await laden();
        },
      }));
      formWirt.scrollIntoView?.({ block: "start", behavior: "smooth" });
    }

    async function speichere(t) {
      sage("Wird gespeichert...");
      try {
        await cloud().setzeTurnier(t.id, t);
        sage(`«${t.name}» ist gespeichert.`, "ist-gut");
      } catch (fehler) {
        sage(fehlerText(fehler), "ist-fehler");
      }
      await laden();
    }

    async function loesche(t) {
      sage("Wird gelöscht...");
      try {
        await cloud().loescheTurnier(t.id);
        sage(`«${t.name}» ist gelöscht.`, "ist-gut");
      } catch (fehler) {
        sage(`Das ging nicht: ${fehlerText(fehler)}`, "ist-fehler");
      }
      await laden();
    }

    // Laufende zuerst, dann geplante, angehaltene und zuletzt die vorbei sind –
    // die neuesten davon oben.
    const REIHE = { laeuft: 0, geplant: 1, angehalten: 2, beendet: 3 };
    async function laden() {
      liste.innerHTML = "";
      liste.append(el("p", "adm-hinweis", "Die Turniere werden geladen..."));
      let turniere = [];
      try {
        turniere = await cloud().alleTurniere();
      } catch (fehler) {
        liste.innerHTML = "";
        liste.append(el("p", "adm-hinweis ist-fehler", `Die Turniere sind nicht zu haben: ${fehlerText(fehler)}`));
        return;
      }
      const jetzt = Date.now();
      const lage = (t) => tn()?.lage?.(t, jetzt) || "laeuft";
      turniere.sort((a, b) => REIHE[lage(a)] - REIHE[lage(b)]
        || (lage(a) === "beendet" ? b.endeMs - a.endeMs : a.startMs - b.startMs));
      // Die Einträge je Turnier: für die Zahl der Spieler und wer vorne liegt.
      const mitStand = await Promise.all(turniere.map((t) => cloud().turnierErgebnisse(t.id)
        .then((eintraege) => ({ t, eintraege }), () => ({ t, eintraege: null }))));
      liste.innerHTML = "";
      if (!mitStand.length) {
        liste.append(el("p", "adm-hinweis", "Noch kein Turnier. «Neues Turnier» legt eines an."));
        return;
      }
      mitStand.forEach(({ t, eintraege }) => liste.append(turnierZeile(t, eintraege, { bearbeiten: oeffne, speichere, loesche })));
    }

    laden();
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
    wirt.append(baueTurniere(offen));
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
      merkeAdmin(Boolean(nutzer) && istAdmin(nutzer));
      if (!nutzer) { zeigeAnmeldung(hinweis); hinweis = ""; return; }
      if (!istAdmin(nutzer)) { zeigeKeinAdmin(nutzer); return; }
      zeigeAdmin(nutzer);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", los);
  else los();
})();
