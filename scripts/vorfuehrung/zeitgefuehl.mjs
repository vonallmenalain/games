// Zeitgefühl: die Stoppuhr auf der Werkbank, mitten in der Runde. Die «Lange
// Uhr» ist eben gestoppt – auf die Hundertstel genau –, unten stehen
// die Punkte der Aufgaben davor.
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
      for (let i = 0; i < Z.AUFGABEN && st.phase !== "ende"; i += 1) {
        const a = Z.aufgabe();
        if (a.art === "lang") {
          // Die Aufgabe des Bildes: Sie liegt einen Augenblick da, dann die
          // Antwort – und die Auflösung bleibt stehen, solange sie will.
          await warte(900);
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
  dauer: 8000,
  // Das Standbild: die Auflösung der «Langen Uhr», sobald sie ganz dasteht.
  bild: 600,
  bildWenn: () => {
    const Z = window.LernappZeitgefuehl;
    return Z.state.phase === "zeigen" && Z.aufgabe().art === "lang" && performance.now() - Z.state.tZeig > 500;
  },
};
