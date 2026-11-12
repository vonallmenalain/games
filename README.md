# arcade

Die Spiele aus [Gripszug](https://kids.alae.app) einzeln, für alle, ohne Konto.

Ein Link, ein Spiel, eine Bestenliste, auf der alle stehen:

    https://games.alae.app/turmbau

Gedacht zum Weitergeben. Wer den Link öffnet, spielt sofort: keine Anmeldung,
keine Schranke, kein Zug, der wächst. Nur die Frage, wer die höchste Zahl
schafft. Unter `/` stehen alle Spiele nebeneinander, dazu die Hall of Fame –
und eine Gesamtwertung über alle Spiele, in der mehr Spiele niemandem einen
Vorteil verschaffen.

Und ab und zu ein Turnier: eine eigene Rangliste mit Anfang und Ende, für
alle auf der Startseite oder nur für die, denen man den Link schickt.

    https://games.alae.app/turnier?t=herbstcup-k3m9x2p7

Oder, wenn der Admin den Link selbst gewählt hat, kurz:

    https://games.alae.app/hotdog

## Wie das hier gebaut ist

Kein Build-Werkzeug, kein Framework, keine Abhängigkeiten im Browser ausser
dem Firebase-SDK. Die Site sind die Dateien im Wurzelverzeichnis; Netlify
kopiert sie nach `dist/` (`netlify/build.mjs`) und veröffentlicht das.

    index.html            die Startseite «arcade»: alle Spiele als Bilder,
                          ihre Bestenlisten
    turmbau.html …        siebenunddreissig Spielseiten, erzeugt
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
    cloud.js              Firestore: miniScores lesen, schreiben, umbenennen,
                          miniUmzuege (wohin eine zusammengeführte Kennung zog) –
                          miniRunden, jede Runde mit ihrer Uhrzeit (nur für
                          den Admin), miniGeister, die Aufzeichnungen der
                          Läufe, und miniTurniere mit ihren Einträgen.
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
    scripts/icons-bauen.mjs    rendert das Zeichen der App aus icons/icon.svg
                               (die zwei alae-Winkel als 8-Bit-Figur) und
                               icons/favicon.svg in alle Grössen, dazu das
                               Bild zu geteilten Links (icons/vorschau.svg →
                               vorschau.jpg): npm run icons

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

### Die Spiele vom Oktober 2026

Kurze Runden, schnell schwerer, viel Können: Jedes würfelt seine Welt aus
`zufall.js` (im Turnier für alle dieselbe), und in jedem beweist ein
Autopilot in `npm run pruefen:browser` (Abschnitte 4g18–4g24), dass die Welt
schaffbar ist. Am 28. Oktober ersetzte das Turmspringen das Skispringen
(dessen Bestenliste `skiJump` bleibt in der Datenbank liegen, die Regeln
nehmen keine neuen Einträge mehr an), und der Freitaucher kam dazu. Die Schrauben für die Schwierigkeit stehen als Konstanten oben
in der jeweiligen Datei.

**Jongleur** (`jongleur.js`, `juggler`) – In der Zirkusmanege jongliert ein
Jongleur im Scheinwerferlicht. Ein Tipp links wirft mit der linken Hand,
rechts mit der rechten. Jeder Ball fliegt in die andere Hand, und keine Hand
darf zwei halten. Wer gleich nach dem Fang wirft, wirft perfekt: Der Ball
zieht eine goldene Spur und rückt in den gleichmässigen Takt. Länger halten
wirft höher und schafft Platz. Alle zehn Fänge wirft ein Clown mit
Trommelwirbel ein weiteres Ding ein, später auch Keulen, Fackeln, schwere
Kugeln und einen Apfel, und die Bälle fliegen immer schneller. Gezählt werden
die Fänge. Die besten Runden lassen sich Zug um Zug anschauen.

**Turmspringen** (`turmspringen.js`, `highDive`) – Ein Sprungturm aus Stahl
in einem Bergsee, die Alpen dahinter, auf den Booten das Publikum. Acht
Sprünge, jeder von einer anderen Höhe – gewürfelt aus einem Band, das mit
jedem Sprung steigt, von 8–11 m bis 24–27 m (`BAENDER`). Den Absprung macht
der Springer selbst. In der Luft gibt es eine Regel: Halten heisst Päckchen,
er dreht; Loslassen heisst strecken, die Drehung hört auf (aus vollem
Päckchen dreht er beim Öffnen noch ein gutes Dutzend Grad nach). Ins Wasser
geht es senkrecht, Kopf oder Füsse voran, und gestreckt. Jede halbe
Drehung ist ein Punkt; fast genau senkrecht und ganz gestreckt ist
«perfekt» und zählt doppelt, mehrere perfekte in Folge dreifach und
vierfach. Ein Bauch- oder Rückenklatscher oder eine Arschbombe beendet die
Runde, sonst endet sie nach dem achten Sprung. Mehr Drehung bringt mehr,
lässt aber weniger Zeit zum Öffnen – ganz oben passen gut zweieinhalb
Saltos hinein. Dazu wird es Abend und unter Flutlicht Nacht. Im ersten
Sprung sagt das Spiel, wann halten und wann loslassen. (Umgebaut im
November 2026, siehe unten.)

Das Bild dazu (seit dem 12. November 2026, die Rechnung ist dieselbe): Es
springen abwechselnd eine Frau und ein Mann, Sprung um Sprung (`FIGUREN`) –
Körper mit Gelenken, von der Seite gezeichnet (`maleFigur`), eine Haltung ist
ein Satz Winkel (`POSEN`). Auf dem Brett wird von den Füssen her gerechnet
(`bodenPose`, `zweiGlieder`): Der Anlauf ist ein Gang, bei dem kein Fuss
rutscht (`GANG`), an der Kante geht es in die Knie, die Arme holen aus und
schwingen hoch. In der Luft mischt sich die Haltung aus Päckchen und
gestreckt (`flugPose`), im Wasser gleitet die Figur hinunter, schwimmt hoch
und tritt Wasser (`schwimmPose`). Weil sie grösser gezeichnet ist, als sie
gerechnet wird, liegt das Brett im Bild etwas tiefer und endet dort, wo ihre
Zehen stehen (`deckHoehe`, `kanteVorn`). Beim Eintauchen schiesst Wasser
hoch (`platsch`, `spritzer`): eine Krone aus Strahlen, die sich lösen und in
Tropfen zerfallen, Schaum und Ringe auf dem See, ein Wellenberg, der davon
läuft, und unter Wasser eine Schleppe aus Blasen – klein bei einem sauberen
Sprung, breit beim Klatscher, mit einer Säule bei der Arschbombe.

**Fallschirm** (`fallschirm.js`, `skyDive`) – Sprung um Sprung aus dem
Flugzeug über einem Tal mit See, Fluss, Dorf und Wäldern, von oben gesehen:
Der Boden kommt aus 900 m Höhe herauf. Wer links oder rechts aufs Bild hält,
gleitet zur Seite, an Vogelschwärmen, Ballonen, Gewitterwolken und Seglern
vorbei. Ein Wisch nach oben zieht den Schirm – je näher an der Mindesthöhe,
desto mehr Punkte, darunter ist es zu spät. Unter dem Schirm geht es gegen
Wind und Böen auf die Ringe (50/25/10), und kurz vor dem Boden fängt derselbe
Wisch die Landung ab. Mit jedem Sprung fällt man schneller, die Ziele werden
kleiner und rücken an Wasser, Wald und Dächer, fahren als Floss oder Boot,
und es wird Abend und Nacht. Der erste Fehler beendet die Runde.

**Holzfäller** (`holzfaeller.js`, `lumberCut`) – Holzfäller-Show auf einer
Waldlichtung zur goldenen Stunde. Baumstämme fliegen in hohem Bogen ins Bild
und drehen sich. Ein gerader Wisch quer durch einen Stamm schneidet ihn – je
näher am roten Strich, desto mehr Punkte: «Perfekt» gibt 10, perfekte
Schnitte in Folge vervielfachen die Punkte bis ×5, Goldstämme zählen doppelt.
Die zwei Hälften fliegen mit Sägemehl und Spänen auseinander und zeigen ihre
Jahresringe. Drei Äxte: Ein Stamm, der ungeschnitten fällt, ein Schnitt weit
neben dem Strich, durch einen Ast oder durch einen Nagelstamm kostet je eine.
Welle um Welle fliegen die Stämme schneller, drehen stärker und kommen zu
zweit bis zu viert, manche tragen zwei Striche. Jeder Schnitt ist ein Zug,
der sich in der Hall of Fame und im Multiplayer genau nachspielen lässt.

**Fledermaus** (`fledermaus.js`, `batEcho`) – Eine Fledermaus fliegt durch
eine stockdunkle Höhle, die immer schneller nach rechts weiterzieht. Rechts
tippen ist ein Flügelschlag, links tippen ein Ruf: Ein Ring aus Schall läuft
durch die Höhle, die Kanten von Fels und Tropfsteinen glühen cyan und violett
auf und verblassen wieder – den Weg voraus muss man sich merken. Rufe gibt es
drei zu Beginn, und sie laden nicht von selbst nach: Neue bringen nur die
gelben Glühwürmchen (je einen); wer keinen mehr hat, fliegt blind. Später
kommen Spinnen am Faden, Tropfsteine, die sich lösen, und Gabeln mit einer
Sackgasse. Gezählt werden die Meter. Jeder Abschnitt hat einen freien
Korridor, den der Autopilot in der Prüfung bis 2000 m abfliegt.

**Zeitlupen-Ninja** (`ninja.js`, `timeNinja`) – Ein nächtlicher Dojo-Hof,
von oben gesehen, Raum über Raum. Die Zeit läuft nur, wenn der Ninja läuft:
Wer stillsteht, sieht Pfeile, Wurfsterne und Kirschblüten fast reglos in der
Luft hängen – wer rennt, sieht die Welt in normalem Tempo. Gesteuert wird
mit Finger oder Maus, irgendwo im Bild: Ziehen gibt die Richtung, Halten
läuft weiter, jede neue Zugrichtung lenkt ihn genau dorthin (es zählt, wohin
der Finger zuletzt gezogen hat, nicht, wo er aufgesetzt wurde), erst
Loslassen hält ihn an; am Rechner auch mit Pfeiltasten/WASD. Der Weg führt
an Bogenschützen, Klingen, Fallen und den Lichtkegeln der Wächter vorbei zum
Tor. Jeder Raum gibt 10 Punkte, jede Schriftrolle «+3
Punkte», und der **Tempo-Bonus** oben links zeigt gross, was ein Raum in
echter Zeit noch dazugibt: +10 bis 4 s, +6 bis 7 s, +3 bis 12 s, mit einem
Balken, der abläuft – Stehenbleiben kostet keine Punkte, nur diesen Bonus.
Am Tor steht nur der Tempo-Bonus («Tempo-Bonus +6»), auch beim Zuschauen;
die 10 Punkte des Raums zählen still mit. Der erste Treffer beendet die Runde. Die Räume werden immer dichter, und
beim Zuschauen stehen Pfeile und Klingen genau dort, wo sie damals waren.

**Freitaucher** (`freitaucher.js`, `freeDive`) – Ein Atemzug, so tief man
sich traut: fünf Tauchgänge an fünf Plätzen (Bucht, Riffkante, Quallenfeld,
Muränenriff, Nachttauchgang), jeder tiefer, von 21 bis 42 m. Halten heisst
schwimmen – Flossenschlag um Flossenschlag dorthin, wo der Finger liegt (am
Rechner mit den Pfeiltasten) –, Loslassen gleiten. Wie beim echten
Freitauchen trägt das Wasser oben, in 11 m schwebt der Taucher, darunter
sinkt er von selbst, immer schneller: Hinunter ist leicht, hinauf teuer.
Jeder Schlag kostet Luft, gleiten fast keine; der Luftring um den Taucher
läuft leer, und sein weisser Strich sagt, wie viel der Weg nach oben kostet.
Auf dem Grund liegen Muscheln mit Perlen – je tiefer, desto wertvoller (1,
2, 3, 5, 8) –, sie zählen erst, wenn sie oben sind. Strömung zieht quer,
Quallen stechen (Luft weg, kurz kein Schlag), Muränen reissen die beste
Perle aus dem Netz, nachts leuchten nur Perlen und Quallen. Geht die Luft
aus, ist es ein Blackout: Das Netz ist weg und die Runde vorbei. Wer zu
lange an der Oberfläche liegt, lässt den Platz aus. Gezählt werden die
Perlen.

### Drei Umbauten (November 2026): zurück zu einer Regel

Die Spiele, die am meisten Freude machen (Tier 1: Turmbau, Brückenbauer,
Lianenschwung, Tunnelflug, Drift-Rennen …), haben eines gemeinsam: eine
Regel, die in einen Satz passt, das Können im *Wann* und *Wie viel*, der
erste Fehler beendet die Runde, und über dem Überleben liegt eine
«Perfekt»-Schicht. Drei Spiele wurden daraufhin umgebaut. Ihre Bestenlisten
zählen nach den alten Regeln – der Admin leert sie beim Veröffentlichen
(«Bestenliste leeren»); die Aufzeichnungen tragen eine neue Fassung, alte
Läufe werden nicht mehr abgespielt.

**Turmspringen** (`highDive`, Fassung `t2`) – Vorher sieben Regeln: Ring an
der Kante, ein Drall, der nie aufhört, Böen, Kompass, Pflicht je Höhe, drei
Richter. Jetzt: Halten dreht, Loslassen hält die Drehung an, senkrecht
hinein; acht Sprünge von gewürfelten Höhen, halbe Drehungen als Punkte,
perfekt ×2 bis ×4 (oben beschrieben). Die Schrauben: `W_PAECK`, `OEFFNEN`,
`PERFEKT`, `KLATSCH`, `KETTE_MAX`, `BAENDER`. Prüfung 4g19: Ein Autopilot
springt jede Welt perfekt durch, ein gieriger kommt nicht durch.

**Seiltänzer** (`ropeWalk`, Fassung `t2`) – Vorher kippte er von allein
wie ein Stab auf der Fingerspitze, und Halten (rechts) und Loslassen (links)
wirkten immer: dauerndes Ausgleichen ohne lesbaren Moment. Jetzt zwei
Knöpfe wie im Slalom: links halten lehnt nach links, rechts nach rechts,
ohne Finger richtet er sich auf (`AUFRICHT`). Das Spiel sind die Böen, die
man kommen sieht: Jede wirft um, wer nicht gegenhält, und wer zu lange
hält, kippt nach der anderen Seite (`STANGE` ist stärker als das
Aufrichten). Ab 120 m folgen Doppelböen, erst von der einen, dann gleich von
der anderen Seite. Eine Böe, durch die er kaum schief kommt, ist
«pariert», mehrere in Folge zählen hoch. Gezählt werden weiter die Meter.
Prüfung 4g12: Ein genauer Autopilot geht bis 1500 m, einer, der eine
Viertelsekunde zu spät reagiert, fällt lange vorher; ohne Eingabe wirft die
erste Böe.

Seit dem 12. November 2026 (Fassung `t4`) kommt mehr als Wind, und es wird
früh ernst. Die Steuerung ist dieselbe; neu sind die **Störungen**
(`neuesEreignis`): Böen; ein **Vogel, der auf einem Ende der Stange
landet** (`VOGEL_LAST`) – solange er sitzt, zieht er diese Seite hinunter,
und wenn er auffliegt, ist das Gewicht auf einmal weg; ab 55 m manchmal zwei,
links und rechts, und wer zuerst kam, fliegt zuerst (`PAAR_AB`); ein
**Vogel, der ihn rammt** (`RAMME_STOSS`) – ein Ruck zur anderen Seite, Federn
fliegen, und pariert ist er nur, wenn man sich vorher hineinlehnt
(`PARIERT_JE`). Man sieht jede kommen: Blätter und Pfeile vor der Böe, den
Vogel im Anflug (dazu ein Flattern), den Rammvogel mit Strichen dahinter.
Eine Welle, die das Seil entlanglief (Fassung `t3`), gibt es nicht mehr –
die Läufe mit ihr zählen bei Geist und Zuschauen nicht mehr mit. Die Vögel sind je Landschaft andere: Dohlen in der Schlucht,
Tauben in der Stadt, Möwen bei den Gipfeln. Die erste Böe kommt nach gut
zwei Sekunden (`STOER_AB`), der erste Vogel nach gut fünf (`VOGEL_AB`),
danach folgt eine Störung dicht auf die andere (`ABSTAND`, in Sekunden), die
Schwere wächst über rund 90 m statt 300 m (`SCHWER_WEG`), und Doppelböen
kommen ab 45 m statt ab 120 m (`DOPPEL_AB`). Simulierte
Spieler fallen im Mittel nach 10 bis 60 Sekunden statt nach 30 bis 190.
Prüfung 4g12: Der genaue Autopilot (der sich vor einem Rammvogel kurz
hineinlehnt) geht weiter bis 1500 m und pariert alles; eine Böe ist
nachgerechnet lang genug, um einen Untätigen umzuwerfen; die erste Böe kommt
vor der vierten Sekunde, der erste Vogel vor der achten, in der ersten
halben Minute mindestens zehn Störungen; wer einen Vogel auf der Stange
nicht ausgleicht, kippt zu ihm hin.

**Planetenhüpfer** (`planetHop`, Fassung `p3`) – Vorher brachte ein Sprung
10 bis 100 Punkte, je nachdem, wie viel Sauerstoff noch übrig war – man sah
nie, warum es wie viel gab. Jetzt zählt jeder neue Planet einen Punkt, ein
Volltreffer (auf die Mitte des Planeten, `VOLL`) eine Reihe dazu wie beim
Froschsprung (bis `KETTE_MAX`), und goldene Ringe laufen über die
Lufthülle. Der Sauerstoff ist nur noch die Uhr: knapp zwei Runden um den
Planeten (`LUFT0`, `LUFT_MIN`), dann ist die Runde vorbei. Prüfung 4g6:
Wer auf die Mitte wartet, holt deutlich mehr je Planet.

### Hammerwurf und Entenfamilie (November 2026)

Zwei neue Spiele nach dem Muster von Tier 1: eine Regel, das Können im
*Wann*, der erste Fehler beendet die Runde, und eine «Perfekt»-Schicht
darüber. Beide in 2D, von oben gesehen.

**Hammerwurf** (`hammerwurf.js`, `hammerThrow`) – Ein Stadion am Abend:
Wurfkreis im Käfig, davor der Sektor im Rasen. Der Werfer dreht sich mit
dem Hammer, Drehung um Drehung schneller (`W0`, `W_PLUS`). Ein Tipp lässt
los, und der Hammer fliegt tangential weiter – genau die Mittellinie
hinauf, wenn er rechts vom Werfer steht. Je länger er dreht, desto weiter
fliegt er (`WEITE0` bis `WEITE_MAX`), aber desto kürzer ist der
Augenblick, in dem er in den Sektor zeigt. Nach `DREH_MAX` Drehungen tritt
er über. Jeder Wurf muss über die Qualifikationslinie (`Q0` + `Q_PLUS` je
Wurf); die rückt hinaus, bis keine Drehung mehr reicht – nach gut einem
Dutzend Würfen endet jede Runde von selbst. Gezählt werden die Meter;
«Mitte!» (ein Drittel des Sektors, `MITTE`) gibt +5 m, in Folge +10, +15,
+20. Netz, ungültig, zu kurz oder übergetreten beendet die Runde. Der
Sektor wird schmaler (`SEKTOR`). Gewürfelt wird nur der Wind, Wurf um Wurf
(±`WIND_MAX` m/s, Rücken- oder Gegenwind auf die Weite); die Fahne neben
dem Käfig und die Anzeige zeigen ihn. Unter dem Ring steht, die wievielte
Drehung es ist und wie weit der Hammer jetzt flöge. Jeder Wurf ist ein Zug
(Richtung, Tempo, Ausgang) – so lässt sich ein Lauf anschauen und im
Multiplayer zuschauen. Prüfung 4g30: Ein Autopilot kommt auf neun Würfe
und mehr und tritt dann über, einer auf die Mittellinie holt mehr; erst, nie, Netz,
daneben enden je mit ihrem Grund.

**Entenfamilie** (`entenfamilie.js`, `duckCrossing`) – Eine Entenmutter
zieht mit ihren Küken zum See, Fluss um Fluss, und auf den Flüssen kreuzen
Ruderboote, Kanus, Flösse, Motorboote und Dampfer in Bahnen. Halten heisst
schwimmen, Loslassen warten. Die Küken folgen in einer Kette; wartet die
Mutter, rücken sie auf (`ABSTAND_ENG`), schwimmt sie, ziehen sie sich
wieder auseinander (`ABSTAND`). Ein Boot trifft – Ende. Sicher sind nur
die Ufer und die Seerosenfelder. Jedes Ufer bringt ein Küken mehr
(`KUEKEN_START` bis `KUEKEN_MAX`): Die Kette wird länger, und dieselbe
Lücke reicht nicht mehr. Dazu mehr Bahnen, schnellere Boote, seltener
Seerosen. Je Fluss so viele Punkte, wie Küken ankommen; in einem Zug (ohne
anzuhalten, solange eine Ente im Wasser ist) doppelt. Die Runde dauert
90 Sekunden (`DAUER`), die Sonne geht dabei unter.

Schaffbar ist jeder Fluss durch eine *grüne Welle*: Alle Bahnen eines
Flusses wiederholen sich im selben Takt (`takt`, schnelle Bahnen mehrmals
darin), und einmal je Takt liegt in jeder Bahn genau dann eine Lücke vor
der Familie, wenn sie bei vollem Tempo dort ankommt – mit `SPIEL` Metern
Luft. Die übrigen Lücken sind zufällig, manche reichen nur für die halbe
Familie. Wie die Flüsse liegen, hängt nur an ihrer Nummer; die Boote
kommen aus `zufall.js`. Die Ufer sind so breit, dass die ganze Familie
darauf wartet (`ufer`). Weiter weg als `VORAUS` verschwinden die Boote im
Dunst – auf jedem Bildschirm sieht man gleich weit. Aufgezeichnet werden
Höhe der Mutter und Zahl der Küken; beim Anschauen fahren dieselben Boote,
und die Küken folgen nach derselben Regel. Prüfung 4g31: Ein Autopilot, der
am Ufer auf die Welle wartet (`querungOk`, `wartenBisWelle`), quert auf
jeder Welt in 90 s mindestens sechs Flüsse, jeden in einem Zug; wer blind
losschwimmt, wird bald erwischt.

### Schwarm (November 2026): das erste Spiel in 3D

**Schwarm** (`schwarm.js`, `flockFlight`, Fassung `t2`) – Ein Starenschwarm
zieht im Abendlicht über das Meer, der Sonne entgegen; die Kamera fliegt
dicht dahinter. Die Regel: **Links lenkt nach links, rechts nach rechts,
beide zusammen ballen den Schwarm. Aufgefächert zählt er, geballt kommt er
durch.** Am Rechner lenken die Pfeiltasten oder A/D; ↓, S und die
Leertaste ballen (links und rechts zugleich auch).

Umgebaut am 12. November 2026 nach dem Muster von Tier 1 und 2. Vorher
verlor auch ein perfekter Autopilot je Lauf rund 370 Vögel und gewann
ebenso viele dazu: Der Schwarm war breiter als die Lücken, Vögel wichen von
selbst um Felsen aus, kleine Trupps kamen beim blossen Folgen des Wegs dazu
– und wer immer 2 m neben der Linie flog, machte nur 16 % weniger Punkte.
Die Bestenliste zählt nach den alten Regeln; der Admin leert sie beim
Veröffentlichen («Bestenliste leeren»). Läufe aus `t1` werden nicht mehr
abgespielt.

**Jede Reihe ist ein Tor.** Ob Felsnadeln, ein grosser Fels mitten im Weg
(drum herum, durch die Lücke zwischen ihm und einer Nadel), ein Felsbogen,
eine Felswand mit Spalt, ein Windpark oder eine Stromleitung (nur zwischen
den zwei hohen Masten ist es frei): Am freien Weg lässt jede Reihe eine
Lücke, links und rechts gleich weit (`torDazu`), und in ihrer Mitte hängt
ein goldener Ring, so gross wie das, was dort noch perfekt ist. Wer die
**Mitte des Schwarms** – ein warmer Schein zwischen den Vögeln – genau
hindurchführt (am Anfang auf 1 m, am Schluss auf 0,6 m, `PERFEKT0`/
`PERFEKT_MIN`) und dabei keinen Vogel verliert, fliegt «perfekt»: Der Ring
blüht auf, und Vögel schliessen sich an – das erste perfekte Tor in Folge
bringt 2, dann 4, 6, 8, 10 (`KETTE`). Oben links steht «Perfekt ×n». Ein Tor,
das nicht perfekt ist, bricht die Kette; daneben steht, wie weit und auf
welcher Seite («◂ 1,3 m»). Vögel wachsen also nur aus Genauigkeit – und
grosse Trupps an heiklen Stellen (am Rand, hinter einem zweiten, engeren
Spalt, im Durchlass neben einem grossen Fels; `TRUPP`) kommen nur, wenn die
Mitte durch ihren Ring geht. Wer einen holt, verlässt das Tor: Die Kette
bricht.

**Was trifft, ist, was man sieht** (`trifft`). Kein Vogel weicht von selbst
aus, und keiner fliegt je über den Rand des Schwarms hinaus (`masse`): Was
beim Durchflug über den Fels hinausragt, bleibt hängen – genau dort, wo es
den Fels berührt; der Rand des Bilds glüht auf dieser Seite, und dort steht
«−23». **Trifft die Mitte des Schwarms den Fels, ist die Runde vorbei**
(«Am Fels zerschellt», wie der Körper im Felsflug). Unter einem Dutzend
Vögeln (`MINDEST`) zerstreut sich der Schwarm.

**Ballen.** Aufgefächert ist der Schwarm breit (`radiusBei`: 150 Vögel gut
17 m) und zählt: Hundert Vögel bringen alle dreissig Meter einen Punkt
(`PUNKTE_JE_100M`). Liegen beide Seiten gut eine Zehntelsekunde auf
(`BALL_VERZUG` – ein Daumenwechsel ballt nicht), zieht er sich zu einer
dichten Kugel zusammen (`ballRadiusBei`: 150 Vögel gut 3 m; `BALL_ZU`,
`BALL_LANG_ZU`), passt durch jeden Spalt – lenkt aber nicht und zählt
nicht. Loslassen fächert ihn wieder auf (`BALL_AUF`; die Länge wächst
langsamer, `BALL_LANG_AUF`, damit hinten keiner rückwärts fliegt). Das
Können liegt im Wann und Wie lange: vorher genau ausrichten, so spät wie
möglich ballen, sofort wieder lösen und weiterlenken – wer zu früh ballt,
kommt nicht mehr zur Mitte, wer zu früh löst, lässt das Ende am Fels. Ein
grosser Schwarm zählt schneller, muss aber öfter ballen. Gelenkt wird
nicht sofort, sondern wie ein Band (`LENK_ZEIT`): Wer zu spät umlenkt,
kommt nicht mehr hinüber.

**Der Falke** (ab `FALKE_AB`, auf offenen Stücken; später zwei kurz
hintereinander). Man sieht ihn voraus kreisen, ein Ring hält ihn auch vor
dem dunklen Himmel fest, er schreit – dann legt er die Flügel an und stösst
`FALKE_STOSS` Sekunden später auf die Mitte des Schwarms. Ist der geballt,
greift er ins Leere; wer erst in den letzten `FALKE_SPAET` Sekunden geballt
hat, hat ihn «pariert» (die Kette wächst wie bei einem perfekten Tor), wer
früher ballte, war zu früh (die Kette bricht). Aufgefächert reisst er ein
Sechstel heraus (`FALKE_RAUB`). Vor der ersten Wand und vor dem ersten
Falken sagt eine Tafel einmal, was zu tun ist.

Die Runde endet nach 3600 m am Schlafplatz – hinter drei letzten
Felswänden, deren Spalten nur noch einen Ball durchlassen
(`SCHLUSS_SPALTEN`); jeder Vogel, der ankommt, zählt noch einen Punkt.
Unterwegs wird es Abend – Goldene Stunde, Sonnenuntergang, Abendrot, Blaue
Stunde, Nacht –, schneller (von 38 auf gut 70 m/s) und enger.

Wie die anderen würfelt es seine Welt aus `zufall.js`. Zuerst kommt ein
Feld Nadeln, dann ein grosser Fels, dann die erste Wand (`erstesBallen`),
danach, wie es fällt. Die Reihen eines Felds liegen in der Zeit
auseinander (`REIHE_T0`/`REIHE_T_MIN`), und von Tor zu Tor geht der freie
Weg (`wegBei`) nie weiter zur Seite, als sich in der Zeit lenken lässt –
abzüglich der Pause, in der man an einem Tor geballt ist und anfährt
(`T_PAUSE`); verlangt wird am Anfang gut die Hälfte dessen, was der
Schwarm zur Seite kann, am Schluss gut vier Fünftel (`anteilBei`,
`reichBei`). Wo ein Vogel im Schwarm fliegt, folgt aus seiner Nummer, die
Windräder drehen nach der Flugzeit, und der Falke hängt an der Strecke –
wer gleich fliegt, verliert dieselben Vögel. Aufgezeichnet werden Strecke,
Seite und Schwarmgrösse (`a`, `b`, `c`); in `c` stehen 2000 dazu, solange er
geballt ist (`GEBALLT_C`), und 0 nach dem Zerschellen. Beim Anschauen
fliegt der Schwarm denselben Weg durch denselben Abend, ballt an denselben
Stellen und ist so gross wie damals. Die Gegner fliegen als kleiner
Schwarm aus Licht mit.

Gemessen mit Autopiloten, die die Welt kennen (je sechs Welten): Wer jedes
Tor in der Mitte trifft und kurz davor ballt, kommt immer an, verliert
keinen Vogel, ist an jedem Tor perfekt und holt rund 720 Punkte – in jeder
Welt fast gleich viel (vorher schwankte derselbe Pilot zwischen 294 und 474).
Wer an jedem Tor im Mittel einen halben Meter danebenliegt, holt rund
80 %, mit knapp einem Meter gut die Hälfte, mit anderthalb Metern ein
Drittel; wer immer 2 m danebenfliegt, gut ein Viertel, wer nie ballt, ein
Viertel. Ein Pilot mit einer Zehntelsekunde Reaktionszeit kommt meist an,
mit 0,15 s im Mittel bis gut 3000 m, mit einer Viertelsekunde bis gut
1500 m. Wer eine knappe Sekunde zu früh ballt, kommt nicht mehr zur Mitte
und zerschellt nach rund 900 m; wer nichts tut, nach gut 400 m.
Abschnitt 4g25 in `npm run pruefen:browser` rechnet nach, dass jedes Tor
auf seiner ganzen Breite frei und der Weg lenkbar ist, und lässt diese
Piloten fliegen.

**Gezeichnet wird mit WebGL 2**, ohne Bibliothek – das Repository bleibt ohne
Abhängigkeiten. Sechs kleine Programme stehen in `schwarm.js`: der Himmel
(Verlauf, Sonne, Wolken, Berge, Mond und Sterne aus der Blickrichtung), das
Wasser, alles Feste (ein Netz je Form, viele Male gezeichnet), die Vögel (je
eine Scheibe, die zur Kamera schaut; Rumpf und schlagende Flügel entstehen
im Programm), die Seile und alles, was leuchtet. Die Spiegelung im Wasser
ist die Welt, auf den Kopf gestellt und noch einmal gezeichnet; das Wasser
legt sich darüber und lässt davon stehen, was es spiegelt – kein zweites
Bild im Speicher. Der Falke und die Gegner stehen fast ohne Dunst im Bild,
sonst verschwänden sie vor dem Abendhimmel. Zahlen und Namen liegen auf
einer zweiten Leinwand (2D) darüber. Kommen die Bilder zu langsam, zeichnet
das Spiel die Welt mit weniger Bildpunkten (`gueteTakt`), die Zahlen
bleiben scharf. Ohne WebGL 2 steht ein Satz da statt einer Welt.

Die Schrauben stehen oben in der Datei: `Z_ENDE`, `V0`/`V_MAX`, `QUER0`,
`LENK_ZEIT`/`LOS_ZEIT` (wie flink er lenkt), die des Ballens (`BALL_…`,
`GEBALLT`), `START_VOEGEL`, `MINDEST`, `PUNKTE_JE_100M`, `PERFEKT0`/
`PERFEKT_MIN` und `KETTE`, `TRUPP`, `BREIT0`/`BREIT_MIN` (die Breite der
Lücken), `SPALT0`/`SPALT_MIN` und `SCHLUSS_SPALTEN` (die Spalten der
Felswände), `T_PAUSE` und `REIHE_T0`/`REIHE_T_MIN` (wie dicht die Tore
kommen), die des Falken (`FALKE_…`), die Masse der Hindernisse – und
`ABEND`, die fünf Lichter mit Sonnenstand und Farben.

### Die Welle (November 2026)

**Die Welle** (`welle.js`, `waveRide`) – Eine riesige, durchscheinende Welle
bei Sonnenuntergang, und ein Surfer, der sie entlangfährt; die Kamera sitzt
dicht hinter ihm, wie eine Helmkamera in der Röhre. Hinter ihm bricht die
Welle – der Schaum jagt ihn. Ein Finger genügt: Halten zieht die Wand
hinauf, Loslassen lässt ihn hinunterschiessen (am Rechner die Leertaste,
der Pfeil nach oben oder W). Zwei Grössen entscheiden: `h`, wie hoch er an
der Wand steht (0 das Tal, 1 die Lippe), und `d`, wie viele Meter er vor dem
Schaum ist. Hoch an der Wand ist er langsam, der Schaum kommt näher; im
unteren Drittel liegt die schnellste Linie; ganz unten im Flachen verhungert
er. Hinauf kostet Tempo, hinunter gibt Tempo, und unter der Lippe ist die
Wand so steil, dass er fast stehen bleibt.

Punkte gibt es nur in der Röhre, dort, wo das Dach über ihm zu ist (`d`
unter 9 m, `ROEHRE`): je Sekunde umso mehr, je tiefer er darin steckt
(`punkteBei`), mal die Serie – sie wächst in 30 Sekunden ohne Unterbruch von
×1 auf ×4 und beginnt neu, sobald er die Röhre verlässt. Ganz dicht am
Schaum reisst der Sog zurück (`SOG`): Wer zu gierig ist, kommt nur auf der
schnellsten Linie wieder heraus. Verschluckt ihn der Schaum (`d` unter
null) oder trägt es ihn über die Lippe (`h` über 1), ist die Runde vorbei.
Sonst läuft die Welle nach 80 Sekunden am Strand aus, mit einem kleinen
Bonus – und unterwegs sinkt die Sonne von der goldenen Stunde ins Abendrot.

Wie die anderen würfelt es seine Welt aus `zufall.js`: die Abschnitte der
Welle. In einem schnellen zieht der Schaum für zwei bis vier Sekunden an, in
einem langsamen lässt er nach, später kommen kurze Doppelschläge; mit der
Zeit werden die Pausen kürzer, die Welle schneller (`C0` bis `C1`) und die
Schulter kleiner (`TASCHE_FERN`). Wo ein schneller Abschnitt kommt, läuft
voraus weisse Gischt die Lippe entlang, und oben links wandert ein roter
Strich über dem Balken auf den Schaum zu. Der Schaum hängt nur an der Zeit
(`schaumBei`), nie daran, wie jemand fährt. Schaffbar bleibt jede Welle: Wer
immer die schnellste Linie fährt, behält nachgerechnet `RESERVE` Meter Luft
(`ideallinie` – wo nicht, zieht der Abschnitt weniger stark an, für alle
gleich). Der Autopilot in `npm run pruefen:browser` (Abschnitt 4g26) fährt
sie bis an den Strand, ein zweiter holt in der Röhre ein Vielfaches der
Punkte. Aufgezeichnet werden Strecke, Höhe an der Wand und Abstand zum
Schaum (`a`, `b`, `c`, je mal 100); beim Anschauen fährt der Surfer auf
derselben Welle, und die Gegner fahren als Surfer aus Licht mit – so tief
in der Röhre, wie sie damals waren.

**Gezeichnet wird wie der Schwarm mit WebGL 2**, in einem Durchgang. Die
Welle ist ein Netz, von dem jede Ecke nur weiss, in welcher Reihe und wo im
Querschnitt sie liegt; die Form entsteht im Programm aus zwei Zahlen je
Reihe (`formBei`): wie weit die Lippe überwirft und wie eng der Bogen ist –
voraus eine runde Dünung, zum Schaum hin die Röhre mit dem fallenden
Vorhang. Die Farbe des Wassers ist, was durchscheint (dünn golden, dicker
smaragdgrün, ganz dick fast nichts mehr), was sich spiegelt (der Himmel,
unter dem Dach die Röhre selbst) und der Schaum, der in Streifen die Wand
hinaufzieht. Dazu Himmel und offenes Meer in einem Programm, der Surfer
(ein Netz in zwei Haltungen), die Spur seines Bretts, Gischt, Tropfen und
Sprühnebel als weiche Scheiben – und auf der zweiten Leinwand die Zahlen
und, wenn es knapp war, Tropfen auf der Linse. Drei Klänge: die Brandung
(der Fahrtwind, in der Röhre lauter), ein hohles Rauschen, wenn sich das
Dach schliesst, und der Brecher am Schluss.

Die Schrauben stehen oben in der Datei: `DAUER`, `ROEHRE`, `C0`/`C1`,
`LINIE` (wie schnell die Welle in welcher Höhe trägt), `TASCHE_NAH`/
`TASCHE_FERN`, `SOG`, `HANG_NAH`/`HANG_FERN`, `STEIL_OBEN`, die Punkte
(`P_RAND`, `P_TIEF`, `P_HOCH`, `SERIE_VOLL`), `RESERVE` – und `ABEND`, die
drei Lichter, sowie `FORM`, der Querschnitt nach dem Abstand vor dem Schaum.

### Steinhüpfer (November 2026)

**Steinhüpfer** (`steinhuepfer.js`, `stoneSkip`) – Ein flacher Stein hüpft
über einen spiegelglatten Bergsee, bei Tagesanbruch; die Kamera fliegt tief
hinter ihm her. Halten holt aus – ein Zeiger pendelt zwischen «zu steil» und
«zu flach», der Stein in der Hand kippt mit –, Loslassen wirft: je näher an
der Mitte, desto mehr Schwung (`S_WURF_MIN` bis `S_WURF`, in m/s). Danach
gibt es nur noch eines zu tun: tippen, genau wenn der Stein das Wasser
berührt (Finger, Maus, Leertaste, Enter oder Pfeil nach oben). Das Zeichen
dafür ist das Spiegelbild: Stein und Spiegelbild kommen einander entgegen,
und wo sie sich treffen, ist der Moment. Ein Balken für das Fenster wird nie
eingeblendet; nur im allerersten Wurf zieht sich ein Ring auf die Stelle
zusammen.

Wie genau der Tipp sitzt, entscheidet, wie viel Schwung bleibt (`werte`):
«Perfekt» behält fast alles und zählt eine Serie hoch, die ein wenig Schwung
zurückgibt (`SERIE_SCHUB`); «gut» kostet etwas, «knapp» viel – je weiter
daneben, desto mehr –, und wer ganz daneben tippt oder gar nicht, dessen
Stein versinkt. In den ersten drei Hüpfern verzeiht das Spiel das einmal
(`GNADE_BIS`). Aus dem Schwung folgen die Bögen (`bogenDauer`,
`bogenHoehe`): Wer ihn verliert, hüpft kürzer, flacher und schneller, und
das Fenster wird mit jedem Hüpfer enger (`fenster`: von 48 auf 17 ms für
«perfekt», jenseits von 260 m bis auf 10 ms am anderen Ufer) – am Schluss
prasselt es, und unter `S_AUS` ist der Stein ausgehüpft. Gezählt werden die Meter. Nach 700 m (`Z_UFER`) liegt das
andere Ufer; mit menschlichem Timing kommt dort kaum jemand an. Ein guter
Wurf endet bei etwa 300 m nach knapp zwanzig Sekunden.

Der Tipp zählt nach der **Spielzeit**, nicht nach dem Bild: Ein Bogen ist
eine Formel (Anfang, Schwung, Dauer, Höhe – `neuerBogen`), das Aufsetzen ist
ausgerechnet, jede Eingabe trägt den Zeitstempel ihres Ereignisses
(`spielzeit`, abzüglich `VERZUG` für Bild und Finger), und `ablauf` arbeitet
beides der Reihe nach ab. So ist ein genauer Tipp auch bei dreissig Bildern
in der Sekunde «perfekt», und Prüfung und Autopilot rechnen eine Runde in
Millisekunden durch (`tippe(zeit)`, `aufsetzZeit()`).

Wie die anderen würfelt es seinen See aus `zufall.js`, gleich zu Beginn der
Runde und ganz: Böen (ein Bogen, der in ihrem Kräuselband beginnt, wird
länger oder kürzer), die Wellen eines Ruderboots (das Wasser steht höher,
der Stein setzt früher auf – sein Spiegelbild zeigt es), Seerosen und
Treibholz (wer darauf landet, verliert viel Schwung; ab zwei «Perfekt» in
Folge trägt der Bogen darüber) und Libellenringe (ein perfekter Hüpfer
fliegt hindurch und bekommt `RING_SCHUB`). Die ersten vierzig Meter sind
frei, dann wird es dichter. Der Autopilot in `npm run pruefen:browser`
(Abschnitt 4g29) erreicht mit genauen Tipps das andere Ufer – auch mit
dreissig Schritten je Sekunde –, einer mit ±55 ms nie, und wer nicht tippt,
versinkt beim zweiten Aufsetzen. Aufgezeichnet werden Strecke, Höhe und
Hüpfer (`a` mal 10, `b` mal 100, `c`); beim Anschauen hüpft der Stein über
denselben See und hinterlässt dieselben Ringe, die Gegner hüpfen als Steine
aus Licht daneben.

**Gezeichnet wird wie der Schwarm mit WebGL 2**, in einem Durchgang, mit
sieben kleinen Programmen. Himmel, Wolken und die drei Bergketten entstehen
aus der Blickrichtung (`HIMMEL_FS`: jede Kette ein Grat aus dem Rauschen,
die Kante zwischen Licht und Schatten läuft vom Gipfel schräg hinab, oben
liegt Schnee, auf dem das erste Licht liegt). Unter dem Horizont trifft der
Blick das Wasser, und was es dort neigt – die Ringe des Steins (die jüngsten
sechzehn als Wellen), die Wellen des Boots, eine Böe –, verbiegt das
Spiegelbild. Ufer, Wald, Steg und Kiesel sind ein einziges grosses Netz,
einmal gebaut (`landBauen`; der See ist immer derselbe Ort), gespiegelt
darunter gezeichnet; das Wasser legt sich darüber und lässt stehen, was es
spiegelt. Dazu Schilf (Halme im Programm), die Spur der Ringe und die
Seerosenblätter als Scheiben auf dem Wasser, Tropfen, Funken und Ringe aus
Licht. Mit der Strecke geht die Sonne auf (`MORGEN`: Morgengrauen,
Alpenglühen, Sonnenaufgang bei gut 200 m, goldener Morgen), und versinkt
der Stein, dreht sich die Kamera um und zeigt die Kette seiner Ringe. Zwei
eigene Klänge: ein helles Plitsch bei jedem Hüpfer (`plitsch`, mit wenig
Schwung höher) und die Vögel am Ufer; dazu Wurf, Ring und das Versinken aus
vorhandenen.

Die Schrauben stehen oben in der Datei: `Z_UFER`, `S_WURF`/`S_WURF_MIN`,
`S_NORM`/`T_NORM`/`T_HOCH`/`H_NORM` (Dauer und Höhe eines Bogens),
`S_AUS`, die Fenster (`FENSTER_WEIT`, `FENSTER_ENG`, `FENSTER_N`,
`FENSTER_AB`/`FENSTER_UFER`, `GUT_MAL`, `KNAPP_MAL`), was bleibt (`BEHALT_PERFEKT`, `BEHALT_GUT`,
`BEHALT_KNAPP`, `SERIE_SCHUB`), `RING_SCHUB`, `BEHALT_SEEROSE`/
`BEHALT_HOLZ`, `VERZUG` – und `MORGEN`, die fünf Lichter.

### Eiskanal (November 2026)

**Eiskanal** (`eiskanal.js`, `iceRun`) – Eine Bobfahrt bei Nacht, aus dem
Schlitten gesehen: eine Rinne aus Eis im Flutlicht, 1400 m lang, 110 m
Gefälle, vom Starthaus (40 km/h) bis ins Ziel (bei voller Fahrt gut
130 km/h). Wer links aufs Bild hält, lenkt nach links, wer rechts hält, nach
rechts (am Rechner Pfeiltasten oder A/D; liegen zwei Finger auf, gilt der
letzte). Quer in der Rinne ist der Schlitten ein Pendel: In der Kurve drückt
ihn die Fliehkraft die Aussenwand hinauf, die Schwerkraft zieht ihn zurück,
und dazwischen schwingt er um die ruhige Linie (`linieBei`). Lenken schiebt
ihn zur Seite – und kostet Tempo, in einer schnellen Kurve mehr als auf der
Geraden. Auf den Geraden stehen niedrige Banden: Jede Berührung nimmt Tempo,
und der dritte harte Schlag (`HART`, `SCHLAEGE`) kippt den Bob. In den Kurven
wächst die Aussenwand zur Steilwand mit einer Lippe aus Licht und einem
Sonnensegel darüber; wer über die Lippe hinausschiesst, ist draussen.

Gezählt wird die Strecke – je 10 m ein Punkt, 140 im Ziel – und im Ziel die
Zeit: Jede Zehntelsekunde unter der Richtzeit (`RICHTZEIT`, 61 s) bringt
fünf Punkte dazu (`BONUS_JE_ZEHNTEL`). Eine Fahrt mit viel Lenken kommt so
auf gut 200, eine gute auf 300, die beste auf über 450. An zwei Toren steht
die Zwischenzeit gegen die eigene beste Fahrt auf diesem Gerät, grün oder
rot (die Bahn ist jedes Mal eine andere, aber immer gleich lang und gleich
steil). Oben links der Tacho, die Zeit, die Strecke und drei Kufen für die
Schläge, die der Bob noch aushält; oben in der Mitte die Ansage der nächsten
Kurve; unten auf der Haube der Querschnitt der Rinne mit dem Schlitten
darin – das Ende ist weiss, wo eine Bande steht, und orange, wo es eine
Lippe ist, ein grüner Strich zeigt die ruhige Linie.

Wie die anderen würfelt es seine Welt aus `zufall.js`: Geraden, Kurven,
S-Kurven, ein Kreisel (mit Gegenkurve, damit die Bahn sich nicht kreuzt) und
ein Labyrinth aus schnellen Wechseln, nach unten enger (`RADIUS0`/`RADIUS1`,
`UEBERGANG0`/`UEBERGANG1`) – immer genau 1400 m. Kreuzt sich ein Wurf, fehlt
ihm Kreisel oder Labyrinth oder müsste eine Wand höher sein, als sie sein
kann, wird neu gewürfelt, aus demselben Zufall. Wie hoch jede Wand ist,
folgt aus der Bahn selbst: `bahnRechnen` fährt sie einmal bei vollem Tempo
ab (`vf`, ohne Lenkkosten) mit einem Schlitten, der ruhig gegen sein Pendeln
lenkt und nur einen Teil der Lenkung braucht (die Sollfahrt, `bahn.soll`,
Schrauben `SOLL_…`). Die Wand reicht dort so hoch, wie er kommt, plus Luft:
oben 30 Grad, unten 14 (`LUFT0`, `LUFT1`, `LUFT_FORM`) – das ist die
Schraube für «schwer». Unter 16 Grad über der Bande (`STEIL`) bleibt es eine
Bande, darüber ist es eine Lippe. So ist jede Bahn ohne Bande fahrbar; der
Abschnitt 4g27 in `npm run pruefen:browser` rechnet die Sollfahrt nach, und
ein Autopilot fährt ins Ziel. Wer nichts tut, schiesst nach einem Drittel
der Bahn über eine Lippe. Aufgezeichnet werden Strecke, Lage von Rand zu
Rand und Tempo (`a`, `b`, `c`); beim Anschauen liegt der Bob Bild für Bild
dort, wo er damals lag. Die Gegner fahren als Bob aus Licht mit.

**Gezeichnet wird mit WebGL 2** wie im Schwarm, in einem Durchgang und mit
sechs Programmen: der Himmel (Nacht, Sterne, Mond mit Hof, Nordlicht, Berge
– und unter dem Horizont das Tal mit den Lichtern der Dörfer), die Bahn,
alles Feste daneben (Tannen, Masten, Tore), der Bob, der Schneefall und
alles, was leuchtet. Die Bahn ist ein einziges Netz entlang ihrer Raumkurve,
einmal je Runde gebaut (`bahnNetz`): Jede Ecke weiss, wo sie im Querschnitt
liegt und woraus sie ist – Eis, Bande oder Lippe, Schnee, Sonnensegel,
Tafel. Die Flutlichter hängen alle 24 m mitten über der Bahn; wo die
nächsten drei sind, folgt darum aus der Strecke allein, und Licht und Glanz
entstehen je Bildpunkt, ohne dass ein Licht übergeben wird. Auf dem Eis ist
der Glanz in Fahrtrichtung gestreckt: Die Lichter ziehen als Streifen über
die Wände, dazu Kufenrillen, Reif, Fugen, die vorbeifliegen, und zwei blanke
Spuren entlang der Sollfahrt – sie zeigen die Linie. Die Kamera sitzt im
Schlitten und rollt mit der Lage in der Rinne; unten im Bild die Haube, in
deren Lack die Flutlichter wandern. Die Flocken des Schneefalls ziehen mit
dem Tempo Striche. Kommen die Bilder zu langsam, zeichnet das Spiel die Welt
mit weniger Bildpunkten (`gueteTakt`). Vier Klänge, alle aus vorhandenen:
die Kufen auf dem Eis und der Fahrtwind als Kulissen, die mit dem Tempo
gehen, ein dumpfer Schlag an der Bande und der Sturz.

Die Schrauben stehen oben in der Datei: `LAENGE`, `GEFAELLE`, `ROHR`,
`BANDE`, `STEIL`, `LUFT0`/`LUFT1`/`LUFT_FORM`, die Fahrt (`V_START`, `ROLL`,
`LUFT_W`, `GRIFF`, `DAEMPFUNG`, `LENK_KOSTEN`), die Bande (`HART`, `SANFT`,
`BANDE_FEST`, `BANDE_JE`, `SCHLAEGE`) und die Punkte (`RICHTZEIT`,
`BONUS_JE_ZEHNTEL`).

### Felsflug (November 2026)

**Felsflug** (`felsflug.js`, `cliffFlight`) – Im Wingsuit durch eine
Alpenschlucht, im Morgenlicht; die Kamera fliegt dicht hinter und über dem
Flieger und legt sich mit ihm in die Kurve. Wer links aufs Bild hält, zieht
nach links, wer rechts hält, nach rechts (am Rechner Pfeiltasten oder A/D;
liegen zwei Finger auf, gilt der letzte); die Höhe hält der Flieger von
selbst. Er steht auf einer Felsnadel, und der erste Druck ist der Absprung.
Die Schlucht windet sich talwärts, und es wird immer schneller: von 130 auf
250 km/h (`V0`, `V_MAX`). Im Weg stehen Felsnasen, die aus der Wand ragen,
Felstürme mitten in der Schlucht (links oder rechts vorbei, später zwischen
zweien hindurch), eine Klamm, in der beide Wände an den Weg heranrücken,
Felsbögen, eine Steinbrücke mit Pfeilern, Tannen auf Felsbändern – und ein
Massiv, das die Schlucht teilt: auf einer Seite breit, auf der anderen ein
Spalt. **Der erste Kontakt beendet die Runde**; es zählt der Körper
(`KOERPER`), nicht die Flügelspitze.

Seit November 2026 ist die Schlucht auf Flughöhe ein **Gang**: Die Wand steht
nur wenige Meter neben dem freien Weg (`gangBei`, `LUFT0`, `LUFT_MIN`) und
folgt ihm in jede Kurve; darüber öffnet sich die Schlucht. Vorne ist der Gang
gut 20 m breit und biegt in weiten Bögen, ab `ENG_AB` (220 m) wird er
enger und kurviger, und ab `ENG_VOLL` (2600 m) ist er Wand an Wand kaum
mehr acht Meter breit und schlägt Haken: Serpentinen (`kurven`), dichtere
Hindernisse, kurze Pausen, und der Weg verlangt gut zwei Drittel dessen, was
der Flieger zur Seite kann (`engeBei`, `anteilBei`). Der Flieger ist ein Mensch im
Wingsuit (`fliegerNetz`): Helm mit Visier, Gurtzeug, Handschuhe und Schuhe,
die Flügel Zelle an Zelle; sein Netz entsteht in jedem Bild neu aus seiner
Haltung (`fliegerPose`) – er steht auf der Kanzel, breitet im Absprung Arme
und Beine aus, nimmt in der Kurve den inneren Arm zurück, der Stoff zittert
im Fahrtwind, und am Schirm greift er nach den Leinen.

Gezählt wird die Nähe zum Fels. Fliegen allein bringt einen Punkt je Sekunde
(`GRUND`). Wer näher als viereinhalb Meter an Wand, Turm, Pfeiler oder Tanne
vorbeizieht (`NAH`), bekommt mehr – je näher, desto steiler mehr, bis
sechsmal so viel unter anderthalb Metern (`GANZ_NAH`, `NAH_MAL`, `NAH_HOCH`). Dazu
die Serie, die als Zahl am Flieger steht: Sie steigt, solange der Fels nah
ist, bis ×1,6 (`SERIE_MAX`), und fällt, wenn man in der Mitte fliegt. Wer an
einer Nase, einem Turm, einem Pfeiler, einer Tanne oder durch einen Bogen
näher als 2,2 m vorbeikommt, fliegt «haarscharf» und bekommt 3 bis 8
Punkte mal die Serie (`HAAR`, `HAAR_PUNKTE`) – ein Ruck, und die Zeit hält
für einen Wimpernschlag den Atem an. Wer statt der breiten Seite den Spalt
neben einem Massiv nimmt, bekommt 12 mal die Serie (`SPALT_PUNKTE`). Nach
4300 m (`Z_ENDE`, 85 Sekunden) öffnet sich das Tal: Schirm auf, Landung auf
der Wiese, 30 Punkte dazu (`LANDE_PUNKTE`). Dorthin kommt nur, wer die Haken
am Schluss vorausahnt – ein Pilot mit gut einer Zehntelsekunde Reaktionszeit
schafft im Mittel rund 2600 m, mit einer Fünftelsekunde rund 2000 m (vorher
landeten beide meist im Tal). Um ein Massiv herum geht der Gang über gut
hundert Meter in die offene Seite über – rückte die Wand auf einmal heran,
stünde sie quer im Weg.
Den Fels sieht und hört man kommen: Auf seiner Seite glüht der Rand des
Bilds, Windstreifen ziehen dort vorbei, Staub und Steinchen lösen sich von
der Wand, und ein Rauschen wird lauter.

Wie die anderen würfelt es seine Welt aus `zufall.js`. Zuerst entsteht der
freie Weg (`wegBei`): Punkt für Punkt nie weiter zur Seite, als sich in der
Zeit lenken lässt – die Biegung der Schlucht selbst ist eingerechnet
(`reichBis`), verlangt wird am Anfang die Hälfte dessen, was der Flieger
zur Seite kann, am Schluss knapp drei Viertel (`anteilBei`). Darum herum
stellen die Abschnitte ihre Hindernisse, und auf der Breite `breiteBei(z)`
(von 9,5 m auf 5 m, `BREIT0`/`BREIT_MIN`) steht am Weg nichts: Die Wände
weichen dort zurück (`backe`), ein Turm wird schlanker (`raeumeWeg`). Die
Wände sind zwei Reihen von Knoten, alle vier Meter einer (`wandL`, `wandR`):
Dort steht der Fels auf Flughöhe, und genau diese Knoten sind auch Ecken
des gezeichneten Netzes – was man sieht, ist, woran man anstösst. Der
Abschnitt 4g28 in `npm run pruefen:browser` geht den Weg Meter für Meter ab
(frei auf seiner Breite, nie zu steil, hinten eng und hakig), ein Autopilot,
der die Kurven vorausnimmt, folgt ihm bis ins Tal, und wer nichts tut,
prallt nach rund zehn Sekunden an. Aufgezeichnet
werden Strecke, Seite und Schräglage (`a`, `b`, `c`; nach dem Aufprall
steht in `c` die Zahl 314; Fassung `t2` seit dem Gang); beim Anschauen
fliegt der Flieger denselben Weg durch dieselbe Schlucht. Die Gegner fliegen
als Flieger aus Licht mit.

**Gezeichnet wird mit WebGL 2** wie im Schwarm, in einem Durchgang und mit
sieben Programmen: die Wände, der Bach, alles Feste (ein Netz je Form, viele
Male gezeichnet: Türme, Brocken, Tannen, Pfeiler, der Flieger, sein Schirm),
der Himmel (danach – nur dort, wo noch nichts steht), die Bänder (Rauchfahne,
Windstreifen, Seile, Wasserfälle, Sonnenstrahlen), die Scheiben (Staub,
Lichter) und die Dohlen. Die Schlucht entsteht laufend in Kacheln von 64 m
(`kachelBauen`): je Seite ein Gitter vom Bachbett über das Ufer und die Wand
bis hinauf auf die Schulter des Bergs, dazu die Flanken eines Massivs und
das Band des Bachs; 22 Kacheln liegen im Speicher und werden mit einem
Aufruf gezeichnet. Wohin eine Fläche schaut, rechnet das Programm aus ihren
Ecken (kantig, wie gebrochener Fels); die Schichten, das Gras auf den
Bändern und der Schnee weiter oben folgen aus Höhe und Neigung. Wie viel
Sonne eine Ecke bekommt, wird beim Bauen der Kachel ausgerechnet
(`sonneBei`: ein Strahl zur Sonne, Stück um Stück über das Gelände) – so
liegt die eine Wand im warmen Licht und die andere im blauen Schatten, und
wo die Schlucht zur Sonne hin biegt, fällt das Licht bis auf den Bach.
Dunst macht Fernes hell, zur Sonne hin golden. Hochkant gehört die Höhe
den Wänden. Kommen die Bilder zu langsam, zeichnet das Spiel die Welt mit
weniger Bildpunkten (`gueteTakt`). Fünf Klänge, alle aus vorhandenen: der
Fahrtwind und das Rauschen des Felsens als Kulissen (die eine geht mit dem
Tempo, die andere mit der Nähe), ein Zischen bei «haarscharf», der Aufprall
und der Schirm.

Die Schrauben stehen oben in der Datei: `Z_ENDE`, `V0`/`V_MAX`,
`QUER0`/`QUER_ZU` und `TRAEG_AN`/`TRAEG_AB` (wie flink er zur Seite zieht),
`BREIT0`/`BREIT_MIN` (die Breite des freien Wegs – die Schraube für
«schwer»), die Punkte (`GRUND`, `NAH`, `GANZ_NAH`, `NAH_MAL`, `NAH_HOCH`,
`SERIE_…`, `HAAR`, `HAAR_PUNKTE`, `SPALT_PUNKTE`, `LANDE_PUNKTE`) und in
`abschnitt()`, ab wann welches Hindernis vorkommt.

### Die Klänge

Bis Oktober 2026 klangen die Spiele wie die Kinder-App (`kids.js`,
`playJingle`). Jetzt hat jedes Spiel eigene Klänge, ausgewählt auf einer
Klangauswahl mit 442 Vorschlägen für 109 Plätze. Gespielt werden sie von
`klang.js` (`window.ArcadeKlang`):

    ArcadeKlang.ton("punkt")                 einheitlich für alle Spiele
    ArcadeKlang.ton("ball.kick", { laut })   der eigene Klang eines Spiels
    ArcadeKlang.kulisse("huegel.wind")       eine Schleife: setze(0…1), laut(0…1), stop()

**Für alle Spiele gleich** sind Punkt, Perfekt, Meilenstein, Fehler, die
Tafel nach der Runde, der eigene Rekord (ein eigener, festlicher Klang, wenn
der Bestwert fällt), Gegner überholt, der Countdown im Multiplayer, Knöpfe
und Fenster. Tafel/Rekord und Stille kommen aus der Bühne (`game-shell.js`),
Überholen aus `geist.js`, der Countdown aus `live-spiel.js`; den Rest ruft
das Spiel selbst.

**Weniger ist mehr.** Ein Klang kommt zu dem, was man tut (Block landet,
Liane gepackt), zu einem perfekten Zug – und dann nur zum ersten in Folge –
oder wenn etwas geschafft ist: die Scheibe, der Teich, das Schiff, der Raum,
«On Fire», ein Ring. Nie nur, weil eine Zahl erreicht ist (alle 10 Blöcke,
alle 100 m) oder eine Runde beginnt. Eine «Serie», die mit jedem Perfekt
einen Ton höher stieg, und einen Ton zum Rundenstart gab es kurz; sie waren
zu viel.

**Je Spiel** gibt es eigene Klänge (Kick, Tor, Platsch, Schnitt, Echo-Ruf …)
und leise **Kulissen**, die mit dem Spiel gehen: der Motor mit dem Tempo, der
Wind mit der Schicht, der Brenner nur solange gedrückt, der Fahrtwind des
Turmspringers im Fall, der Herzschlag des Ninjas mit der Weltzeit, das Meer
des Freitauchers mit der Tiefe und sein Herz, sobald die Luft knapp wird.
Ein sauberes Eintauchen klingt nach einem leisen Plopp, ein Klatscher nach
Platsch. Der Schwarm hat seinen Fahrtwind, ein Flattern, wenn Vögel
am Fels hängen bleiben, ein kurzes Rauschen beim Ballen, eine Perle für
jedes perfekte Tor, ein Zwitschern für jeden Trupp, den Schrei des Falken
(im Browser erzeugt: `schrei`) und einen dumpfen Schlag, wenn die Mitte am
Fels zerschellt. Eine Kulisse startet mit der
Runde und endet mit ihr; die Tafel hält alle an (`stille()`).

**Woher:** 47 kurze Aufnahmen aus freien Sammlungen (Kenney, OpenGameArt –
alle CC0) liegen als MP3 unter `klang/` und werden je Spiel vorgeladen; der
Rest entsteht im Browser (Glocken, 8-Bit-Töne, Wind, Schnee, Motoren). Alles
ist auf dieselbe Lautheit gebracht (Einmal-Klänge −20 dB, Kulissen −27 dB,
gemessen) und läuft über einen leisen Hauptregler mit Begrenzer: Die Klänge
sollen begleiten, nicht übertönen. Der Ton-Schalter oben rechts (`kids.js`)
gilt auch hier – beide spielen über denselben AudioContext. `npm run pruefen`
hält fest, dass jedes Spiel alle seine Plätze benutzt und keinen alten
Kinder-App-Klang mehr.

### Das Aussehen: dunkel, überall

Alle Seiten – Startseite, Turnier, Spiele, Multiplayer, Adminbereich – stehen
auf demselben dunklen Grund. Die Farben stehen einmal oben in `styles.css`
(`:root`): `--ar-grund` (#0d0c11), die Flächen `--ar-flaeche` und
`--ar-flaeche-hoch`, das Glas über Bildern (`--ar-glas`, mit Unschärfe), die
Schrift `--ar-text` und `--ar-leise`, dazu Koralle, Gold und Grün für das,
was hervorsticht. Knöpfe über einem Spiel oder einem Bild sind aus dunklem
Glas, damit sie auf jedem Hintergrund lesbar bleiben.

**Das Logo** sind die zwei Winkel von alae.app als 8-Bit-Figur – dieselben
Blöcke wie im App-Icon – mit «arcade» daneben (`mini-games.js`, `marke`). Es
steht oben auf jeder Seite mit eigenem Kopf und führt zur Startseite.

**Ein geteilter Link** (WhatsApp, Signal, iMessage) zeigt eine Vorschau: den
Titel der Seite («Multiplayer · arcade»), einen kurzen Satz und das Logo
(`icons/vorschau.jpg`, 1200 × 630, Logo in der Mitte, damit es auch
quadratisch beschnitten ganz bleibt). Die Angaben stehen im Kopf jeder Seite
(`scripts/seiten-bauen.mjs`, `kopf`, `og:`); das Bild braucht eine volle
Adresse und zeigt deshalb immer auf `games.alae.app`. Der Satz bleibt kurz:
bei den Spielen ihr Text ohne den Namen davor, bis zum ersten
Gedankenstrich (`kurzText`). «Teilen» im Multiplayer schickt nur seinen
Namen mit – was es ist, sagt die Vorschau.

### Die Startseite: arcade

Dunkel und ein Bildschirm ohne Scrollen – fürs Handy gemacht,
hoch wie quer (`mini-games.js`, `baueUebersicht`; die Bühne selbst,
`arcadeBuehne`, steht genauso auf der Turnierseite):

- **Das Bild:** das Spiel mitten in einer Runde, in einem Fenster in seiner
  eigenen Form – hochkant 9:16, quer 16:9 –, so gross, wie es geht, ohne
  Rand darin. Es steht das Bild (quer oder hoch), dessen Form dem Fenster
  näher ist, und es füllt es (`filmFuer`). Braucht quer die Leiste daneben
  Platz (Tablet), wird das Fenster schmaler und niedriger und bleibt 16:9 –
  sonst fiele links und rechts ein Stück Bild weg, samt der Zahl oben links. Ein Tipp aufs Bild startet das
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
  Fenster, siehe unten), wo es geht «Als App installieren», der Name (ein
  Tipp ändert ihn) und das Vollbild. Links das Logo: die Pixel-Winkel und
  «arcade».

**Die Gesamtwertung** (`mini-games.js`, `gesamtwertung`, `gesamtTafel`). Der
Platz im Schnitt allein ist nicht fair: Platz 2 von zwei zählte wie Platz 2
von zwanzig, und wer ein einziges Spiel gespielt hat, stand vor jemandem mit
vierzehn. Die Zahl der Siege auch nicht: Wer mehr spielt, sammelt mehr.
Deshalb zählen **Duelle**: Jedes Spiel ist eine Reihe davon – wer in der
Rangliste hinter dir steht, hat gegen dich verloren, wer vor dir steht,
gewonnen, wer gleich viel hat, teilt es. Die **Wertung** ist der Anteil
gewonnener Duelle (0–100); ein grosses Feld zählt so mehr als ein kleines, und
wer allein in einem Spiel steht, hat dort keines. Dazu kommen sechs Duelle,
die als geteilt zählen (`AUSGLEICH`): Wer erst wenige hat, steht nahe der
Mitte, auch wenn er alle gewonnen hat. Mehr Spiele heben niemanden, der nicht
besser spielt – ein Anteil bleibt ein Anteil. Siege und Podest stehen als
Anteil an den eigenen Spielen da.

Gezählt werden genau die Spiele, die auf der Startseite stehen (was der
Adminbereich angehakt hat) – die Tiers kennt nur der Admin, sie spielen hier
keine Rolle. Im Fenster stehen das Podest wie im Turnier und die Tabelle:
Wertung, Spiele, Ø Platz, Siege, Podest, jede Spalte mit einem Tipp
sortierbar. Wonach sortiert ist, merkt sich das Gerät (`mini.gesamt`). «So
wird gerechnet» klappt die Erklärung auf.

**Ein Tipp auf einen Namen** (in der Tabelle oder auf dem Podest) zeigt im
selben Fenster seine Karte (`spielerKarte`): Platz und Wertung, wie viele
Spiele von allen, Platz im Schnitt, wie oft vorne und auf dem Podest; seine
besten Spiele (nach den gewonnenen Duellen, mit Ausgleich – Platz 2 von 6 vor
Platz 1 von 2); was er am meisten spielt, als Balken **ohne Zahl** (wie oft
jemand spielt, geht niemanden etwas an); alle seine Spiele nach dem Platz und
die, die er noch nie gespielt hat. Jedes Spiel darin führt zum Spiel.

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
  3 Versuche je Spiel». Davor, nur bei einem öffentlichen Turnier, das Logo
  als Weg zur Startseite (schmal nur die Figur). Eines nur mit Link bleibt
  ohne – ein Raum für sich –, ebenso jedes in seiner eigenen App.
- **Die Gesamtwertung** über alle Spiele, golden und gross – im Turnier zählt
  sie mehr als jede einzelne Liste: der Pokal und die ersten drei, daneben
  der eigene Platz, wer weiter hinten steht («Du 5.»). Schmal steht sie unter
  dem Namen, breit (und auf dem Handy quer) daneben. Ein Tipp öffnet sie im
  Fenster, mit zwei Reitern oben (`turnier.js`, `gesamtZeigen`):
  «Gesamtwertung» zeigt die Beschreibung des Turniers, ein Podest – Platz 1
  in der Mitte und am höchsten, mit Krone, links der Zweite, rechts der
  Dritte – und darunter alle weiteren Ränge, je nur Name und Schnitt
  (`gesamtAnsicht`). Ein Tipp auf einen Rang klappt auf, woraus sich sein
  Schnitt zusammensetzt: der Platz in jedem Spiel, die Rechnung
  («Ø Platz 2,33: (2 + 3 + 2) ÷ 3») und wie gezählt wird. «Spiele» zeigt
  jedes Spiel mit seiner ganzen Rangliste, mit dem ▶ zum Anschauen, dazu die
  Multiplayer, die schon gezählt haben (`spieleAnsicht`). Verdeckt steht
  dort nur, wie viele dabei sind.
- **Wer gerade spielt**, steht neben der Gesamtwertung als ein Knopf
  **«● 3 live»** – er steht, solange jemand spielt, und ändert nur seine
  Zahl. Ein Tipp öffnet die Liste: je eine Karte «Joshua spielt Turmbau»,
  mit den Punkten, die er gerade hat, und «Zuschauen». Im Fenster der
  Gesamtwertung trägt sein Kreis einen grünen Punkt, und in der Liste des
  Spiels steht er markiert. Siehe «Wer gerade spielt» unter Turniere. Bis
  Oktober 2026 stand hier eine Leiste mit einer Karte je Spieler, dazu ein
  Satz unter dem Spiel, Namen auf den Kacheln und Punkte am Podest – bei
  sechs Spielern am selben Abend kam und ging dort dauernd etwas.
- **Läuft gerade ein Multiplayer** zum Turnier, steht daneben «Multiplayer
  läuft» mit dem Weg hinein – und kommt er neu dazu, geht einmal ein Fenster
  auf («Mitspielen» oder «Später»; je Multiplayer einmal, `sessionStorage`).
  In den Spielen des Turniers steht er als Band unten, ausser während einer
  Runde (`turnier.js`, `liveBand`).

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
                    Seiltänzer, Heisser Draht, Ball hochhalten,
                    Turmspringen, Fallschirm, Fledermaus,
                    Zeitlupen-Ninja, Freitaucher.
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
Bild dort, wo sie damals war (`geist.js`, `zuschauer`). Wo das Spiel eine
Uhr hat (Lianenschwung, Hügelflieger, Blätter im Strom), läuft sie mit – so
weit wie die Runde des anderen, auch im Multiplayer, wo man erst mittendrin
zuschaut (`startClock(rest, fertig, gesamt)` in `game-shell.js`). Oben steht,
wessen Lauf das ist, und «Beenden» – jederzeit. Am Schluss eine Tafel mit «Nochmal»
und «Zurück». Welche Fassung der Aufzeichnung zu welchem Spiel gehört, steht
in `ANSEHBAR` (`mini-games.js`); `npm run pruefen` hält sie mit den Spielen
gleich. Läufe von vor dieser Fassung haben keine Saat – sie lassen sich erst
nach dem nächsten Rekord anschauen (der Lianenschwung braucht keine, seine
Strecke ist fest).

Die elf Spiele ohne Figur im Bild (Turmbau, Brückenbauer, Drehscheibe,
Fischteich, Kacheln-Knobeln, Wo hält der Zug?, Der Heizer, Blätter im Strom,
Kranhafen, Jongleur, Holzfäller)
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

**Zu jeder Bestmarke ihr Lauf, in jedem Modus.** Ob allein, im Turnier oder
im Multiplayer: Jede Runde geht über `melde` in die Hall of Fame, und beim
Rekord geht der Lauf gleich nach der Punktzahl hinauf – nicht erst nach der
Liste, die danach gelesen wird. Trotzdem kann die Seite schneller weg sein
(im Turnier sofort zurück zur Übersicht, im Multiplayer die nächste Runde,
die App weggewischt): Dann ist die Zahl oben und der Lauf nicht. Deshalb
steht er vorher auf dem Gerät (`mini.ausstehend`) und wird erst gestrichen,
wenn er angekommen ist. Was liegen bleibt, holt die nächste Seite nach,
sobald sie geladen ist (`nachreichen`) – dazu die besten Läufe, die
`geist.js` ohnehin auf dem Gerät behält (`mini.lauf`, auch die der anderen
Namen auf diesem Gerät). Ein Lauf gehört zu dem Eintrag mit demselben Namen
(oder derselben Kennung) und genau seiner Zahl; so findet er ihn auch, wenn
der Adminbereich den Eintrag unter eine andere Kennung zusammengeführt hat.
Fehlt dort der Lauf oder liegt nur ein schwächerer, geht er hinauf; ein
überholter Lauf wird nicht mehr gebraucht. Was nachgesehen ist, merkt sich
das Gerät (`mini.lauf.nachgesehen`) und fragt erst wieder, wenn der Lauf
besser geworden ist. Gefragt wird dafür nach dem Namen und nach der eigenen
Kennung, nie nach ganzen Listen. Das Zusammenführen im Adminbereich bricht
ab, wenn sich ein Lauf nicht lesen lässt, statt den Eintrag samt Lauf zu
löschen.

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
eine Nachbesserung an der Physik, Eingaben nicht. Dreissigmal je Sekunde
(wie beim Live-Zuschauen), genau auf den Takt gerechnet (zwischen zwei
Bildern, statt das nächste Bild zu nehmen), und gespeichert als Schritte von
Probe zu Probe, die Schritte als Text (`v: 4`, Base64-VLQ wie in den
Quellkarten der Browser, Wiederholungen als `~` und Anzahl): meist ein
Zeichen je Zahl. Zwei Minuten Flug brauchen so um 7 400 Zeichen – gut drei
Minuten passen in die Grenze von 12 000, ohne dass die Regeln sie anheben
müssen; erst ein längerer Lauf wird verdichtet (jede zweite Probe). Abgespielt
wird auf derselben weichen Kurve wie die Geister im Multiplayer (`geist.js`,
`kurve`) – so läuft der Lauf so flüssig wie damals. Ältere Aufzeichnungen
(viermal je Sekunde als Zahlen, `v: 1`; zehnmal als Liste von Schritten,
`v: 2`) laufen auf derselben Kurve; genauer wird es mit dem nächsten Rekord. Sie stehen in einer eigenen
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

    Spiele            welche dazugehören, eines bis alle siebenunddreissig
    Wann              Beginn und Dauer (30 Minuten bis ein Monat), ein
                      eigenes Ende – oder ohne Zeitlimite
    Versuche          je Spiel unbegrenzt, eine feste Zahl, getippt
                      (1 bis 100) – oder nur, wer nicht vorne liegt
    Was zählt         der beste Versuch oder alle zusammen
    Gesamtwertung     Platz im Schnitt (der Durchschnitt der Plätze aus den
                      gespielten Spielen, der kleinste gewinnt) oder Prozent
                      vom Besten (der Beste eines Spiels bekommt 100, die
                      anderen ihren Anteil; der höchste Schnitt gewinnt)
    Aufgaben          für alle gleich, gleiches Level wie der 1. Platzierte
                      oder jedes Mal neu gewürfelt
    Wer es sieht      alle in der App (auf der Startseite, bis zwölf Stunden
                      nach dem Ende) oder nur, wer den Link hat
    Verdeckt          die Rangliste erst am Schluss zeigen
    Gegner            Platz 1 und die eigene Bestmarke beim Spielen zeigen
                      (Vorgabe) oder nicht
    Replays           den besten Lauf jedes Spielers im Turnier anschauen
                      lassen (der ▶ in den Listen, Vorgabe) oder nicht –
                      dann auch nicht über eine von Hand getippte Adresse
    Aktiv             angehalten, bis es gebraucht wird – "Jetzt starten",
                      "Anhalten", "Jetzt beenden" gehen mit einem Klick

**Der Link.** Von selbst ist er ein Stück vom Namen und acht Zeichen Zufall:
`/turnier?t=herbstcup-k3m9x2p7` – bei einem Turnier «nur mit Link» ist der
Zufall der Schlüssel. Wer will, wählt beim Anlegen einen eigenen, kurzen:
«Eigener Link» und `hotdog` ergibt `games.alae.app/hotdog`. Er ist zugleich
die Kennung des Turniers, also 6 bis 48 Zeichen aus a–z, 0–9 und dem
Bindestrich (`firestore.rules`, `istTurnier`); was getippt wird, wird dazu
(«Hot Dög!» → `hot-doeg`). Das Formular sagt gleich, ob er frei ist. Nicht
gehen: ein Name, den schon ein Turnier hat (es würde überschrieben), und einer,
unter dem schon eine Seite liegt (`/turmbau`, `/live`, …) – dort käme Netlify
gar nicht erst zur Weiterleitung. Ändern lässt sich der Link danach nicht mehr:
Er ist verschickt, und die Einträge hängen an ihm. Und kurz heisst auch leicht
zu erraten – für ein Turnier «nur mit Link» ist der automatische sicherer.

Wie `/hotdog` zum Turnier findet: Unter dieser Adresse liegt keine Datei, also
liefert Netlify `404.html` aus (ohne eine Zeile in `netlify.toml`). Die sieht
nach: Sieht die Adresse aus wie die Kennung eines Turniers, geht es sofort
weiter auf `/turnier?t=hotdog`; gibt es das Turnier nicht, sagt das die
Turnierseite. Eine Seite, die es gibt, nur gross geschrieben (`/Turmbau`),
führt zu ihr, alles andere bleibt «nicht gefunden» (`scripts/seiten-bauen.mjs`,
`weiterSeite`). «Link kopieren» im Adminbereich gibt den kurzen Link weiter
(`turnier.js`, `volleAdresse`, `eigenerLink`: ein Link ohne den Zufall hinten
ist ein eigener); innerhalb der arcade führen alle Wege weiter direkt auf
`/turnier?t=…`, ohne den Umweg.

**Die Vorschau eines Turnierlinks.** Wer einen Link in WhatsApp, Signal oder
iMessage schickt, bekommt darunter ein Kärtchen: das Bild, einen Titel, einen
Satz, die Adresse. Das liest der Messenger aus dem HTML (`og:title`,
`og:description`), ohne ein Skript laufen zu lassen – und `turnier.html` ist
für alle Turniere dieselbe Datei. Den Namen setzt deshalb eine Netlify Edge
Function ein, beim Ausliefern (`netlify/edge-functions/turnier-vorschau.js`):

    Bild      das Logo (icons/vorschau.jpg), wie bisher
    Titel     der Name des Turniers                    «HotDog Party»
    Satz      die Beschreibung des Turniers (gekürzt) – hat es keine, steht
              hier nichts. Kein «Turnier · arcade»: Wer den Link bekommt,
              kennt die arcade meist gar nicht.
    Adresse   games.alae.app

Den Namen liest sie über die REST-Schnittstelle von Firestore, so wie ihn
jeder lesen darf, der den Link hat. Ein eigener Link (`/hotdog`) geht dort
schon auf dem Server weiter (302 auf `/turnier?t=hotdog`), so bekommt auch er
die Vorschau mit Namen. Klappt etwas nicht (kein Turnier, Firestore zu
langsam), kommt die Seite, wie sie ist, mit dem allgemeinen Satz
«Mitspielen mit einem Tipp – ohne Anmeldung.» WhatsApp merkt sich eine
Vorschau eine Weile – ein Link, der schon einmal verschickt wurde, zeigt
vielleicht noch eine Zeit lang die alte. Geprüft wird die Function ohne
Netlify in `scripts/pruefen.mjs`.

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

**Wer weniger spielt, hat keinen Nachteil.** Die Gesamtwertung zählt nur,
was jemand gespielt hat: den Durchschnitt seiner Plätze (oder seiner
Prozente) über die gespielten Spiele, Multiplayer mit ihrem Gewicht (×2 zählt
wie zwei Spiele; `turnier.js`, `gesamtwertung`). Bei gleichem Schnitt steht
vorne, wer mehr gespielt hat – den Platz teilen sie sich trotzdem. Bis
Oktober 2026 zählte ein ausgelassenes Spiel als Platz hinter dem Letzten;
wer später dazukam, lag damit fast sicher hinten. Die Kehrseite: Wer nur das
eine Spiel spielt, das er am besten kann, und dort gewinnt, steht mit
Ø 1 ganz vorne.

**Wer gerade spielt.** Jede Runde legt einen kleinen Zettel in die Realtime
Database (`geist.js`, «Live mitschauen: senden»; `cloud.js`, `amSpielen`):
im Turnier nach `turnierAmSpielen/<turnier>/<kennung>` – `name`, `spiel`,
`p` (die Punkte gerade), `lebt`, am Ende `fertig`. Beim Start sofort, mit
neuen Punkten höchstens alle zwei Sekunden, sonst alle zehn, solange die
Runde im Bild ist. Die Turnierseite hört die Zettel ihres Turniers als Strom
(`amSpielenHoeren`, EventSource): Wer beginnt, steht eine Sekunde später da,
ohne Neuladen – auch auf dem Handy; kommt die Seite aus dem Hintergrund
zurück und ist der Strom eingeschlafen, verbindet sie neu. Wer seit 25
Sekunden nichts gesagt hat, spielt nicht mehr (`mini-games.js`,
`zettelLeser`; gezählt wird, wann dieses Gerät eine Änderung sah, nicht die
Uhr des Spielers). Wer eine Runde beendet hat, bleibt noch eine Minute
«zwischen zwei Runden» dabei – sonst käme und ginge er mit jeder Runde. Wer
die Seite mitten in der Runde verlässt, nimmt seinen Zettel mit und ist
sofort weg. Sich selbst sieht niemand unter «live»: Der eigene Zettel zählt
nicht zu denen, die spielen – weder der dieses Geräts noch einer unter
demselben Namen von einem anderen (`mini-games.js`, `werIch`; so wie die
Rangliste «Du» erkennt). «Live» zeigt die anderen, auf der Startseite wie
auf der Turnierseite. Der Zettel geht beim Beginn, am Ende, alle 15 Sekunden und mit
neuen Punkten höchstens alle 5 Sekunden hinaus (`geist.js`). Die Ergebnisse kommen über einen eigenen Strom
(`cloud.js`, `turnierHoeren`, siehe «Ohne Netz»).
Solange die Rangliste verdeckt ist, stehen keine Punkte auf dem Zettel. Die
Zettel gibt es in jedem Turnier, auch wo sich nicht zuschauen lässt – dann
nur ohne «Zuschauen».

**Live zuschauen.** Wer gerade spielt, ist auf der Turnierseite ein Weg zum
Zuschauen: «Zuschauen» in der Liste hinter «live», im Reiter «Spiele» – und im Fenster der
Gesamtwertung steht bei jedem Rang «Live zuschauen» (oder, spielt er gerade
nicht, «Zuschauen»). Das öffnet sein Spiel im **Beobachtungsmodus**
(`/<spiel>?mitschauen=<kennung>&aus=<turnier>`, `geist.js`, `mitschauer`):
dieselbe Welt (die Saat seiner Runde), dieselbe Figur, dieselben Züge, gut
anderthalb Sekunden hinter ihm. Der Modus folgt dem Spieler, nicht dem Spiel,
und bleibt, bis jemand «Beenden» tippt: Beginnt er eine neue Runde, lädt die
Seite mit ihrer Welt neu – in einem anderen Spiel geht sie gleich dorthin.
Spielt er gerade nicht (Runde zu Ende gespielt, oder seit 15 Sekunden nichts
mehr gehört), steht nur «<Name> spielt gerade nicht», darunter, was er
zuletzt hatte.

Geschrieben wird das von der laufenden Runde selbst (`geist.js`, «Live
mitschauen: senden»), aus denselben Stellen, die auch den Lauf fürs Replay
aufzeichnen (`fuer` und `zuege`): der Ort der Figur dreissigmal
je Sekunde, in den Spielen ohne Figur jeder Zug – alle halbe Sekunde ein
Stück in die Realtime Database, **aber nur, wenn jemand zuschaut**: Bis
dahin bleiben die Proben auf dem Gerät; meldet sich der erste Zuschauer an
(`zuschauer/<spieler>`, siehe «Wer mir zuschaut»), geht die Runde von Anfang
an hinaus und danach im Takt (`mitschauenWecken`). Bis Oktober 2026 schickte
jedes spielende Gerät zweimal je Sekunde, ob jemand zusah oder nicht
(`turnierMitschauen/<turnier>/<kennung>`:
`name`, `runde` mit Spiel und Saat, `teile`, `ende`, `lebt`; über die
REST-Schnittstelle ohne SDK, `cloud.js`, `mitschauenSchreiben`). Wer
zuschaut, hört per Streaming mit (`mitschauenHoeren`, EventSource). Die
Realtime Database rechnet nach Datenmenge, nicht nach Anfragen: Ein
Zuschauer lädt um 5 MB je Stunde, frei sind 360 MB am Tag. Je Spieler und
Turnier steht nur die letzte Runde da; die nächste überschreibt sie.

Wie das Anschauen der besten Läufe gibt es das nur, wo das Turnier Replays
zulässt (`ohneReplay`), und nicht, solange die Rangliste verdeckt ist –
geschrieben wird dann gar nicht erst (`mitschauenErlaubt`). Und gar kein
Live gibt es, wo der Adminbereich «Live und Zuschauen» abgeschaltet hat
(`ohneLive`, `turnier.js` `liveErlaubt`): Dann gehen auch keine Zettel
hinaus, der Knopf «live» fehlt, und während einer Runde schickt das Gerät
nichts ausser dem Ergebnis – das Ruhigste für viele Geräte in einem
schwachen WLAN. Die Regeln
(`database.rules.json`) lassen nur genau diese Form zu, unter einer Kennung,
wie bei den Spielern eines Multiplayers.

**Zuschauen in der App.** Dasselbe gibt es ausserhalb der Turniere: Wer mit
Namen spielt, steht auf der Startseite – oben im Knopf «live» und in der
Liste dahinter («Alain spielt Turmbau», Punkte, «Zuschauen») und in der
Rangliste bei seinem Namen. Jeder dieser Wege öffnet den Beobachtungsmodus
ohne Turnier (`/<spiel>?mitschauen=<kennung>&wer=<name>`); er folgt dem
Spieler durch alle Spiele der App, bis «Beenden» zurück zur Startseite führt.
Die Runde schreibt dafür nach `mitschauen/<kennung>` (dieselbe Form wie im
Turnier) und legt ihren Zettel nach `amSpielen/<kennung>`. Ohne Namen geht
nichts hinaus, ebenso wenig im Multiplayer (der hat sein eigenes Zuschauen).

**Wer mir zuschaut.** Schaut jemand zu, steht beim Spieler unten links im
Bild, klein und mit grünem Punkt: «Alain schaut gerade zu» (mehrere: «Alain
und Zoe schauen gerade zu»; wer keinen Namen hat, ist «jemand»). Nur ein
Hinweis – nicht anklickbar, und wo ein Spiel unten Knöpfe hat (Slalom,
Fallschirm, Fledermaus), steht er darüber (`--gz-unten`). Der
Beobachtungsmodus meldet sich dafür beim Spieler an (`geist.js`,
`mitschauer`; `cloud.js`, `zuschauerMelden`, nach
`zuschauer/<spieler>/<kennung>`: `name`, `lebt`) – alle zehn Sekunden neu,
solange er im Bild ist, und beim Gehen ab. Wer noch keine Kennung hat,
bekommt eine für dieses Fenster. Die Spielseite hört das als Strom
(`zuschauerHinweis`, `zuschauerHoeren`); wer seit 25 Sekunden nichts gesagt
hat, schaut nicht mehr zu. Wie der Zettel nur mit Namen und nie im
Multiplayer.

«live» auf der Startseite zeigt dazu, wer in einem **öffentlichen**
Turnier spielt, das gerade läuft – «Joshua spielt Fischteich, im Turnier
Herbstcup» –: Sie hört auch die Zettel dieser Turniere (`turnier.js`,
`oeffentlichLaufend`; die Liste frisch alle fünf Minuten). Ein Turnier «nur
mit Link» kennt die Startseite gar nicht, es bleibt für sich. Umgekehrt
zeigt die Turnierseite nur, wer in diesem Turnier spielt, nie die App. Der
Knopf steht nur, wenn jemand spielt, und nimmt der Seite keinen Platz weg:
Das Bild bleibt gleich gross.

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
«Schon mal üben», kein Link zur Hall of Fame. Einzig ein öffentliches
Turnier trägt oben links das Logo, den Weg zur Startseite – es steht ja
ohnehin dort; eines nur mit Link nicht. Wer allein vorne liegt oder alle
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
zuvorderst (`mini.turniere`, höchstens zehn) – wie die öffentlichen bis zwölf
Stunden nach seinem Ende (`NACHLESE_MS`; bis Oktober 2026 waren es drei
Tage). So findet es auch, wer die App
schon installiert hat und den Link nur einmal angeklickt hat. Auf Android
teilen sich Browser und installierte App diesen Speicher; auf dem iPhone
kennt die App auf dem Startbildschirm nur, was in ihr selbst geöffnet wurde.

**Deine Turniere.** Wer auf der Startseite oben rechts auf seinen Namen
tippt, sieht unter «Du spielst als …» die Turniere, in denen auf diesem
Gerät gespielt wurde – die laufenden zuerst, dann die zuletzt beendeten,
je mit dem eigenen Platz in der Gesamtwertung (`turnier.js`,
`meineTurniere`; höchstens acht). Dabei ist ein Turnier, sobald hier ein
Versuch beginnt oder die Turnierseite den eigenen Namen in der Wertung
findet (`mini.turniere.dabei`). Gemerkt wird auf dem Gerät: Ein Konto gibt
es nicht, und über alle Turniere hinweg nach einem Namen zu fragen, liessen
die Regeln nicht zu. Auf der Turnierseite steht die Liste nicht – dort bleibt
das Turnier ein Raum für sich.

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

**Die anderen im Bild.** In den achtzehn Spielen mit Figur (Lianenschwung,
Tunnelflug, Drift-Rennen, Planetenhüpfer, Mondlandung, Schwerkraft-Läufer,
Hügelflieger, Windschichten, Slalom, Froschsprung, Seiltänzer, Heisser Draht,
Ball hochhalten, Turmspringen, Fallschirm, Fledermaus, Zeitlupen-Ninja,
Freitaucher)
misst jedes Gerät dreissigmal je Sekunde, wo seine Figur ist, und schickt
das zehnmal je Sekunde hinaus (`lage`): die neueste Probe in `t`, `a`, `b`,
`c`, `p`, die zwei davor als kurzer Text in `v` («Abstand,a,b,c,p;…»). So
sehen die anderen jede Bewegung so fein wie im Replay, und die Datenbank
trägt etwa ein Drittel mehr als vorher, nicht das Dreifache – sie rechnet
nach Datenmenge, und jede Lage geht an jedes Gerät der Runde. Ein Gerät mit
einer älteren Fassung lässt `v` einfach liegen. Die anderen laufen als
Geister mit – wer vorne liegt in Gold –,
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
Kacheln-Knobeln, Fischteich, Heizer, Zahlengleis, Jongleur, Holzfäller) gibt es nichts, dem eine
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
zählt: wie ein Spiel, doppelt, dreifach oder gar nicht. Solange er offen
ist, steht auf der Turnierseite oben «Multiplayer läuft» mit dem Weg hinein,
beim ersten Mal auch in einem Fenster, und in den Spielen des Turniers als
Band unten (`turnierLive/<turnier>` in der Realtime Database, gelesen ohne
SDK) – auch wenn er nur mit Link offen ist: Wer im Turnier spielt, soll ihn
sehen. «Nur mit Link» nimmt ihn dann nur von der Startseite. «Ins Turnier
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

