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

    index.html            die Startseite «alae arcade»: alle Spiele als Filme,
                          ihre Bestenlisten
    turmbau.html …        dreiundzwanzig Spielseiten, erzeugt
    turnier.html          die Turnierseite, erzeugt
    live.html             der Multiplayer, erzeugt
    admin.html            der Adminbereich, erzeugt
    app.webmanifest       erzeugt
    service-worker.js     erzeugt

    mini-games.js         die Liste der Spiele, die Knöpfe, die Bestenliste,
                          die Bühne der Start- und der Turnierseite, die
                          Auswertung der Startseite
    bilder/               die Bilder der Startseite: echte Runden, im richtigen
                          Moment aufgenommen (quer, hoch, klein)
    filme/                die Filme von früher (ausgeschaltet, mini-games.js,
                          FILME)
    cloud.js              Firestore: miniScores lesen, schreiben, umbenennen –
                          miniGeister, die Aufzeichnungen der Läufe, und
                          miniTurniere mit ihren Einträgen.
    turnier.js            der Turniermodus: die Turnierseite, der Hinweis auf
                          der Startseite, die Sperre vor dem Spiel, der Versuch,
                          das Ergebnis, die Gesamtwertung
    admin.js              anmelden, aufräumen, Turniere ausrichten. Der
                          einzige Ort mit Anmeldung; die Spielseiten laden
                          firebase-auth gar nicht erst.
    live.js               der Multiplayer: Sichtbarkeit, Lobby, Leitung, Runden,
                          Wertung, Podest – über die Realtime Database
    live-spiel.js         ein Spiel als Runde eines Multiplayers: Countdown,
                          gemeinsamer Start, Punkte melden, Zeitende
    game-shell.js         die gemeinsame Bühne: Leiste, Zeitbalken,
                          Spielfläche, Ergebnis
    geist.js              die Gegner: Platz 1 und die eigene Bestmarke als
                          Schalter über der Spielfläche, mitlaufend oder als
                          Zielmarke, dazu die Aufzeichnung der eigenen Runde
    game-cloud.js         der Spielstand während einer Runde. Er überlebt die
                          Seite nicht, und das ist Absicht.
    zufall.js             der Zufall. Ohne Turnier in der Adresse würfelt
                          jede Runde ihre eigene Saat; mit einem bekommt
                          jeder im selben Versuch denselben Lauf.
    kids.js               Ton, Konfetti
    vollbild.js           der Knopf fürs Vollbild und der Rahmen, in dem es
                          über Seitenwechsel bestehen bleibt
    train-art.js          die Lok und die zwei Handgriffe, mit denen hier
                          jede Zeichnung entsteht (el, shade)
    train-scenes.js       die Landschaften der App. Geladen, aber nicht mehr
                          aufgebaut: Die Spiele stehen im Vollbild.
    highscore.js          welches Spiel wie heisst und wozu es gehört
    styles.css            das Aussehen
    pwa.js                Service Worker anmelden, Installation anbieten

    firestore.rules       die Regeln der Datenbank. Sie fahren von selbst
                          nach Firebase, sobald sie auf main stehen.
    database.rules.json   die Regeln der Realtime Database (Multiplayer),
                          auf demselben Weg

    scripts/seiten-bauen.mjs   baut die erzeugten Dateien aus einer Tabelle
    scripts/pruefen.mjs        hält alles zusammen, ohne Browser
    scripts/check-spiele.mjs   spielt jedes Spiel einmal durch, im Browser
    scripts/check-live.mjs     spielt einen Multiplayer mit vier Geräten durch
    scripts/filme-aufnehmen.mjs  nimmt die Bilder (und Filme) der Startseite auf – wie sich
                               jedes Spiel dabei selbst spielt, steht in
                               scripts/vorfuehrung/<seite>.mjs
    scripts/check-zuschauen.mjs  schaut den anderen zu, in jedem Spiel, in dem
                               man ausscheidet, und vergleicht die Bilder
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
in der Adresse würfelt `neu()` eine frische Saat (aus `Math.random`), so
zufällig wie vorher, aber aufschreibbar: Die Aufzeichnung eines Laufs trägt
sie (`geist.js`), und wer ihn anschaut, baut mit `halte(saat)` dieselbe Welt
wieder auf. Mit Turnier spielen alle denselben Lauf: den ersten Versuch alle
gleich, den zweiten auch – aber einen anderen als den ersten. `npm run
pruefen` besteht darauf.

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

### Die Startseite: alae arcade

Dunkel, wie alae.app, und ein Bildschirm ohne Scrollen – fürs Handy gemacht,
hoch wie quer (`mini-games.js`, `baueUebersicht`; die Bühne selbst,
`arcadeBuehne`, steht genauso auf der Turnierseite):

- **Das Bild:** das Spiel mitten in einer Runde, in einem Fenster in seiner
  eigenen Form – hochkant 9:16, quer 16:9 –, so gross, wie es geht, ohne
  Rand darin. Es steht das Bild (quer oder hoch), dessen Form dem Fenster
  näher ist, und es füllt es (`filmFuer`). Ein Tipp aufs Bild startet das
  Spiel; ein Wisch nach links zeigt das nächste Spiel, nach rechts das vorige
  (am Computer auch die Pfeiltasten) – ohne das Spiel zu starten.
- **Die Leiste:** hochkant unter dem Bild, quer daneben – der Name des
  Spiels, der Knopf zur Rangliste mit dem Namen des Ersten und der runde
  Play-Knopf. Die Rangliste öffnet sich im Fenster: alle Plätze, mit Krone,
  Medaillen, «Du» und dem ▶ zum Anschauen.
