/*
 * fallschirm.js – Fallschirm.
 * ---------------------------------------------------------------------------
 * Gerüst: Das Spiel wird gerade gebaut. Bis dahin steht hier nur die Bühne.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "skydive") return;

  const host = document.querySelector("#fs-stage");
  const shellApi = window.LernappGameShell;
  if (!host || !shellApi) return;

  const zufall = window.LernappZufall?.fuer?.("skyDive") || { neu() {}, zahl: () => Math.random() };
  let shell = null;

  function startRun() {
    zufall.neu();
    shell.clear();
    shell.setPhase("intro");
    const feld = shell.el("div", "fs-feld");
    const canvas = document.createElement("canvas");
    canvas.className = "fs-canvas";
    feld.append(canvas);
    shell.play.append(shell.el("p", "cm-prompt fs-prompt", "Kommt bald."), feld);
  }

  shell = shellApi.mount({
    host,
    title: "Fallschirm",
    area: "konzentration",
    clock: false,
    onRestart: startRun,
    live: { los: () => {}, stopp: () => {} },
  });
  startRun();

  window.LernappFallschirm = { weltText: () => "" };
})();