## Ohne Netz

Gespielt wird auch ohne Netz – in der installierten App und im Browser, sobald
die Seite einmal mit Netz offen war: Dann liegen alle Seiten und Skripte im
Service Worker (`service-worker.js`), auch das Firebase-SDK. Bilder und Klänge
kommen dazu, sobald sie einmal geladen wurden.

**Eine Runde ohne Netz wartet auf dem Gerät** (`mini-games.js`, «Ohne Netz»):
`mini.wartet` hält Kennung, Name, Punkte, Dauer, die Uhrzeit, zu der sie zu
Ende war, und woher sie kam – auch wenn das Netz erst beim Eintragen wegbricht
(ein Fehler wie `unavailable`, nicht eine Absage der Regeln). Der Bestwert auf
dem Gerät gilt sofort, und unter dem Ergebnis steht «Ohne Netz gemerkt – die
Runde kommt in die Liste, sobald du wieder online bist.» Oben rechts auf der
Start- und der Turnierseite steht dann «Offline» (`offlineZeichen`).

**Zurück im Netz geht sie hinaus** (`sendeWartende`): wenn das Ereignis
«online» kommt, wenn die Seite wieder vorne ist und beim nächsten Laden – die
Startseite wartet darauf, bevor sie die Listen liest. Die Runden gehen
nacheinander über denselben Weg wie jede andere (`cloud.js`, `speichere`), mit
`offline: true`, ihrer eigenen Uhrzeit und ihrer Quelle: In `miniScores` zählen
sie wie gleich gespielt, die Uhr des Eintrags geht dabei nie zurück, und im
Rundenprotokoll stehen sie zu ihrer Zeit. Die Regeln lassen dafür bis zu 30
Tage zurück zu (`ohneNetzGespielt`); was älter ist, zählt in der Liste, nur
ohne Protokoll. Ist die Kennung inzwischen umgezogen (Umzüge), geht die Runde
dorthin. Was wartet, geht vor einer neuen Runde hinaus – die Reihenfolge
bleibt. Weist die Datenbank eine Runde ab (ein Spiel, das es nicht mehr gibt),
fällt sie weg, statt ewig zu warten.

