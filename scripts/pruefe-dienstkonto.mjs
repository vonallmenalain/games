/*
 * pruefe-dienstkonto.mjs - Sieht einem Dienstkonto-Schlüssel an, ob er einer ist.
 *
 * Aufgerufen von .github/workflows/firestore-rules.yml, bevor der Schlüssel an
 * Firebase geht. Der häufigste Fehler beim Anlegen des Secrets ist, die
 * JSON-Datei base64-kodiert einzufügen statt im Klartext. Ohne diese Prüfung
 * scheitert das später an einer Firebase-Meldung, die nach etwas ganz anderem
 * aussieht - hier steht sofort, was zu tun ist.
 *
 * Gelesen wird von der Standardeingabe, nicht aus einer Datei oder aus einem
 * Argument: So steht der Schlüssel nirgends in einer Prozessliste.
 *
 *   echo "$SECRET" | node scripts/pruefe-dienstkonto.mjs
 *
 * Ausgegeben wird nur die Adresse des Dienstkontos. Der Schlüssel selbst darf
 * nie ins Protokoll - Logs von GitHub Actions sind für jeden lesbar, der das
 * Repository lesen darf.
 */

function lies(strom) {
  return new Promise((erfuellen, ablehnen) => {
    let text = "";
    strom.setEncoding("utf8");
    strom.on("data", (stueck) => { text += stueck; });
    strom.on("end", () => erfuellen(text));
    strom.on("error", ablehnen);
  });
}

function pruefe(roh) {
  const text = roh.trim();
  if (!text) {
    return { fehler: "Es wurde kein Schlüssel übergeben (die Eingabe ist leer)." };
  }

  let daten;
  try {
    daten = JSON.parse(text);
  } catch (fehler) {
    // Sieht es nach base64 aus? Dann ist das mit Abstand der wahrscheinlichste
    // Grund, und es lohnt sich, ihn beim Namen zu nennen.
    const wirktWieBase64 = /^[A-Za-z0-9+/\r\n]+={0,2}$/.test(text) && text.length > 40;
    return {
      fehler: `Der Schlüssel ist kein gültiges JSON: ${fehler.message}`,
      hinweis: wirktWieBase64
        ? "Die Eingabe sieht base64-kodiert aus. Das Secret muss den Inhalt der JSON-Datei im Klartext enthalten."
        : "Erwartet wird der vollständige Inhalt der JSON-Datei, so wie Google sie herunterlädt.",
    };
  }

  if (daten === null || typeof daten !== "object" || Array.isArray(daten)) {
    return { fehler: "Der Schlüssel ist zwar JSON, aber kein Objekt." };
  }
  if (daten.type !== "service_account") {
    return {
      fehler: `Das ist kein Dienstkonto-Schlüssel (type ist ${JSON.stringify(daten.type ?? null)}, erwartet "service_account").`,
      hinweis: 'Ein Konto aus "gcloud auth login" hat type "authorized_user" und taugt hier nicht.',
    };
  }
  for (const feld of ["client_email", "private_key", "project_id"]) {
    if (!daten[feld]) return { fehler: `Im Schlüssel fehlt das Feld ${feld}.` };
  }

  return { konto: daten.client_email, projekt: daten.project_id };
}

const ergebnis = pruefe(await lies(process.stdin));

if (ergebnis.fehler) {
  console.error(ergebnis.fehler);
  if (ergebnis.hinweis) console.error(ergebnis.hinweis);
  process.exit(1);
}

console.log(`Dienstkonto: ${ergebnis.konto}`);
console.log(`Projekt im Schlüssel: ${ergebnis.projekt}`);
