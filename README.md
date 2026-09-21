# Mini-Games

Die Spiele aus [Gripszug](https://kids.alae.app) einzeln, für alle, ohne Konto.

Ein Link, ein Spiel, eine Bestenliste, auf der alle stehen:

    https://games.alae.app/turmbau

Gedacht zum Weitergeben. Wer den Link öffnet, spielt sofort: keine Anmeldung,
keine Schranke, kein Zug, der wächst. Nur die Frage, wer die höchste Zahl
schafft. Unter `/` stehen alle Spiele nebeneinander, dazu die Hall of Fame –
wer den besten Durchschnittsrang hat, wer wie oft gespielt hat, wer wie viele
Spiele anführt.

## Wie das hier gebaut ist

Kein Build-Werkzeug, kein Framework, keine Abhängigkeiten im Browser ausser
dem Firebase-SDK. Die Site sind die Dateien im Wurzelverzeichnis; Netlify
kopiert sie nach `dist/` (`netlify/build.mjs`) und veröffentlicht das.

    index.html            die Startseite: alle Spiele, alle Namen
    turmbau.html …        elf Spielseiten, erzeugt
    admin.html            der Adminbereich, erzeugt
    app.webmanifest       erzeugt
    service-worker.js     erzeugt

    mini-games.js         die Liste der Spiele, die Knöpfe, die Bestenliste,
                          die Auswertung der Startseite
    cloud.js              Firestore: miniScores lesen, schreiben, umbenennen –
                          und miniGeister, die Aufzeichnungen der Läufe.
    admin.js              anmelden und aufräumen. Der einzige Ort mit
                          Anmeldung; die Spielseiten laden firebase-auth
                          gar nicht erst.
    game-shell.js         die gemeinsame Bühne: Leiste, Zeitbalken,
                          Spielfläche, Ergebnis
    game-cloud.js         der Spielstand während einer Runde. Er überlebt die
                          Seite nicht, und das ist Absicht.
    zufall.js             der Zufall. Ohne Turnier in der Adresse ist er
                          Math.random; mit einem bekommt jeder denselben Lauf.
    kids.js               Lautsprecher, Ton, Vorlesen, Konfetti
    train-art.js          die Lok und die zwei Handgriffe, mit denen hier
                          jede Zeichnung entsteht (el, shade)
    train-scenes.js       die Landschaft hinter jedem Spiel
    strand-art.js         die Schätze für drei der Spiele
    highscore.js          welches Spiel wie heisst und wozu es gehört
    styles.css            das Aussehen
    pwa.js                Service Worker anmelden, Installation anbieten

    firestore.rules       die Regeln der Datenbank. Sie fahren von selbst
                          nach Firebase, sobald sie auf main stehen.

    scripts/seiten-bauen.mjs   baut die erzeugten Dateien aus einer Tabelle
    scripts/pruefen.mjs        hält alles zusammen, ohne Browser
    scripts/check-spiele.mjs   spielt jedes Spiel einmal durch, im Browser
    scripts/test-rules.mjs     spielt die Regeln im Emulator durch

## Ein Spiel dazunehmen

1. `<spiel>.js` schreiben – oder aus dem Repository der App herüberkopieren,
   dazu seinen Abschnitt aus deren `styles.css`. Die Spiele hängen nur an
   `LernappGameShell`, `LernappGameCloud`, `LernappKids`, `LernappTrainArt`,
   `LernappZufall` und `LernappHighscore`; alles davon gibt es hier.
2. Eine Zeile in `SPIELE` in `scripts/seiten-bauen.mjs`, eine in
   `mini-games.js` und eine in `highscore.js` (Titel, Bereich, Einheit).
3. `npm run bauen && npm run pruefen`

Ein Spiel, das würfelt, nimmt seine Zahlen aus `LernappZufall.fuer(<spiel>)`
statt aus `Math.random` – und ruft `neu()` zu Beginn jeder Runde. Ohne Turnier
in der Adresse ist beides dasselbe wie vorher; mit Turnier spielen alle
denselben Lauf, und der zweite Versuch ist derselbe wie der erste.

**Wichtig:** Welche Spiele in die Bestenliste schreiben dürfen, steht auch in
`firestore.rules` (Funktion `miniSpiele`) – ein neues Spiel braucht dort eine
Zeile, sonst weist die Datenbank jeden Eintrag ab. `npm run pruefen` hält die
beiden Listen zusammen, und der Merge nach `main` bringt die Regeln nach
Firebase.

### Geister

Der Streckenlauf hat ein festes Level – dieselben Lücken, dieselben Kisten,
Meter für Meter. Genau das macht etwas möglich, was sonst keines der Spiele
kann: Ein Lauf lässt sich aufheben und neben dem nächsten noch einmal
abspielen. Wer `/strecke` öffnet, läuft deshalb neben den drei Besten, so wie
sie damals gelaufen sind.

Aufgezeichnet werden Stellungen, keine Tastendrücke: alle 50 Millisekunden x
und y, drei Bytes je Stellung, als Text. Eingaben wären kleiner, verlangten
aber eine Physik, die sich nie mehr ändern darf – eine einzige Nachbesserung
an der Sprunghöhe, und jeder alte Geist liefe durch Wände. Stellungen sind
stumpf und halten das aus.

Sie stehen in einer eigenen Sammlung (`miniGeister`), nicht in `miniScores`:
Die Startseite liest jedes Punkte-Dokument, um die Hall of Fame zu bauen, und
lüde sonst bei jedem Besuch ein paar Kilobyte je Spieler mit, die dort niemand
ansieht. Geschrieben wird eine Aufzeichnung nur zusammen mit der Punktzahl und
nur bei einem Rekord – denselben Weg durch `mini-games.js`, keinen zweiten.

Jede Aufzeichnung trägt die Fassung ihres Levels (`level: "v1"`). Ändert sich
die Strecke, zählt `LEVEL` in `strecke.js` hoch, und die alten Geister
verschwinden aus dem Bild. Das ist der Preis dafür, dass nie einer läuft, der
nicht mehr passt.

Geeignet ist ein Spiel, das genau eine Zahl liefert, bei der grösser besser
ist. Spiele mit Sternen je Level taugen nicht: Am Ende hätten alle drei, und
die Liste sagte nichts mehr.

Und es soll von selbst zu einem Ende kommen: eine feste Uhr wie bei Blätter im
Strom, eine feste Zahl Anläufe wie beim Bremsweg oder wenigstens ein Deckel wie
beim Heizer. Eine Runde, die eine Viertelstunde dauern kann, ist keine Runde
mehr, die man jemandem schickt.

## Firebase

Eigenes Projekt (`games-a0cd4`), eigene Datenbank, eigene Anmeldung – mit der
Kids-App teilt das hier nichts mehr. Wie das eingerichtet ist und was einmalig
von Hand gemacht werden muss (Dienstkonto, GitHub-Umgebung, Authorized
Domains), steht in [FIREBASE.md](FIREBASE.md).

`firestore.rules` im Repository ist die Wahrheit: Ein Merge nach `main`
veröffentlicht die Regeln. In der Console wird nichts von Hand geändert.

## Der Adminbereich

`/admin`. Drei Wege hinein – Google, E-Mail-Link, Passwort. Dahinter steht,
was in der Bestenliste steht: Zahlen, alle Spieler, jedes Spiel mit seinen
Einträgen. Und das Einzige, was kein Gast darf: löschen.

Dafür gibt es die Anmeldung überhaupt. Eine Liste, in die jeder ohne Konto
schreiben darf, ist irgendwann eine Liste mit einem Namen darin, den man dort
nicht haben will.

Er gehört bewusst nicht zur installierten App: kein Manifest, kein Service
Worker, nicht im Zwischenspeicher. Wer hierherkommt, will die aktuellen Zahlen
sehen, nicht die von gestern.

## Ohne Konto

Wer hier schreibt, sagt nur, wer er zu sein behauptet: eine Kennung, die sein
Gerät sich selbst gegeben hat (`mini_…`), und ein Name, den er selbst
eingetippt hat. Die Regeln prüfen deshalb nicht, **wer** schreibt, sondern
**was**: ein Dokument je Spiel und Spieler, ein Name von höchstens 24 Zeichen,
Punkte, die nie fallen, ein Zähler, der nur steigt. Das ist eine Bestenliste
unter Freunden, keine Urkunde.

Der Name gehört dem Gerät, nicht einem Konto (`localStorage`, `mini.name`).
Auf einem anderen Gerät trägt man ihn neu ein – in der Liste steht man
trotzdem einmal, gezählt wird der Name.

## Prüfen

    npm run pruefen           die Dateien: Tabelle, Seiten, Service Worker,
                              Manifest, Zeichen, Regeln, Adminbereich,
                              keine Reste der App
    npm run pruefen:browser   jedes Spiel einmal öffnen und eine Runde
                              anspielen. Braucht Playwright:
                              npm i && npx playwright install chromium
    npm run test:rules        die Firestore-Regeln im Emulator durchspielen.
                              Braucht Java, kein Netz, keine Zugangsdaten.

`pruefen:browser` ist das, was zählt: `styles.css` und `train-art.js` sind aus
der App herausgeschnitten worden, und was dabei zu viel wegfiel, sieht man
keiner Datei an – nur einer Seite, die weiss bleibt.

## Was hier bewusst fehlt

Konten für Spieler, Kinder, Gruppen, Käufe, Fortschritt, der Zug, die Reise,
die Schranke vor der zweiten Runde – das alles ist Gripszug und bleibt dort.
Aus der App kommt nur, was ein Spiel zum Laufen braucht.

Besuche zählt hier niemand. Wer spielt, hinterlässt eine Zeile in
`miniScores`, sobald er seinen Namen einträgt – und sonst nichts.