**Die Listen ohne Netz** zeigen, was das Gerät zuletzt gesehen hat
(`mini.listen`, bei jedem Lesen nachgeführt), mit den eigenen wartenden Runden
darin (`mitWartenden`). Firestore antwortet ohne Netz aus seinem leeren
Zwischenspeicher; `cloud.js` (`ergebnisse`) zählt eine solche Antwort nicht
und wirft, wenn kein Spiel vom Server antwortet – sonst sähe die Liste aus wie
«noch niemand gespielt».

**Turniere ohne Netz.** Auch im Turnier wartet niemand auf die Datenbank
(`turnier.js`). Bis Oktober 2026 schon: Vor jeder Runde las die Spielseite
das Turnier frisch, meldete den Versuch per Transaktion an, und ohne Antwort
hiess es «Das Turnier ist gerade nicht zu haben» oder «zählt nicht fürs
Turnier» – an einem Abend mit sechs Geräten in einem Keller mit schwachem
WLAN konnte so kaum jemand spielen. Jetzt:

- **Das Turnier steht auf dem Gerät** (`mini.turnier.stand`, `gemerkterStand`):
  das Turnier, seine Einträge und seine Multiplayer. Turnierseite und
  Spielseite zeichnen sofort daraus; der Server frischt im Hintergrund auf.
  Nur wer das Turnier noch nie gesehen hat, braucht das Netz – die Seite
  versucht es dann von selbst weiter (3, 6, 12 … Sekunden).