- **Unten alle Spiele in einer Zeile,** nach Tier geordnet (Favoriten
  zuerst), als kleine Kacheln mit Bild und Namen; vorne die laufenden
  Turniere. Ein Tipp holt das Spiel nach oben – die Kachel fliegt hinauf.
- **Von selbst:** Solange niemand wählt, kommt alle neun Sekunden der nächste
  Favorit (ein Strich unter der Kachel zeigt die Zeit). Wer aus einem Spiel
  zurückkommt, sieht dieses Spiel.
- **Oben rechts:** der Pokal (die Gesamtwertung über alle Spiele, im
  Fenster), wo es geht «Als App installieren», der Name (ein Tipp ändert ihn)
  und das Vollbild. Links das Logo von alae.app (aus dessen Logo-Paket) mit
  «arcade».

**Die Bilder** sind echte Runden: `npm run bilder` (scripts/filme-aufnehmen.mjs
--standbild) lässt jedes Spiel von einem Autopiloten spielen
(`scripts/vorfuehrung/<seite>.mjs`, ohne Leiste, ohne Gegner, ohne Datenbank)
und macht im richtigen Moment ein Bild mit doppelter Pixeldichte – wann, sagt
die Vorführung (`bild`, `bildWenn`: im Turmbau nach fünf, sechs Blöcken, im
Brückenbauer, während der Balken über die Schlucht wächst):
`bilder/<seite>-quer.webp` (2560×1440), `-hoch.webp` (1080×1920) und
`-klein.webp` (480×270, für die Zeile). Wer ein Spiel sichtbar ändert, nimmt
sein Bild neu auf (`npm run bilder -- turmbau`) und zählt die Fassung hoch – sie
hängt an den Adressen der Bilder.

**Die Filme** (bis Oktober 2026 oben auf der Startseite) sind ausgeschaltet:
Mit `FILME = true` in mini-games.js laufen sie wieder, aus `filme/`.
`npm run filme` nimmt sie neu auf – mit ffmpeg zwei Schleifen je Spiel,
`filme/<seite>-quer.mp4` (1280×720) und `-hoch.mp4` (540×960). Der Service
Worker lässt Filme durch: Safari spielt ein Video nur mit Range-Anfragen, und
die beantwortet nur der Server.

### Die Turnierseite

Sie sieht aus wie die Startseite (`turnier.js`, `turnierSeite`, mit
`arcadeBuehne` aus mini-games.js): oben das Bild des gewählten Spiels,
darunter Rangliste und Play, unten nur die Spiele des Turniers. Ein Tipp aufs
Bild oder auf Play spielt im Turnier. Anders ist nur der Kopf – mit so wenig
Text wie möglich:

- **Links der Name des Turniers** und darunter eine Zeile, wie lange es
  läuft und was gilt: «läuft ohne Zeitlimite · seit Mo 12.10., 23:30 ·
  3 Versuche je Spiel».
- **Die Gesamtwertung** über alle Spiele, golden und gross – im Turnier zählt
  sie mehr als jede einzelne Liste: der Pokal und die ersten drei, daneben
  der eigene Platz, wer weiter hinten steht («Du 5.»). Schmal steht sie unter
  dem Namen, breit (und auf dem Handy quer) daneben. Ein Tipp öffnet die
  ganze Tabelle im Fenster, mit der Beschreibung des Turniers, einem Satz, wie
  gezählt wird, und den Multiplayern, die schon gezählt haben. Verdeckt steht
  dort nur, wie viele dabei sind.
- **Läuft gerade ein Multiplayer**, steht daneben «Multiplayer läuft» mit dem
  Weg hinein.

Darf man ein Spiel gerade nicht spielen (alle Versuche gespielt, allein
vorne, noch nicht begonnen, angehalten, vorbei), steht an der Stelle von Play
ein Schloss und unten auf dem Bild, warum – das Bild führt dann nirgends hin.

### Gegner und Geister

Wer spielt, spielt nicht allein: Über der Spielfläche stehen die Schalter
«Platz 1» und «Bestmarke» (`geist.js`), in den Spielen mit Geist im Bild dazu
«Alle». Sie sagen vor der Runde, gegen wen es geht, lassen sich an- und
abschalten (zu Beginn ist alles aus – ein Tipp auf einen Schalter blendet
seinen Gegner ein; die Wahl gilt auf dem Gerät für alle Spiele, gemerkt unter
`mini.geister`) und zeigen während der Runde, wo man gegen den Gegner
steht – grün, solange man vor ihm liegt, mit einem Ton, wenn man seine Zahl
schlägt. «Alle» zeigt, auf welchem Platz man unter allen gerade liegt.

    Geist im Bild   Lianenschwung, Tunnelflug, Drift-Rennen,
                    Planetenhüpfer, Mondlandung, Schwerkraft-Läufer,
                    Hügelflieger, Windschichten, Slalom, Froschsprung,
                    Seiltänzer, Heisser Draht, Ball hochhalten.
                    Aufgezeichnet wird der Weg
                    (wo, wann, in welcher Lage), und der Gegner fliegt,
                    fährt oder läuft als Figur aus Licht mit – genau so wie
                    in seiner besten Runde. Ob seine Welt dieselbe war,
                    spielt keine Rolle: Er folgt seinem eigenen Weg.
                    Platz 1 in Gold, die Bestmarke hellblau, alle anderen
                    in Flieder. «Alle» ist jeder, der in der Hall of Fame
                    steht (bis zwanzig), im Turnier jeder, der dort
                    mitspielt. Wer noch keinen Lauf hinterlegt hat – eine
                    Zahl von früher –, läuft erst mit, wenn er sich
                    verbessert.
    mitlaufend      Blätter im Strom, Zwei Spuren: der Gegner läuft mit
                    seinem Stand von damals mit, Viertelsekunde für
                    Viertelsekunde – als Zahl, ohne Figur.
    Zielmarke       Turmbau, Brückenbauer, Drehscheibe, Fischteich,
                    Kacheln-Knobeln, Kranhafen: Spiele ohne Uhr. Der
                    Gegner ist eine Zahl; im Turmbau eine Linie in der Höhe
                    seines besten Turms. Im Tunnelflug, Drift-Rennen und
                    Schwerkraft-Läufer stehen Platz 1 und die Bestmarke
                    zusätzlich als Tor, Zielstreifen oder Linie bei ihren
                    Metern.

