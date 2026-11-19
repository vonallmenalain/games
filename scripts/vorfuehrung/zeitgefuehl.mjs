// Zeitgefühl: die Stoppuhr auf der Werkbank, mitten in der Runde. Die ersten
// Aufgaben gehen schnell, dann läuft Wasser in ein Glas, bis der Deckel aus
// Messing es zudeckt – und im Augenblick, da es voll ist, kommt der Tipp: auf
// die Hundertstel genau. Unten stehen die Punkte der Aufgaben davor.
export default {
  bereit: () => Boolean(window.LernappZeitgefuehl?.state?.aufgaben && window.LernappZeitgefuehl.view.cssW > 0),
  spiele: () => {
    const Z = window.LernappZeitgefuehl;
    const st = Z.state;
    const warte = (ms) => new Promise((fertig) => setTimeout(fertig, ms));
    // Wie weit daneben, Aufgabe für Aufgabe – eine Runde, wie sie jemand
    // spielt, der es kann.
    const neben = [40, -110, 20, 230, -60, 90, -30, 150, -280, 70];
    (async () => {
      Z.losGehts();
      // Die erste schwere Aufgabe ist das Glas.
      st.aufgaben[Z.PLAN[0] + Z.PLAN[1]] = Z.wuerfle("glas");
      for (let i = 0; i < Z.AUFGABEN && st.phase !== "ende"; i += 1) {
        const a = Z.aufgabe();
        // Die Aufgabe liegt da und wartet – ein Tipp, und ihre Uhr läuft.
        Z.aufgabeLos();
        if (i === Z.PLAN[0] + Z.PLAN[1]) {
          // Die Aufgabe des Bildes: Das Wasser läuft, der Deckel kommt, dann
          // der Tipp – und die Auflösung bleibt stehen, solange sie will.
          await warte(Z.ANLAUF + a.ziel + 3);
          Z.antworte(a.ziel + 3);
          await warte(Z.ZEIGEN_MS + 200);
        } else {
          await warte(220);
          Z.antworte(a.ziel + neben[i]);
          await warte(220);
          Z.weiter();
        }
      }
    })();
  },
  vorlauf: 300,
  dauer: 11000,
  // Das Standbild: die Auflösung des Glases, sobald sie ganz dasteht.
  bild: 600,
  bildWenn: () => {
    const Z = window.LernappZeitgefuehl;
    return Z.state.phase === "zeigen" && Z.aufgabe().art === "glas" && performance.now() - Z.state.tZeig > 500;
  },
};