- **Der Postausgang** (`mini.turnier.post`): Ein Versuch steht dort, bevor
  die Runde beginnt, ihr Ergebnis, sobald sie fertig ist. Hinaus geht es der
  Reihe nach, je Eintrag streng in der Reihenfolge der Runden (Beginn,
  Ergebnis, nächster Beginn) – sobald eine Runde beginnt oder endet, beim
  Laden jeder Seite, wenn das Netz zurückkommt, wenn die Seite wieder vorne
  ist und alle halbe Minute, solange etwas wartet. Mehrere Fenster teilen
  sich eine Sperre (`navigator.locks`). Unter dem Ergebnis steht sofort die
  Liste, wie das Gerät sie kennt – mit dieser Runde (`mitPost`); dauert es,
  dazu «Gespeichert – kommt ins Turnier, sobald die Verbindung steht». Oben
  rechts steht «Wird hochgeladen» (schmal: ein Pfeil). Neu laden hilft nicht
  gegen einen verbrauchten Versuch: Er steht schon im Postausgang.
- **Später heisst nicht zu spät:** Die Regeln nehmen einen Versuch, der laut
  seiner Uhr im Turnier gespielt wurde, bis zwei Stunden nach dem Schluss
  noch an (`firestore.rules`, `darfBeginnen`; `cloud.js` schickt die Zeit der
  Runde mit).