Im Schwerkraft-Läufer und im Seiltänzer laufen alle gleich schnell –
überholen kann dort niemand. Die Schalter zeigen deshalb nur, wie weit die
Gegner gekommen sind, ohne «überholt!» und ohne Platz unter allen
(`gleichschritt`).

### Die besten Läufe anschauen

In der Hall of Fame und auf der Turnierseite steht in jedem Spiel bei jedem
Spieler ein kleiner ▶ – sofern es von seinem besten Lauf eine Aufzeichnung
gibt (`mini-games.js`, `ansehbareLaeufe`). Gefragt wird nach denen, die
gerade in der Liste stehen: erst die ersten drei und der eigene Eintrag, mit
«Ganze Liste» die übrigen (`ansehenFuer`, je 25 Aufzeichnungen auf einmal).
Er öffnet das Spiel
mit `?zuschauen=<spieler>` (aus einem Turnier dazu `&aus=<turnier>`; das ist
kein Versuch im Turnier). Ein Turnier kann die Replays abschalten
(`ohneReplay`): Dann steht dort kein ▶, und das Spiel zeigt auch über die
Adresse nur «In diesem Turnier lassen sich die Läufe nicht anschauen» – wie
bei einer verdeckten Rangliste bis zum Schluss. Das Spiel spielt den Lauf ganz ab, in seiner eigenen
Welt: Die Aufzeichnung trägt die Saat, mit der die Welt gewürfelt war, und im
Planetenhüpfer auch, wo die Uhr der Planeten stand. Die Figur steht Bild für
Bild dort, wo sie damals war (`geist.js`, `zuschauer`). Oben steht, wessen
Lauf das ist, und «Beenden» – jederzeit. Am Schluss eine Tafel mit «Nochmal»
und «Zurück». Welche Fassung der Aufzeichnung zu welchem Spiel gehört, steht
in `ANSEHBAR` (`mini-games.js`); `npm run pruefen` hält sie mit den Spielen
gleich. Läufe von vor dieser Fassung haben keine Saat – sie lassen sich erst
nach dem nächsten Rekord anschauen (der Lianenschwung braucht keine, seine
Strecke ist fest).

Die neun Spiele ohne Figur im Bild (Turmbau, Brückenbauer, Drehscheibe,
Fischteich, Kacheln-Knobeln, Wo hält der Zug?, Der Heizer, Blätter im Strom,
Kranhafen)
zeichnen statt eines Weges ihre Züge auf (`geist.js`, `zuege`): dieselben,
die sie im Multiplayer melden, mit der Zeit seit dem Start, der Saat und dem
Ende der Runde. Beim Anschauen baut das Spiel sie nach – genau so, wie es im
Multiplayer dem zuschaut, der noch spielt (`zuschauer({ zuege: true })` gibt
dieselben Fragen: `jetzt`, `seit`, `letzte`, `naechste`). Der Heizer lässt
dabei die Stände der Kessel weg und rechnet sie selbst, sonst passte eine
lange Schicht nicht in die Datenbank; Blätter im Strom schreibt seine Wische
in den Lauf mit Uhr, den die Gegner lesen. Welche Fassung dazugehört, steht
in `ANSEHBAR_ZUEGE`. Gespeichert wird die Aufzeichnung wie jede beim nächsten
Rekord – Bestwerte von vorher lassen sich erst anschauen, wenn sie
geschlagen sind. Beim Anschauen gehört kein Tipp und keine Taste dem Spiel,
auch nicht, bevor der Lauf geladen ist.

Platz 1 ist der Erste der Hall of Fame, im Turnier der Erste des Turniers –
bei einer verdeckten Rangliste bleibt er verborgen, und ein Turnier kann die
Gegner ganz abschalten. Die Bestmarke ist der eigene Bestwert – der beste
unter dem eigenen Namen, auch wenn er auf einem anderen Gerät gespielt wurde.

Was der Server über diesen Bestwert sagt, gilt – auch nach unten. Jede
Spielseite fragt einmal nach dem Eintrag dieses Geräts (`cloud.js`,
`meinErgebnis`) und nach der Liste des Spiels, und setzt Bestwert, Bestmarke
und den Startstand des Spiels auf das Beste unter dem eigenen Namen
(`mini-games.js`, `gleicheAb`). Stammt es von einem anderen Gerät, läuft
dessen Lauf als Bestmarke mit. Hat der Admin den Eintrag gelöscht, steht
danach auch auf dem Gerät nichts mehr davon – sonst käme die alte Zahl nach
der nächsten Runde als «Bestwert» zurück. Ohne Namen und ohne Netz bleibt
alles, wie es ist.

