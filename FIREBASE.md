# Firebase: was einmal eingerichtet werden muss

Die Mini-Games haben ein eigenes Firebase-Projekt: **`games-a0cd4`**. Mit der
Kids-App teilen sie nichts mehr – nicht das Projekt, nicht die Datenbank, nicht
die Konten, nicht die Zahlen.

In der Datenbank steht genau eine Sammlung:

```
miniScores/<spiel>_<spieler>
    game        "towerStack"     welches Spiel
    spieler     "mini_a7f3…"     die Kennung, die das Gerät sich selbst gab
    name        "Jonas"          was in der Liste steht
    punkte      42               der Bestwert, er fällt nie
    versuche    7                wie oft gespielt wurde
    erstesMs / updatedAtMs       Uhrzeiten, für die Reihenfolge bei Gleichstand
```

Lesen darf jeder, auch ohne Konto – die Liste ist der Sinn der Sache.
Schreiben auch, aber nur in dieser Form (`firestore.rules`). Löschen darf nur
der Admin.

## 1. Die Regeln fahren von selbst nach Firebase

`firestore.rules` im Repository ist die Wahrheit. In der Firebase-Console wird
an den Regeln **nichts von Hand** geändert – sonst laufen zwei Fassungen
auseinander, und welche gilt, sieht man erst, wenn etwas nicht mehr geht.

`.github/workflows/firestore-rules.yml` macht das:

| wann | was |
|---|---|
| Pull Request | Regeln im Emulator durchspielen (`npm run test:rules`), und – wenn ein Prüfschlüssel hinterlegt ist – von Firebase gegenlesen lassen |
| Merge nach `main` | Regeln veröffentlichen |

Ein Merge nach `main` wirkt **sofort** auf die Produktionsdatenbank. Anders als
bei Netlify gibt es hier kein gesperrtes Publishing dazwischen.

### Einzurichten (einmal)

1. **Dienstkonto anlegen.** Google Cloud Console → *IAM & Verwaltung* →
   *Dienstkonten* → *Dienstkonto erstellen*, Projekt `games-a0cd4`.
   Name z. B. `github-regeln`.
2. **Rolle geben:** `Firebase Rules Admin` (`roles/firebaserules.admin`). Mehr
   nicht – dieses Konto soll Regeln veröffentlichen und sonst gar nichts.
3. **Schlüssel herunterladen:** Reiter *Schlüssel* → *Schlüssel hinzufügen* →
   *JSON*.
4. **GitHub-Umgebung anlegen:** Repository → *Settings* → *Environments* →
   *New environment*, Name **`produktion`**. Unter *Deployment branches* nur
   `main` zulassen.
5. **Secret hinterlegen:** in dieser Umgebung (nicht im Repository!) das Secret
   **`FIREBASE_SERVICE_ACCOUNT`** anlegen, Inhalt = die JSON-Datei **im
   Klartext**, so wie Google sie herunterlädt. Nicht base64-kodiert –
   `scripts/pruefe-dienstkonto.mjs` sagt es sonst im Workflow.

Warum in einer Umgebung und nicht im Repository: Bei einem Pull Request läuft
der Workflow in der Fassung, die im Pull Request steht. Läge der Schlüssel als
gewöhnliches Repository-Secret bereit, könnte jeder, der einen Branch pushen
darf, diesen Workflow umschreiben und damit veröffentlichen, ohne je nach
`main` mergen zu dürfen. Eine Umgebung gibt ihre Secrets nur an einen Job, der
sie anfordert – und nur von den Branches, die in ihrer Regel stehen.

### Freiwillig

Ein zweites Dienstkonto mit derselben Rolle, hinterlegt als
**Repository**-Secret `FIREBASE_SERVICE_ACCOUNT_PRUEFUNG`, lässt Firebase die
Regeln schon im Pull Request gegenlesen (`--dry-run`, veröffentlicht nichts).
Fehlt es, wird der Schritt übersprungen statt zu scheitern.

## 2. Anmeldung – nur für den Adminbereich

Die Spielseiten laden `firebase-auth` gar nicht erst. Angemeldet wird
ausschliesslich unter `/admin`, mit drei Wegen: Google, E-Mail-Link, Passwort.

Wer Admin ist, entscheidet `firestore.rules` (`istAdmin`): die Adresse muss in
der Liste stehen **und bestätigt sein** (`email_verified`). Bei Google und beim
E-Mail-Link ist sie das von sich aus, beim Passwort erst nach dem Klick auf den
Bestätigungslink.

Eine weitere Adresse aufnehmen heisst: Zeile in `firestore.rules` (`istAdmin`)
**und** in `admin.js` (`ADMINS`). Die zweite ist nur Höflichkeit – sie sorgt
dafür, dass jemand eine verständliche Meldung bekommt statt einer leeren
Seite. Schutz ist allein die erste: Die Datenbank fragt nicht den Browser.

### Einzurichten in der Firebase-Console

*Authentication → Settings → Authorized domains* muss enthalten:

- `games.alae.app`
- `gamesrepo.netlify.app`
- `localhost` (steht meist schon da)

Ohne das schlägt Google-Anmeldung und E-Mail-Link mit
`auth/unauthorized-domain` fehl. Der Adminbereich sagt das dann auch so.

## 3. Was hier NICHT steht

Keine Konten von Spielern, kein Fortschritt, keine Käufe, keine Besuchszahlen.
Wer über einen Mini-Link hereinkommt, hinterlässt eine Zeile in `miniScores`,
sobald er seinen Namen einträgt – und sonst nichts.

## 4. Die alten Ergebnisse

Bis zur Trennung lagen die Ergebnisse im Projekt der Kids-App
(`lernapp-8d944`, Sammlung `miniScores`). Die sind **nicht** mitgekommen: Ein
neues Projekt ist eine neue, leere Datenbank. Die Liste fängt bei null an.

Falls dort noch etwas stehen soll, was sich lohnt: Ein Umzug ginge über das
Admin-SDK mit demselben Dienstkonto-Schlüssel, der für die Regeln ohnehin
gebraucht wird. Über den Browser ginge es nicht – die Regeln lassen einen
Eintrag nur mit `versuche == 1` anlegen, und damit wäre die Zahl der Runden
verloren.

## Prüfen, ohne etwas anzufassen

```
npm run test:rules        Regeln im Firestore-Emulator durchspielen.
                          Braucht Java, kein Netz, keine Zugangsdaten.
npm run pruefen           Dateien: zeigen alle vier Stellen auf dasselbe
                          Projekt? Kennen die Regeln dieselben Spiele wie
                          mini-games.js?
```