- **Die Turnierseite hört zu, statt zu fragen** (`cloud.js`, `turnierHoeren`,
  Firestores onSnapshot): Der ganze Stand kommt einmal, danach nur, was sich
  ändert. Bis Oktober 2026 las jedes Gerät das ganze Turnier neu, sobald
  irgendwer eine Runde beendete.
- **Die ewige Liste nebenher:** Eine Turnierrunde geht über `mini.wartet` im
  Hintergrund in die Hall of Fame, ohne danach die ganze Liste neu zu lesen;
  den eigenen Bestwert gleicht eine Spielseite im Turnier höchstens alle
  halbe Stunde ab (`gleicheAb`), und die Läufe der Gegner holt sie nur neu,
  wenn sich deren Zahl geändert hat (`geist.js`, `turnierGeistFuer`).
- **«Offline bereit»:** Die Turnierseite fragt den Service Worker, ob alles
  da ist, um die Spiele des Turniers ohne Netz zu spielen (`STAND`), und lässt
  holen, was fehlt (`VORBEREITEN`). Solange das läuft, steht oben «Offline
  60 %», danach kurz «Offline bereit». Wer den Link vor dem Abend einmal mit
  gutem Netz öffnet, sieht so, dass sein Gerät vorbereitet ist. Der Service
  Worker holt dabei höchstens vier Dateien zugleich, zuerst den Rahmen, dann
  die Spiele des Turniers (`GLEICHZEITIG`, `SPIEL_DATEIEN`) – bis Oktober 2026
  holte er alle gut hundert auf einmal.