Aufgezeichnet werden Stellungen, keine Tastendrücke – Stellungen überstehen
eine Nachbesserung an der Physik, Eingaben nicht. Zehnmal je Sekunde, genau
auf den Takt gerechnet (zwischen zwei Bildern, statt das nächste Bild zu
nehmen), und gespeichert als Schritte von Probe zu Probe (`v: 2`): kleine
Zahlen, die Aufzeichnung bleibt unter der Grenze der Datenbank. Abgespielt
wird auf derselben weichen Kurve wie die Geister im Multiplayer (`geist.js`,
`kurve`) – so läuft der Lauf so flüssig wie damals, ohne die Stufen, die
viermal je Sekunde früher zeigten. Ältere Aufzeichnungen (viermal je
Sekunde, `v: 1`) laufen auf derselben Kurve; genauer wird es mit dem
nächsten Rekord. Sie stehen in einer eigenen
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

    Spiele            welche dazugehören, eines bis alle dreiundzwanzig
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
    Replays           den besten Lauf jedes Spielers im Turnier anschauen
                      lassen (der ▶ in den Listen, Vorgabe) oder nicht –
                      dann auch nicht über eine von Hand getippte Adresse
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
zeigt je Spiel nur den Namen, die Rangliste und Play (oder an seiner Stelle
das Schloss und «Du liegst vorne»); den Link zum Weitergeben hat der
Adminbereich.

**Ein Turnier auf dem Startbildschirm.** Wer im Turnier «Zum Startbildschirm»
wählt, bekommt das Turnier als eigene App: mit seinem Namen, und sie öffnet
direkt die Turnierseite. Dafür baut `turnier.js` (`alsApp`) im Browser ein
eigenes Manifest, sobald das Turnier gelesen ist – Chrome und Edge lesen es.
Safari auf dem iPhone nicht; dort setzt dieselbe Stelle den Namen
(`apple-mobile-web-app-title`), und gestartet wird die Seite, auf der man
beim Hinzufügen war.

**Die Turnier-App bleibt im Turnier.** Beginnt ein Fenster der installierten
App (`display-mode: standalone`) auf einer Turnierseite oder einem Spiel
des Turniers, gehört es zu diesem Turnier – gemerkt im Speicher des Fensters
(`sessionStorage`, `mini.heimTurnier`), nicht des Geräts: Die Hauptapp, als
eigene App installiert, bleibt die Hauptapp. In diesem Fenster führt jeder
Weg zurück ins Turnier: Die Startseite und ein Spiel ohne Turnier in der
Adresse leiten gleich auf die Turnierseite um, der Pokal unter dem Ergebnis
und der Knopf oben im Spiel heissen «Turnier», ebenso beim Anschauen eines
Laufs aus dem Turnier (`?aus=` – dort stand vorher «Hall of Fame», und genau
so landeten Kinder plötzlich in der Hauptapp), und am Ende eines Multiplayers
steht «Zum Turnier» statt «Zur Startseite». Erlaubt bleiben das Turnier, der
Multiplayer und der Adminbereich (`turnier.js`, `heim`).

**Das Gerät merkt sich seine Turniere.** Jedes Turnier, das geöffnet wird,
auch eines nur mit Link, steht danach auf der Startseite dieses Geräts,
zuvorderst (`mini.turniere`, höchstens zehn). So findet es auch, wer die App
schon installiert hat und den Link nur einmal angeklickt hat. Auf Android
teilen sich Browser und installierte App diesen Speicher; auf dem iPhone
kennt die App auf dem Startbildschirm nur, was in ihr selbst geöffnet wurde.

## Multiplayer

Alle zur selben Zeit im selben Level: `/live`. Angelegt wird er im
Adminbereich – «Neuer Multiplayer» neben «Neues Turnier» (`/live?neu`) –,
und wer ihn anlegt, leitet ihn und spielt auf demselben Gerät mit.

**Sichtbar.** Beim Anlegen (und in der Lobby noch umzustellen):

- **Nur mit Einladungslink** (Voreinstellung): Er steht nirgends in der
  App. Wer mitspielt, bekommt den Link (`/live?code=K7QMX2PA9Z`) – zehn
  Zeichen, nicht zu erraten. Einen Code zum Abtippen gibt es nicht mehr.
- **Für alle**: Auf der Startseite erscheint oben «Multiplayer» mit dem
  roten Punkt – solange er offen ist, für jeden, der gerade die App offen
  hat (die Startseite fragt alle 20 Sekunden nach, `liveOffen` in der
  Realtime Database, ohne SDK). Ein Tipp, und man ist in der Lobby. Sind
  mehrere offen, führt er nach `/live`, wo sie zur Wahl stehen. Gehört er zu
  einem Turnier, steht er auch auf der Turnierseite.

Ohne Nachzügler verschwindet der Knopf mit dem Start der ersten Runde,
sonst mit dem Podest. Was länger als einen halben Tag offen steht, hat
jemand zu schliessen vergessen – das zeigt die Startseite nicht mehr.

Die Multiplayer, die auf einem Gerät angelegt wurden, stehen im
Adminbereich unter «Neuer Multiplayer» – mit «Öffnen» und dem Link, solange
es sie gibt. Einer nur mit Link ginge sonst mit dem Tab verloren.

**Anlegen.** Ein Name, das Programm (Spiele in ihrer Reihenfolge, je 1–5
Runden und 0–2 Übungsrunden) und die Einstellungen:

| Einstellung | Auswahl |
|---|---|
| Sichtbar | nur mit Einladungslink oder für alle |
| Zeitlimit je Runde | ohne, 30 s, 1, 1½, 2, 3, 5 Minuten |
| Punkte je Runde | Platzpunkte 10 · 8 · 6 · 5 · 4 · 3 · 2 · 1 (dahinter je 1) oder Prozent vom Besten |
| Level | jede Runde ein neues oder alle Runden eines Spiels gleich – immer für alle dasselbe |
| Countdown | 3, 5 oder 10 Sekunden |
| Nach jeder Runde | die Leitung drückt «Weiter» oder automatisch nach 15 Sekunden |
| Finale doppelt | das letzte Spiel zählt doppelt |
| Zwischenstand | nach jeder Runde zeigen oder bis zum Schluss verdeckt |
| Nachzügler | dürfen ab der nächsten Runde mitspielen, oder nur bis zum Start |
| Die anderen live im Bild | in den zwölf Spielen mit Figur: die anderen als Geister, oder nicht |

