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
    turmbau.html …        zwölf Spielseiten, erzeugt
    app.webmanifest       erzeugt
    service-worker.js     erzeugt

    mini-games.js         die Liste der Spiele, die Knöpfe, die Bestenliste,
                          die Auswertung der Startseite
    cloud.js              Firestore, aber nur miniScores – lesen, schreiben,
                          umbenennen. Sonst nichts.
    game-shell.js         die gemeinsame Bühne: Leiste, Zeitbalken,
                          Spielfläche, Ergebnis
    game-cloud.js         der Spielstand während einer Runde. Er überlebt die
                          Seite nicht, und das ist Absicht.
    kids.js               Lautsprecher, Ton, Vorlesen, Konfetti
    train-art.js          die Lok und die zwei Handgriffe, mit denen hier
                          jede Zeichnung entsteht (el, shade)
    train-scenes.js       die Landschaft hinter jedem Spiel
    strand-art.js         die Schätze für drei der Spiele
    highscore.js          welches Spiel wie heisst und wozu es gehört
    styles.css            das Aussehen
    pwa.js                Service Worker anmelden, Installation anbieten

    scripts/seiten-bauen.mjs   baut die erzeugten Dateien aus einer Tabelle
    scripts/pruefen.mjs        hält alles zusammen, ohne Browser
    scripts/check-spiele.mjs   spielt jedes Spiel einmal durch, im Browser

## Ein Spiel dazunehmen

1. `<spiel>.js` aus dem Repository der App herüberkopieren – dazu seinen
   Abschnitt aus deren `styles.css`. Die Spiele hängen nur an
   `LernappGameShell`, `LernappGameCloud`, `LernappKids`, `LernappTrainArt`
   und `LernappHighscore`; alles davon gibt es hier.
2. Eine Zeile in `SPIELE` in `scripts/seiten-bauen.mjs` und eine in
   `mini-games.js`.
3. `npm run bauen && npm run pruefen`

**Wichtig:** Die Bestenliste liegt im Firebase-Projekt der App, in der
Sammlung `miniScores`. Welche Spiele dort schreiben dürfen, steht in
`firestore.rules` **im Repository der App** (Funktion `miniSpiele`). Ein
neues Spiel braucht dort eine Zeile, sonst weist die Datenbank jeden Eintrag
ab. Von hier aus lässt sich das nicht prüfen.

Geeignet ist ein Spiel, das genau eine Zahl liefert, bei der grösser besser
ist. Spiele mit Sternen je Level taugen nicht: Am Ende hätten alle drei, und
die Liste sagte nichts mehr.

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
                              Manifest, Zeichen, keine Reste der App
    npm run pruefen:browser   jedes Spiel einmal öffnen und eine Runde
                              anspielen. Braucht Playwright:
                              npm i && npx playwright install chromium

`pruefen:browser` ist das, was zählt: `styles.css` und `train-art.js` sind aus
der App herausgeschnitten worden, und was dabei zu viel wegfiel, sieht man
keiner Datei an – nur einer Seite, die weiss bleibt.

## Was hier bewusst fehlt

Konten, Kinder, Gruppen, Käufe, Fortschritt, der Zug, die Reise, der
Adminbereich, die Schranke vor der zweiten Runde – das alles ist Gripszug und
bleibt dort. Aus der App kommt nur, was ein Spiel zum Laufen braucht.

Besuche zählt hier niemand: Wer über einen Mini-Link hereinkommt, hat die App
nicht geöffnet, und so soll es in deren Zahlen auch aussehen.