Ein Multiplayer braucht das Netz: Er ist ein gemeinsamer Moment.

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

Was in der Datenbank steht, beschreibt der Kopf von `cloud.js`: `miniScores`
(je Spiel und Spieler die Summen), `miniRunden` (jede Runde einzeln, siehe
unten beim Adminbereich), `miniGeister`, `config/miniGames` und
`miniTurniere`. Abgefragt wird immer nur über ein einziges Feld – es braucht
keinen zusammengesetzten Index und damit keine Datei, die jemand von Hand
nach Firebase bringen muss.

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

**Aufbau.** Oben fünf Kacheln – Turniere, offene Spiele, Spieler, Einträge,
Runden. Jede ist ein Knopf: Sie klappt den Bereich auf, in dem steht, was
hinter der Zahl steckt («Runden» zeigt die Spiele gleich nach Runden
sortiert). Darunter vier Bereiche, zuerst alle zugeklappt – nur Titel und
Zahl:

    Turniere                       anlegen, ändern, anhalten, Multiplayer
    Welche Spiele gespielt werden  Haken für die Startseite, Tiers, ▶
    Spieler                        eine Zeile je Name; ein Tipp auf den Namen
                                   öffnet seine Auswertung, der Haken davor
                                   wählt ihn zum Zusammenführen
    Spiele und Bestenlisten        eine Zeile je Spiel; ein Tipp auf das Spiel
                                   klappt seine Bestenliste auf

