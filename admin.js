/*
 * admin.js – Der Adminbereich: anmelden, aufräumen, Turniere ausrichten.
 * ---------------------------------------------------------------------------
 * Drei Dinge kann er, und alle darf sonst niemand: die Spiele auswählen, die
 * auf der Startseite stehen, Einträge aus der Bestenliste löschen oder
 * zusammenführen – und Turniere anlegen, anhalten, beenden und wieder
 * wegräumen. Dazu zeigt er, was in der Bestenliste steckt: je Spiel, je
 * Spieler (mit einer eigenen Auswertung), nach Tier, Startseite oder
 * Turnier gefiltert.
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
 * In einer Deploy Preview von Netlify meldet Google über die Live-Adresse an
 * (siehe Anmeldung in einer Netlify-Vorschau weiter unten).
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

  // Das offene Turnierformular, falls eines offen ist – für den Zurück-Knopf
  // des Browsers (baueTurniere, schliesse). Wohin danach gerollt wird,
  // entscheidet schliesse selbst; der Browser soll dabei nicht dazwischen
  // rollen.
  let formularZu = null;
  window.addEventListener("popstate", () => formularZu?.());
  try { history.scrollRestoration = "manual"; } catch { /* dann eben nicht */ }

  // Alles weg, was gerade dasteht – auch ein offenes Turnierformular samt
  // seiner Ansicht für sich allein.
  function leere() {
    wirt.innerHTML = "";
    wirt.classList.remove("ist-formular");
    formularZu = null;
    klappen.clear();
    dashboard?.zu({ still: true });
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

  // Kürzer für die Tabellen: ohne Jahr, solange es dieses Jahr ist.
  function wannKurz(ms) {
    const zahl = Number(ms) || 0;
    if (!zahl) return "–";
    const datum = new Date(zahl);
    const diesesJahr = datum.getFullYear() === new Date().getFullYear();
    try {
      return datum.toLocaleString("de-CH", diesesJahr
        ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
        : { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch { return wann(zahl); }
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

  // ---------------------------------------------------------------------------
  // Anmeldung in einer Netlify-Vorschau
  // ---------------------------------------------------------------------------
  /*
   * Firebase lässt «Mit Google anmelden» nur auf freigegebenen Adressen zu
   * (Authorized domains) und kennt dort keine Platzhalter – jede Deploy
   * Preview hat aber ihre eigene Adresse. Deshalb holt sich die Vorschau das
   * Google-Token über die Live-Adresse: Dort öffnet sich ein Fenster
   * (/admin?vorschau=<Adresse der Vorschau>), das bei Google anmeldet und das
   * Token per postMessage zurückschickt. Damit meldet sich die Vorschau bei
   * Firebase an – signInWithCredential fragt nicht nach der Domain. Dasselbe
   * wie im Entdecker.
   *
   * Das Token geht nur an Vorschauen dieses Netlify-Projekts, und nur an
   * solche aus diesem Repository selbst: an die Deploy Preview eines eigenen
   * Pull Requests (deploy-preview-<n>--…) und an einen einzelnen Deploy
   * (<kennung>--…), wenn er aus main gebaut ist – so zeigt Netlify den Stand,
   * der noch nicht veröffentlicht ist – oder zu einem eigenen Pull Request
   * gehört. Das Repository ist öffentlich: Einen Pull Request aus einem Fork
   * kann jeder öffnen, und seine Vorschau führt fremden Code aus. Woher ein
   * Pull Request kommt, sagt die GitHub-API, woraus ein Deploy gebaut ist,
   * die Netlify-API (beide ohne Anmeldung).
   *
   * Das Fenster auf der Live-Adresse braucht diese Fassung von admin.js –
   * erst wenn sie dort veröffentlicht ist, geht die Anmeldung in Vorschauen.
   */
  const LIVE = "https://games.alae.app";
  const REPO = "vonallmenalain/games";
  // Die Seite dieses Projekts bei Netlify (gamesrepo).
  const NETLIFY_SEITE = "f509e792-125f-4e61-aade-64425bb5dde2";
  const VORSCHAU = /^https:\/\/(?:deploy-preview-(\d+)|([0-9a-f]{24}))--gamesrepo\.netlify\.app$/;
  const VORSCHAU_NACHRICHT = "mini:vorschau-anmeldung";
  const inVorschau = () => VORSCHAU.test(window.location.origin);
  const authFehler = (code) => Object.assign(new Error(code), { code });

  // In der Vorschau: das Fenster auf der Live-Adresse öffnen und auf das
  // Token warten.
  function googleUeberLive() {
    const fenster = window.open(`${LIVE}/admin?vorschau=${encodeURIComponent(window.location.origin)}`,
      "mini-vorschau-anmeldung", "popup,width=480,height=680");
    if (!fenster) return Promise.reject(authFehler("auth/popup-blocked"));
    return new Promise((fertig, scheitert) => {
      function bote(ereignis) {
        if (ereignis.source !== fenster || ereignis.origin !== LIVE) return;
        const d = ereignis.data;
        if (d?.type !== VORSCHAU_NACHRICHT) return;
        const idToken = typeof d.idToken === "string" ? d.idToken : null;
        const accessToken = typeof d.accessToken === "string" ? d.accessToken : null;
        if (!idToken && !accessToken) return;
        stop();
        fertig(window.firebase.auth.GoogleAuthProvider.credential(idToken, accessToken));
      }
      // Fenster ohne Anmeldung geschlossen: wie bei signInWithPopup.
      const uhr = window.setInterval(() => {
        if (!fenster.closed) return;
        stop();
        scheitert(authFehler("auth/popup-closed-by-user"));
      }, 500);
      function stop() {
        window.removeEventListener("message", bote);
        window.clearInterval(uhr);
      }
      window.addEventListener("message", bote);
    });
  }

  // Stammt der Pull Request aus diesem Repository (und nicht aus einem Fork)?
  async function eigenerPullRequest(nummer) {
    try {
      const antwort = await fetch(`https://api.github.com/repos/${REPO}/pulls/${nummer}`, { headers: { Accept: "application/vnd.github+json" } });
      if (!antwort.ok) return false;
      const pr = await antwort.json();
      return pr?.head?.repo?.full_name === REPO && pr?.base?.repo?.full_name === REPO;
    } catch { return false; }
  }

  // Ein einzelner Deploy: Woraus ist er gebaut? Vertraut wird dem Stand von
  // main und der Vorschau eines eigenen Pull Requests – zurück kommt, was es
  // ist, sonst null.
  async function eigenerDeploy(kennung) {
    try {
      const antwort = await fetch(`https://api.netlify.com/api/v1/deploys/${kennung}`, { headers: { Accept: "application/json" } });
      if (!antwort.ok) return null;
      const d = await antwort.json();
      if (d?.id !== kennung || d?.site_id !== NETLIFY_SEITE) return null;
      if (d.context === "production" && d.branch === "main") return `Stand von main, ${String(d.commit_ref || "").slice(0, 7)}`;
      const nummer = String(d.review_id ?? "");
      if (d.context === "deploy-preview" && /^\d+$/.test(nummer) && await eigenerPullRequest(nummer)) return `Pull Request #${nummer}`;
      return null;
    } catch { return null; }
  }

  // Auf der Live-Adresse, im Fenster, das eine Vorschau geöffnet hat: bei
  // Google anmelden – mit einer zweiten Anwendung ohne Speicher (cloud.js,
  // vorschauApp), die eigene Anmeldung hier bleibt, wie sie ist – und das
  // Token an die Vorschau schicken.
  async function zeigeVorschauAnmeldung(ziel) {
    leere();
    const karte = el("section", "adm-karte adm-anmeldung");
    karte.append(el("h1", "adm-titel", "Anmeldung für die Vorschau"));
    wirt.append(karte);
    const opener = window.opener;
    const treffer = VORSCHAU.exec(ziel);
    const zurueck = el("a", "adm-klein-link", "Zum Adminbereich");
    zurueck.href = "/admin";
    if (!opener || !treffer) {
      karte.append(el("p", "adm-lead", "Diese Seite öffnet sich aus einer Vorschau des Adminbereichs."), zurueck);
      return;
    }
    const [, nummer, kennung] = treffer;
    const lead = el("p", "adm-lead", `Die Vorschau ${new URL(ziel).host} möchte dich mit deinem Google-Konto anmelden.`);
    const meldung = el("p", "adm-meldung", "Die Vorschau wird geprüft...");
    karte.append(lead, meldung);
    const sage = (text, art = "") => {
      meldung.textContent = text;
      meldung.className = `adm-meldung ${art}`.trim();
    };
    const woher = nummer
      ? ((await eigenerPullRequest(nummer)) ? `Pull Request #${nummer}` : null)
      : await eigenerDeploy(kennung);
    if (!woher) {
      sage(`Diese Vorschau stammt weder aus main noch aus einem Pull Request von ${REPO} – oder GitHub und Netlify antworten gerade nicht. Angemeldet wird nur in eigenen Vorschauen.`, "ist-fehler");
      karte.append(zurueck);
      return;
    }
    lead.textContent = `Die Vorschau ${new URL(ziel).host} (${woher}) möchte dich mit deinem Google-Konto anmelden.`;
    sage("");
    const google = knopf("Mit Google anmelden", "adm-knopf-voll", async () => {
      const app = cloud()?.vorschauApp?.();
      if (!app || !window.firebase?.auth) { sage("Firebase ist nicht geladen.", "ist-fehler"); return; }
      const a = window.firebase.auth(app);
      sage("Fenster öffnet sich...");
      try {
        await a.setPersistence(window.firebase.auth.Auth.Persistence.NONE);
        const anbieter = new window.firebase.auth.GoogleAuthProvider();
        anbieter.setCustomParameters({ prompt: "select_account" });
        const ergebnis = await a.signInWithPopup(anbieter);
        const nachweis = ergebnis?.credential || null;
        await a.signOut();
        if (!nachweis?.idToken && !nachweis?.accessToken) { sage("Google hat kein Token geschickt.", "ist-fehler"); return; }
        opener.postMessage({ type: VORSCHAU_NACHRICHT, idToken: nachweis.idToken || null, accessToken: nachweis.accessToken || null }, ziel);
        google.remove();
        sage("Angemeldet. Dieses Fenster schliesst sich gleich.", "ist-gut");
        window.setTimeout(() => window.close(), 1200);
      } catch (fehler) {
        sage(fehlerText(fehler), "ist-fehler");
      }
    });
    karte.append(google);
  }

  function zeigeAnmeldung(hinweis) {
    leere();
    const karte = el("section", "adm-karte adm-anmeldung");
    karte.append(el("h1", "adm-titel", "Adminbereich"));
    karte.append(el("p", "adm-lead", "Die Bestenlisten der alae arcade – ansehen und aufräumen."));

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
      // In einer Netlify-Vorschau: über die Live-Adresse.
      if (inVorschau()) {
        try {
          await a.signInWithCredential(await googleUeberLive());
        } catch (fehler) {
          sage(fehlerText(fehler), "ist-fehler");
        }
        return;
      }
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

    // --- E-Mail: Link oder Passwort ---------------------------------------
    // Eine Adresse für beide Wege. Mit Passwort meldet «Anmelden» an, ohne
    // schickt «Link per E-Mail» einen Link, der anmeldet.
    const mailForm = el("form", "adm-form adm-form-mail");
    const mailFeld = feld("email", "deine@adresse.ch", "email");
    mailFeld.value = gemerkteMail();
    mailFeld.required = true;
    const pwFeld = feld("password", "Passwort", "current-password");
    const pwKnopf = el("button", "adm-knopf adm-knopf-hell", "Anmelden");
    pwKnopf.type = "submit";
    const mailKnopf = el("button", "adm-knopf adm-knopf-hell", "Link per E-Mail");
    mailKnopf.type = "button";
    const mailKnoepfe = el("div", "adm-form-knoepfe");
    mailKnoepfe.append(pwKnopf, mailKnopf);
    mailForm.append(mailFeld, pwFeld, mailKnoepfe);
    mailKnopf.addEventListener("click", async () => {
      const a = auth();
      const adresse = mailFeld.value.trim();
      if (!a || !mailFeld.reportValidity() || !adresse) return;
      sage("Link wird verschickt...");
      try {
        await a.sendSignInLinkToEmail(adresse, { url: hierher(), handleCodeInApp: true });
        merkeMail(adresse);
        sage(`Der Link ist unterwegs an ${adresse}. Öffne ihn auf diesem Gerät.`, "ist-gut");
      } catch (fehler) {
        sage(fehlerText(fehler), "ist-fehler");
      }
    });
    mailForm.addEventListener("submit", async (ereignis) => {
      ereignis.preventDefault();
      const a = auth();
      if (!a) return;
      if (!pwFeld.value) { sage("Passwort eingeben – oder «Link per E-Mail».", "ist-fehler"); pwFeld.focus(); return; }
      sage("Wird angemeldet...");
      try {
        await a.signInWithEmailAndPassword(mailFeld.value.trim(), pwFeld.value);
        merkeMail(mailFeld.value.trim());
      } catch (fehler) {
        sage(fehlerText(fehler), "ist-fehler");
      }
    });
    karte.append(mailForm);

    // Beim allerersten Mal gibt es das Konto noch nicht. Das Anlegen steht
    // klein daneben statt als eigener Weg: Wer hier landet, meldet sich in
    // aller Regel an und legt nichts an.
    const nebenbei = el("p", "adm-klein");
    nebenbei.append(document.createTextNode("Noch kein Konto mit Passwort? "));
    nebenbei.append(knopf("Anlegen", "adm-knopf-text", async () => {
      const a = auth();
      if (!a) return;
      const adresse = mailFeld.value.trim();
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

    const zurueck = el("a", "adm-klein-link", "Zurück zur alae arcade");
    zurueck.href = "/";
    karte.append(zurueck);

    wirt.append(karte);
  }

  function zeigeKeinAdmin(nutzer) {
    leere();
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

  // Ein Eintrag geht mit seinem Geist: Er heisst gleich (<spiel>_<spieler>).
  // Bliebe die Aufzeichnung stehen, könnte der Spieler sie nie ersetzen –
  // ein schwächerer Lauf überschreibt keinen besseren –, und neben ihm liefe
  // nie wieder sein eigener Geist.
  async function loesche(id) {
    const db = cloud()?.db?.();
    if (!db) throw new Error("Firestore ist nicht bereit.");
    await db.collection("miniScores").doc(id).delete();
    try { await db.collection("miniGeister").doc(id).delete(); } catch (fehler) {
      console.warn("Der Geist zum Eintrag ist geblieben", fehler);
    }
  }

  // ---------------------------------------------------------------------------
  // Ein Name auf mehreren Geräten
  // ---------------------------------------------------------------------------
  /*
   * Wer denselben Namen auf zwei Geräten eingetragen hat, ist ein Spieler und
   * steht in jeder Liste einmal da (mini-games.js, verdichte) – in der
   * Datenbank aber zweimal, je Gerät ein Eintrag je Spiel. Neue Runden
   * landen inzwischen unter einer Kennung (mini-games.js, stammKennung); was
   * davor unter den anderen entstand, führt das hier zusammen:
   *
   *   je Spiel ein Eintrag   unter der Kennung, unter der am meisten gespielt
   *                          wurde: die beste Zahl, alle Runden zusammen,
   *                          das früheste erste Mal
   *   der beste Lauf         zieht mit um, wenn er besser ist als der, der
   *                          dort schon liegt
   *   die anderen            werden gelöscht, samt ihren Läufen
   *
   * Alles innerhalb der Regeln, die für jeden gelten: Punkte fallen nicht,
   * Runden steigen. Nur das Löschen braucht den Admin. Ein neuer Eintrag
   * beginnt mit einer Runde (firestore.rules) – fehlt er unter der Kennung,
   * wird er erst so angelegt und dann auf die Summe gesetzt.
   *
   * Turniere bleiben, wie sie sind: Dort hängen die Versuche an der Kennung,
   * und ein Turnier ist bald vorbei.
   */
  async function fuehreZusammen(person) {
    const db = cloud()?.db?.();
    if (!db) throw new Error("Firestore ist nicht bereit.");
    const stamm = mini()?.stammVon?.(person.eintraege);
    if (!stamm) return 0;
    const jetzt = () => ({
      updatedAtMs: Date.now(),
      updatedAt: window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || null,
    });
    const nameVomStamm = person.eintraege.find((e) => e.spieler === stamm)?.name || person.name;
    const nachSpiel = new Map();
    person.eintraege.forEach((e) => {
      if (!nachSpiel.has(e.game)) nachSpiel.set(e.game, []);
      nachSpiel.get(e.game).push(e);
    });

    let geloescht = 0;
    for (const [spiel, eintraege] of nachSpiel) {
      const andere = eintraege.filter((e) => e.spieler !== stamm);
      if (!andere.length) continue;
      const ziel = eintraege.find((e) => e.spieler === stamm) || null;
      const name = ziel?.name || nameVomStamm;
      const punkte = Math.max(...eintraege.map((e) => e.punkte));
      const versuche = eintraege.reduce((summe, e) => summe + Math.max(1, e.versuche), 0);
      const erste = eintraege.map((e) => e.erstesMs).filter((ms) => ms > 0);
      const seit = erste.length ? { erstesMs: Math.min(...erste) } : {};

      const ref = db.collection("miniScores").doc(`${spiel}_${stamm}`);
      if (!ziel) await ref.set({ game: spiel, spieler: stamm, name, punkte, versuche: 1, ...seit, ...jetzt() });
      if (ziel || versuche > 1) await ref.set({ name, punkte, versuche, ...seit, ...jetzt() }, { merge: true });

      const laeufe = await Promise.all(eintraege.map((e) => db.collection("miniGeister").doc(`${spiel}_${e.spieler}`).get()
        .then((doc) => (doc.exists && doc.data()?.bahn ? { spieler: e.spieler, ...doc.data() } : null))
        .catch(() => null)));
      const besterLauf = laeufe.filter(Boolean).sort((a, b) => (Number(b.punkte) || 0) - (Number(a.punkte) || 0))[0] || null;
      const stammLauf = laeufe.find((l) => l?.spieler === stamm) || null;
      if (besterLauf && besterLauf.spieler !== stamm && (Number(besterLauf.punkte) || 0) > (Number(stammLauf?.punkte) || 0)) {
        await db.collection("miniGeister").doc(`${spiel}_${stamm}`).set({
          game: spiel,
          spieler: stamm,
          name,
          punkte: Math.max(0, Math.round(Number(besterLauf.punkte) || 0)),
          level: String(besterLauf.level || ""),
          bahn: String(besterLauf.bahn),
          ...jetzt(),
        });
      }

      for (const e of andere) {
        await loesche(e.id);
        geloescht += 1;
      }
    }
    return geloescht;
  }

  const kennungen = (person) => new Set(person.eintraege.map((e) => e.spieler)).size;

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
  // Ein Spiel spielen, aus dem Adminbereich
  // ---------------------------------------------------------------------------
  // Der kleine Knopf neben jedem Haken startet das Spiel in einem Fenster,
  // das das ganze Browserfenster füllt – über dem Adminbereich, damit ein
  // halb ausgefülltes Turnier darunter bleibt, wie es war. Ins Vollbild geht
  // es nicht von selbst: Dafür steht im Spiel oben rechts der Knopf, und das
  // Vollbild bleibt dann auch nach dem Spiel, bis man es beendet
  // (vollbild.js).
  //
  // Die Runde zählt wie jede andere: Sie geht unter dem Namen dieses Geräts
  // in die Hall of Fame, und der beste Versuch bleibt dort stehen. Hat das
  // Gerät noch keinen Namen, fragt das Spiel nach der Runde danach.
  //
  // Mit ?von=admin in der Adresse führt der Weg oben links im Spiel hierher
  // zurück (mini-games.js, ausAdmin).
  const spielAdresse = (spiel) => `${mini()?.spielLink?.(spiel) || "/"}?von=admin`;
  let spielZu = null;

  // Im Fenster meldet das Spiel den Weg zurück, statt den Adminbereich ein
  // zweites Mal hineinzuladen.
  window.addEventListener("message", (ereignis) => {
    if (ereignis.origin === window.location.origin && ereignis.data?.miniAdmin === "zu") spielZu?.();
  });

  function zeigeSpiel(spiel) {
    spielZu?.();
    const huelle = el("div", "adm-spiel");
    huelle.setAttribute("role", "dialog");
    huelle.setAttribute("aria-modal", "true");
    huelle.setAttribute("aria-label", titel(spiel));
    const fenster = el("iframe", "adm-spiel-fenster");
    fenster.src = spielAdresse(spiel);
    fenster.title = titel(spiel);
    fenster.allow = "autoplay; fullscreen";
    fenster.setAttribute("allowfullscreen", "");
    // Die Spiele hören auf Tasten. Ohne Fokus im Fenster gingen die an den
    // Adminbereich, und beim Signal liesse sich keine Runde starten.
    fenster.addEventListener("load", () => { try { fenster.contentWindow?.focus(); } catch { /* egal */ } });
    huelle.append(fenster);

    const vorher = document.activeElement;
    const taste = (ereignis) => { if (ereignis.key === "Escape") schliessen(); };
    function schliessen() {
      document.removeEventListener("keydown", taste);
      huelle.remove();
      document.body.classList.remove("adm-spiel-offen");
      if (spielZu === schliessen) spielZu = null;
      vorher?.focus?.({ preventScroll: true });
    }
    document.addEventListener("keydown", taste);
    document.body.classList.add("adm-spiel-offen");
    document.body.append(huelle);
    spielZu = schliessen;
  }

  function spielenKnopf(spiel) {
    const node = knopf("", "adm-spielen-knopf", () => zeigeSpiel(spiel));
    node.title = `${titel(spiel)} spielen`;
    node.setAttribute("aria-label", `${titel(spiel)} spielen`);
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const dreieck = document.createElementNS(NS, "path");
    dreieck.setAttribute("d", "M8 5.5v13l10.5-6.5z");
    dreieck.setAttribute("fill", "currentColor");
    svg.append(dreieck);
    node.append(svg);
    return node;
  }

  // Ein Spiel zum Anhaken, mit dem Knopf zum Spielen daneben. Der Knopf
  // liegt neben dem Haken und nicht in seinem label: Ein Tipp auf "spielen"
  // soll nie zugleich den Haken umlegen – auf der Startseite wäre das sofort
  // gespeichert.
  function wahlZeile(spiel, an, beiAenderung, zusatz = null) {
    const zeile = el("div", "adm-wahl");
    zeile.style.setProperty("--adm-farbe", farbe(spiel).hell);
    const haken = el("label", "adm-wahl-haken");
    const box = el("input");
    box.type = "checkbox";
    box.value = spiel;
    box.checked = an;
    zeile.classList.toggle("ist-an", an);
    box.addEventListener("change", () => {
      zeile.classList.toggle("ist-an", box.checked);
      beiAenderung(box.checked);
    });
    haken.append(box, el("span", "adm-wahl-name", titel(spiel)));
    zeile.append(haken);
    if (zusatz) zeile.append(zusatz);
    zeile.append(spielenKnopf(spiel));
    return { zeile, box };
  }

  // ---------------------------------------------------------------------------
  // Die Tiers
  // ---------------------------------------------------------------------------
  // Drei Gruppen, in die der Admin die Spiele einteilt – im Block «Welche
  // Spiele gespielt werden» mit T1/T2/T3 neben jedem Spiel. Gespeichert in
  // config/miniGames (cloud.js, setzeTiers); beim Anlegen eines Turniers
  // stehen die Spiele danach gruppiert, mit einem Knopf je Tier. Nie
  // eingeteilt: die Vorgabe (mini-games.js, TIERS_VORGABE).
  const TIER_LISTE = () => mini()?.TIERS || [1, 2, 3];

  // Für jedes Spiel sein Tier – aus dem Gespeicherten, sonst aus der Vorgabe.
  function vollstaendig(gespeichert) {
    const einteilung = {};
    (mini()?.SPIELE || []).forEach((s) => { einteilung[s.id] = mini()?.tierVon?.(s.id, gespeichert) ?? 3; });
    return einteilung;
  }

  // Die Spiele je Tier, in der Reihenfolge der Liste (mini-games.js, SPIELE).
  function nachTier(einteilung) {
    const gruppen = new Map(TIER_LISTE().map((n) => [n, []]));
    (mini()?.SPIELE || []).forEach((s) => gruppen.get(einteilung[s.id] || 3)?.push(s.id));
    return gruppen;
  }

  function tierTitel(n, anzahl) {
    const kopf = el("h3", "adm-tier-titel");
    kopf.append(el("span", "adm-tier-marke", `Tier ${n}`), el("span", "adm-tier-zahl", `${anzahl} ${anzahl === 1 ? "Spiel" : "Spiele"}`));
    return kopf;
  }

  function tierWahl(spiel, tier, beiWechsel) {
    const wahl = el("select", "adm-tier-wahl");
    wahl.setAttribute("aria-label", `Tier von ${titel(spiel)}`);
    wahl.title = "In welches Tier dieses Spiel gehört";
    TIER_LISTE().forEach((n) => {
      const option = el("option", "", `T${n}`);
      option.value = String(n);
      wahl.append(option);
    });
    wahl.value = String(tier);
    wahl.addEventListener("change", () => beiWechsel(Number(wahl.value)));
    return wahl;
  }

  // ---------------------------------------------------------------------------
  // Übersicht: Bereiche zum Aufklappen, Tabellen zum Sortieren, ein Filter
  // ---------------------------------------------------------------------------
  /*
   * Der Adminbereich ist lang geworden. Damit er auf einen Blick lesbar
   * bleibt, steht jeder Bereich zuerst zugeklappt da: nur sein Titel und eine
   * Zahl, die sagt, was drin ist. Was offen ist, wonach sortiert und wie
   * gefiltert, merkt sich der Tab (sessionStorage) – nach "Neu laden" oder
   * einem Löschen steht alles wieder so da, wie es war.
   */
  const ANSICHT_KEY = "mini.admin.ansicht";
  const ansicht = (() => {
    let gemerkt = null;
    try { gemerkt = JSON.parse(sessionStorage.getItem(ANSICHT_KEY) || "null"); } catch { gemerkt = null; }
    const roh = gemerkt && typeof gemerkt === "object" ? gemerkt : {};
    return {
      offen: Array.isArray(roh.offen) ? roh.offen.map(String) : [],
      sortiert: roh.sortiert && typeof roh.sortiert === "object" ? roh.sortiert : {},
      filter: {
        tier: Number(roh.filter?.tier) || 0,
        wahl: typeof roh.filter?.wahl === "string" ? roh.filter.wahl : "alle",
      },
      spiel: typeof roh.spiel === "string" ? roh.spiel : "",
    };
  })();

  function merkeAnsicht() {
    try { sessionStorage.setItem(ANSICHT_KEY, JSON.stringify(ansicht)); } catch { /* dann nur bis zum Neuladen */ }
  }

  // Ein Bereich zum Auf- und Zuklappen. Der Kopf ist ein einziger Knopf:
  // Titel und Zahl. Was der Bereich kann – Knöpfe, Tabellen, Filter –, steht
  // erst im aufgeklappten Teil; zugeklappt soll nichts ablenken.
  const klappen = new Map();
  function klappBlock(id, ueberschrift, klasse = "") {
    const block = el("section", `adm-block adm-klapp ${klasse}`.trim());
    block.id = `adm-${id}`;
    const kopf = el("header", "adm-block-kopf");
    const titelZeile = el("h2", "adm-klapp-titel");
    const schalter = el("button", "adm-klapp-knopf");
    schalter.type = "button";
    schalter.setAttribute("aria-controls", `adm-${id}-inhalt`);
    const zahl = el("span", "adm-block-zahl");
    schalter.append(el("span", "adm-klapp-name", ueberschrift), zahl);
    titelZeile.append(schalter);
    kopf.append(titelZeile);
    const inhalt = el("div", "adm-klapp-inhalt");
    inhalt.id = `adm-${id}-inhalt`;
    block.append(kopf, inhalt);

    function setze(offen) {
      block.classList.toggle("ist-offen", offen);
      schalter.setAttribute("aria-expanded", String(offen));
      inhalt.hidden = !offen;
      const liste = new Set(ansicht.offen);
      if (offen) liste.add(id);
      else liste.delete(id);
      ansicht.offen = [...liste];
      merkeAnsicht();
    }
    schalter.addEventListener("click", () => setze(inhalt.hidden));
    setze(ansicht.offen.includes(id));
    const bereich = { block, inhalt, zahl, oeffne: () => setze(true) };
    klappen.set(id, bereich);
    return bereich;
  }

  // Für die Kacheln oben: den Bereich aufklappen und hinrollen.
  function zeigeBereich(id) {
    const bereich = klappen.get(id);
    if (!bereich) return;
    bereich.oeffne();
    const ruhig = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    bereich.block.scrollIntoView?.({ behavior: ruhig ? "auto" : "smooth", block: "start" });
  }

  /*
   * Eine Tabelle, die sich nach ihren Spalten sortieren lässt: Ein Tipp auf
   * die Überschrift sortiert danach, ein zweiter dreht die Richtung um.
   *
   *   key     wie die Spalte in der gemerkten Sortierung heisst
   *   wert    wonach sortiert wird (Zahl oder Text); ohne wert ist die
   *           Spalte nicht sortierbar
   *   zelle   was in der Zelle steht (Knoten oder Text); sonst der wert
   *   ab      beim ersten Tipp absteigend (für "die meisten zuerst")
   *
   * Bei Gleichstand bleibt die Reihenfolge, in der die Zeilen kamen – die
   * Spiele also in der Reihenfolge der Liste.
   */
  function sortierTabelle(name, spalten, { standard, leer = "Nichts zu zeigen.", zeile = null, klasse = "" } = {}) {
    const tabelle = el("table", `adm-tabelle adm-sortierbar ${klasse}`.trim());
    const kopfZeile = el("tr");
    const body = el("tbody");
    let daten = [];
    const jetzt = () => {
      const gemerkt = ansicht.sortiert[name];
      return gemerkt && spalten.some((s) => s.key === gemerkt.key && s.wert) ? gemerkt : standard;
    };

    spalten.forEach((spalte) => {
      const th = el("th", [spalte.zahl ? "zahl" : "", spalte.klasse || ""].join(" ").trim());
      if (spalte.wert) {
        th.dataset.key = spalte.key;
        const b = el("button", "adm-sortier", spalte.titel);
        b.type = "button";
        b.addEventListener("click", () => {
          const bisher = jetzt();
          ansicht.sortiert[name] = { key: spalte.key, ab: bisher.key === spalte.key ? !bisher.ab : Boolean(spalte.ab) };
          merkeAnsicht();
          zeichne();
        });
        th.append(b);
      } else if (spalte.titel) {
        th.textContent = spalte.titel;
      }
      kopfZeile.append(th);
    });
    const thead = el("thead");
    thead.append(kopfZeile);
    tabelle.append(thead, body);

    function zeichne() {
      const { key, ab } = jetzt();
      const spalte = spalten.find((s) => s.key === key) || spalten.find((s) => s.wert);
      kopfZeile.querySelectorAll("th").forEach((th) => {
        if (th.dataset.key === spalte.key) th.setAttribute("aria-sort", ab ? "descending" : "ascending");
        else th.removeAttribute("aria-sort");
      });
      const sortiert = daten.slice().sort((a, b) => {
        const x = spalte.wert(a);
        const y = spalte.wert(b);
        const unterschied = typeof x === "string" || typeof y === "string"
          ? String(x).localeCompare(String(y), "de")
          : (Number(x) || 0) - (Number(y) || 0);
        return ab ? -unterschied : unterschied;
      });
      body.replaceChildren();
      if (!sortiert.length) {
        const tr = el("tr", "adm-leer");
        const td = el("td", "", leer);
        td.colSpan = spalten.length;
        tr.append(td);
        body.append(tr);
      }
      sortiert.forEach((daten) => {
        const tr = el("tr");
        spalten.forEach((s) => {
          const td = el("td", [s.zahl ? "zahl" : "", s.klasse || ""].join(" ").trim());
          const inhalt = s.zelle ? s.zelle(daten) : s.wert(daten);
          if (inhalt instanceof Node) td.append(inhalt);
          else td.textContent = String(inhalt ?? "");
          tr.append(td);
        });
        body.append(tr);
        zeile?.(daten, tr, body);
      });
    }

    // Am Handy rollt die Tabelle für sich, nicht der ganze Bereich.
    const wirt = el("div", "adm-tabelle-wirt");
    wirt.append(tabelle);
    return {
      tabelle,
      wirt,
      zeige(neu) { daten = neu; zeichne(); },
      zeichne,
    };
  }

  /*
   * Welche Spiele gezählt werden: ein Tier, was auf der Startseite steht
   * (oder nicht) oder die Spiele eines Turniers. Es ist ein Filter für den
   * ganzen Adminbereich – er steht bei den Spielen, bei den Spielern und in
   * der Auswertung eines Spielers, und wer ihn an einer Stelle ändert, ändert
   * ihn überall (stand.melde).
   */
  function passt(stand, spiel) {
    const { tier, wahl } = ansicht.filter;
    const bekannt = stand.bekannte.includes(spiel);
    if (tier && (!bekannt || stand.einteilung[spiel] !== tier)) return false;
    if (wahl === "an") return stand.offen.has(spiel);
    if (wahl === "aus") return !stand.offen.has(spiel);
    if (wahl.startsWith("t:")) return Boolean(stand.turniere.find((t) => t.id === wahl.slice(2))?.spiele?.includes(spiel));
    return true;
  }
  const istGefiltert = () => Boolean(ansicht.filter.tier) || ansicht.filter.wahl !== "alle";

  // Die Spiele, die es gibt, in der Reihenfolge der Liste – dahinter, was
  // von Spielen übrig ist, die es nicht mehr gibt.
  function alleSpiele(stand) {
    const verwaist = [...new Set(stand.alle.map((e) => e.game))].filter((id) => !stand.bekannte.includes(id)).sort();
    return [...stand.bekannte, ...verwaist];
  }

  function filterLeiste(stand) {
    const leiste = el("div", "adm-filter");
    const tiers = el("div", "adm-filter-tiers");
    tiers.setAttribute("role", "group");
    tiers.setAttribute("aria-label", "Nach Tier filtern");
    const tierKnoepfe = [0, ...TIER_LISTE()].map((n) => {
      const b = knopf(n ? `Tier ${n}` : "Alle Tiers", "adm-chip", () => {
        ansicht.filter.tier = n;
        stand.melde();
      });
      b.dataset.tier = String(n);
      tiers.append(b);
      return b;
    });

    const wahl = el("select", "adm-feld adm-filter-wahl");
    wahl.setAttribute("aria-label", "Welche Spiele");
    wahl.addEventListener("change", () => {
      ansicht.filter.wahl = wahl.value;
      stand.melde();
    });
    const aufheben = knopf("Filter aufheben", "adm-knopf-text adm-filter-weg", () => {
      ansicht.filter = { tier: 0, wahl: "alle" };
      stand.melde();
    });
    leiste.append(tiers, wahl, aufheben);

    function zeichne() {
      tierKnoepfe.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.tier) === ansicht.filter.tier)));
      const option = (wert, text) => {
        const o = el("option", "", text);
        o.value = wert;
        return o;
      };
      wahl.replaceChildren(option("alle", "Alle Spiele"), option("an", "Auf der Startseite"), option("aus", "Nicht auf der Startseite"));
      if (stand.turniere.length) {
        const gruppe = el("optgroup");
        gruppe.label = "Im Turnier";
        stand.turniere.forEach((t) => gruppe.append(option(`t:${t.id}`, t.name)));
        wahl.append(gruppe);
      }
      // Ein gemerktes Turnier, solange die Turniere noch laden – und keines
      // mehr, wenn es das Turnier nicht mehr gibt.
      if (![...wahl.options].some((o) => o.value === ansicht.filter.wahl)) {
        if (stand.turniereGeladen) ansicht.filter.wahl = "alle";
        else wahl.append(option(ansicht.filter.wahl, "Turnier..."));
      }
      wahl.value = ansicht.filter.wahl;
      aufheben.hidden = !istGefiltert();
    }
    stand.hoerer.add(zeichne);
    zeichne();
    return { leiste, weg: () => stand.hoerer.delete(zeichne) };
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
  function baueAuswahl(stand) {
    const { einteilung } = stand;
    // Dieselbe Menge wie in den anderen Bereichen: Was hier angehakt wird,
    // filtert dort gleich mit (passt).
    const gewaehlt = stand.offen;
    const bereich = klappBlock("auswahl", "Welche Spiele gespielt werden");
    const zaehle = () => {
      bereich.zahl.textContent = `${gewaehlt.size} von ${(mini()?.SPIELE || []).length} angehakt`;
    };
    zaehle();

    const meldung = el("p", "adm-meldung");
    bereich.inhalt.append(meldung);

    const gitter = el("div", "adm-tiers");

    // Geht das Speichern schief, springt der Haken zurück (zurueck) – ohne
    // die Seite neu zu bauen: Sonst verschwände mit ihr auch die Meldung, und
    // es sähe aus, als hätte der Klick einfach nichts getan.
    async function sichern(zurueck) {
      meldung.textContent = "Wird gespeichert...";
      meldung.className = "adm-meldung";
      try {
        await cloud().setzeOffeneSpiele([...gewaehlt]);
        meldung.textContent = "Gespeichert.";
        meldung.className = "adm-meldung ist-gut";
      } catch (fehler) {
        zurueck();
        zeichneGruppen();
        meldung.textContent = `Nicht gespeichert: ${fehlerText(fehler)}`;
        meldung.className = "adm-meldung ist-fehler";
      }
      zaehle();
      stand.melde();
    }

    // Ein anderes Tier: Das Spiel wandert gleich in seine Gruppe, und die
    // Einteilung ist gespeichert – auch für das nächste Turnier hier.
    async function sichereTiers(zurueck) {
      meldung.textContent = "Wird gespeichert...";
      meldung.className = "adm-meldung";
      try {
        await cloud().setzeTiers(einteilung, [...gewaehlt]);
        meldung.textContent = "Tiers gespeichert.";
        meldung.className = "adm-meldung ist-gut";
      } catch (fehler) {
        zurueck();
        zeichneGruppen();
        meldung.textContent = `Nicht gespeichert: ${fehlerText(fehler)}`;
        meldung.className = "adm-meldung ist-fehler";
      }
      stand.melde();
    }

    function zeichneGruppen() {
      gitter.replaceChildren();
      nachTier(einteilung).forEach((ids, n) => {
        gitter.append(tierTitel(n, ids.length));
        const gruppe = el("div", "adm-auswahl");
        ids.forEach((id) => {
          const wahl = tierWahl(id, n, (neu) => {
            const vorher = einteilung[id];
            einteilung[id] = neu;
            zeichneGruppen();
            sichereTiers(() => { einteilung[id] = vorher; });
          });
          const { zeile } = wahlZeile(id, gewaehlt.has(id), (an) => {
            if (an) gewaehlt.add(id);
            else gewaehlt.delete(id);
            sichern(() => { if (an) gewaehlt.delete(id); else gewaehlt.add(id); });
          }, wahl);
          gruppe.append(zeile);
        });
        if (!ids.length) gruppe.append(el("p", "adm-klein adm-tier-leer", "Noch kein Spiel in diesem Tier."));
        gitter.append(gruppe);
      });
    }
    zeichneGruppen();
    bereich.inhalt.append(gitter);

    const alleAn = knopf("Alle anhaken", "adm-knopf-klein", () => {
      gitter.querySelectorAll("input[type=checkbox]").forEach((h) => { if (!h.checked) h.click(); });
    });
    const alleAus = knopf("Alle abwählen", "adm-knopf-klein", () => {
      gitter.querySelectorAll("input[type=checkbox]").forEach((h) => { if (h.checked) h.click(); });
    });
    const zeile = el("div", "adm-kopf-aktionen");
    zeile.append(alleAn, alleAus);
    bereich.inhalt.append(zeile);
    return bereich;
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
  // So viele Versuche je Spiel lassen die Regeln zu (firestore.rules,
  // istTurnier).
  const VERSUCHE_MAX = 100;
  // Das Ende, das nie kommt – siehe turnier.js.
  const OHNE_ENDE = () => tn()?.OHNE_ENDE || Date.UTC(9999, 11, 31);
  const istOhneEnde = (t) => (Number(t?.endeMs) || 0) >= OHNE_ENDE();

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
  function turnierFormular(vorlage, { offen, sichern, abbrechen, einteilung = vollstaendig(null) }) {
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
      ohneGeist: false,
      ohneReplay: false,
      aktiv: true,
      spitzeWartet: false,
    };

    const form = el("form", "adm-turnier-form");
    // Geprüft wird beim Speichern hier unten, mit einem Satz, der sagt, was
    // fehlt – nicht vom Browser. Der hielte sonst auch eine Zahl im Feld der
    // Versuche für falsch, wenn gar nicht die Zahl, sondern "unbegrenzt"
    // gewählt ist.
    form.noValidate = true;
    // Das Formular steht allein da und ist lang: Der Weg zurück steht deshalb
    // auch oben, nicht nur unter dem letzten Feld.
    const formKopf = el("header", "adm-turnier-form-kopf");
    formKopf.append(el("h3", "", vorlage ? `«${vorlage.name}» ändern` : "Neues Turnier"));
    formKopf.append(knopf("Zurück zur Übersicht", "adm-knopf-klein", abbrechen));
    form.append(formKopf);

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
    const gewaehlt = new Set(t.spiele);
    const zaehle = () => { spieleTitel.textContent = `Spiele – ${gewaehlt.size} gewählt`; };
    const haken = [];
    // Nach Tier gruppiert, so wie im Block «Welche Spiele gespielt werden»
    // eingeteilt.
    const gruppen = nachTier(einteilung);
    gruppen.forEach((ids, n) => {
      if (!ids.length) return;
      spieleGruppe.append(tierTitel(n, ids.length));
      const gitter = el("div", "adm-auswahl");
      ids.forEach((id) => {
        const { zeile, box } = wahlZeile(id, gewaehlt.has(id), (an) => {
          if (an) gewaehlt.add(id);
          else gewaehlt.delete(id);
          zaehle();
        });
        gitter.append(zeile);
        haken.push(box);
      });
      spieleGruppe.append(gitter);
    });
    zaehle();
    const setze = (ids) => haken.forEach((box) => {
      const soll = ids.includes(box.value);
      if (box.checked !== soll) box.click();
    });
    // Ein Tier dazu – oder, wenn es schon ganz gewählt ist, wieder weg.
    const tierKnopf = (n) => knopf(`Tier ${n}`, "adm-knopf-klein", () => {
      const ids = gruppen.get(n) || [];
      const ganz = ids.length > 0 && ids.every((id) => gewaehlt.has(id));
      setze(ganz ? [...gewaehlt].filter((id) => !ids.includes(id)) : [...new Set([...gewaehlt, ...ids])]);
    });
    const auswahlKnoepfe = el("div", "adm-kopf-aktionen");
    auswahlKnoepfe.append(
      ...TIER_LISTE().filter((n) => (gruppen.get(n) || []).length).map(tierKnopf),
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
    // Ohne Zeitlimite: Das Turnier läuft, bis es angehalten, beendet oder
    // gelöscht wird (turnier.js, OHNE_ENDE).
    const ohne = el("option", "", "ohne Zeitlimite");
    ohne.value = "ohne";
    dauer.append(ohne);
    const eigen = el("option", "", "eigenes Ende …");
    eigen.value = "eigen";
    dauer.append(eigen);
    const passend = DAUERN.find(([, ms]) => ms === t.endeMs - t.startMs);
    dauer.value = istOhneEnde(t) ? "ohne" : passend ? String(passend[1]) : "eigen";
    const ende = feld("datetime-local", "");
    // Ein Turnier ohne Zeitlimite hat sein Ende im Jahr 9999 – das soll
    // nicht im Feld stehen, falls jemand doch ein eigenes Ende wählt.
    ende.value = fuerFeld(istOhneEnde(t) ? t.startMs + TAG : t.endeMs);
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
      if (dauer.value === "ohne") return OHNE_ENDE();
      if (dauer.value === "eigen") return ausFeld(ende.value);
      return ausFeld(beginn.value) + Number(dauer.value);
    }
    function nachziehen() {
      const eigenesEnde = dauer.value === "eigen";
      endeZeile.hidden = !eigenesEnde;
      const bis = endeMs();
      if (dauer.value === "ohne") endeText.textContent = "Läuft, bis du es anhältst, beendest oder löschst.";
      else endeText.textContent = !eigenesEnde && Number.isFinite(bis) ? `Endet ${tn()?.datum?.(bis) || new Date(bis).toLocaleString("de-CH")}.` : "";
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

    // Die Versuche: unbegrenzt, eine feste Zahl – oder unbegrenzt für alle
    // ausser dem, der vorne liegt (turnier.js, alleinVorne). Die Zahl wird
    // getippt, nicht aus einer Liste gewählt – vier Versuche sind so gut wie
    // drei oder fünf. Wer in das Zahlfeld tippt, meint die feste Zahl; der
    // Punkt davor springt von selbst mit.
    const versuche = wahl("Versuche je Spiel", "versuchsart", [
      ["frei", "Unbegrenzt", "So oft, wie jemand will, solange das Turnier läuft."],
      ["zahl", "Eine feste Zahl", "Ein Versuch zählt, sobald er beginnt – wer mittendrin neu lädt, hat ihn trotzdem gebraucht."],
      ["spitze", "Nur wer nicht vorne liegt", "Unbegrenzt – ausser für den, der in einem Spiel allein auf Platz 1 steht: Er wartet dort, bis ihn jemand einholt oder überholt. Wer überall vorne liegt, kann gar nicht mehr spielen, bis die anderen nachziehen."],
    ], t.spitzeWartet ? "spitze" : t.versuche ? "zahl" : "frei");
    const anzahl = feld("number", "3");
    anzahl.className = "adm-feld adm-feld-zahl";
    anzahl.min = "1";
    anzahl.max = String(VERSUCHE_MAX);
    anzahl.step = "1";
    anzahl.inputMode = "numeric";
    anzahl.value = String(t.versuche || 3);
    anzahl.setAttribute("aria-label", "Anzahl Versuche je Spiel");
    // Das Feld steht in der Zeile seiner Wahl, gleich hinter dem Wort.
    const zahlTitel = versuche.querySelector('input[value="zahl"]').closest(".adm-option").querySelector("strong");
    const reihe = el("span", "adm-option-reihe");
    zahlTitel.replaceWith(reihe);
    reihe.append(zahlTitel, anzahl);
    const waehleZahl = () => {
      const radio = versuche.querySelector('input[value="zahl"]');
      if (radio.checked) return;
      radio.checked = true;
      pruefeSumme();
    };
    anzahl.addEventListener("focus", waehleZahl);
    anzahl.addEventListener("input", waehleZahl);
    form.append(versuche);
    const unbegrenzt = () => gewaehlterWert("versuchsart") !== "zahl";
    // Die Zahl, wie sie im Feld steht – NaN, wenn dort keine ganze steht.
    const getippt = () => (/^\s*\d+\s*$/.test(anzahl.value) ? Number(anzahl.value) : NaN);

    const zaehlt = wahl("Was in einem Spiel zählt", "zaehlt", [
      ["bester", "Der beste Versuch", "Wer es dreimal probiert, dem zählt die beste Runde."],
      ["summe", "Alle Versuche zusammen", "Jede Runde zählt dazu – geht nur mit einer festen Zahl von Versuchen."],
    ], t.zaehlt);
    form.append(zaehlt);
    // Zusammenzählen ohne Grenze hiesse: Es gewinnt, wer am längsten spielt.
    const summeRadio = zaehlt.querySelector('input[value="summe"]');
    const besterRadio = zaehlt.querySelector('input[value="bester"]');
    function pruefeSumme() {
      const ohneGrenze = unbegrenzt();
      summeRadio.disabled = ohneGrenze;
      if (ohneGrenze && summeRadio.checked) besterRadio.checked = true;
    }
    versuche.addEventListener("change", pruefeSumme);
    pruefeSumme();

    form.append(wahl("Gesamtwertung über alle Spiele", "wertung", [
      ["platz", "Platzziffer", "Die Plätze aus allen Spielen zusammengezählt – die kleinste Summe gewinnt. Wer ein Spiel auslässt, bekommt dort den Platz hinter dem Letzten."],
      ["prozent", "Prozent vom Besten", "Der Beste eines Spiels bekommt 100, alle anderen ihren Anteil an seiner Zahl – die höchste Summe gewinnt. Hier zählt, wie knapp jemand dran war."],
    ], t.wertung));

    form.append(wahl("Aufgaben", "aufgaben", [
      ["gleich", "Für alle gleich", "Der erste Versuch ist für alle derselbe Lauf, der zweite auch – aber ein anderer als der erste. Kein Glück mit dem Würfel."],
      ["wieErster", "Gleiches Level wie der 1. Platzierte", "Jeder Versuch ist derselbe Lauf, für alle – genau der, auf dem Platz 1 vorne liegt."],
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
    // Die Gegner beim Spielen (geist.js): Platz 1 und die eigene Bestmarke,
    // die als Zahl, Linie oder Geist mitlaufen. Angehakt heisst: Sie sind
    // da, und jeder kann sie vor dem Spiel für sich ausblenden.
    const gegner = el("input");
    gegner.type = "checkbox";
    gegner.checked = !t.ohneGeist;
    const gegnerZeile = el("label", "adm-option");
    const gegnerText = el("span", "adm-option-text");
    gegnerText.append(el("strong", "", "Gegner beim Spielen zeigen"), el("small", "", "Platz 1 und die eigene Bestmarke laufen mit – als Zahl, als Linie oder als Geist im Bild. Jeder kann sie vor dem Spiel für sich ausblenden. Bei einer verdeckten Rangliste bleibt Platz 1 verborgen."));
    gegnerZeile.append(gegner, gegnerText);
    // Die Replays (geist.js, zuschauer): der ▶ neben jedem Spieler in den
    // Listen des Turniers. Ohne Haken lässt sich kein Lauf anschauen.
    const replay = el("input");
    replay.type = "checkbox";
    replay.checked = !t.ohneReplay;
    const replayZeile = el("label", "adm-option");
    const replayText = el("span", "adm-option-text");
    replayText.append(el("strong", "", "Replays anschauen lassen"), el("small", "", "Neben jedem Spieler steht ein ▶: Damit lässt sich sein bester Lauf in diesem Turnier ganz anschauen. Ohne Haken lässt sich kein Lauf anschauen. Bei einer verdeckten Rangliste erst am Schluss."));
    replayZeile.append(replay, replayText);
    // Nur im Multiplayer (live.js): keine Versuche dazwischen, gezählt werden
    // nur die Multiplayer, die zum Turnier gehören.
    const nurLive = el("input");
    nurLive.type = "checkbox";
    nurLive.checked = Boolean(t.nurLive);
    const nurLiveZeile = el("label", "adm-option");
    const nurLiveText = el("span", "adm-option-text");
    nurLiveText.append(el("strong", "", "Nur im Multiplayer spielen"), el("small", "", "Gespielt wird nur in Multiplayern, die zu diesem Turnier gehören (Knopf «Multiplayer» beim Turnier). Dazwischen gibt es keine Versuche; die Gesamtwertung zählt nur die Multiplayer."));
    nurLiveZeile.append(nurLive, nurLiveText);
    const aktiv = el("input");
    aktiv.type = "checkbox";
    aktiv.checked = t.aktiv;
    const aktivZeile = el("label", "adm-option");
    const aktivText = el("span", "adm-option-text");
    aktivText.append(el("strong", "", "Aktiv"), el("small", "", "Ohne Haken ist das Turnier angehalten: Es steht nirgends, und niemand kann spielen, bis du es fortsetzt."));
    aktivZeile.append(aktiv, aktivText);
    schalter.append(verdecktZeile, gegnerZeile, replayZeile, nurLiveZeile, aktivZeile);
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
        versuche: unbegrenzt() ? 0 : getippt(),
        zaehlt: gewaehlterWert("zaehlt") || "bester",
        wertung: gewaehlterWert("wertung") || "platz",
        aufgaben: gewaehlterWert("aufgaben") || "gleich",
        sichtbar: gewaehlterWert("sichtbar") || "alle",
        verdeckt: verdeckt.checked,
        ohneGeist: !gegner.checked,
        ohneReplay: !replay.checked,
        nurLive: nurLive.checked,
        aktiv: aktiv.checked,
        spitzeWartet: gewaehlterWert("versuchsart") === "spitze",
        erstelltMs: vorlage?.erstelltMs || Date.now(),
      };
      if (!daten.name) { sage("Ohne Namen gibt es kein Turnier.", "ist-fehler"); nameFeld.focus(); return; }
      if (!daten.spiele.length) { sage("Mindestens ein Spiel muss dabei sein.", "ist-fehler"); return; }
      if (!Number.isFinite(daten.startMs) || !Number.isFinite(daten.endeMs)) { sage("Beginn und Ende brauchen ein Datum und eine Uhrzeit.", "ist-fehler"); return; }
      if (daten.endeMs <= daten.startMs) { sage("Das Ende muss nach dem Beginn liegen.", "ist-fehler"); return; }
      if (!vorlage && daten.endeMs <= Date.now()) { sage("Dieses Turnier wäre schon vorbei, bevor es jemand sieht.", "ist-fehler"); return; }
      if (!unbegrenzt() && !(daten.versuche >= 1 && daten.versuche <= VERSUCHE_MAX)) {
        sage(`Die Zahl der Versuche ist eine ganze Zahl von 1 bis ${VERSUCHE_MAX}.`, "ist-fehler");
        anzahl.focus();
        return;
      }
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

  // Wer in einem Turnier steht, unter welchem Namen – so, wie die Rangliste
  // Namen zusammenfasst (mini-games.js, verdichte).
  const namensSchluessel = (name) => String(name || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("de");

  /*
   * Ein Turnier in der Liste. Zugeklappt eine Zeile: Name, wie es steht, wann
   * es läuft, wer vorne liegt. Ein Tipp darauf wählt es aus und klappt auf,
   * was sich damit tun lässt – öffnen, Link, umbenennen, bearbeiten,
   * anhalten, beenden, löschen – und den ganzen Stand, aus dem sich einzelne
   * Spieler entfernen lassen. Ein zweiter Tipp klappt es wieder zu.
   */
  function turnierZeile(t, eintraege, aktion) {
    const lage = tn()?.lage?.(t) || "laeuft";
    const offen = Boolean(aktion.offen);
    const karte = el("article", `adm-turnier ist-${lage}${offen ? " ist-offen" : ""}`);

    const wahl = el("button", "adm-turnier-wahl");
    wahl.type = "button";
    wahl.setAttribute("aria-expanded", String(offen));
    const kopf = el("span", "adm-turnier-kopf");
    kopf.append(el("strong", "adm-turnier-name", t.name));
    kopf.append(el("span", `adm-marke ist-${lage}`, tn()?.statusText?.(t) || LAGE_WORT[lage]));
    kopf.append(el("span", "adm-marke", t.sichtbar === "alle" ? "öffentlich" : "nur mit Link"));
    if (t.verdeckt) kopf.append(el("span", "adm-marke", "verdeckt"));
    wahl.append(kopf);

    // Wer vorne liegt – auch bei einem verdeckten Turnier: Der Admin muss die
    // Siegerehrung vorbereiten können.
    const wertung = Array.isArray(eintraege) ? tn()?.gesamtwertung?.(t, eintraege, aktion.abende || []) : null;
    const personen = wertung?.personen || [];
    let stand = "Der Stand ist gerade nicht zu haben.";
    if (Array.isArray(eintraege)) {
      stand = personen.length
        ? `${zahlWort(personen.length, "Spieler", "Spieler")} · vorne: ${personen.slice(0, 3).map((p) => `${p.platz}. ${p.name}`).join(", ")}`
        : "Noch hat niemand gespielt.";
    }
    wahl.append(el("span", "adm-turnier-stand", `${tn()?.zeitraum?.(t) || ""} · ${stand}`));
    wahl.addEventListener("click", () => aktion.waehle(offen ? null : t.id));
    karte.append(wahl);
    if (!offen) return karte;

    const detail = el("div", "adm-turnier-detail");
    const eckdaten = [
      t.spiele.map(titel).join(", "),
      t.spitzeWartet ? "Platz 1 wartet" : t.versuche ? `${t.versuche} ${t.versuche === 1 ? "Versuch" : "Versuche"}` : "unbegrenzt",
      t.zaehlt === "summe" ? "Versuche zusammen" : "bester Versuch",
      t.spiele.length > 1 ? (t.wertung === "prozent" ? "Prozent vom Besten" : "Platzziffer") : "",
      { gleich: "gleiche Aufgaben", wieErster: "Level wie Platz 1" }[t.aufgaben] || "gewürfelt",
      t.ohneGeist ? "ohne Gegner" : "",
      t.ohneReplay ? "ohne Replays" : "",
      t.nurLive ? "nur Multiplayer" : "",
      aktion.abende?.length ? `${aktion.abende.length} Multiplayer` : "",
    ].filter(Boolean);
    detail.append(el("p", "adm-klein", eckdaten.join(" · ")));

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
    // Umbenennen ohne das ganze Formular. Der Link bleibt, wie er ist: Er ist
    // schon verschickt, und ein neuer Name soll ihn nicht ins Leere laufen
    // lassen.
    aktionen.append(knopf("Umbenennen", "adm-knopf-klein", () => {
      const max = cloud()?.TURNIER_NAME_MAX || 60;
      const neu = window.prompt(`Neuer Name (höchstens ${max} Zeichen). Der Link bleibt derselbe.`, t.name);
      if (neu === null) return;
      const sauber = String(neu).replace(/\s+/g, " ").trim().slice(0, max);
      if (!sauber || sauber === t.name) return;
      aktion.speichere({ ...t, name: sauber });
    }));
    aktionen.append(knopf("Bearbeiten", "adm-knopf-klein", () => aktion.bearbeiten(t)));
    // Einen Multiplayer zu diesem Turnier anlegen (live.js): Er zählt dann in
    // der Gesamtwertung mit.
    const live = el("a", "adm-knopf adm-knopf-klein", "Multiplayer");
    live.href = `/live?neu&turnier=${encodeURIComponent(t.id)}`;
    aktionen.append(live);

    // Bei Bedarf aktivieren: Ein vorbereitetes Turnier startet mit einem Klick,
    // ein laufendes lässt sich anhalten, ein angehaltenes fortsetzen.
    if (lage === "geplant") {
      aktionen.append(knopf("Jetzt starten", "adm-knopf-klein", () => aktion.speichere({ ...t, startMs: Date.now() })));
    }
    if (lage === "laeuft" || lage === "geplant") {
      aktionen.append(knopf("Anhalten", "adm-knopf-klein", () => aktion.speichere({ ...t, aktiv: false })));
    }
    if (lage === "angehalten") {
      aktionen.append(knopf("Fortsetzen", "adm-knopf-klein", () => aktion.speichere({ ...t, aktiv: true })));
    }
    if (lage === "laeuft" || (lage === "angehalten" && Date.now() > t.startMs)) {
      aktionen.append(knopf("Jetzt beenden", "adm-knopf-klein", () => {
        if (!window.confirm(`«${t.name}» jetzt beenden? Danach zählt keine Runde mehr.`)) return;
        aktion.speichere({ ...t, endeMs: Date.now() });
      }));
    }
    aktionen.append(knopf("Löschen", "adm-knopf-weg", () => {
      if (!window.confirm(`«${t.name}» löschen – mitsamt ${Array.isArray(eintraege) ? zahlWort(eintraege.length, "Eintrag", "Einträgen") : "allen Einträgen"}? Das lässt sich nicht rückgängig machen.`)) return;
      aktion.loesche(t);
    }));
    detail.append(aktionen);

    // Der ganze Stand, und für jeden Namen ein Weg hinaus – für den Tag, an
    // dem in einem Turnier ein Name steht, den man dort nicht haben will.
    if (Array.isArray(eintraege) && personen.length) {
      const tabelle = el("table", "adm-tabelle adm-turnier-tabelle");
      const kopfZeile = el("tr");
      [["Name", ""], ["Spiele", "zahl"], [t.wertung === "prozent" && t.spiele.length > 1 ? "Punkte" : "Plätze", "zahl"], ["", ""]]
        .forEach(([wort, klasse]) => kopfZeile.append(el("th", klasse, wort)));
      const thead = el("thead");
      thead.append(kopfZeile);
      tabelle.append(thead);
      const body = el("tbody");
      personen.forEach((person) => {
        const zeile = el("tr");
        zeile.append(el("td", "adm-name", `${person.platz}. ${person.name}`));
        // Gezählt wird, was zählt: die Spiele und die Live-Abende des Turniers.
        zeile.append(el("td", "zahl", `${person.gespielt}/${wertung?.teile ?? t.spiele.length}`));
        zeile.append(el("td", "zahl", String(person.wert)));
        const zelle = el("td", "adm-aktionen");
        const seine = eintraege.filter((e) => namensSchluessel(e.name) === namensSchluessel(person.name));
        zelle.append(knopf("Entfernen", "adm-knopf-weg", () => {
          if (!window.confirm(`«${person.name}» aus «${t.name}» entfernen – mit ${zahlWort(seine.length, "Eintrag", "Einträgen")}? Das lässt sich nicht rückgängig machen.`)) return;
          aktion.entferne(t, person.name, seine.map((e) => e.id));
        }));
        zeile.append(zelle);
        body.append(zeile);
      });
      tabelle.append(body);
      detail.append(tabelle);
    }
    karte.append(detail);
    return karte;
  }

  // Die Gruppen der Liste, in dieser Reihenfolge. Die laufenden stehen immer
  // da, auch wenn gerade keines läuft; die anderen nur, wenn es welche gibt.
  const GRUPPEN = [
    ["laeuft", "Laufende Turniere"],
    ["geplant", "Geplant"],
    ["angehalten", "Angehalten"],
    ["beendet", "Beendet"],
  ];

  /*
   * Die Multiplayer, die auf diesem Gerät angelegt wurden (live.js merkt sie
   * sich) und die es noch gibt – mit dem Weg zurück in die Lobby und dem
   * Link. Einer nur mit Link steht sonst nirgends; ohne diese Liste wäre er
   * mit dem Tab verloren. Was es nicht mehr gibt, fällt heraus.
   */
  const MEINE_KEY = "mini.live.meine";
  const PHASE = { lobby: "Lobby", runde: "läuft", pause: "zwischen zwei Runden", ende: "am Podest" };

  function meineMultiplayer() {
    const box = el("div", "adm-multiplayer");
    box.hidden = true;
    let gemerkt = [];
    try { gemerkt = JSON.parse(localStorage.getItem(MEINE_KEY) || "[]"); } catch { gemerkt = []; }
    if (!Array.isArray(gemerkt) || !gemerkt.length || !cloud()?.multiplayer) return box;
    Promise.all(gemerkt.slice(0, 10).map((m) => Promise.resolve(cloud().multiplayer(m?.code)).catch(() => undefined))).then((stand) => {
      // undefined: nicht zu erreichen – der bleibt gemerkt. null: gibt es nicht mehr.
      const bleiben = gemerkt.filter((_, i) => stand[i] !== null);
      try { localStorage.setItem(MEINE_KEY, JSON.stringify(bleiben)); } catch { /* privater Modus */ }
      const da = stand.filter(Boolean);
      if (!da.length) return;
      box.append(el("h3", "", da.length === 1 ? "Dein Multiplayer" : "Deine Multiplayer"));
      da.forEach((m) => {
        const zeile = el("div", "adm-multiplayer-zeile");
        const text = el("div", "adm-multiplayer-text");
        text.append(el("strong", "", m.name), el("small", "", `${PHASE[m.phase] || m.phase} · ${m.sichtbar === "alle" ? "für alle offen" : "nur mit Link"}`));
        const aktionen = el("div", "adm-kopf-aktionen");
        const oeffnen = el("a", "adm-knopf adm-knopf-klein", "Öffnen");
        oeffnen.href = `/live?code=${encodeURIComponent(m.code)}`;
        const adresse = `${window.location.origin}/live?code=${m.code}`;
        const kopieren = knopf("Link kopieren", "adm-knopf-klein", async () => {
          if (await kopiere(adresse)) {
            kopieren.textContent = "Kopiert";
            window.setTimeout(() => { kopieren.textContent = "Link kopieren"; }, 2000);
          }
        });
        aktionen.append(oeffnen, kopieren);
        zeile.append(text, aktionen);
        box.append(zeile);
      });
      box.hidden = false;
    });
    return box;
  }

  function baueTurniere(stand) {
    const bereich = klappBlock("turniere", "Turniere", "adm-turniere");
    const { block, inhalt } = bereich;
    const neuKnopf = knopf("Neues Turnier", "adm-knopf-voll", () => oeffne(null));
    // Daneben einen Multiplayer: alle spielen zur selben Zeit, angelegt und
    // geleitet auf /live (live.js) – die Anmeldung hier gilt dort auch.
    const neuerMultiplayer = el("a", "adm-knopf adm-knopf-voll", "Neuer Multiplayer");
    neuerMultiplayer.href = "/live?neu";
    const neuKnoepfe = el("div", "adm-kopf-aktionen adm-werkzeug");
    neuKnoepfe.append(neuKnopf, neuerMultiplayer);
    inhalt.append(neuKnoepfe);
    inhalt.append(meineMultiplayer());

    const formWirt = el("div", "adm-turnier-formwirt");
    const meldung = el("p", "adm-meldung");
    const liste = el("div", "adm-turnier-liste");
    inhalt.append(formWirt, meldung, liste);

    const sage = (text, art = "") => {
      meldung.textContent = text;
      meldung.className = `adm-meldung ${art}`.trim();
    };

    /*
     * Ein offenes Formular steht allein da (.ist-formular): kein Streifen,
     * keine Liste der Turniere, keine Spieler darunter – nur das Turnier, das
     * gerade entsteht. Wer abbricht, steht wieder dort, wo er war; wer
     * speichert, bei der Liste mit der Meldung und dem Link.
     *
     * Und weil es aussieht wie eine eigene Seite, schliesst es auch der
     * Zurück-Knopf des Browsers (oder die Wischgeste am Handy), statt den
     * Adminbereich ganz zu verlassen.
     */
    let vorherY = 0;
    function schliesse({ gespeichert = false } = {}) {
      if (formularZu === schliesse) formularZu = null;
      formWirt.innerHTML = "";
      neuKnoepfe.hidden = false;
      wirt.classList.remove("ist-formular");
      if (history.state?.admFormular) history.back();
      if (gespeichert) block.scrollIntoView?.({ block: "start" });
      else window.scrollTo(0, vorherY);
    }

    function oeffne(vorlage) {
      formWirt.innerHTML = "";
      neuKnoepfe.hidden = true;
      sage("");
      formWirt.append(turnierFormular(vorlage, {
        offen: [...stand.offen],
        einteilung: stand.einteilung,
        abbrechen: () => schliesse(),
        sichern: async (daten) => {
          const id = vorlage?.id || neueTurnierId(daten.name);
          await cloud().setzeTurnier(id, daten);
          gewaehlt = id;
          schliesse({ gespeichert: true });
          const adresse = tn()?.volleAdresse?.(id) || `${window.location.origin}/turnier?t=${id}`;
          sage(vorlage ? `«${daten.name}» ist gespeichert.` : `«${daten.name}» ist angelegt. Der Link: ${adresse}`, "ist-gut");
          await laden();
        },
      }));
      if (!wirt.classList.contains("ist-formular")) vorherY = window.scrollY;
      wirt.classList.add("ist-formular");
      if (!history.state?.admFormular) history.pushState({ admFormular: true }, "");
      formularZu = schliesse;
      window.scrollTo(0, 0);
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

    async function entferne(t, name, ids) {
      sage("Wird entfernt...");
      try {
        await cloud().loescheTurnierEintraege(t.id, ids);
        sage(`«${name}» ist aus «${t.name}» entfernt.`, "ist-gut");
      } catch (fehler) {
        sage(`Das ging nicht: ${fehlerText(fehler)}`, "ist-fehler");
      }
      await laden();
    }

    // Welches Turnier aufgeklappt ist. Es bleibt aufgeklappt, wenn die Liste
    // nach einer Änderung neu gelesen wird – wer es eben angehalten hat, will
    // sehen, dass es jetzt angehalten ist.
    let gewaehlt = null;
    let geladen = [];
    function waehle(id) {
      gewaehlt = id;
      zeichne();
    }

    // Laufende zuerst, dann geplante, angehaltene und zuletzt die vorbei sind –
    // die neuesten davon oben.
    function zeichne() {
      liste.innerHTML = "";
      const jetzt = Date.now();
      const lage = (t) => tn()?.lage?.(t, jetzt) || "laeuft";
      GRUPPEN.forEach(([art, ueberschrift]) => {
        const darin = geladen.filter(({ t }) => lage(t) === art)
          .sort((a, b) => (art === "beendet" ? b.t.endeMs - a.t.endeMs : a.t.startMs - b.t.startMs));
        if (!darin.length && art !== "laeuft") return;
        const gruppe = el("section", `adm-turnier-gruppe ist-${art}`);
        gruppe.append(el("h3", "adm-turnier-gruppe-titel", darin.length ? `${ueberschrift} (${darin.length})` : ueberschrift));
        if (!darin.length) gruppe.append(el("p", "adm-hinweis", "Gerade läuft kein Turnier."));
        darin.forEach(({ t, eintraege, abende }) => gruppe.append(turnierZeile(t, eintraege, {
          offen: t.id === gewaehlt, waehle, bearbeiten: oeffne, speichere, loesche, entferne, abende,
        })));
        liste.append(gruppe);
      });
    }

    async function laden() {
      liste.innerHTML = "";
      liste.append(el("p", "adm-hinweis", "Die Turniere werden geladen..."));
      let turniere = [];
      try {
        turniere = await cloud().alleTurniere();
      } catch (fehler) {
        liste.innerHTML = "";
        liste.append(el("p", "adm-hinweis ist-fehler", `Die Turniere sind nicht zu haben: ${fehlerText(fehler)}`));
        geladenMelden([]);
        return;
      }
      // Die Einträge je Turnier: für die Zahl der Spieler, wer vorne liegt und
      // den ganzen Stand des aufgeklappten.
      // Dazu die Live-Abende, die zum Turnier gehören: Sie zählen in der
      // Gesamtwertung mit.
      geladen = await Promise.all(turniere.map((t) => Promise.all([
        cloud().turnierErgebnisse(t.id),
        Promise.resolve(cloud().turnierLive?.(t.id)).catch(() => []),
      ]).then(([eintraege, abende]) => ({ t, eintraege, abende: abende || [] }), () => ({ t, eintraege: null, abende: [] }))));
      zeichne();
      geladenMelden(turniere);
    }

    // Die Turniere gehen auch an die anderen Bereiche: für die Kachel oben
    // und den Filter "Im Turnier".
    function geladenMelden(turniere) {
      const laufend = turniere.filter((t) => (tn()?.lage?.(t) || "laeuft") === "laeuft").length;
      bereich.zahl.textContent = `${zahlWort(turniere.length, "Turnier", "Turniere")}${laufend ? ` · ${laufend} ${laufend === 1 ? "läuft" : "laufen"}` : ""}`;
      stand.turniere = turniere;
      stand.turniereGeladen = true;
      stand.turniereDa();
      stand.melde();
    }

    laden();
    return bereich;
  }

  // ---------------------------------------------------------------------------
  // Die Kacheln oben
  // ---------------------------------------------------------------------------
  // Die Zahlen auf einen Blick – und jede ist ein Weg: Ein Tipp klappt den
  // Bereich auf, in dem steht, was hinter der Zahl steckt. "Runden" zeigt
  // die Spiele gleich danach sortiert, die am meisten gespielt werden.
  function kacheln(stand) {
    const wrap = el("div", "adm-streifen");
    const kachel = (ziel, beiKlick = () => zeigeBereich(ziel)) => {
      const b = el("button", "adm-kachel");
      b.type = "button";
      b.setAttribute("aria-controls", `adm-${ziel}`);
      const wert = el("strong");
      const wort = el("span");
      b.append(wert, wort);
      b.addEventListener("click", beiKlick);
      wrap.append(b);
      return (zahl, text) => {
        wert.textContent = String(zahl);
        wort.textContent = text;
      };
    };
    const turniere = kachel("turniere");
    const offen = kachel("auswahl");
    const spieler = kachel("spieler");
    const eintraege = kachel("spiele");
    const runden = kachel("spiele", () => {
      ansicht.sortiert.spiele = { key: "runden", ab: true };
      stand.melde();
      zeigeBereich("spiele");
    });

    function zeichne() {
      const laufend = stand.turniere.filter((t) => (tn()?.lage?.(t) || "laeuft") === "laeuft").length;
      turniere(stand.turniereGeladen ? stand.turniere.length : "…",
        `${stand.turniere.length === 1 ? "Turnier" : "Turniere"}${laufend ? ` · ${laufend} ${laufend === 1 ? "läuft" : "laufen"}` : ""}`);
      offen(stand.offen.size, `von ${stand.bekannte.length} Spielen offen`);
      spieler(new Set(stand.alle.map((e) => e.name.toLocaleLowerCase("de"))).size, "Spieler");
      eintraege(stand.alle.length, stand.alle.length === 1 ? "Eintrag" : "Einträge");
      const alleRunden = stand.alle.reduce((summe, e) => summe + Math.max(1, e.versuche), 0);
      runden(alleRunden, alleRunden === 1 ? "Runde" : "Runden");
    }
    stand.hoerer.add(zeichne);
    zeichne();
    return wrap;
  }

  // ---------------------------------------------------------------------------
  // Bausteine für Spieler und Spiele
  // ---------------------------------------------------------------------------
  const schluesselVon = (name) => String(name || "").toLocaleLowerCase("de");
  const rundenVon = (eintraege) => eintraege.reduce((summe, e) => summe + Math.max(1, e.versuche), 0);
  const zuletztVon = (eintraege) => Math.max(0, ...eintraege.map((e) => Number(e.updatedAtMs) || 0));
  function zuerstVon(eintraege) {
    const erste = eintraege.map((e) => Number(e.erstesMs) || 0).filter((ms) => ms > 0);
    return erste.length ? Math.min(...erste) : 0;
  }

  // Ein Name ist hier, was er überall ist: gross oder klein geschrieben
  // derselbe, auf allen Geräten zusammen (mini-games.js, verdichte).
  function nachPerson(eintraege) {
    const personen = new Map();
    eintraege.forEach((e) => {
      const schluessel = schluesselVon(e.name);
      if (!personen.has(schluessel)) personen.set(schluessel, { schluessel, name: e.name, eintraege: [] });
      personen.get(schluessel).eintraege.push(e);
    });
    return [...personen.values()];
  }

  function spielName(spiel, bekannt) {
    const name = el("span", "adm-spielname");
    name.style.setProperty("--adm-farbe", farbe(spiel).hell);
    name.append(el("span", "adm-punkt"), el("span", "", bekannt ? titel(spiel) : `${spiel} (kein Spiel mehr)`));
    return name;
  }

  const tierMarke = (tier) => (tier ? el("span", "adm-tier-marke", `T${tier}`) : "–");

  function platzMarke(platz, von) {
    const wrap = el("span", "adm-platz-wrap");
    wrap.append(el("span", `adm-platz${platz <= 3 ? ` ist-${platz}` : ""}`, `${platz}.`));
    if (von) wrap.append(el("small", "adm-von", `von ${von}`));
    return wrap;
  }

  function personKnopf(name, beiKlick) {
    const b = el("button", "adm-person", name);
    b.type = "button";
    b.title = `Auswertung von ${name}`;
    b.addEventListener("click", beiKlick);
    return b;
  }

  // Eine Handlung, die die Datenbank ändert, und danach alles neu gelesen.
  async function undNeu(arbeit, neuLaden) {
    try {
      await arbeit();
      await neuLaden();
    } catch (fehler) {
      window.alert(`Das ging nicht: ${fehlerText(fehler)}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Die Spieler
  // ---------------------------------------------------------------------------
  // Eine Zeile je Name: in wie vielen Spielen, wie viele Runden, welcher
  // Platz im Schnitt (wie in der Hall of Fame, mini-games.js, auswertung).
  // Ein Tipp auf den Namen öffnet seine ganze Auswertung. Gezählt wird, was
  // der Filter durchlässt – "Tier 1" heisst: der Schnitt in Tier 1.
  let gesucht = "";

  function baueSpieler(stand, neuLaden) {
    const bereich = klappBlock("spieler", "Spieler");
    const alleLeute = nachPerson(stand.alle);
    bereich.zahl.textContent = zahlWort(alleLeute.length, "Spieler", "Spieler");

    // Wer auf mehreren Geräten spielt, steht hier einmal – in der Datenbank
    // aber mehrmals (fuehreZusammen).
    const doppelt = alleLeute.filter((person) => kennungen(person) > 1);
    if (doppelt.length) {
      const hinweis = el("p", "adm-hinweis adm-doppelt",
        `${doppelt.length === 1 ? `"${doppelt[0].name}" hat` : `${doppelt.length} Namen haben`} auf mehreren Geräten gespielt und ${doppelt.length === 1 ? "steht" : "stehen"} deshalb mehrmals in der Datenbank. `
        + "Zusammengeführt bleibt je Spiel ein Eintrag: die beste Zahl, alle Runden zusammen. ");
      if (doppelt.length > 1) {
        hinweis.append(knopf("Alle zusammenführen", "adm-knopf-klein", async () => {
          const namen = doppelt.map((person) => `"${person.name}"`).join(", ");
          if (!window.confirm(`${namen} zusammenführen? Je Spiel bleibt ein Eintrag mit der besten Zahl und allen Runden; die übrigen Einträge werden gelöscht. Das lässt sich nicht rückgängig machen.`)) return;
          await undNeu(async () => { for (const person of doppelt) await fuehreZusammen(person); }, neuLaden);
        }));
      }
      bereich.inhalt.append(hinweis);
    }

    const filter = filterLeiste(stand);
    const suche = feld("search", "Name suchen");
    suche.classList.add("adm-suche");
    suche.setAttribute("aria-label", "Name suchen");
    suche.value = gesucht;
    suche.addEventListener("input", () => {
      gesucht = suche.value;
      zeichne();
    });
    filter.leiste.append(suche);
    const summe = el("p", "adm-klein adm-summe");

    const tabelle = sortierTabelle("spieler", [
      {
        key: "name", titel: "Name", klasse: "adm-name",
        wert: (p) => p.name,
        zelle: (p) => {
          const teile = document.createDocumentFragment();
          teile.append(personKnopf(p.name, () => zeigeAuswertung(stand, p.schluessel, neuLaden)));
          if (p.geraete > 1) teile.append(el("small", "adm-kennung", `auf ${p.geraete} Geräten`));
          return teile;
        },
      },
      { key: "spiele", titel: "Spiele", zahl: true, ab: true, wert: (p) => p.spiele },
      { key: "runden", titel: "Runden", zahl: true, ab: true, wert: (p) => p.runden },
      { key: "schnitt", titel: "Ø Platz", zahl: true, wert: (p) => p.schnitt, zelle: (p) => p.schnitt.toFixed(1) },
      { key: "siege", titel: "1. Plätze", zahl: true, ab: true, klasse: "adm-breit", wert: (p) => p.siege },
      { key: "zuletzt", titel: "Zuletzt", zahl: true, ab: true, klasse: "adm-breit", wert: (p) => p.zuletzt, zelle: (p) => wannKurz(p.zuletzt) },
      {
        key: "aktionen", titel: "", klasse: "adm-aktionen",
        zelle: (p) => {
          const teile = document.createDocumentFragment();
          if (p.geraete > 1) {
            teile.append(knopf("Zusammenführen", "adm-knopf-klein", async () => {
              if (!window.confirm(`"${p.name}" von ${p.geraete} Geräten zusammenführen? Je Spiel bleibt ein Eintrag mit der besten Zahl und allen Runden; die übrigen Einträge werden gelöscht. Das lässt sich nicht rückgängig machen.`)) return;
              await undNeu(() => fuehreZusammen({ name: p.name, eintraege: p.alle }), neuLaden);
            }));
          }
          // Am Handy reicht der Name: Er öffnet dieselbe Auswertung.
          teile.append(knopf("Auswertung", "adm-knopf-klein adm-breit", () => zeigeAuswertung(stand, p.schluessel, neuLaden)));
          return teile;
        },
      },
    ], { standard: { key: "runden", ab: true }, leer: "Hier hat noch niemand gespielt." });

    bereich.inhalt.append(filter.leiste, summe, tabelle.wirt);

    function zeichne() {
      const spiele = alleSpiele(stand).filter((spiel) => passt(stand, spiel));
      const eintraege = stand.alle.filter((e) => spiele.includes(e.game));
      const wertung = new Map((mini()?.auswertung?.(eintraege, spiele) || []).map((p) => [schluesselVon(p.name), p]));
      const leute = nachPerson(eintraege).map((p) => {
        const alle = alleLeute.find((a) => a.schluessel === p.schluessel)?.eintraege || p.eintraege;
        const w = wertung.get(p.schluessel);
        return {
          schluessel: p.schluessel,
          name: p.name,
          alle,
          geraete: new Set(alle.map((e) => e.spieler)).size,
          spiele: new Set(p.eintraege.map((e) => e.game)).size,
          runden: rundenVon(p.eintraege),
          schnitt: w?.schnitt || 0,
          siege: w?.siege || 0,
          zuletzt: zuletztVon(p.eintraege),
        };
      });
      const such = schluesselVon(gesucht.trim());
      const gezeigt = such ? leute.filter((p) => p.schluessel.includes(such)) : leute;
      summe.textContent = `${gezeigt.length} von ${zahlWort(alleLeute.length, "Spieler", "Spielern")} · gezählt in ${zahlWort(spiele.length, "Spiel", "Spielen")}`;
      tabelle.zeige(gezeigt);
    }
    stand.hoerer.add(zeichne);
    zeichne();
    return bereich;
  }

  // ---------------------------------------------------------------------------
  // Die Spiele und ihre Bestenlisten
  // ---------------------------------------------------------------------------
  // Eine Zeile je Spiel – auch für die, die noch niemand gespielt hat: Tier,
  // ob es auf der Startseite steht, wie viele spielen, wie oft, wer den
  // Rekord hält. Nach jeder Spalte sortierbar, nach Tier, Startseite oder
  // Turnier zu filtern. Ein Tipp auf das Spiel klappt seine Bestenliste auf,
  // mit allem, was es zum Aufräumen braucht.
  function spielZahlen(stand, spiel) {
    const eintraege = stand.alle.filter((e) => e.game === spiel);
    const liste = mini()?.rangliste?.(eintraege) || [];
    return {
      id: spiel,
      bekannt: stand.bekannte.includes(spiel),
      tier: stand.bekannte.includes(spiel) ? stand.einteilung[spiel] || 0 : 0,
      an: stand.offen.has(spiel),
      eintraege,
      liste,
      spieler: liste.length,
      runden: rundenVon(eintraege),
      zuletzt: zuletztVon(eintraege),
    };
  }

  function bestenliste(z, stand, neuLaden) {
    const name = z.bekannt ? titel(z.id) : z.id;
    const platzVon = new Map(z.liste.map((e) => [schluesselVon(e.name), e.platz]));
    const tabelle = el("table", "adm-tabelle adm-bestenliste");
    const kopfZeile = el("tr");
    ["Platz", "Name", einheit(z.id), "Runden", "Zuletzt", ""].forEach((text, i) => {
      kopfZeile.append(el("th", [i === 0 || (i > 1 && i < 5) ? "zahl" : "", i === 4 ? "adm-breit" : ""].join(" ").trim(), text));
    });
    const thead = el("thead");
    thead.append(kopfZeile);
    const body = el("tbody");
    // Ein Name auf mehreren Geräten hat einen Platz: Die weiteren Einträge
    // stehen darunter, als das, was sie sind.
    const schonDa = new Set();
    z.eintraege
      .slice()
      .sort((a, b) => b.punkte - a.punkte || a.updatedAtMs - b.updatedAtMs)
      .forEach((eintrag) => {
        const zeile = el("tr");
        const platz = el("td", "zahl");
        const schluessel = schluesselVon(eintrag.name);
        platz.append(schonDa.has(schluessel) ? el("small", "adm-von", "weiteres Gerät") : platzMarke(platzVon.get(schluessel) || 0));
        schonDa.add(schluessel);
        const wer = el("td", "adm-name");
        wer.append(personKnopf(eintrag.name, () => zeigeAuswertung(stand, schluesselVon(eintrag.name), neuLaden)));
        wer.append(el("small", "adm-kennung", eintrag.spieler));
        zeile.append(platz, wer);
        zeile.append(el("td", "zahl", String(eintrag.punkte)));
        zeile.append(el("td", "zahl", String(eintrag.versuche)));
        zeile.append(el("td", "zahl adm-breit", wannKurz(eintrag.updatedAtMs)));
        const aktionen = el("td", "adm-aktionen");
        aktionen.append(knopf("Namen ändern", "adm-knopf-klein", async () => {
          const neu = window.prompt("Neuer Name (höchstens 24 Zeichen):", eintrag.name);
          if (neu === null) return;
          const sauber = String(neu).replace(/\s+/g, " ").trim().slice(0, 24);
          if (!sauber) return;
          await undNeu(() => benenneUm(eintrag.id, sauber), neuLaden);
        }));
        // Löschen fragt nach. Ein Eintrag ist weg, wenn er weg ist – und die
        // beiden Knöpfe liegen nebeneinander.
        aktionen.append(knopf("Löschen", "adm-knopf-weg", async () => {
          if (!window.confirm(`"${eintrag.name}" aus ${name} löschen?`)) return;
          await undNeu(() => loesche(eintrag.id), neuLaden);
        }));
        zeile.append(aktionen);
        body.append(zeile);
      });
    tabelle.append(thead, body);
    const wirt = el("div", "adm-tabelle-wirt");
    wirt.append(tabelle);
    return wirt;
  }

  function baueSpiele(stand, neuLaden) {
    const bereich = klappBlock("spiele", "Spiele und Bestenlisten");
    const filter = filterLeiste(stand);
    const summe = el("p", "adm-klein adm-summe");

    function schalter(z) {
      const b = el("button", "adm-spiel-schalter");
      b.type = "button";
      b.setAttribute("aria-expanded", String(ansicht.spiel === z.id));
      b.title = "Bestenliste zeigen";
      b.append(spielName(z.id, z.bekannt));
      b.addEventListener("click", () => {
        ansicht.spiel = ansicht.spiel === z.id ? "" : z.id;
        merkeAnsicht();
        tabelle.zeichne();
      });
      return b;
    }

    // Die Bestenliste unter ihrer Zeile, über die ganze Breite.
    function detail(z, tr, body) {
      if (ansicht.spiel !== z.id) return;
      tr.classList.add("ist-offen");
      const zeile = el("tr", "adm-detail");
      const zelle = el("td");
      zelle.colSpan = 8;
      const kasten = el("div", "adm-spiel-detail");
      kasten.style.setProperty("--adm-farbe", farbe(z.id).hell);
      if (!z.eintraege.length) {
        kasten.append(el("p", "adm-hinweis", "Noch hat niemand gespielt."));
      } else {
        const kopf = el("div", "adm-detail-kopf");
        kopf.append(el("span", "adm-klein", `${zahlWort(z.eintraege.length, "Eintrag", "Einträge")} · ${zahlWort(z.runden, "Runde", "Runden")}`));
        // Wenn ein Spiel umgebaut wurde und die alten Zahlen nichts mehr
        // bedeuten: die ganze Bestenliste auf einmal, mit den Geistern.
        kopf.append(knopf("Bestenliste leeren", "adm-knopf-weg", async () => {
          const name = z.bekannt ? titel(z.id) : z.id;
          if (!window.confirm(`Die ganze Bestenliste von ${name} leeren – ${z.eintraege.length === 1 ? "den einen Eintrag" : `alle ${z.eintraege.length} Einträge`} samt Geistern? Das lässt sich nicht rückgängig machen.`)) return;
          await undNeu(async () => { for (const eintrag of z.eintraege) await loesche(eintrag.id); }, neuLaden);
        }));
        kasten.append(kopf, bestenliste(z, stand, neuLaden));
      }
      zelle.append(kasten);
      zeile.append(zelle);
      body.append(zeile);
    }

    const tabelle = sortierTabelle("spiele", [
      { key: "spiel", titel: "Spiel", wert: (z) => (z.bekannt ? titel(z.id) : z.id), zelle: schalter },
      { key: "tier", titel: "Tier", wert: (z) => z.tier || 9, zelle: (z) => tierMarke(z.tier) },
      // Offen heisst: steht auf der Startseite (Welche Spiele gespielt werden).
      { key: "an", titel: "Offen", ab: true, wert: (z) => (z.an ? 1 : 0), zelle: (z) => el("span", z.an ? "adm-an" : "adm-aus", z.an ? "✓" : "–") },
      { key: "spieler", titel: "Spieler", zahl: true, ab: true, wert: (z) => z.spieler },
      { key: "runden", titel: "Runden", zahl: true, ab: true, wert: (z) => z.runden },
      {
        key: "rekord", titel: "Rekord", klasse: "adm-breit",
        zelle: (z) => (z.liste[0] ? `${z.liste[0].punkte} ${einheit(z.id)} · ${z.liste[0].name}` : "–"),
      },
      { key: "zuletzt", titel: "Zuletzt", zahl: true, ab: true, klasse: "adm-breit", wert: (z) => z.zuletzt, zelle: (z) => wannKurz(z.zuletzt) },
      { key: "spielen", titel: "", klasse: "adm-breit", zelle: (z) => (z.bekannt ? spielenKnopf(z.id) : "") },
    ], { standard: { key: "tier", ab: false }, leer: "Kein Spiel passt zum Filter.", zeile: detail, klasse: "adm-spieltabelle" });

    bereich.inhalt.append(filter.leiste, summe, tabelle.wirt);

    function zeichne() {
      const alle = alleSpiele(stand);
      const gezeigt = alle.filter((spiel) => passt(stand, spiel)).map((spiel) => spielZahlen(stand, spiel));
      const eintraege = gezeigt.reduce((summe, z) => summe + z.eintraege.length, 0);
      bereich.zahl.textContent = `${zahlWort(stand.bekannte.length, "Spiel", "Spiele")} · ${zahlWort(stand.alle.length, "Eintrag", "Einträge")}`;
      summe.textContent = `${gezeigt.length} von ${zahlWort(alle.length, "Spiel", "Spielen")} · ${zahlWort(eintraege, "Eintrag", "Einträge")} · ${zahlWort(gezeigt.reduce((s, z) => s + z.runden, 0), "Runde", "Runden")}`;
      tabelle.zeige(gezeigt);
    }
    stand.hoerer.add(zeichne);
    zeichne();
    return bereich;
  }

  // ---------------------------------------------------------------------------
  // Die Auswertung eines Spielers
  // ---------------------------------------------------------------------------
  /*
   * Alles über einen Namen an einem Ort, in einem Fenster über dem
   * Adminbereich: welche Spiele, welcher Platz in jedem, wie oft gespielt,
   * seit wann – und in welchen Turnieren. Dazu, was sich mit ihm machen
   * lässt: umbenennen, zusammenführen, ein einzelnes Ergebnis oder alle
   * löschen. Nach jedem davon wird neu gelesen, und das Fenster steht
   * wieder da (neuLaden merkt sich, wessen es war).
   *
   * Der Filter gilt auch hier: "Tier 1" zeigt den Schnitt in Tier 1.
   */
  let dashboard = null;

  function zeigeAuswertung(stand, schluessel, neuLaden) {
    dashboard?.zu({ still: true });
    const seine = stand.alle.filter((e) => schluesselVon(e.name) === schluessel);
    if (!seine.length) return;
    const name = seine[0].name;
    const geraete = new Set(seine.map((e) => e.spieler)).size;

    const huelle = el("div", "adm-dash-huelle");
    const karte = el("article", "adm-dash");
    karte.setAttribute("role", "dialog");
    karte.setAttribute("aria-modal", "true");
    karte.setAttribute("aria-labelledby", "adm-dash-titel");
    karte.tabIndex = -1;

    const kopf = el("header", "adm-dash-kopf");
    const links = el("div");
    const ueberschrift = el("h2", "adm-dash-titel", name);
    ueberschrift.id = "adm-dash-titel";
    const seit = zuerstVon(seine);
    links.append(ueberschrift, el("p", "adm-klein", [
      geraete > 1 ? `auf ${geraete} Geräten` : "auf einem Gerät",
      seit ? `zum ersten Mal ${wann(seit)}` : "",
      `zuletzt ${wann(zuletztVon(seine))}`,
    ].filter(Boolean).join(" · ")));
    kopf.append(links, knopf("Schliessen", "adm-knopf-hell adm-dash-zu", () => schliessen()));

    const filter = filterLeiste(stand);
    const zahlen = el("div", "adm-streifen adm-dash-zahlen");

    const teil = (ueber) => {
      const box = el("section", "adm-dash-teil");
      box.append(el("h3", "", ueber));
      return box;
    };

    const tabelle = sortierTabelle("auswertung", [
      { key: "spiel", titel: "Spiel", wert: (z) => (z.bekannt ? titel(z.id) : z.id), zelle: (z) => spielName(z.id, z.bekannt) },
      { key: "tier", titel: "Tier", klasse: "adm-breit", wert: (z) => z.tier || 9, zelle: (z) => tierMarke(z.tier) },
      { key: "platz", titel: "Platz", zahl: true, wert: (z) => z.platz, zelle: (z) => platzMarke(z.platz, z.von) },
      {
        key: "punkte", titel: "Bestwert", zahl: true,
        zelle: (z) => {
          const wert = el("span", "adm-bestwert", `${z.punkte} ${einheit(z.id)}`);
          if (z.eintraege.length > 1) wert.append(el("small", "adm-von", `${z.eintraege.length} Geräte`));
          return wert;
        },
      },
      { key: "runden", titel: "Runden", zahl: true, ab: true, wert: (z) => z.runden },
      { key: "zuerst", titel: "Zuerst", zahl: true, ab: true, klasse: "adm-breit", wert: (z) => z.zuerst, zelle: (z) => wannKurz(z.zuerst) },
      { key: "zuletzt", titel: "Zuletzt", zahl: true, ab: true, klasse: "adm-breit", wert: (z) => z.zuletzt, zelle: (z) => wannKurz(z.zuletzt) },
      {
        key: "weg", titel: "", klasse: "adm-aktionen",
        zelle: (z) => knopf("Löschen", "adm-knopf-weg", async () => {
          const spiel = z.bekannt ? titel(z.id) : z.id;
          if (!window.confirm(`Das Ergebnis von "${name}" in ${spiel} löschen${z.eintraege.length > 1 ? ` (${z.eintraege.length} Einträge, je Gerät einer)` : ""}?`)) return;
          await undNeu(async () => { for (const e of z.eintraege) await loesche(e.id); }, neuLaden);
        }),
      },
    ], { standard: { key: "platz", ab: false }, leer: "In diesen Spielen hat er oder sie noch nicht gespielt." });
    const jeSpiel = teil("Je Spiel");
    jeSpiel.append(tabelle.wirt);

    const turniere = teil("Turniere");
    const turnierListe = el("div", "adm-dash-turniere");
    turniere.append(turnierListe);

    const aufraeumen = teil("Aufräumen");
    const aktionen = el("div", "adm-kopf-aktionen");
    aktionen.append(knopf("Namen ändern", "adm-knopf-klein", async () => {
      const neu = window.prompt(`Neuer Name für "${name}" in allen Spielen (höchstens 24 Zeichen):`, name);
      if (neu === null) return;
      const sauber = String(neu).replace(/\s+/g, " ").trim().slice(0, 24);
      if (!sauber || sauber === name) return;
      dashboard.schluessel = schluesselVon(sauber);
      await undNeu(async () => { for (const e of seine) await benenneUm(e.id, sauber); }, neuLaden);
    }));
    if (geraete > 1) {
      aktionen.append(knopf(`Von ${geraete} Geräten zusammenführen`, "adm-knopf-klein", async () => {
        if (!window.confirm(`"${name}" von ${geraete} Geräten zusammenführen? Je Spiel bleibt ein Eintrag mit der besten Zahl und allen Runden; die übrigen Einträge werden gelöscht. Das lässt sich nicht rückgängig machen.`)) return;
        await undNeu(() => fuehreZusammen({ name, eintraege: seine }), neuLaden);
      }));
    }
    // Der Weg für den Tag, an dem jemand einen Namen einträgt, den man hier
    // nicht haben will: alles von ihm auf einmal.
    const wieViele = zahlWort(seine.length, "Eintrag", "Einträge");
    aktionen.append(knopf(seine.length === 1 ? "Eintrag löschen" : `Alle ${wieViele} löschen`, "adm-knopf-weg", async () => {
      if (!window.confirm(`Wirklich ${seine.length === 1 ? "den Eintrag" : `alle ${wieViele}`} von "${name}" löschen? Das lässt sich nicht rückgängig machen.`)) return;
      await undNeu(async () => { for (const e of seine) await loesche(e.id); }, neuLaden);
    }));
    aufraeumen.append(aktionen);

    karte.append(kopf, filter.leiste, zahlen, jeSpiel, turniere, aufraeumen);
    huelle.append(karte);

    function zeilen() {
      const proSpiel = new Map();
      seine.forEach((e) => {
        if (!proSpiel.has(e.game)) proSpiel.set(e.game, []);
        proSpiel.get(e.game).push(e);
      });
      return alleSpiele(stand).filter((spiel) => proSpiel.has(spiel) && passt(stand, spiel)).map((spiel) => {
        const eintraege = proSpiel.get(spiel);
        const liste = mini()?.rangliste?.(stand.alle.filter((e) => e.game === spiel)) || [];
        const bekannt = stand.bekannte.includes(spiel);
        return {
          id: spiel,
          bekannt,
          tier: bekannt ? stand.einteilung[spiel] || 0 : 0,
          eintraege,
          platz: liste.find((e) => schluesselVon(e.name) === schluessel)?.platz || liste.length,
          von: liste.length,
          punkte: Math.max(0, ...eintraege.map((e) => Number(e.punkte) || 0)),
          runden: rundenVon(eintraege),
          zuerst: zuerstVon(eintraege),
          zuletzt: zuletztVon(eintraege),
        };
      });
    }

    function zeichne() {
      const daten = zeilen();
      const moeglich = alleSpiele(stand).filter((spiel) => passt(stand, spiel)).length;
      const schnitt = daten.length ? daten.reduce((summe, z) => summe + z.platz, 0) / daten.length : 0;
      const kachel = (wert, wort) => {
        const box = el("div");
        box.append(el("strong", "", String(wert)), el("span", "", wort));
        return box;
      };
      zahlen.replaceChildren(
        kachel(daten.length, `von ${zahlWort(moeglich, "Spiel", "Spielen")} gespielt`),
        kachel(daten.reduce((summe, z) => summe + z.runden, 0), "Runden"),
        kachel(daten.length ? schnitt.toFixed(1) : "–", "Platz im Schnitt"),
        kachel(daten.filter((z) => z.platz === 1).length, "1. Plätze"),
        kachel(daten.filter((z) => z.platz <= 3).length, "Podestplätze"),
      );
      tabelle.zeige(daten);
    }

    // In welchen Turnieren er mitspielt und auf welchem Platz: gelesen erst
    // hier, wenn das Fenster aufgeht – für die Liste oben braucht es das nicht.
    async function ladeTurniere() {
      turnierListe.replaceChildren(el("p", "adm-hinweis", "Die Turniere werden geladen..."));
      await stand.turniereBereit;
      const funde = await Promise.all(stand.turniere.map(async (t) => {
        try {
          const [eintraege, abende] = await Promise.all([
            cloud().turnierErgebnisse(t.id),
            Promise.resolve(cloud().turnierLive?.(t.id)).catch(() => []),
          ]);
          const wertung = tn()?.gesamtwertung?.(t, eintraege || [], abende || []);
          const p = wertung?.personen?.find((x) => schluesselVon(x.name) === schluessel);
          return p ? { t, platz: p.platz, von: wertung.personen.length, gespielt: p.gespielt, teile: wertung.teile } : null;
        } catch { return null; }
      }));
      if (!huelle.isConnected) return;
      const dabei = funde.filter(Boolean).sort((a, b) => (b.t.startMs || 0) - (a.t.startMs || 0));
      turnierListe.replaceChildren();
      if (!dabei.length) {
        turnierListe.append(el("p", "adm-hinweis", "In keinem Turnier dabei."));
        return;
      }
      dabei.forEach(({ t, platz, von, gespielt, teile }) => {
        const lage = tn()?.lage?.(t) || "laeuft";
        const zeile = el("div", "adm-dash-turnier");
        zeile.append(platzMarke(platz, von), el("strong", "", t.name), el("span", `adm-marke ist-${lage}`, tn()?.statusText?.(t) || LAGE_WORT[lage]));
        zeile.append(el("span", "adm-klein", `${gespielt} von ${zahlWort(teile, "Teil", "Teilen")} gespielt`));
        turnierListe.append(zeile);
      });
    }

    const vorher = document.activeElement;
    const taste = (ereignis) => { if (ereignis.key === "Escape") schliessen(); };
    huelle.addEventListener("click", (ereignis) => { if (ereignis.target === huelle) schliessen(); });
    function schliessen({ still = false } = {}) {
      document.removeEventListener("keydown", taste);
      stand.hoerer.delete(zeichne);
      filter.weg();
      huelle.remove();
      document.body.classList.remove("adm-dash-offen");
      if (dashboard?.zu === schliessen) dashboard = null;
      if (!still) vorher?.focus?.({ preventScroll: true });
    }

    stand.hoerer.add(zeichne);
    zeichne();
    ladeTurniere();
    document.addEventListener("keydown", taste);
    document.body.classList.add("adm-dash-offen");
    document.body.append(huelle);
    karte.focus({ preventScroll: true });
    dashboard = { schluessel, zu: schliessen };
  }

  // ---------------------------------------------------------------------------
  // Der ganze Adminbereich
  // ---------------------------------------------------------------------------
  async function zeigeAdmin(nutzer, { person = null } = {}) {
    leere();

    const kopf = el("header", "adm-kopf");
    const links = el("div");
    links.append(el("h1", "adm-titel", "Adminbereich"), el("p", "adm-klein", `${nutzer.email} · ${cloud()?.projektId || ""}`));
    kopf.append(links);
    const rechts = el("div", "adm-kopf-aktionen");
    const neu = knopf("Neu laden", "adm-knopf-hell", () => zeigeAdmin(nutzer));
    const zuDenSpielen = el("a", "adm-knopf adm-knopf-hell", "Zu den Spielen");
    zuDenSpielen.href = "/";
    rechts.append(neu, zuDenSpielen, knopf("Abmelden", "adm-knopf-still", () => auth()?.signOut()));
    const voll = window.LernappVollbild?.knopf?.("adm-knopf adm-knopf-hell adm-vollbild");
    if (voll) rechts.append(voll);
    kopf.append(rechts);
    wirt.append(kopf);

    const laedt = el("p", "adm-hinweis", "Die Einträge werden geladen...");
    wirt.append(laedt);

    const bekannte = (mini()?.SPIELE || []).map((s) => s.id);

    let alle = [];
    let offen = [];
    let einteilung = vollstaendig(null);
    try {
      let gewaehlt;
      let gespeichert;
      [alle, gewaehlt, gespeichert] = await Promise.all([
        alleEintraege(),
        cloud().offeneSpiele(),
        // Ohne Tiers geht es auch: dann gilt die Vorgabe.
        Promise.resolve(cloud().tiers?.()).catch(() => null),
      ]);
      // Ein Objekt für alle Bereiche: Was oben eingeteilt wird, gilt gleich im
      // nächsten Turnierformular und im Filter.
      einteilung = vollstaendig(gespeichert);
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

    /*
     * Was alle Bereiche teilen: die Einträge, die Spiele, die Tiers, was auf
     * der Startseite steht, die Turniere. Ändert sich daran etwas ohne neues
     * Lesen – ein Haken, ein Tier, der Filter, die Turniere sind da –, sagt
     * melde es allen, die zuhören (hoerer), und die zeichnen sich neu.
     */
    const stand = {
      alle,
      bekannte,
      einteilung,
      offen: new Set(offen),
      turniere: [],
      turniereGeladen: false,
      hoerer: new Set(),
      melde() {
        merkeAnsicht();
        this.hoerer.forEach((zeichne) => zeichne());
      },
    };
    stand.turniereBereit = new Promise((fertig) => { stand.turniereDa = fertig; });

    // Nach einer Änderung neu lesen – und dort bleiben, wo man war, samt dem
    // Fenster eines Spielers, wenn eines offen war.
    const neuLaden = async () => {
      const y = window.scrollY;
      await zeigeAdmin(nutzer, { person: dashboard?.schluessel || null });
      window.scrollTo(0, y);
    };

    wirt.append(kacheln(stand));
    wirt.append(baueTurniere(stand).block);
    wirt.append(baueAuswahl(stand).block);
    wirt.append(baueSpieler(stand, neuLaden).block);
    wirt.append(baueSpiele(stand, neuLaden).block);
    if (person) zeigeAuswertung(stand, person, neuLaden);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  async function los() {
    // Das Fenster, das eine Vorschau auf der Live-Adresse geöffnet hat.
    const vorschau = new URLSearchParams(window.location.search).get("vorschau");
    if (vorschau !== null) { zeigeVorschauAnmeldung(vorschau); return; }

    const a = auth();
    if (!a) {
      leere();
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