Ein Programm lässt sich als Vorlage speichern (auf dem Gerät, das leitet);
das zuletzt benutzte steht beim nächsten Mal schon da.

**Die Lobby.** Der Link (kopieren, teilen), wie man hineinkommt, und wer da
ist (grüner Punkt, solange die Verbindung steht). Die Leitung spielt selbst
mit – auf demselben Gerät.

**Eine Runde.** «Start» schreibt, welche Runde mit welcher Saat ab wann
läuft – zur Serverzeit. Jedes Gerät, das dabei ist, öffnet das Spiel in
einem Rahmen über der Seite (`/turmbau?live=K7QMX2PA9Z&nr=0`, `live-spiel.js`).
Dort zählt eine Tafel herunter, Eingaben sind gesperrt, und gestartet wird
nicht auf einen Tipp, sondern zur Serverzeit – jedes Gerät rechnet sie in
seine eigene Uhr um. Im Browser-Test liegen vier Geräte dabei unter zehn
Millisekunden auseinander. Die Tafel einer Übung sagt nur «Übungsrunde»
(oder «Übungsrunde 1 von 2»). Oben stehen alle mit ihren Punkten und die
Zeit. Wer ausscheidet, schaut eine Sekunde später den anderen zu (siehe
Zuschauen); spielt niemand mehr, steht da, wie es bei den anderen steht. Die
Runde endet, wenn alle fertig (oder weg) sind oder die Zeit um ist; die
Leitung kann sie auch von Hand beenden – mit dem Knopf «Leitung» über dem
Spiel, auch beim Zuschauen, oder mit «Runde jetzt beenden» auf ihrer Tafel.

**Weg** ist, wer die Verbindung verliert – oder wer schweigt. Solange das
Spiel im Bild ist und läuft, meldet es sich alle drei Sekunden, auch ohne
neue Punkte (`live-spiel.js`, Lebenszeichen; am Bild aufgehängt, nicht an
einer Uhr, denn Zeitgeber laufen in verdeckten Tabs weiter). Wer zwölf
Sekunden lang schweigt – Bildschirm aus, App im Hintergrund, ein vergessenes
zweites Fenster –, steht bei den anderen als «weg», und die Runde wartet
nicht auf ihn (`live.js`, `WEG_MS`). Ohne das hing eine Runde ohne Uhr
(Brückenbauer, Turmbau …) ewig: Die Verbindung eines gesperrten Handys
steht oft noch minutenlang, sein Spiel aber läuft nicht weiter, und alle
anderen sassen vor «spielt noch». Kommt er zurück, solange die Runde noch
läuft, spielt er weiter; gewertet wird, was er zuletzt gemeldet hat.

**Jedes Spiel** gibt der Bühne dafür mit (`game-shell.js`,
`mount({ live: { los, stopp, zuschauen } })`), wie die Runde ohne Tipp
beginnt, wie sie endet, wenn die Zeit des Abends um ist, und – wo man
ausscheidet – wie es einem anderen zuschaut. Eine Runde gibt es nur einmal –
kein «Noch einmal», kein Weg hinaus ausser über den Multiplayer.

**Die anderen im Bild.** In den dreizehn Spielen mit Figur (Lianenschwung,
Tunnelflug, Drift-Rennen, Planetenhüpfer, Mondlandung, Schwerkraft-Läufer,
Hügelflieger, Windschichten, Slalom, Froschsprung, Seiltänzer, Heisser Draht,
Ball hochhalten)
meldet jedes Gerät zehnmal je Sekunde, wo seine Figur ist
(`lage`). Die anderen laufen als Geister mit – wer vorne liegt in Gold –,
gebaut auf denselben Geistern wie in der Hall of Fame (`geist.js`): Statt
einer Aufzeichnung beantwortet der Live-Strom die Frage «wo ist er zur Zeit
t» (`live-spiel.js`, `liveLauf`).

Und zwar nicht für «jetzt»: Bis eine Lage da ist, vergeht eine Zehntelsekunde
oder zwei, und wer den anderen jetzt zeigen will, muss raten, wo er
inzwischen ist – und springt zurück, wenn die nächste Lage etwas anderes
sagt. So ruckelte es. Jedes Gerät zeigt jeden anderen deshalb gerade so weit
zurück, dass fast immer die Lage danach schon da ist, und dazwischen läuft
eine weiche Kurve (kubisch, durch jede Probe, ohne über sie
hinauszuschiessen). Wie weit zurück, misst es selbst, je Spieler: bei jeder
neuen Lage, wie alt die bis dahin neueste schon war – meist eine
Fünftelsekunde. Der Verzug ändert sich nur langsam (höchstens 8 % schneller
oder langsamer); kommt eine Lage doch zu spät, geht es kurz in der alten
Richtung weiter, und was die Lage dann noch korrigiert, verschwindet in
einer Zehntelsekunde statt in einem Sprung. In den Spielen, in denen `c` ein
Winkel ist (`ANSEHBAR`, `winkel`), dreht sich die Figur dabei mit, statt zu
springen. Der Browser-Test misst, wie stark sich das Tempo eines Geists von
Bild zu Bild ändert, und lässt höchstens 0,3 px/ms zu (gemessen: 0,06 bis 0,13).

