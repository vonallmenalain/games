/*
 * jongleur.js – Jongleur.
 * ---------------------------------------------------------------------------
 * Gerüst: Das Spiel wird gerade gebaut. Bis dahin steht hier nur die Bühne.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "juggle") return;

  const host = document.querySelector("#jg-stage");
  const shellApi = window.LernappGameShell;
  if (!host || !shellApi) return;

  const zufall = window.LernappZufall?.fuer?.("juggler") || { neu() {}, zahl: () => Math.random() };
  let shell = null;

  function startRun() {
    zufall.neu();
    shell.clear();
    shell.setPhase("intro");
    const feld = shell.el("div", "jg-feld");
    const canvas = document.createElement("canvas");
    canvas.className = "jg-canvas";
    feld.append(canvas);
    shell.play.append(shell.el("p", "cm-prompt jg-prompt", "Kommt bald."), feld);
  }

  shell = shellApi.mount({
    host,
    title: "Jongleur",
    area: "konzentration",
    clock: false,
    onRestart: startRun,
    live: { los: () => {}, stopp: () => {} },
  });
  startRun();

  window.LernappJongleur = { weltText: () => "" };
})();