Was aufgeklappt ist, wonach sortiert und wie gefiltert wird, merkt sich der
Tab (`sessionStorage`, `mini.admin.ansicht`): Nach «Neu laden» oder einem
Löschen steht alles wieder so da. Die Tabellen der Spieler und Spiele lassen
sich nach jeder Spalte sortieren (ein Tipp auf die Überschrift, ein zweiter
dreht um). Ein Filter gilt für den ganzen Adminbereich: nach Tier, nach dem,
was auf der Startseite steht (oder nicht), oder nach den Spielen eines
Turniers – «Tier 1» heisst dann bei den Spielern auch: Platz im Schnitt in
Tier 1. Bei den Spielern sucht ein Feld nach dem Namen, und ein Zeitraum
zeigt nur, was darin gespielt wurde (siehe **Zeitraum**).

**Die Auswertung eines Spielers** (ein Fenster über dem Adminbereich): wo er
überall gespielt hat, je Spiel der Platz (von wie vielen), der Bestwert, die
Runden, das erste und das letzte Mal; dazu die Zahlen zusammen – Spiele,
Runden, Platz im Schnitt, erste Plätze, Podestplätze – und in welchen
Turnieren er auf welchem Platz steht. Mit einem Zeitraum gilt das alles für
die Runden darin. Aufräumen geht dort auch: ein einzelnes
Ergebnis löschen, alle löschen, den Namen in allen Spielen und Turnieren
ändern (die Geräte übernehmen ihn beim nächsten Öffnen), von mehreren Geräten
zusammenführen. Ein Name ist dabei, was er überall ist:
gross oder klein geschrieben derselbe, auf allen Geräten zusammen.

**Spielzeit.** Jede Runde misst ihre Dauer – vom Start (`game-shell.js`,
`setPhase("play")`) bis zum Ergebnis (`showResult`), in `mini-games.js`
(`rundeBeginnt`, `rundeEndet`) – und meldet sie mit der Runde. `cloud.js`
zählt sie zum Feld `spielMs` des Eintrags dazu, höchstens eine halbe Stunde
je Runde. Die Regeln prüfen dasselbe: Die Spielzeit wächst nur mit einer
Runde und je Runde um höchstens 30 Minuten; nur der Admin darf mehr auf
einmal schreiben – beim Zusammenführen, wo die Zeit aller Geräte
zusammenkommt. Der Adminbereich zeigt sie bei den Spielern, bei den Spielen,
in jeder Bestenliste und in der Auswertung eines Spielers. Erfasst wird sie
seit Fassung 2026-10-25-6; was davor gespielt wurde, zählt nicht mit (ältere
Einträge haben das Feld nicht, es gilt dann als 0).

**Das Rundenprotokoll.** `miniScores` kennt nur Summen – wann gespielt
wurde, steht dort nicht. Deshalb hält `cloud.js` (`speichere`) jede Runde,
die dort zählt, zusätzlich als eigenes Dokument fest, in derselben
Transaktion: `miniRunden/<spiel>_<spieler>_<nr>` mit Name, Punkten, Dauer
(`ms`, höchstens 30 Minuten), Uhrzeit (`zeitMs`) und – aus einem Turnier
oder einem Multiplayer – woher (`quelle`). `nr` ist der Zähler `versuche`
nach dieser Runde. Turnier- und Multiplayer-Runden laufen über denselben Weg
(`mini-games.js`, `melde`), sie stehen also genauso da. Die Regeln lassen
eine Runde nur zu, wenn der Eintrag daneben im selben Schreiben genau um sie
wächst (Zähler um eins, Spielzeit um ihre Dauer, derselbe Name, Bestwert
mindestens so hoch), mit einer Uhrzeit höchstens zehn Minuten neben der des
Servers; ändern lässt sie sich nie, lesen und löschen nur der Admin. Weist
die Datenbank das Protokoll ab (Regeln noch nicht veröffentlicht, eine Uhr,
die weit danebenliegt), geht die Runde allein noch einmal – sie zählt dann
wie früher, nur ohne Protokoll. Erfasst wird ab der Fassung, die das
mitbringt; was davor gespielt wurde, steht nur in den Summen.