**Zuschauen.** Wer ausgeschieden ist, sieht eine Sekunde später dem zu, der
vorne liegt und noch spielt: Die Kamera folgt seiner Figur, sein Name steht
auf einem Schild daran, die anderen fliegen als Geister mit. Oben lässt sich
jeder antippen, der noch spielt; ist der, dem man zuschaut, fertig, geht es
zum nächsten. Dasselbe Abspielen wie bei den besten Läufen
(`zuschauenStarten`, die dritte Andockstelle `live.zuschauen`) – um den
Verzug dessen zurück, dem man zuschaut, und noch eine Zehntelsekunde dazu,
damit die Kamera ruhig bleibt. Der Planetenhüpfer stellt dabei die Uhr seiner
Planeten nach der Zeit, die gerade im Bild ist.

In den Spielen ohne Figur (Turmbau, Brückenbauer, Drehscheibe,
Kacheln-Knobeln, Fischteich, Heizer, Zahlengleis) gibt es nichts, dem eine
Kamera folgen könnte – dort baut das Spiel des Zuschauers nach, was der
andere tut. Jedes Gerät meldet dafür seine Züge (`live-spiel.js`, `zug`):
sofort, nicht im Takt, und immer mit dem ganzen Stand in `a`, `b`, `c` – wie
viele Blöcke und wo der oberste liegt, wann der Balken kippt und wie lang er
ist, wo ein Pfeil steckt, welche Kacheln und Fische gefunden sind, wie die
Kessel stehen, wo die Lok hält. Was zwischen zwei Zügen geschieht, rechnet
der Zuschauer selbst: Die Welt kommt aus derselben Saat, der Block fällt,
der Arbeiter geht, die Scheibe dreht sich, die Kessel leeren sich (als
Formel, also genau wie beim anderen). Wer erst später zuschaut oder oben
einen anderen antippt, sieht in einem Augenblick alles bis jetzt, ohne
Fallen und Gehen; dafür behält jedes Gerät alle Proben der Runde. Was im
Bild steht, prüft `scripts/check-zuschauen.mjs`: Am Schluss ist es Block
für Block, Pfeil für Pfeil dasselbe wie beim anderen. Nur die Fische
schwimmen bei jedem Zuschauer eigene Bögen – welche gefangen werden, ist
dasselbe. Das Zahlengleis kennt kein Ausscheiden, aber wer seine zehn Zahlen
schneller hat, schaut den anderen bei ihren zu. Bei «Blätter im Strom»
enden alle zugleich. Die Leitung beendet die Runde auch beim Zuschauen
über ihren Knopf «Leitung».

Wer in einer Runde nicht mitspielt (ein Nachzügler), kann von Anfang an
zuschauen («Zuschauen», oben «Schliessen»).

**Das Grossbild** (`/live?code=K7QMX2PA9Z&gross`, der Link steht in der
Lobby der Leitung) ist für Fernseher und Beamer: Es tritt nicht bei, zeigt
alles grösser – in der Lobby den Link zum Abschreiben – und schaut in jeder
Runde, der sich zuschauen lässt, von selbst dem zu, der vorne liegt.

**Die Auswertung.** Rundenpunkte, Zwischenstand, was als Nächstes kommt;
«Weiter», «Runde wiederholen» (sie beginnt bei null), «Multiplayer beenden». Gleich
viele Punkte heisst derselbe Platz. Gerechnet wird nichts in der Datenbank:
Jedes Gerät rechnet aus denselben Punkten dasselbe.

**Die Hall of Fame** bekommt jede zählende Runde wie eine gewöhnliche – mit
Namen, Rekord und Aufzeichnung. Übungsrunden nicht. Ein Versuch in einem
Turnier ist eine Live-Runde nie.

**Am Schluss** das Podest und der Endstand. «Multiplayer abschliessen»
löscht ihn aus der Datenbank; wer noch zuschaut, behält das Podest auf dem
Schirm.

**Mit einem Turnier.** Beim Anlegen lässt sich ein Turnier wählen (oder im
Adminbereich beim Turnier «Multiplayer» antippen – dann ist es schon
gewählt, und seine Spiele stehen im Programm) und wie der Multiplayer dort
zählt: wie ein Spiel, doppelt, dreifach oder gar nicht. Solange er offen und
für alle sichtbar ist, steht auf der Turnierseite oben «Multiplayer
läuft» mit dem Weg hinein (`turnierLive/<turnier>` in der Realtime Database,
gelesen ohne SDK); einer nur mit Link steht auch dort nicht. «Ins Turnier
eintragen und abschliessen» schreibt den Endstand nach
`miniTurniere/<id>/live/<code>-<zeit>` (die ersten vier Zeichen des Codes);
in der Gesamtwertung ist er eine eigene Spalte, mal sein Gewicht – bei der
Platzziffer zählt der Platz im Multiplayer, bei «Prozent vom Besten» der
Anteil an seiner höchsten Punktzahl. Wer ihn verpasst hat, steht dort hinter
dem Letzten, wie bei einem ausgelassenen Spiel. Im Fenster der Gesamtwertung
steht jeder Multiplayer mit seinem Endstand.

**Nur im Multiplayer.** Ein Turnier mit dem Haken «Nur im Multiplayer
spielen» kennt keine Versuche: Die Spiele stehen da, aber gespielt wird nur
in seinen Multiplayern (die Regeln lassen keinen Versuch beginnen), und die
Gesamtwertung zählt nur sie.

## Vollbild

