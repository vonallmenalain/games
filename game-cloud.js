/*
 * game-cloud.js – Ein Spielstand, der die Seite nicht überlebt.
 * ---------------------------------------------------------------------------
 * In der App legt diese Datei ab, was ein Spiel selbst führt: die eigenen
 * besten fünf Runden, den Rundenzähler, freigeschaltete Level – auf dem Gerät
 * und, angemeldet, zusätzlich in Firestore, damit der Stand dem Kind von
 * einem Gerät aufs andere folgt.
 *
 * Hier folgt er niemandem. Die Mini-Games gehören keinem: Wer über einen Link
 * hereinkommt, spielt eine Runde, trägt seinen Namen ein und steht in der
 * Liste, die alle sehen (mini-games.js, cloud.js). Ein zweiter Stand daneben –
 * "deine fünf besten Runden auf diesem Gerät" – wäre eine Liste, nach der
 * niemand gefragt hat, und läge auf dem Gerät von jemandem, der hier nur zu
 * Besuch ist.
 *
 * Deshalb gibt es hier eine Ablage, die nichts ablegt: kein localStorage,
 * keine Cloud, kein Zuhören auf fremde Stände. Sie lebt so lange wie die
 * Seite, und das genügt – ein Spiel braucht sie nur, um innerhalb einer Runde
 * zu wissen, was es schon gezählt hat.
 *
 * Eine Zahl kommt trotzdem von aussen herein: der eigene Bestwert aus der
 * offenen Bestenliste (mini-games.js, startStand). Ohne ihn wäre für das
 * Spiel jede erste Runde die beste, die es je gab – und Turmbau riefe bei
 * jedem Neuladen "Neuer Rekord!". Ein Rekord, den es umsonst gibt, ist keiner.
 *
 * Die Schnittstelle ist dieselbe wie in der App. Ein Spiel lässt sich von dort
 * hierher kopieren, ohne dass jemand eine Zeile ändert.
 */
(() => {
  "use strict";

  function clone(wert) {
    try { return JSON.parse(JSON.stringify(wert)); } catch { return wert; }
  }

  /*
   * Meldet einen Spielstand an.
   *
   *   key    In der App der Schlüssel im localStorage. Hier nur noch ein Name,
   *          den niemand liest – aber die Spiele geben ihn mit, und ein Spiel
   *          soll sich unverändert herüberkopieren lassen.
   *   empty  Was ein leerer Stand ist.
   *   merge  Wird nicht gebraucht (siehe mergeScores unten).
   */
  function register({ empty = {} } = {}) {
    let aktuell = clone(window.LernappMini?.startStand?.(empty) || empty);
    const zuhoerer = [];
    return {
      read() { return aktuell; },
      write(daten) {
        aktuell = daten;
        zuhoerer.forEach((fn) => { try { fn(aktuell); } catch { /* egal */ } });
        return aktuell;
      },
      update(fn) { return this.write(fn(aktuell)); },
      reset() { return this.write(clone(empty)); },
      onChange(fn) {
        zuhoerer.push(fn);
        return () => {
          const i = zuhoerer.indexOf(fn);
          if (i >= 0) zuhoerer.splice(i, 1);
        };
      },
    };
  }

  // Die Spiele rufen das auf, um register() eine Zusammenführung mitzugeben:
  // In der App bringt sie die Bestenlisten zweier Geräte zusammen. Hier gibt
  // es kein zweites Gerät und keine Ablage, also auch nichts
  // zusammenzuführen – die Funktion bleibt trotzdem stehen, denn ohne sie
  // liesse sich kein Spiel aus der App herüberkopieren, ohne dass jemand eine
  // Zeile streicht.
  const mergeScores = () => null;

  window.LernappGameCloud = { register, mergeScores };
})();
