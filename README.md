# Mini-Games

Die Spiele aus [Gripszug](https://kids.alae.app) einzeln, für alle, ohne Konto.

Ein Link, ein Spiel, eine Bestenliste, auf der alle stehen:

    https://games.alae.app/turmbau

Gedacht zum Weitergeben. Wer den Link öffnet, spielt sofort: keine Anmeldung,
keine Schranke, kein Zug, der wächst. Nur die Frage, wer die höchste Zahl
schafft. Unter `/` stehen alle Spiele nebeneinander, dazu die Hall of Fame –
wer den besten Durchschnittsrang hat, wer wie oft gespielt hat, wer wie viele
Spiele anführt.

Und ab und zu ein Turnier: eine eigene Rangliste mit Anfang und Ende, für
alle auf der Startseite oder nur für die, denen man den Link schickt.

    https://games.alae.app/turnier?t=herbstcup-k3m9x2p7

## Wie das hier gebaut ist

Kein Build-Werkzeug, kein Framework, keine Abhängigkeiten im Browser ausser
dem Firebase-SDK. Die Site sind die Dateien im Wurzelverzeichnis; Netlify
kopiert sie nach `dist/` (`netlify/build.mjs`) und veröffentlicht das.

    index.html            die Startseite: alle Spiele, alle Namen
    turmbau.html …        zehn Spielseiten, erzeugt
    turnier.html          die Turnierseite, erzeugt
    admin.html            der Adminbereich, erzeugt
    app.webmanifest       erzeugt
    service-worker.js     erzeugt

    mini-games.js         die Liste der Spiele, die Knöpfe, die Bestenliste,
                          die Auswertung der Startseite
    cloud.js              Firestore: miniScores lesen, schreiben, umbenennen –
                          miniGeister, die Aufzeichnungen der Läufe, und
                          miniTurniere mit ihren Einträgen.
    turnier.js            der Turniermodus: die Turnierseite, der Hinweis auf
                          der Startseite, die Sperre vor dem Spiel, der Versuch,
                          das Ergebnis, die Gesamtwertung
    admin.js              anmelden, aufräumen, Turniere ausrichten. Der
                          einzige Ort mit Anmeldung; die Spielseiten laden
                          firebase-auth gar nicht erst.
    game-shell.js         die gemeinsame Bühne: Leiste, Zeitbalken,
                          Spielfläche, Ergebnis
    geist.js              die Gegner: Platz 1 und die eigene Bestmarke als
                          Schalter über der Spielfläche, mitlaufend oder als
                          Zielmarke, dazu die Aufzeichnung der eigenen Runde
    game-cloud.js         der Spielstand während einer Runde. Er überlebt die
                          Seite nicht, und das ist Absicht.
    zufall.js             der Zufall. Ohne Turnier in der Adresse ist er
                          Math.random; mit einem bekommt jeder im selben
                          Versuch denselben Lauf.
    kids.js               Lautsprecher, Ton, Vorlesen, Konfetti
    train-art.js          die Lok und die zwei Handgriffe, mit denen hier
                          jede Zeichnung entsteht (el, shade)
    train-scenes.js       die Landschaften der App. Geladen, aber nicht mehr
                          aufgebaut: Die Spiele stehen im Vollbild.
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
denselben Lauf: den ersten Versuch alle gleich, den zweiten auch – aber einen
anderen als den ersten. `npm run pruefen` besteht darauf.

Nur was die Aufgabe entscheidet, kommt aus dem Turnier-Zufall. Was davon
abhängt, wie jemand spielt – Funken beim perfekten Treffer, das Schlingern
eines Fisches Bild für Bild –, bleibt bei `Math.random`. Sonst zöge der
bessere Spieler mehr Zahlen, und ab seinem ersten Funken liefe sein Lauf
anders als der aller anderen.

**Wichtig:** Welche Spiele in die Bestenliste schreiben dürfen, steht auch in
`firestore.rules` (Funktion `miniSpiele`) – ein neues Spiel braucht dort eine
Zeile, sonst weist die Datenbank jeden Eintrag ab. `npm run pruefen` hält die
beiden Listen zusammen, und der Merge nach `main` bringt die Regeln nach
Firebase.

Geeignet ist ein Spiel, das genau eine Zahl liefert, bei der grösser besser
ist. Spiele mit Sternen je Level taugen nicht: Am Ende hätten alle drei, und
die Liste sagte nichts mehr.

Und es soll von selbst zu einem Ende kommen: eine feste Uhr wie bei Blätter im
Strom, eine feste Zahl Runden wie bei Wo hält der Zug? oder wenigstens ein
Deckel wie beim Heizer. Eine Runde, die eine Viertelstunde dauern kann, ist
keine Runde mehr, die man jemandem schickt.

### Gegner und Geister

Wer spielt, spielt nicht allein: Über der Spielfläche stehen zwei Schalter,
«Platz 1» und «Bestmarke» (`geist.js`). Sie sagen vor der Runde, gegen wen es
geht, lassen sich an- und abschalten (die Wahl gilt auf dem Gerät für alle
Spiele) und zeigen während der Runde, wo man gegen den Gegner steht – grün,
solange man vor ihm liegt, mit einem Ton, wenn man seine Zahl schlägt.

    mitlaufend   Blätter im Strom, Lianenschwung: Spiele mit
                 fester Zeit. Der Gegner läuft mit seinem Stand von
                 damals mit, Viertelsekunde für Viertelsekunde. Im Lianenschwung
                 zusätzlich als Geist im Bild – die Strecke ist immer
                 dieselbe, also schwingt er an denselben Lianen.
    Zielmarke    Turmbau, Brückenbauer, Drehscheibe, Tunnelflug,
                 Fischteich, Kacheln-Knobeln: Spiele ohne Uhr. Der
                 Gegner ist eine Zahl; im Turmbau eine Linie in der Höhe
                 seines besten Turms.

Platz 1 ist der Erste der Hall of Fame, im Turnier der Erste des Turniers –
bei einer verdeckten Rangliste bleibt er verborgen, und ein Turnier kann die
Gegner ganz abschalten. Die Bestmarke ist der eigene Bestwert auf dem Gerät.

Aufgezeichnet werden Stellungen, keine Tastendrücke – Stellungen überstehen
eine Nachbesserung an der Physik, Eingaben nicht. Sie stehen in einer eigenen
Sammlung (`miniGeister`), nicht in `miniScores`: Die Startseite liest jedes
Punkte-Dokument und lüde sonst bei jedem Besuch Kilobytes mit, die dort
niemand ansieht. Geschrieben wird eine Aufzeichnung nur zusammen mit der
Punktzahl und nur bei einem Rekord (`mini-games.js`, `melde`), und jede trägt
ihre Fassung (`level`): Ändert sich, was darin steht, zählt sie hoch, und die
alten Geister verschwinden aus dem Bild. Im Turnier liegt der beste Lauf
jedes Spielers unter `miniTurniere/<id>/geister`; den eigenen besten Lauf
hält das Gerät selbst, auch ohne Namen und ohne Netz. Fehlt zu einem Gegner
die Aufzeichnung – eine Bestzahl von früher –, steht er als Zielmarke da.

## Turniere

Ein Turnier legt der Admin an (`/admin`, «Neues Turnier») – und stellt ein,
was es ausmacht:

    Spiele            welche dazugehören, eines bis alle zehn
    Wann              Beginn und Dauer (30 Minuten bis ein Monat), ein
                      eigenes Ende – oder ohne Zeitlimite
    Versuche          je Spiel unbegrenzt, eine feste Zahl, getippt
                      (1 bis 100) – oder nur, wer nicht vorne liegt
    Was zählt         der beste Versuch oder alle zusammen
    Gesamtwertung     Platzziffer (die Plätze zusammengezählt, die kleinste
                      Summe gewinnt) oder Prozent vom Besten (der Beste
                      eines Spiels bekommt 100, die anderen ihren Anteil)
    Aufgaben          für alle gleich, gleiches Level wie der 1. Platzierte
                      oder jedes Mal neu gewürfelt
    Wer es sieht      alle in der App (auf der Startseite) oder nur, wer den
                      Link hat
    Verdeckt          die Rangliste erst am Schluss zeigen
    Gegner            Platz 1 und die eigene Bestmarke beim Spielen zeigen
                      (Vorgabe) oder nicht
    Aktiv             angehalten, bis es gebraucht wird – "Jetzt starten",
                      "Anhalten", "Jetzt beenden" gehen mit einem Klick

Gespielt wird es auf der Turnierseite (`/turnier?t=<id>`): Von dort führt
jedes Spiel mit `?turnier=<id>` in der Adresse ins Spiel, und das Spiel steht
sofort da – keine Tafel davor. Nur wer noch keinen Namen hat, wird einmal
danach gefragt. Wer gerade nicht spielen darf (alle Versuche gespielt,
allein vorne, noch nicht begonnen, angehalten, vorbei), landet ohne ein Wort
wieder auf der Turnierseite; dort steht beim Spiel, warum. Sonst läuft das
Spiel wie immer, nur dass sein Ergebnis ins Turnier geht (und in die ewige
Liste, eine Runde ist eine Runde).

Unter dem Ergebnis steht im Turnier nur die Rangliste des Spiels, darüber
«Neuer Rekord!», wenn die Runde auf Platz 1 führt. «Noch einmal» gibt es nur,
wenn es noch einmal geht; sonst bleibt der Pokal, der zum Turnier führt.

**Ein Versuch zählt, sobald er beginnt.** Sonst hätte ein Turnier mit drei
Versuchen beliebig viele: Wer eine schlechte Runde kommen sieht, lädt neu,
und die Runde hat es nie gegeben. Die Regeln der Datenbank setzen das durch
(`offen` in `firestore.rules`): erst der Beginn, dann genau ein Ergebnis.

**Nur mit Link heisst: nirgends aufgeführt.** Die Startseite fragt nur nach
öffentlichen Turnieren, und die Regeln lassen keine andere Frage zu. Der Name
eines Turniers ist deshalb lang und zufällig (`herbstcup-k3m9x2p7`), nicht
`herbst24`. Geheim ist es damit nicht – wer den Link weitergibt, gibt das
Turnier weiter.

**Verdeckt heisst: die Seite zeigt es nicht.** Wer will, liest die Zahlen
trotzdem aus der Datenbank; die Einträge sind lesbar wie die ewige Liste.
Das ist für die Spannung, nicht zur Geheimhaltung.

**Ohne Zeitlimite heisst: bis es angehalten wird.** Ein solches Turnier
läuft, bis der Admin es anhält, beendet oder löscht. Ein Ende hat es in der
Datenbank trotzdem – den 31. Dezember 9999 (`OHNE_ENDE` in `turnier.js`).
So rechnen die Regeln damit wie mit jedem anderen Turnier und mussten dafür
nichts lernen; auf den Seiten steht statt des Datums «ohne Zeitlimite».

**Nur wer nicht vorne liegt: Platz 1 wartet.** Jeder spielt jedes Spiel so
oft, wie er will – ausser das, in dem er allein auf Platz 1 steht. Dort
wartet er, bis ihn jemand einholt oder überholt. Wer überall vorne liegt, hat
keinen Versuch mehr, bis die anderen nachziehen. Bei Gleichstand an der
Spitze führt niemand (sonst liesse sich der Gleichstand nie mehr brechen),
und mit null Punkten auch nicht (sonst sperrte ein abgebrochener erster
Versuch aus). Gezählt wird wie bei «unbegrenzt» der beste Versuch.

Das prüft die Seite (`turnier.js`, `alleinVorne`), nicht die Datenbank: Wer
vorne liegt, steht erst in allen Einträgen eines Spiels, und eine Regel kann
keine Liste befragen. Die Regeln lassen das Feld (`spitzeWartet`) nur zusammen
mit unbegrenzten Versuchen zu. Wie «verdeckt» gilt es für das Spiel unter
Freunden, nicht gegen jemanden, der die Datenbank von Hand beschreibt. Mit
verdeckter Rangliste erfährt so nur der Führende, dass er vorne liegt.

**Aufgaben: woher die Läufe kommen.** Viele Spiele würfeln ihre Welt:
Pfeiler, Lianen, den Tunnel, die gesuchte Zahl. Im Turnier kommt dieser
Zufall aus `zufall.js`, mit einer Saat aus Turnier, Versuch und Spiel.

    für alle gleich      der erste Versuch ist für alle derselbe Lauf, der
                         zweite auch – aber ein anderer als der erste
    wie Platz 1          jeder Versuch ist der erste, für alle und immer
                         wieder (`aufgaben: "wieErster"`). Wer vorne liegt,
                         hat seine Punkte auf genau dem Lauf geholt, den alle
                         spielen – auch im zehnten Versuch. Der Geist von
                         Platz 1 fliegt dieselbe Strecke mit.
    neu gewürfelt        wie ausserhalb des Turniers

**Ein Turnier ist ein Raum für sich.** Von der Turnierseite und aus einem
Spiel im Turnier führt kein Weg hinaus: kein «Ohne Turnier spielen», kein
«Schon mal üben», kein Link zur Hall of Fame. Wer allein vorne liegt oder alle
Versuche gespielt hat, kommt nur noch zurück zum Turnier. Die Turnierseite
zeigt je Spiel nur den Namen, die Rangliste und den Knopf (oder an seiner
Stelle «Du liegst vorne»); den Link zum Weitergeben hat der Adminbereich.

**Ein Turnier auf dem Startbildschirm.** Wer im Turnier «Zum Startbildschirm»
wählt, bekommt das Turnier als eigene App: mit seinem Namen, und sie öffnet
direkt die Turnierseite. Dafür baut `turnier.js` (`alsApp`) im Browser ein
eigenes Manifest, sobald das Turnier gelesen ist – Chrome und Edge lesen es.
Safari auf dem iPhone nicht; dort setzt dieselbe Stelle den Namen
(`apple-mobile-web-app-title`), und gestartet wird die Seite, auf der man
beim Hinzufügen war.

**Das Gerät merkt sich seine Turniere.** Jedes Turnier, das geöffnet wird,
auch eines nur mit Link, steht danach auf der Startseite dieses Geräts,
zuvorderst (`mini.turniere`, höchstens zehn). So findet es auch, wer die App
schon installiert hat und den Link nur einmal angeklickt hat. Auf Android
teilen sich Browser und installierte App diesen Speicher; auf dem iPhone
kennt die App auf dem Startbildschirm nur, was in ihr selbst geöffnet wurde.

## Vollbild

Jedes Spiel füllt das Bild: Die Spielfläche reicht bis an den linken, rechten
und unteren Rand, oben bleibt ein ruhiger Streifen mit den Knöpfen, der Uhr und
den Gegnern (`styles.css`, Die Bühne). Die Landschaft aus der App baut die
Bühne nicht mehr auf. Die Spiele mit einer Leinwand haben eine breiteste
Welt (Turmbau, Brückenbauer, Drehscheibe, Lianenschwung, Tunnelflug); auf
einem sehr flachen Bild steht ihre Fläche in der Mitte, statt oben ein Stück
Welt zu verlieren.

Oben rechts, neben dem Ton, holt ein Knopf das Spiel ins Vollbild des
Browsers – ohne Adressleiste, auch ohne die App zu installieren. Ihn gibt es
nur, wo der Browser das einer Seite erlaubt (am Computer, auf Android; auf dem
iPhone nicht), und nicht in der installierten App, die ohnehin im Vollbild
startet. Das Vollbild gilt für eine Seite: Wer ins nächste Spiel wechselt,
tippt dort noch einmal.

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
Einträgen, die Turniere. Und was kein Gast darf: löschen und Turniere
ausrichten.

In der App gibt es keinen Anmeldeknopf. Wer aber im Adminbereich angemeldet
ist und von dort zu den Spielen geht, findet rechts im Balken der Startseite
(und der Turnierseite) einen Knopf zurück. Die Spielseiten können die
Anmeldung nicht selbst lesen – sie laden firebase-auth gar nicht erst –,
deshalb merkt sich `admin.js` im localStorage (`mini.admin`), dass hier ein
Admin angemeldet ist, und nimmt es beim Abmelden wieder weg. Ein Schutz ist
das nicht und muss keiner sein: Wer das Merkzeichen von Hand setzt, bekommt
einen Knopf, der zur Anmeldung führt.

Dafür gibt es die Anmeldung überhaupt. Eine Liste, in die jeder ohne Konto
schreiben darf, ist irgendwann eine Liste mit einem Namen darin, den man dort
nicht haben will.

Neben jedem Spiel – in der Auswahl für die Startseite wie im Formular eines
Turniers – steht ein kleines ▶. Es startet das Spiel im Vollbild, in einem
Fenster über dem Adminbereich (ein halb ausgefülltes Turnier darunter bleibt,
wie es war), mit `?von=admin` in der Adresse. Die Runde zählt wie jede andere:
Sie geht unter dem Namen dieses Geräts in die Hall of Fame, der beste Versuch
bleibt stehen. Der Weg oben links im Spiel schliesst das Fenster wieder. Wo
der Browser kein Vollbild kennt (iPhone), füllt das Fenster den Bildschirm.

Ein Turnier anlegen oder ändern geschieht für sich allein: Solange das
Formular offen ist, steht darunter nichts anderes. «Zurück zur Übersicht»,
«Abbrechen» oder der Zurück-Knopf des Browsers führen wieder zur ganzen Seite.

Die Turniere stehen nach ihrem Stand gruppiert da: zuerst die laufenden, dann
geplante, angehaltene und beendete. Ein Tipp auf ein Turnier wählt es aus und
klappt auf, was sich damit tun lässt – öffnen, Link kopieren, umbenennen (der
Link bleibt derselbe), bearbeiten, starten, anhalten, fortsetzen, beenden,
löschen – und den ganzen Stand. Daraus lässt sich ein einzelner Spieler
entfernen, mit allen seinen Einträgen in diesem Turnier, ohne das Turnier
selbst anzurühren.

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
    npm run test:rules        die Firestore-Regeln im Emulator durchspielen –
                              und cloud.js dagegen laufen lassen, so wie es
                              im Browser läuft. Braucht Java, kein Netz,
                              keine Zugangsdaten.

`pruefen:browser` ist das, was zählt: `styles.css` und `train-art.js` sind aus
der App herausgeschnitten worden, und was dabei zu viel wegfiel, sieht man
keiner Datei an – nur einer Seite, die weiss bleibt.

## Was hier bewusst fehlt

Konten für Spieler, Kinder, Gruppen, Käufe, Fortschritt, der Zug, die Reise,
die Schranke vor der zweiten Runde – das alles ist Gripszug und bleibt dort.
Aus der App kommt nur, was ein Spiel zum Laufen braucht.

Besuche zählt hier niemand. Wer spielt, hinterlässt eine Zeile in
`miniScores`, sobald er seinen Namen einträgt, und wer in einem Turnier
spielt, eine in dessen Liste – und sonst nichts.