Jedes Spiel füllt das Bild: Die Spielfläche reicht bis an den linken, rechten
und unteren Rand, oben bleibt ein ruhiger Streifen mit den Knöpfen, der Uhr und
den Gegnern (`styles.css`, Die Bühne). Die Landschaft aus der App baut die
Bühne nicht mehr auf. Die Spiele mit einer Leinwand haben eine breiteste
Welt (Turmbau, Brückenbauer, Drehscheibe, Lianenschwung, Tunnelflug); auf
einem sehr flachen Bild steht ihre Fläche in der Mitte, statt oben ein Stück
Welt zu verlieren.

**Auf dem Handy** (hochkant bis 760 px breit, quer bis 500 px hoch) ist das
Spiel das ganze Bild: Die Spielfläche beginnt ganz oben und reicht bis an
alle vier Ränder, auch bei den Spielen mit breitester Welt. Der Streifen oben
ist durchsichtig; darüber schweben nur die Knöpfe, der Zähler (auf einem
eigenen Schild), die Uhr und die Gegner-Schalter, alle deckend. Was ein Spiel
selbst oben zeigt – der Satz vor dem ersten Zug, die Meter, die Scheibe –,
rückt unter sie: in CSS um `--cm-oben`, auf der Leinwand um das, was
`game-shell.js` misst (`frei`). Drehscheibe, Schwerkraft-Läufer und Tunnelflug
haben ein festes Bild (Scheibe, Korridor, Band): Es steht ganz im freien Teil,
und unter den Knöpfen geht nur die Landschaft weiter. Die Spiele ohne
Leinwand behalten ihre Fläche unter der Leiste – Kacheln, Fische und Kessel
gehören nicht unter einen Knopf.

Die Leiste oben fängt selbst keine Tipps, nur ihre Knöpfe: Auf dem Handy quer
stehen die Gegner-Schalter in ihrer Zeile, und ein Finger darauf traf früher
die Leiste und startete das Spiel, statt den Gegner abzuschalten.

Oben rechts, neben dem Ton, holt ein Knopf das Spiel ins Vollbild des
Browsers – ohne Adressleiste, auch ohne die App zu installieren. Denselben
Knopf gibt es rechts im Balken der Startseite und der Turnierseite und im
Kopf des Adminbereichs. Ihn gibt es nur, wo der Browser das einer Seite
erlaubt (am Computer, auf Android; auf dem iPhone nicht), und nicht in der
installierten App, die ohnehin im Vollbild startet.

Das Vollbild bleibt, bis man es selbst beendet – mit dem Knopf, mit Esc oder
der Zurück-Geste –, auch über das Ende der Runde und jeden Seitenwechsel
hinaus, wie in der installierten App (`vollbild.js`). Ein Browser verlässt
das Vollbild sonst bei jedem Seitenwechsel. Deshalb bleibt im Vollbild die
Seite stehen, auf der es begann, und ab dem nächsten Weg öffnen sich die
Seiten in einem Fenster, das sie ganz ausfüllt (der Rahmen). Die alte Seite
hält dabei an: keine Schleife, kein Ton. Die Adresse oben und der Name im Tab
wandern mit, der Zurück-Weg des Browsers führt Seite um Seite zurück. Wer das
Vollbild verlässt, bleibt im Rahmen und merkt davon nichts; ein Neuladen
räumt ihn weg.

**Nichts lässt sich markieren.** Ein Kind hält den Finger einen Moment zu
lange auf einem Wort – «Übungsrunde» –, und das Tablet markiert es und bietet
«Suchen» an: ein Tipp, und es steht in einem neuen Tab. Deshalb ist in der
ganzen App kein Text markierbar (`styles.css`, `user-select` auf `html`),
lange Tipps öffnen kein Menü, und Bilder lassen sich nicht wegziehen
(`mini-games.js` fängt `selectstart`, `contextmenu` und `dragstart` ab). Nur
Eingabefelder bleiben, wie sie sind – den eigenen Namen will man korrigieren
können.

## Firebase

Eigenes Projekt (`games-a0cd4`), eigene Datenbank, eigene Anmeldung – mit der
Kids-App teilt das hier nichts mehr. Wie das eingerichtet ist und was einmalig
von Hand gemacht werden muss (Dienstkonto, GitHub-Umgebung, Authorized
Domains), steht in [FIREBASE.md](FIREBASE.md).

`firestore.rules` im Repository ist die Wahrheit: Ein Merge nach `main`
veröffentlicht die Regeln. In der Console wird nichts von Hand geändert.

## Der Adminbereich

`/admin`. Drei Wege hinein – Google, E-Mail-Link, Passwort (eine Adresse
für beide: mit Passwort «Anmelden», ohne «Link per E-Mail»). Dahinter steht,
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
Turniers – steht ein kleines ▶. Es startet das Spiel in einem Fenster, das
das ganze Browserfenster füllt, über dem Adminbereich (ein halb ausgefülltes
Turnier darunter bleibt, wie es war), mit `?von=admin` in der Adresse. Ins
Vollbild geht es nicht von selbst: Dafür steht im Spiel oben rechts der
Knopf, und das Vollbild bleibt auch nach dem Spiel, bis man es beendet. Die
Runde zählt wie jede andere: Sie geht unter dem Namen dieses Geräts in die
Hall of Fame, der beste Versuch bleibt stehen. Der Weg oben links im Spiel
schliesst das Fenster wieder.

Ein Eintrag geht beim Löschen mit seinem Geist (`miniGeister`, gleicher
Name): Bliebe die Aufzeichnung stehen, könnte der Spieler sie nie ersetzen.