**Zeitraum.** Bei den Spielern und in der Auswertung eines Spielers steht
unter dem Filter eine zweite Reihe: «Alle Zeit» (wie immer, die Summen aus
`miniScores`), «Heute», «Gestern», «Letzte 7 Tage» (heute und die sechs Tage
davor), «Ein Tag …» (ein Datum, 00:00 bis 23:59) und «Von – bis …» (zwei
Zeitpunkte mit Uhrzeit, beide eingeschlossen; eines darf leer bleiben). Mit
einem Zeitraum rechnet beides aus den Runden darin (`cloud.js`, `runden`,
eine Bereichsabfrage auf `zeitMs` – gelesen wird nur, was im Zeitraum
liegt): Es steht nur da, wer darin gespielt hat; Runden ist ihre Zahl,
Spielzeit ihre Dauer zusammen, Bestwert der beste Wert darin, Zuerst und
Zuletzt die erste und die letzte Runde darin. Der Platz ist der Rang unter
allen, die im Zeitraum dasselbe Spiel gespielt haben, nach ihrem Bestwert
dort – daraus auch Ø Platz, 1. Plätze und Podestplätze. Tier, Spiele und
«Name suchen» gelten weiter. Der Zeitraum gilt für die Liste und die
Auswertung zugleich und bleibt wie die anderen Filter über «Neu laden»
stehen: Wer aus der gefilterten Liste eine Auswertung öffnet, sieht
denselben und kann ihn dort ändern. Ein Streifen in Koralle sagt, welcher
gilt, mit «× Alle Zeit» daneben; zugeklappt steht es in der Zahl im Kopf.
Beginnt der Zeitraum vor der ersten festgehaltenen Runde, steht darunter,
seit wann es einzelne Runden gibt. Die Spiele und ihre Bestenlisten, die
Kacheln oben, die Turniere und das Aufräumen bleiben bei allen Zeit – und
gelöscht wird immer der ganze Eintrag, nie nur ein Zeitraum.

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
Und mit seinen Runden (`miniRunden`, `cloud.js` `loescheRunden`): Wer aus
der Liste genommen wurde, taucht auch in keinem Zeitraum mehr auf.

Hat jemand unter demselben Namen auf mehreren Geräten gespielt, steht bei
«Spieler» «auf 2 Geräten» und ein Knopf «Zusammenführen» (`admin.js`,
`fuehreZusammen`): Je Spiel bleibt ein Eintrag unter der Kennung, unter der
am meisten gespielt wurde – mit der besten Zahl und allen Runden zusammen;
der beste Lauf zieht mit um, die übrigen Einträge werden gelöscht. Die
Runden der anderen Geräte ziehen unter die Kennung, die bleibt (`cloud.js`,
`zieheRundenUm`), mit ihrer Uhrzeit und einer Nummer hinter den Runden, die
dort schon standen. Turniere bleiben, wie sie sind.
Bevor etwas gelöscht wird, steht für jede andere Kennung fest, wohin es
weitergeht (siehe **Umzüge** unter «Ohne Konto»): Ein Gerät, das noch unter
einer davon spielt, zieht beim nächsten Öffnen mit um.

**Zwei Namen, ein Spieler.** Sind «Efu» und «Efraim» derselbe Mensch, kreuzt
man bei «Spieler» beide an (der Haken vor dem Namen). Darüber erscheint eine
Leiste mit «Zusammenführen …»; sie öffnet ein Fenster: Welcher Name bleibt?
Je Name steht, was hinter ihm steckt (Spiele, Runden, zuletzt, Geräte),
vorgewählt ist der mit den meisten Runden, darunter in einem Satz, was danach
passiert. Nach einer Rückfrage führt `admin.js` (`fuehreNamenZusammen`) in drei
Schritten zusammen: zuerst die Umzüge für jede Kennung ausser der, unter der
am meisten gespielt wurde; dann ein Name überall – in allen Spielen, in den
Einträgen aller Turniere und im Endstand ihrer Multiplayer
(`benenneUmUeberall`); dann je Spiel ein Eintrag wie bei einem Namen auf
mehreren Geräten (`fuehreZusammen`). Danach steht nur noch der bleibende Name
da, mit der besten Zahl, allen Runden und der ganzen Spielzeit beider. Geht es
mit mehr als zwei Namen, geht es genauso. Nimmt die Datenbank keine Umzüge an
(Regeln noch nicht veröffentlicht), bleibt es beim zweiten Schritt: Die Namen
sind dann einer, die Einträge liegen noch je Gerät da («auf 2 Geräten») – das
Fenster sagt es, und «Zusammenführen» holt es später nach.
Und wurde ein Spiel so umgebaut, dass die alten Zahlen nichts mehr bedeuten,
leert «Bestenliste leeren» in der aufgeklappten Bestenliste des Spiels die
ganze Liste auf einmal.

**Tiers.** Im Block «Welche Spiele gespielt werden» stehen die Spiele in fünf
Gruppen, Tier 1 bis 5, und neben jedem ein kleines T1 bis T5 zum Umteilen. Wer ein Spiel
umteilt, speichert die Einteilung sofort (`config/miniGames`, Feld `tiers`,
`cloud.js` `setzeTiers`). Im Formular eines Turniers stehen die Spiele genauso
gruppiert, mit einem Knopf je Tier: Er nimmt das ganze Tier dazu – oder, wenn
es schon ganz gewählt ist, wieder weg. Solange nie eingeteilt wurde, gilt die
Vorgabe aus `mini-games.js` (`TIERS_VORGABE`): Tier 1 Turmbau, Brückenbauer,
Lianenschwung, Tunnelflug, Drift-Rennen, Hügelflieger und die danach
gebauten (Windschichten, Slalom, Froschsprung, Kranhafen, Seiltänzer, Heisser
Draht, Zwei Spuren, Ball hochhalten, Jongleur, Turmspringen, Fallschirm,
Holzfäller, Fledermaus, Zeitlupen-Ninja, Freitaucher), Tier 2 Blätter im Strom, Drehscheibe,
Planetenhüpfer und Der Heizer, Tier 3 der Rest; Tier 4 und 5 sind in der
Vorgabe leer (seit dem 12. November 2026) – dorthin teilt nur der Admin ein.
Ein leeres Tier zeigt «Noch kein Spiel in diesem Tier.» und bekommt im
Turnierformular keinen Knopf. Ein Spiel, das es nicht mehr
gibt (wie der Wellenreiter), fällt beim nächsten Speichern aus den Tiers
(`cloud.js`, `ohneAlteSpiele`): Die Regeln lassen dort nur Spiele zu, die es
gibt, und ohne das scheiterte jedes Speichern an seinem alten Eintrag.
Lehnt die Datenbank einen Haken ab, springt er zurück, und darüber steht,
warum.

**Auswahllisten.** Die aufgeklappte Liste einer Auswahl (Spiele-Filter,
Tier, Dauer eines Turniers, Multiplayer) zeichnet der Browser selbst – unter
Windows mit dem Grund der Auswahl, und war der fast durchsichtig, mit Weiss:
Die helle Schrift stand auf Weiss. `styles.css` gibt jeder Auswahl
`color-scheme: dark` und den Einträgen ihre Farben ausdrücklich: dunkler
Grund, helle Schrift, Gruppen («Im Turnier») in Gold, nicht wählbare
gedämpft.

**In einer Vorschau anmelden.** Firebase lässt «Mit Google anmelden» nur
auf freigegebenen Adressen zu und kennt dort keine Platzhalter – jede Deploy
Preview hat ihre eigene, und jeder einzelne Deploy auch. In einer Vorschau
(`deploy-preview-<n>--gamesrepo.netlify.app` oder ein einzelner Deploy,
`<kennung>--gamesrepo.netlify.app` – so zeigt Netlify den Stand von main, der
noch nicht veröffentlicht ist) öffnet «Mit Google anmelden» deshalb ein
Fenster auf `games.alae.app/admin?vorschau=…`:
Dort meldet Google an (in einer zweiten Firebase-Anwendung ohne Speicher,
`cloud.js` `vorschauApp`), und das Token geht per `postMessage` zurück an die
Vorschau, die sich damit bei Firebase anmeldet (`signInWithCredential` fragt
nicht nach der Domain). Wie im Entdecker – mit einer Prüfung mehr, weil dieses
Repository öffentlich ist: Das Token geht nur an eigene Vorschauen. Bei einer
Deploy Preview muss der Pull Request aus `vonallmenalain/games` selbst
stammen, nicht aus einem Fork (das sagt die GitHub-API). Bei einem einzelnen
Deploy fragt das Fenster die Netlify-API, woraus er gebaut ist: aus `main`
(Kontext «production») oder als Vorschau eines eigenen Pull Requests – sonst
gibt es kein Token. Beide Fragen gehen ohne Anmeldung. Das Fenster auf der
Live-Adresse ist Teil von `admin.js` – es geht erst, wenn diese Fassung dort
veröffentlicht ist.

Ein Turnier anlegen oder ändern geschieht für sich allein: Solange das
Formular offen ist, steht darunter nichts anderes. «Zurück zur Übersicht»,
«Abbrechen» oder der Zurück-Knopf des Browsers führen wieder zur ganzen Seite.
Gleich unter «Spiele» stehen «Alle abwählen», «Alle wählen», die Tiers,
«Nur die offenen» und «3 zufällige» – oben, nicht unter dem letzten Spiel.

**Presets.** Unten neben «Turnier anlegen» steht «Als Preset speichern»: Es
merkt sich alles, was im Formular eingestellt ist – Name, Beschreibung,
Spiele, Dauer, Versuche, Wertung, Aufgaben, wer es sieht, alle Haken –
unter einem eigenen Namen, ohne ein Turnier anzulegen. Beim nächsten neuen
Turnier steht es oben neben «Zurück zur Übersicht» in der Auswahl; ein Tipp
stellt alles wieder so ein, nur der Beginn ist jetzt (und der Link ist
wieder der automatische – den hat jedes Turnier für sich). «Preset löschen»
daneben nimmt es wieder weg. Gespeichert wird in der Datenbank
(`miniPresets`, `cloud.js`, `presets`/`speicherePreset`/`loeschePreset`): Am
Handy stehen dieselben Presets wie am Laptop, lesen und schreiben darf sie nur
der Admin. Bis November 2026 lagen sie im Browser (`localStorage`,
`mini.admin.presets`); was dort noch liegt, zieht beim nächsten Besuch des
Adminbereichs auf diesem Gerät von selbst in die Datenbank um
(`admin.js`, `zieheAltePresetsUm`) – ein Preset gleichen Namens, das dort
schon neuer ist, bleibt.

Alle Knöpfe im Adminbereich haben dieselbe Form, auch die, die eigentlich
Links sind («Zu den Spielen», «Neuer Multiplayer», «Öffnen», «Multiplayer»):
Sie tragen die Grundklasse `adm-knopf` (`admin.js`, `knopfLink`), nicht nur
eine Farbe davon.

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

**Namen ändern nimmt alles mit.** «Du spielst als … · Namen ändern» steht auf
der Startseite, auf der Turnierseite und unter dem Ergebnis (`mini-games.js`,
`namensZeile`). Wer dort einen neuen Namen eintippt, heisst ab sofort so – mit
allem, was er unter dem alten gespielt hat: Bestwerte, Runden, Spielzeit,
Plätze, in jedem Spiel und in den Turnieren, in denen das Gerät dabei war
(`namenAendern`, `cloud.js` `benenneUm`). Umbenannt wird auf dem Server, unter
der Kennung des Geräts **und** unter dem alten Namen – so kommen auch die
Einträge von einem zweiten Gerät desselben Namens mit. Nur der Name ändert
sich, keine Runde kommt dazu, und die Uhr (`updatedAtMs`, Reihenfolge bei
Gleichstand) bleibt stehen. Der neue Name gilt auf dem Gerät sofort; das
Umbenennen in den Listen ist ein Auftrag (`mini.umbenennen`), der wie eine
Runde ohne Netz wartet, bis er draussen ist (`sendeUmbenennen`) – bis dahin
holt der Abgleich den alten Namen nicht zurück (`uebernimmName`). Klappt es
nicht in ein paar Sekunden, sagt die Zeile: «Deine Punkte und Runden kommen
mit, sobald die Verbindung steht.» Bis Oktober 2026 ging ohne Netz gar
nichts. Steht der neue Name schon in einer Liste, fragt sie vorher: «Bist du
das? Dann zählt ihr ab jetzt als ein Spieler.» (Ohne Antwort aus dem Netz
fragt sie nach dem, was das Gerät zuletzt gesehen hat.)

Die anderen Geräte desselben Spielers ziehen von selbst nach: **Was der Server
über den Namen der eigenen Kennung sagt, gilt** (`uebernimmName`). Steht unter
der Kennung des Geräts kein Eintrag mehr mit seinem Namen, übernimmt es den,
unter dem zuletzt gespielt wurde – beim Öffnen eines Spiels (`gleicheAb`), auf
der Startseite und nach jeder Runde (`melde`). Dafür ändert eine Runde den
Namen eines Eintrags nie (`cloud.js`, `speichere`): Ein Gerät, das noch den
alten Namen kennt, schreibt ihn nicht Spiel für Spiel zurück. Dasselbe gilt,
wenn der Admin jemanden umbenennt.

**Jemand anderes auf diesem Gerät.** Unter dem Feld steht «Jemand anderes
spielt»: Das ist der Weg für Geschwister mit einem Handy. Wer dort einen Namen
eintippt, spielt als neuer Mitspieler – mit eigener Kennung, ohne Bestwerte und
ohne eigenen Lauf (`namenWechseln`); was der bisherige gespielt hat, bleibt
bei ihm. Wer zu einem Namen zurückwechselt, den das Gerät schon kennt (gross
oder klein geschrieben), ist wieder dieser Mitspieler: mit seiner Kennung,
seinen Bestwerten und seinem Lauf (`mini.wer`, höchstens zwölf). Die Namen,
die das Gerät kennt, stehen dort als Knöpfe. Im Turnier ist ein neuer
Mitspieler ein neuer Mitspieler, mit eigenen Versuchen; wer sich nur
umbenennt, behält seine.

**Umzüge.** Führt der Admin zwei Namen oder einen Namen von mehreren Geräten
zusammen, bleibt je Spiel ein Eintrag unter einer Kennung, die der anderen
verschwinden. Für jede verschwundene Kennung bleibt ein Zettel, wohin es
weitergeht (`miniUmzuege/<kennung>`: `nach`, `name`; `cloud.js` `umzug`,
`setzeUmzuege`). Das Gerät fragt beim Öffnen nach seiner eigenen Kennung
(`mini-games.js`, `folgeUmzug`) – ein Dokument, keine Abfrage – und spielt
danach unter der neuen Kennung und dem Namen dort weiter, auch über mehrere
Umzüge, aber nie im Kreis. Nicht mitten in einem Turnier, einem Multiplayer
oder beim Zuschauen: Dort hängen Versuche und Plätze an der Kennung, mit der
die Seite begann. Schreiben darf die Zettel nur der Admin (`firestore.rules`).

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
`miniScores`, sobald er seinen Namen einträgt, dazu je Runde eine in
`miniRunden` (wann und wie lange – lesen kann das nur der Admin), und wer in
einem Turnier spielt, eine in dessen Liste – und sonst nichts.
