/*
 * skispringen.js – Skispringen.
 * ---------------------------------------------------------------------------
 * Gerüst: Das Spiel wird gerade gebaut. Bis dahin steht hier nur die Bühne.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "skijump") return;

  const host = document.querySelector("#sj-stage");
  const shellApi = window.LernappGameShell;
  if (!host || !shellApi) return;

  const zufall = window.LernappZufall?.fuer?.("skiJump") || { neu() {}, zahl: () => Math.random() };
  let shell = null;

  function startRun() {
    zufall.neu();
    shell.clear();
    shell.setPhase("intro");
    const feld = shell.el("div", "sj-feld");
    const canvas = document.createElement("canvas");
    canvas.className = "sj-canvas";
    feld.append(canvas);
    shell.play.append(shell.el("p", "cm-prompt sj-prompt", "Kommt bald."), feld);
  }

  shell = shellApi.mount({
    host,
    title: "Skispringen",
    area: "konzentration",
    clock: false,
    onRestart: startRun,
    live: { los: () => {}, stopp: () => {} },
  });
  startRun();

  window.LernappSkispringen = { weltText: () => "" };
})();