Hat jemand unter demselben Namen auf mehreren Geräten gespielt, steht bei
«Die Spieler» «auf 2 Geräten» und ein Knopf «Zusammenführen» (`admin.js`,
`fuehreZusammen`): Je Spiel bleibt ein Eintrag unter der Kennung, unter der
am meisten gespielt wurde – mit der besten Zahl und allen Runden zusammen;
der beste Lauf zieht mit um, die übrigen Einträge werden gelöscht. Turniere
bleiben, wie sie sind.
Und wurde ein Spiel so umgebaut, dass die alten Zahlen nichts mehr bedeuten,
leert «Bestenliste leeren» beim Spiel die ganze Liste auf einmal.

**Tiers.** Im Block «Welche Spiele gespielt werden» stehen die Spiele in drei
Gruppen, Tier 1 bis 3, und neben jedem ein kleines T1/T2/T3. Wer ein Spiel
umteilt, speichert die Einteilung sofort (`config/miniGames`, Feld `tiers`,
`cloud.js` `setzeTiers`). Im Formular eines Turniers stehen die Spiele genauso
gruppiert, mit einem Knopf je Tier: Er nimmt das ganze Tier dazu – oder, wenn
es schon ganz gewählt ist, wieder weg. Solange nie eingeteilt wurde, gilt die
Vorgabe aus `mini-games.js` (`TIERS_VORGABE`): Tier 1 Turmbau, Brückenbauer,
Lianenschwung, Tunnelflug, Drift-Rennen, Hügelflieger und die danach
gebauten (Windschichten, Slalom, Froschsprung, Kranhafen, Seiltänzer, Heisser
Draht, Zwei Spuren, Ball hochhalten), Tier 2 Blätter im Strom, Drehscheibe,
Planetenhüpfer und Der Heizer, Tier 3 der Rest.

**In einer Deploy Preview anmelden.** Firebase lässt «Mit Google anmelden» nur
auf freigegebenen Adressen zu und kennt dort keine Platzhalter – jede Deploy
Preview hat ihre eigene. In einer Vorschau (`deploy-preview-<n>--gamesrepo.netlify.app`)
öffnet «Mit Google anmelden» deshalb ein Fenster auf `games.alae.app/admin?vorschau=…`:
Dort meldet Google an (in einer zweiten Firebase-Anwendung ohne Speicher,
`cloud.js` `vorschauApp`), und das Token geht per `postMessage` zurück an die
Vorschau, die sich damit bei Firebase anmeldet (`signInWithCredential` fragt
nicht nach der Domain). Wie im Entdecker – mit einer Prüfung mehr, weil dieses
Repository öffentlich ist: Das Token geht nur an die Vorschau eines Pull
Requests aus `vonallmenalain/games` selbst, nicht aus einem Fork (die
GitHub-API sagt, woher er kommt). Das Fenster auf der Live-Adresse ist Teil
von `admin.js` – es geht erst, wenn diese Fassung dort veröffentlicht ist.

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
trotzdem einmal, gezählt wird der Name. **Derselbe Name ist derselbe
Spieler:** Seine Zeile zeigt das beste Ergebnis und alle Runden, seine
Bestmarke ist dieses beste Ergebnis, und jedes Gerät spielt unter der
Kennung, unter der sein Name am meisten gespielt hat (`mini-games.js`,
`stammKennung`, gefragt mit `cloud.js`, `unterNamen`) – so landen neue Runden
in denselben Einträgen statt in einem zweiten Satz je Gerät. Nur nicht
mitten im Turnier, im Multiplayer oder beim Zuschauen: Dort hängen Versuche
und Plätze an der Kennung, mit der die Seite begann.

**Namen ändern gilt nur für die nächsten Runden.** «Du spielst als … ·
Namen ändern» steht auf der Startseite, auf der Turnierseite und unter dem
Ergebnis (`mini-games.js`, `namensZeile`). Was schon in einer Liste steht,
bleibt unter dem bisherigen Namen stehen, in der Hall of Fame wie in jedem
Turnier. Darum spielt das Gerät mit einem neuen Namen als neuer Mitspieler:
mit eigener Kennung, ohne Bestwerte und ohne eigenen Lauf (`namenWechseln`).
Mit der alten Kennung schriebe die nächste Runde den neuen Namen auch über
die alten Punkte – je Spiel und Kennung gibt es ein Dokument. Im Turnier ist
ein neuer Name ein neuer Mitspieler, mit eigenen Versuchen.

Wer zu einem Namen zurückwechselt, den das Gerät schon kennt (gross oder
klein geschrieben), ist wieder dieser Mitspieler: mit seiner Kennung, seinen
Bestwerten und seinem Lauf (`mini.wer`, höchstens zwölf). So teilen sich
Geschwister ein Handy. Umbenennen, was schon dasteht, kann nur der Admin.

## Prüfen

    npm run pruefen           die Dateien: Tabelle, Seiten, Service Worker,
                              Manifest, Zeichen, Regeln, Adminbereich,
                              keine Reste der App
    npm run pruefen:browser   jedes Spiel einmal öffnen und eine Runde
                              anspielen. Braucht Playwright:
                              npm i && npx playwright install chromium
    npm run pruefen:live      einen Multiplayer durchspielen: Leitung und drei
                              Spieler in vier Browserfenstern, gegen den
                              Emulator der Realtime Database. Braucht Java
                              und Playwright, kein Netz.
    npm run pruefen:zuschauen in jedem Spiel, in dem man ausscheidet, eine
                              Runde mit drei Robotern: Wer draussen ist,
                              schaut zu, und am Schluss muss im Bild genau
                              stehen, was der andere hatte. Wie pruefen:live.
    npm run test:rules        die Firestore-Regeln im Emulator durchspielen –
                              und cloud.js dagegen laufen lassen, so wie es
                              im Browser läuft. Dazu die Regeln der Realtime
                              Database (database.rules.json). Braucht Java,
                              kein Netz, keine Zugangsdaten.

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
