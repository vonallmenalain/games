/*
 * kids.js – Gemeinsame Kinder-Funktionen für Gripszug.
 * Wird auf jeder Seite vor app.js geladen und stellt window.LernappKids bereit:
 * Sterne, Vorlesen (TTS), Maskottchen, Konfetti, Töne.
 * Bewusst ohne Framework und defensiv (localStorage kann fehlschlagen).
 */
(() => {
  "use strict";

  // ---------------------------------------------------------------------------
  // Speicher-Helfer
  // ---------------------------------------------------------------------------
  const KEYS = {
    stars: (game, levelId) => `lernapp.stars.${game}.${levelId}`,
    tts: "lernapp.tts",
    lastPlayed: "lernapp.lastPlayed",
  };

  function readRaw(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function writeRaw(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore quota/private mode */ }
  }
  function readJSON(key, fallback) {
    const raw = readRaw(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  }
  function writeJSON(key, value) { writeRaw(key, JSON.stringify(value)); }

  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  // ---------------------------------------------------------------------------
  // Tastatur oder Finger?
  // ---------------------------------------------------------------------------
  // Der Fokusrahmen gehört der Tastatur. Wer tippt oder klickt, hat den Finger
  // schon auf dem Ding – er braucht keinen Rahmen, der ihm sagt, wo er gerade
  // war, und ein Kind hält den schwarzen Kasten für einen Fehler.
  //
  // :focus-visible allein reicht dafür nicht. Die antippbaren Teile der App
  // sind zum grossen Teil SVG-Gruppen mit tabindex – Zug, Wagen, Stationen der
  // Reisekarte, Bauteile der Lok –, und dort malen die Browser ihren eigenen
  // Rahmen schon auf :focus, obwohl :focus-visible gar nicht zutrifft
  // (nachgemessen in Chromium: outline "auto 5px", :focus-visible false).
  // Deshalb steht hier fest, womit zuletzt bedient wurde; das Stylesheet
  // richtet sich danach.
  //
  // Defensiv wie der Rest der Datei: die Prüfskripte laden kids.js mit einem
  // von Hand gebauten document, und das hat nicht jedes Feld eines Browsers.
  const wurzel = document.documentElement || null;
  function merkeEingabe(art) {
    if (!wurzel?.dataset || wurzel.dataset.eingabe === art) return;
    wurzel.dataset.eingabe = art;
  }
  // Bis zur ersten Taste gilt: Finger. Wer nur schaut, sieht keinen Rahmen.
  merkeEingabe("zeiger");
  ["pointerdown", "mousedown", "touchstart"].forEach((typ) => {
    document.addEventListener(typ, () => merkeEingabe("zeiger"), { capture: true, passive: true });
  });
  // Nur Tabulator und Pfeile schalten auf Tastatur um: Enter und Leertaste
  // drückt auch, wer vorher mit dem Finger irgendwo hingekommen ist. Abgehört
  // wird im Einfangen, damit die Marke steht, bevor der Fokus umspringt.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Tab" || (typeof event.key === "string" && event.key.startsWith("Arrow"))) merkeEingabe("tastatur");
  }, { capture: true });

  // ---------------------------------------------------------------------------
  // Sterne pro Level (1–3)
  // ---------------------------------------------------------------------------
  function getStars(game, levelId) {
    const raw = readRaw(KEYS.stars(game, levelId));
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? Math.min(3, value) : 0;
  }
  function setStars(game, levelId, stars) {
    const clamped = Math.max(1, Math.min(3, Math.round(stars)));
    const previous = getStars(game, levelId);
    if (clamped > previous) writeRaw(KEYS.stars(game, levelId), String(clamped));
    return { stars: clamped, improved: clamped > previous, previous };
  }

  // ---------------------------------------------------------------------------
  // Vorlesen (Web Speech API)
  // ---------------------------------------------------------------------------
  function ttsSupported() {
    return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
  }
  function ttsEnabled() {
    const setting = readRaw(KEYS.tts);
    if (setting === "0" || setting === "false" || setting === "off") return false;
    if (setting === "1" || setting === "true" || setting === "on") return true;
    // Standard: an für kleine Kinder, sonst auch an (Ton lässt sich abschalten).
    return true;
  }
  function setTtsEnabled(enabled) {
    writeRaw(KEYS.tts, enabled ? "1" : "0");
    if (!enabled) stopHelp();
  }
  let germanVoice = null;
  function pickGermanVoice() {
    if (!ttsSupported()) return null;
    if (germanVoice) return germanVoice;
    const voices = window.speechSynthesis.getVoices() || [];
    germanVoice = voices.find((v) => /de[-_]/i.test(v.lang) && /female|frau|petra|anna|marlene|google/i.test(v.name))
      || voices.find((v) => /de[-_]/i.test(v.lang))
      || null;
    return germanVoice;
  }
  if (ttsSupported() && typeof window.speechSynthesis.addEventListener === "function") {
    window.speechSynthesis.addEventListener("voiceschanged", () => { germanVoice = null; pickGermanVoice(); });
  }
  function stopSpeaking() {
    if (ttsSupported()) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
  }
  // Wichtig: speak() wird ausschliesslich aus einem Klick auf einen
  // Lautsprecher-Knopf heraus aufgerufen. Die App liest nie von selbst vor.
  function speak(text, options = {}) {
    if (!text || !ttsSupported() || !ttsEnabled()) { options.onEnd?.(); return; }
    if (!options.queue) stopSpeaking();
    try {
      const utterance = new window.SpeechSynthesisUtterance(String(text));
      utterance.lang = "de-DE";
      utterance.rate = options.rate ?? 0.95;
      utterance.pitch = options.pitch ?? 1.15;
      const voice = pickGermanVoice();
      if (voice) utterance.voice = voice;
      if (options.onStart) utterance.addEventListener("start", () => options.onStart());
      if (options.onEnd) {
        utterance.addEventListener("end", () => options.onEnd());
        utterance.addEventListener("error", () => options.onEnd());
      }
      window.speechSynthesis.speak(utterance);
    } catch { options.onEnd?.(); }
  }

  // ---------------------------------------------------------------------------
  // Maskottchen "Fino" der Fuchs (Inline-SVG, verschiedene Posen)
  // ---------------------------------------------------------------------------
  function mascotSVG(pose = "happy") {
    const eyes = pose === "sad"
      ? '<circle cx="42" cy="60" r="4.5"/><circle cx="78" cy="60" r="4.5"/>'
      : pose === "think"
        ? '<circle cx="42" cy="58" r="5"/><circle cx="80" cy="56" r="5"/>'
        : '<circle cx="42" cy="58" r="5.5"/><circle cx="78" cy="58" r="5.5"/><circle cx="44" cy="56" r="1.8" fill="#fff"/><circle cx="80" cy="56" r="1.8" fill="#fff"/>';
    const mouth = pose === "sad"
      ? '<path d="M48 82 Q60 74 72 82" fill="none" stroke="#5a3210" stroke-width="3" stroke-linecap="round"/>'
      : pose === "cheer"
        ? '<path d="M46 76 Q60 96 74 76 Q60 84 46 76 Z" fill="#e8607a"/>'
        : '<path d="M48 78 Q60 90 72 78" fill="none" stroke="#5a3210" stroke-width="3" stroke-linecap="round"/>';
    const cheeks = '<circle cx="34" cy="72" r="6" fill="#ffb0a0" opacity="0.7"/><circle cx="86" cy="72" r="6" fill="#ffb0a0" opacity="0.7"/>';
    const arm = pose === "cheer" || pose === "wave"
      ? '<path d="M92 66 Q106 54 104 40" fill="none" stroke="#f08a3c" stroke-width="9" stroke-linecap="round"/>'
      : '';
    return `
      <svg class="mascot mascot-${pose}" viewBox="0 0 120 120" role="img" aria-label="Fino der Fuchs" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 34 L40 52 L26 58 Z" fill="#f08a3c"/>
        <path d="M98 34 L80 52 L94 58 Z" fill="#f08a3c"/>
        <path d="M27 40 L38 51 L31 54 Z" fill="#ffd8bf"/>
        <path d="M93 40 L82 51 L89 54 Z" fill="#ffd8bf"/>
        <ellipse cx="60" cy="66" rx="40" ry="38" fill="#f5933f"/>
        <path d="M60 40 Q34 52 40 84 Q60 96 80 84 Q86 52 60 40 Z" fill="#fff3e6"/>
        ${cheeks}
        <g fill="#3a2412">${eyes}</g>
        <ellipse cx="60" cy="76" rx="6" ry="4.5" fill="#3a2412"/>
        ${mouth}
        ${arm}
      </svg>`;
  }

  // ---------------------------------------------------------------------------
  // Konfetti
  // ---------------------------------------------------------------------------
  function prefersReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  const CONFETTI_COLORS = ["#ef476f", "#ffd166", "#06d6a0", "#118ab2", "#8338ec", "#ff9f1c", "#ff5da2"];
  function burstConfetti(target, count) {
    if (prefersReducedMotion()) return;
    const host = target || document.body;
    if (!host) return;
    const layer = document.createElement("div");
    layer.className = "confetti-layer";
    layer.setAttribute("aria-hidden", "true");
    const total = count || 42;
    for (let i = 0; i < total; i += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      const angle = (Math.random() * 140 - 70);
      const distance = 120 + Math.random() * 220;
      piece.style.setProperty("--dx", `${Math.sin((angle * Math.PI) / 180) * distance}px`);
      piece.style.setProperty("--dy", `${-Math.abs(Math.cos((angle * Math.PI) / 180)) * distance - 40}px`);
      piece.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
      piece.style.setProperty("--delay", `${Math.random() * 0.25}s`);
      piece.style.setProperty("--dur", `${1 + Math.random() * 0.8}s`);
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      if (i % 3 === 0) piece.style.borderRadius = "50%";
      layer.append(piece);
    }
    host.append(layer);
    window.setTimeout(() => layer.remove(), 2600);
  }

  // ---------------------------------------------------------------------------
  // Töne, Jingles + Vibration
  // ---------------------------------------------------------------------------
  // Alle Seiten teilen sich diesen Klang-Baukasten, damit sich richtige Antworten
  // überall gleich anhören. Der globale Ton-Schalter (Lautsprecher oben rechts)
  // liegt unter demselben Schlüssel wie in app.js.
  const AUDIO_KEY = "lernapp.audioFeedback";
  let audioContext = null;
  function audioEnabled() {
    const setting = readRaw(AUDIO_KEY);
    return setting !== "0" && setting !== "false" && setting !== "off";
  }
  function setAudioEnabled(enabled) {
    writeRaw(AUDIO_KEY, enabled ? "1" : "0");
    // Die Musik hängt am selben Schalter wie alle anderen Töne.
    if (!enabled) { stopMusic({ keepWanted: true, fade: 0.3 }); stopHelp(); }
    if (!enabled && audioContext?.state === "running") audioContext.suspend().catch(() => {});
    if (enabled && musicWanted) startMusic();
  }
  function ensureAudio() {
    if (!audioEnabled()) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      if (!audioContext) audioContext = new AC();
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
      return audioContext;
    } catch { return null; }
  }
  function tone(freq, start, duration, type = "sine", volume = 0.05, destination = null) {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(destination || ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.03);
    } catch { /* ignore */ }
  }
  // Ein "Glockenton": Grundton plus leiser Oberton, damit es nach Xylophon
  // klingt und nicht nach Piepser.
  function bell(freq, start, duration, volume = 0.055) {
    tone(freq, start, duration, "triangle", volume);
    tone(freq * 2, start, duration * 0.55, "sine", volume * 0.32);
  }
  // Notenwerte für die Jingles (C-Dur, kindgerecht hell).
  const NOTE = { C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760, C7: 2093 };
  const JINGLES = {
    // Kurzes "Ding-Ding" nach einer richtigen Antwort.
    correct: [
      { note: "G5", at: 0, dur: 0.16, vol: 0.05 },
      { note: "C6", at: 0.09, dur: 0.3, vol: 0.06 },
    ],
    // Der Zug wächst: eine steigende Fanfare mit einem Nachschlag, der wie ein
    // eingerastetes Bauteil klingt. Deutlich länger und höher als "win", damit
    // sie nicht mit dem Levelabschluss verwechselt wird – sie gehört zum Wagen,
    // nicht zur Aufgabe.
    wagon: [
      { note: "C5", at: 0, dur: 0.14, vol: 0.05 },
      { note: "G5", at: 0.1, dur: 0.14, vol: 0.05 },
      { note: "C6", at: 0.2, dur: 0.16, vol: 0.055 },
      { note: "E6", at: 0.3, dur: 0.18, vol: 0.055 },
      { note: "G6", at: 0.42, dur: 0.6, vol: 0.06 },
      { note: "C6", at: 0.42, dur: 0.7, vol: 0.035 },
      { note: "E5", at: 0.9, dur: 0.5, vol: 0.03 },
      { note: "C6", at: 1.05, dur: 0.7, vol: 0.045 },
    ],
    // Fanfare, wenn ein Level oder eine Reise fertig ist.
    win: [
      { note: "C5", at: 0, dur: 0.16, vol: 0.05 },
      { note: "E5", at: 0.1, dur: 0.16, vol: 0.05 },
      { note: "G5", at: 0.2, dur: 0.18, vol: 0.055 },
      { note: "C6", at: 0.32, dur: 0.5, vol: 0.065 },
      { note: "E6", at: 0.44, dur: 0.55, vol: 0.04 },
      { note: "G6", at: 0.52, dur: 0.6, vol: 0.03 },
      { note: "C7", at: 0.66, dur: 0.4, vol: 0.02 },
    ],
    // Aufsteigendes Funkeln, wenn ein neues Tier freigeschaltet wird.
    unlock: [
      { note: "C6", at: 0, dur: 0.14, vol: 0.045 },
      { note: "E6", at: 0.08, dur: 0.14, vol: 0.045 },
      { note: "G6", at: 0.16, dur: 0.16, vol: 0.045 },
      { note: "C7", at: 0.26, dur: 0.42, vol: 0.04 },
    ],
    // Freundliches "Probier nochmal" – tief und leise, nie tadelnd.
    retry: [
      { note: "F5", at: 0, dur: 0.12, vol: 0.028 },
      { note: "D5", at: 0.1, dur: 0.2, vol: 0.026 },
    ],
    // Ein einzelner Stern beim Aufdecken.
    star: [{ note: "A5", at: 0, dur: 0.2, vol: 0.05 }],
  };
  // Spielt einen Jingle aus JINGLES. Unbekannte Namen werden ignoriert.
  function playJingle(name) {
    const parts = JINGLES[name];
    const ctx = parts ? ensureAudio() : null;
    if (!ctx) return;
    const now = ctx.currentTime + 0.01;
    parts.forEach((part) => bell(NOTE[part.note], now + part.at, part.dur, part.vol));
  }
  function playChime() { playJingle("win"); }
  function playStarSound(index = 0) {
    const ctx = ensureAudio();
    if (!ctx) return;
    bell([NOTE.A5, NOTE.C6, NOTE.E6][Math.min(Math.max(index, 0), 2)], ctx.currentTime + 0.01, 0.22, 0.055);
  }
  // Vibrieren geht erst, wenn das Kind die Seite einmal berührt hat – vorher
  // lehnt der Browser den Aufruf ab und schreibt einen Fehler in die Konsole.
  // Das trifft alles, was gleich beim Laden feiert.
  let beruehrt = false;
  ["pointerdown", "keydown", "touchstart"].forEach((art) => {
    document.addEventListener(art, () => { beruehrt = true; }, { once: true, passive: true, capture: true });
  });

  function vibrate(pattern) {
    if (!beruehrt) return;
    try { if (navigator.vibrate && !prefersReducedMotion()) navigator.vibrate(pattern); } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Zuletzt gespielt
  // ---------------------------------------------------------------------------
  function setLastPlayed(game, levelId) {
    if (!game) return;
    writeJSON(KEYS.lastPlayed, { game, levelId: levelId || null, at: Date.now() });
  }
  function getLastPlayed() { return readJSON(KEYS.lastPlayed, null); }

  // ---------------------------------------------------------------------------
  // Tutorial gesehen?
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Hilfe-Lautsprecher ("Was mache ich hier?")
  // ---------------------------------------------------------------------------
  // Die App spricht nie von selbst. Jeder Bildschirm meldet hier an, was gerade
  // zu tun ist; erklingt tut das erst, wenn das Kind den Lautsprecher antippt.
  // Zusätzlich erscheint der Text als Sprechblase – so hilft der Knopf auch auf
  // Geräten ohne Sprachausgabe.
  const helpStack = [];
  let helpButton = null;
  let helpBubble = null;
  let helpHideTimer = 0;
  let helpToken = 0;
  // Liest der Lautsprecher gerade vor? Das ist etwas anderes als "die Blase
  // steht da": die Blase kann längst weggetippt sein, während die Stimme
  // weiterliest – und dann muss der nächste Tipp auf den Lautsprecher die
  // Stimme stoppen, nicht die Blase noch einmal zeigen.
  let helpSpeaking = false;
  let helpSpeechToken = 0;
  let helpWatch = 0;

  function currentHelp() {
    return helpStack.length ? helpStack[helpStack.length - 1].text : "";
  }
  function refreshHelpButton() {
    if (!helpButton) return;
    const text = currentHelp();
    helpButton.hidden = !text;
    helpButton.disabled = !text;
  }
  // Wechselt der Text, der oben liegt, ist ein anderer Bildschirm da: was
  // dazu noch vorgelesen wurde, gehört zum alten und hört auf.
  function helpChanged(before) {
    if (currentHelp() !== before) stopHelp();
    refreshHelpButton();
  }
  // Setzt den Hilfetext der Grundebene (die aktuelle Seite/Ansicht).
  function setHelp(text) {
    const before = currentHelp();
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (helpStack.length && helpStack[0].base) helpStack[0].text = clean;
    else helpStack.unshift({ text: clean, base: true, id: "base" });
    helpChanged(before);
  }
  // Legt einen Hilfetext obendrauf (Dialoge, Overlays). Gibt eine Funktion zum
  // Entfernen zurück.
  function pushHelp(text) {
    const before = currentHelp();
    helpToken += 1;
    const entry = { text: String(text || "").replace(/\s+/g, " ").trim(), id: `h${helpToken}` };
    helpStack.push(entry);
    helpChanged(before);
    return () => {
      const index = helpStack.indexOf(entry);
      if (index < 0) return;
      const previous = currentHelp();
      helpStack.splice(index, 1);
      helpChanged(previous);
    };
  }
  function setSpeaking(on) {
    helpSpeaking = on;
    helpButton?.classList.toggle("speaking", on);
    if (helpWatch) window.clearInterval(helpWatch);
    helpWatch = 0;
  }
  // Manche Browser melden das Ende einer Ansage nicht zuverlässig. Sobald die
  // Stimme angefangen hat, wird deshalb nebenbei nachgeschaut, ob sie noch
  // läuft – sonst bliebe der Knopf grün, und der nächste Tipp würde stoppen
  // statt vorlesen.
  function watchSpeech() {
    if (helpWatch) window.clearInterval(helpWatch);
    helpWatch = window.setInterval(() => {
      try {
        const synth = window.speechSynthesis;
        if (!synth.speaking && !synth.pending) setSpeaking(false);
      } catch { setSpeaking(false); }
    }, 500);
  }
  // Nur die Sprechblase weg – das Vorlesen läuft weiter. Das passiert bei
  // einem Tipp neben die Blase: wer den Text nicht mitlesen will, soll ihn
  // trotzdem zu Ende hören dürfen.
  function hideHelpBubble() {
    if (helpHideTimer) window.clearTimeout(helpHideTimer);
    helpHideTimer = 0;
    if (helpBubble) helpBubble.hidden = true;
  }
  // Stimme sofort still, Knopf zurück, Blase weg.
  function stopHelp() {
    helpSpeechToken += 1;
    stopSpeaking();
    setSpeaking(false);
    hideHelpBubble();
  }
  function showHelpBubble(text) {
    if (!helpBubble) return;
    helpBubble.textContent = text;
    helpBubble.hidden = false;
    if (helpHideTimer) window.clearTimeout(helpHideTimer);
    // Die Blase bleibt so lange stehen, wie das Lesen ungefähr dauert – auch
    // dann, wenn die Stimme früher fertig ist oder das Gerät gar keine hat.
    helpHideTimer = window.setTimeout(hideHelpBubble, Math.min(30000, 3500 + text.length * 55));
  }
  // Der Lautsprecher: ein Tipp liest vor und zeigt den Text, der nächste
  // Tipp macht die Stimme sofort still – auch dann, wenn die Blase längst
  // weggetippt ist. Erst der Tipp danach liest wieder von vorn.
  function speakHelp() {
    const text = currentHelp();
    if (!text) return;
    if (helpSpeaking) { stopHelp(); return; }
    showHelpBubble(text);
    if (!ttsSupported() || !ttsEnabled()) return;
    helpSpeechToken += 1;
    const token = helpSpeechToken;
    // Nur, wenn seither keine neue Ansage angefangen hat: das Ende einer
    // abgebrochenen kommt verspätet und gehört nicht mehr zu dieser.
    const gilt = () => token === helpSpeechToken;
    let ended = false;
    speak(text, {
      onStart: () => { if (gilt()) watchSpeech(); },
      onEnd: () => { if (!gilt()) return; ended = true; setSpeaking(false); },
    });
    if (!ended) {
      setSpeaking(true);
      // Fängt die Stimme gar nicht an – etwa ohne deutsche Stimme auf dem
      // Gerät –, geht der Knopf nach kurzer Zeit von selbst zurück.
      window.setTimeout(() => {
        if (!gilt() || !helpSpeaking) return;
        try {
          const synth = window.speechSynthesis;
          if (!synth.speaking && !synth.pending) setSpeaking(false);
        } catch { setSpeaking(false); }
      }, 2500);
    }
  }
  // Ein Tipp irgendwo neben die Blase blendet sie aus. Auf den Lautsprecher
  // selbst nicht: der hat seine eigene Bedeutung.
  document.addEventListener("pointerdown", (event) => {
    if (!helpBubble || helpBubble.hidden) return;
    if (event.target?.closest?.(".help-voice")) return;
    hideHelpBubble();
  }, { capture: true, passive: true });
  // ---------------------------------------------------------------------------
  // Ton-Schalter (oben rechts)
  // ---------------------------------------------------------------------------
  // Liegt hier statt in app.js, damit auch Seiten ohne app.js (Tier-Sprung)
  // einen Schalter haben – sie machen ja ebenfalls Geräusche.
  let audioToggle = null;
  function updateAudioToggle() {
    if (!audioToggle) return;
    const muted = !audioEnabled();
    audioToggle.classList.toggle("muted", muted);
    audioToggle.setAttribute("aria-pressed", muted ? "true" : "false");
    audioToggle.setAttribute("aria-label", muted ? "Ton einschalten" : "Ton ausschalten");
    audioToggle.title = muted ? "Ton einschalten" : "Ton ausschalten";
  }
  function mountAudioToggle() {
    if (audioToggle || document.querySelector(".sound-toggle")) return null;
    audioToggle = document.createElement("button");
    audioToggle.type = "button";
    audioToggle.className = "sound-toggle";
    audioToggle.dataset.audioToggle = "true";
    audioToggle.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path class="sound-core" d="M11 5 6 9H3v6h3l5 4V5z"/>
        <path class="sound-wave" d="M15.5 8.5a5 5 0 0 1 0 7"/>
        <path class="sound-wave sound-wave-wide" d="M18.3 5.7a9 9 0 0 1 0 12.6"/>
        <path class="sound-off-line" d="M4 4l16 16"/>
      </svg>`;
    audioToggle.addEventListener("click", () => { setAudioEnabled(!audioEnabled()); updateAudioToggle(); });
    document.body.append(audioToggle);
    updateAudioToggle();
    return audioToggle;
  }

  // Baut den Hilfe-Knopf. Die Startseite meldet keinen Text an – dort erklären
  // sich die Kacheln selbst und der Knopf bleibt verborgen.
  function mountHelpButton() {
    if (helpButton || !document.body) return null;
    const wrap = document.createElement("div");
    wrap.className = "help-voice";
    wrap.innerHTML = `
      <button type="button" class="help-voice-button" aria-label="Vorlesen: Was mache ich hier?" title="Was mache ich hier?">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path class="help-voice-core" d="M11 5 6 9H3v6h3l5 4V5z"/>
          <path class="help-voice-wave" d="M15.5 8.5a5 5 0 0 1 0 7"/>
          <path class="help-voice-wave help-voice-wave-wide" d="M18.3 5.7a9 9 0 0 1 0 12.6"/>
        </svg>
        <span class="help-voice-mark" aria-hidden="true">?</span>
      </button>
      <p class="help-voice-bubble" role="status" aria-live="polite" hidden></p>`;
    document.body.append(wrap);
    helpButton = wrap.querySelector(".help-voice-button");
    helpBubble = wrap.querySelector(".help-voice-bubble");
    helpButton.addEventListener("click", speakHelp);
    helpBubble.addEventListener("click", hideHelpBubble);
    refreshHelpButton();
    return helpButton;
  }

  // ---------------------------------------------------------------------------
  // Menü-Musik
  // ---------------------------------------------------------------------------
  // Eine Spieluhr-Melodie im Viervierteltakt, die im Menü in Schleife läuft.
  // Aus Oszillatoren statt aus einer Tondatei: keine Lizenzfrage, kein
  // Megabyte Download, offline dieselbe App – und eine Spieluhr passt zu einem
  // Holzzug ohnehin besser als eine produzierte Tonspur.
  //
  // Web Audio spielt nicht "jetzt", sondern zu einem Zeitpunkt. Deshalb wird
  // im Voraus geplant: ein Zeitgeber schaut ein halbe Sekunde nach vorn und
  // hängt die nächsten Töne an. Töne direkt im Takt zu starten würde bei jedem
  // ausgelasteten Hauptthread hörbar holpern.
  const NOTES = {
    C3: 130.81, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
    C6: 1046.50, D6: 1174.66, E6: 1318.51,
  };

  // Vier Viertel statt Walzer, und deutlich flotter: die alte Fassung war ein
  // gemütliches Um-ta-ta, das nach der zweiten Runde einschläferte. Der Takt
  // liegt jetzt auf Achteln – acht Schritte je Takt –, damit die Melodie
  // synkopieren kann, statt brav auf jeder Zählzeit zu sitzen.
  const BEAT = 60 / 132 / 2;       // Achtel bei 132 Schlägen je Minute
  const STEPS_PER_BAR = 8;
  const BARS = 8;
  const STEPS = BARS * STEPS_PER_BAR;

  // Eine Akkordfolge, die vorwärts zieht und sich rundet: I – V – vi – IV.
  const CHORDS = [
    { bass: "C3", tones: ["E4", "G4"] },
    { bass: "G3", tones: ["D4", "G4"] },
    { bass: "A3", tones: ["C4", "E4"] },
    { bass: "F3", tones: ["A3", "C4"] },
    { bass: "C3", tones: ["E4", "G4"] },
    { bass: "G3", tones: ["D4", "G4"] },
    { bass: "F3", tones: ["A3", "C4"] },
    { bass: "G3", tones: ["B3", "D4"] },
  ];

  // Zwei Strophen. Jede Zeile ist ein Takt aus acht Achteln; null ist eine
  // Pause. Die Melodie beginnt oft auf dem zweiten Achtel und lässt die Eins
  // frei – genau das macht den Unterschied zwischen "brav" und "geht ins Ohr".
  const MELODIES = [
    [
      "G5", null, "G5", "A5", "G5", null, "E5", null,
      "D5", null, "D5", "E5", "D5", null, "B4", null,
      "A5", null, "G5", "E5", "A5", null, null, "G5",
      "F5", null, "E5", "D5", "C5", null, null, null,
      "E5", "G5", "C6", null, "B5", "A5", "G5", null,
      "D5", "G5", "B5", null, "A5", "G5", "F5", null,
      "A5", null, "C6", "A5", "F5", null, "G5", null,
      "G5", null, "B5", "D6", "C6", null, null, null,
    ],
    [
      "C6", null, "B5", "G5", "A5", null, "G5", null,
      "B5", null, "A5", "F5", "G5", null, "D5", null,
      "C6", "B5", "A5", null, "G5", "A5", "E5", null,
      "F5", "E5", "D5", null, "C5", null, "E5", null,
      "G5", null, "E5", "G5", "C6", null, "B5", null,
      "A5", null, "F5", "A5", "D6", null, "B5", null,
      "C6", "A5", "F5", null, "A5", "C6", "E6", null,
      "D6", null, "B5", "G5", "C6", null, null, null,
    ],
  ];

  let musicGain = null;
  let musicTimer = null;
  let musicNext = 0;
  let musicStep = 0;
  let musicVerse = 0;
  let musicWanted = false;

  function musicBus() {
    const ctx = ensureAudio();
    if (!ctx) return null;
    if (!musicGain || musicGain.context !== ctx) {
      musicGain = ctx.createGain();
      musicGain.gain.value = 0;
      musicGain.connect(ctx.destination);
    }
    return ctx;
  }

  // Ein Glockenton mit Oberton – das ist der Unterschied zwischen Spieluhr und
  // Piepser.
  function musicBell(freq, at, duration, volume) {
    tone(freq, at, duration, "triangle", volume, musicGain);
    tone(freq * 2, at, duration * 0.5, "sine", volume * 0.3, musicGain);
  }

  function musicStepAt(step, at) {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const beat = step % STEPS_PER_BAR;
    const chord = CHORDS[bar];
    const note = MELODIES[musicVerse][step];

    // Bass auf die Eins und die Drei – kurz und trocken, damit er hüpft statt
    // zu tragen.
    if (beat === 0 || beat === 4) tone(NOTES[chord.bass], at, BEAT * 1.2, "sine", 0.024, musicGain);
    // Die Akkordtöne sitzen auf den Zwischenschlägen: das ist der Zug nach
    // vorn, den der Walzer nicht hatte.
    if (beat === 2) tone(NOTES[chord.tones[0]], at, BEAT * 0.8, "triangle", 0.013, musicGain);
    if (beat === 6) tone(NOTES[chord.tones[1]], at, BEAT * 0.8, "triangle", 0.013, musicGain);
    // Ein ganz leiser Tick auf den Achteln dazwischen – die Spieluhr bekommt
    // damit einen Puls, ohne dass ein Schlagzeug daraus wird.
    if (beat % 2 === 1) tone(NOTES.E6, at, BEAT * 0.18, "sine", 0.004, musicGain);
    if (note) musicBell(NOTES[note], at, BEAT * 1.4, 0.03);
  }

  function musicTick() {
    if (!musicTimer) return;
    const ctx = musicBus();
    if (!ctx) return;
    while (musicNext < ctx.currentTime + 0.5) {
      if (musicNext < ctx.currentTime) musicNext = ctx.currentTime + 0.05;
      musicStepAt(musicStep, musicNext);
      musicNext += BEAT;
      musicStep += 1;
      if (musicStep >= STEPS) {
        musicStep = 0;
        musicVerse = (musicVerse + 1) % MELODIES.length;
      }
    }
  }

  function startMusic() {
    musicWanted = true;
    if (!audioEnabled() || document.hidden) return;
    const ctx = musicBus();
    if (!ctx || musicTimer) return;
    // Browser lassen Ton erst nach einer Berührung zu, und resume() läuft
    // asynchron: nach dem Wiedereinschalten des Tons schläft der Kontext beim
    // Prüfen noch. Deshalb wird hier nicht aufgegeben, sondern gewartet, bis er
    // wach ist – sonst bliebe die Musik nach jedem Aus und Ein stumm.
    if (ctx.state !== "running") {
      ctx.addEventListener("statechange", () => { if (musicWanted) startMusic(); }, { once: true });
      return;
    }
    musicNext = ctx.currentTime + 0.1;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
    musicTimer = window.setInterval(musicTick, 200);
    musicTick();
  }

  // Beim Verlassen des Menüs ausblenden statt abschneiden: ein abrupt
  // abbrechender Ton klingt nach Fehler.
  function stopMusic(options = {}) {
    const { keepWanted = false, fade = 0.5 } = options;
    if (!keepWanted) musicWanted = false;
    if (musicTimer) { window.clearInterval(musicTimer); musicTimer = null; }
    if (!musicGain) return;
    try {
      const ctx = musicGain.context;
      musicGain.gain.cancelScheduledValues(ctx.currentTime);
      musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
      musicGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fade);
    } catch { /* ignore */ }
  }

  function musicPlaying() { return Boolean(musicTimer); }

  // Im Hintergrund schweigt die Musik – sonst spielt ein Tablet in der Tasche
  // weiter und frisst Akku.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopMusic({ keepWanted: true, fade: 0.25 });
    else if (musicWanted) startMusic();
  });

  // ---------------------------------------------------------------------------
  // Lok-Pfeife
  // ---------------------------------------------------------------------------
  // Vier Klänge zur Auswahl. Eine Dampfpfeife ist kein reiner Ton, sondern zwei
  // eng benachbarte Töne, die miteinander schweben – deshalb klingt jede
  // Variante aus mindestens zwei Stimmen.
  // ---------------------------------------------------------------------------
  // Dampfpfeife
  // ---------------------------------------------------------------------------
  // Die kleine Lok-Pfeife oben ist ein Signalton für die Werkstatt: hell, kurz,
  // zum Unterscheiden. Das hier ist etwas anderes – das Horn einer alten
  // Dampflok, das beim Losfahren tönt.
  //
  // Drei Dinge machen den Unterschied zu einem Piepser:
  //   1. Ein Akkord statt eines Tons. Amerikanische Dampfpfeifen sind
  //      mehrchörig; die Rohre stehen im Moll-Dreiklang, daher der wehmütige
  //      Klang, den man aus jedem alten Film kennt.
  //   2. Luft. Zu jedem Ton gehört gefiltertes Rauschen – der Dampf, der durch
  //      das Rohr fährt. Ohne ihn klingt es nach Orgel.
  //   3. Ein Anlauf und ein Nachlassen der Tonhöhe. Der Druck baut sich auf
  //      und fällt wieder ab; ein Ton mit fester Höhe klingt tot.
  const HORN_CHORD = [1, 1.189, 1.498];   // Moll-Dreiklang: Grundton, kleine Terz, Quinte
  const HORN_BASE = 372;

  let noiseCache = null;
  function noiseBuffer(ctx) {
    if (noiseCache && noiseCache.sampleRate === ctx.sampleRate) return noiseCache;
    const length = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    noiseCache = buffer;
    return buffer;
  }

  // Gefiltertes Rauschen mit Hüllkurve: einmal der Dampf in der Pfeife, einmal
  // der Auspuffschlag des Kessels.
  function hiss(start, duration, volume, freq, q, type = "bandpass") {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx);
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.setValueAtTime(freq, start);
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.05, duration * 0.25));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start(start);
      source.stop(start + duration + 0.05);
    } catch { /* ignore */ }
  }

  // Ein Stoss aufs Horn.
  function hornBlast(start, duration, volume = 0.05) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const attack = Math.min(0.09, duration * 0.3);
    const release = Math.min(0.16, duration * 0.4);
    HORN_CHORD.forEach((ratio, index) => {
      // Jedes Rohr doppelt und leicht verstimmt – das Schweben ist das, was
      // eine Pfeife von einem Oszillator unterscheidet.
      [1, 1.004].forEach((detune, voice) => {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const freq = HORN_BASE * ratio * detune;
          osc.type = index === 0 ? "sawtooth" : "triangle";
          // Anlauf: der Druck baut sich auf. Nachlassen am Ende.
          osc.frequency.setValueAtTime(freq * 0.93, start);
          osc.frequency.exponentialRampToValueAtTime(freq, start + attack);
          osc.frequency.setValueAtTime(freq, start + duration - release);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.94, start + duration);

          const peak = volume * (index === 0 ? 1 : 0.62) * (voice ? 0.55 : 1);
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(peak, start + attack);
          gain.gain.setValueAtTime(peak, start + duration - release);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + duration + 0.05);
        } catch { /* ignore */ }
      });
    });
    // Der Dampf drumherum.
    hiss(start, duration, volume * 0.5, HORN_BASE * 3.2, 1.1);
  }

  // Ein Auspuffschlag: der kurze Stoss, mit dem der Dampf aus dem Kamin fährt.
  function chuff(start, strength = 1) {
    hiss(start, 0.2 * strength, 0.035 * strength, 260, 0.8);
    hiss(start + 0.01, 0.13 * strength, 0.022 * strength, 1500, 0.6, "highpass");
  }

  // Das Rattern auf der Zahnradstrecke (Reise, Berge-Karte): viele kurze
  // Klicks, wie Zähne, die in die Zahnstange greifen.
  function playRattle(seconds = 3) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime + 0.02;
    let at = 0;
    let i = 0;
    while (at < seconds && i < 80) {
      hiss(now + at, 0.05, 0.03, i % 2 ? 260 : 190, 2.4);
      at += 0.11 + (i % 3) * 0.01;
      i += 1;
    }
  }

  // Tüüt tüüt: kurz, dann lang – das Signal vor dem Losfahren.
  function playHorn(options = {}) {
    const { chuffs = 0, volume = 0.05 } = options;
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime + 0.02;
    hornBlast(now, 0.34, volume);
    hornBlast(now + 0.46, 0.62, volume);
    // Danach setzt sich die Maschine in Bewegung: die Schläge kommen zuerst
    // langsam und rücken dann zusammen.
    let at = now + 1.16;
    let spacing = 0.42;
    for (let i = 0; i < chuffs; i += 1) {
      chuff(at, 1 - i * 0.06);
      at += spacing;
      spacing = Math.max(0.17, spacing * 0.86);
    }
  }

  const WHISTLES = {
    hoch: [[880, 0, 0.55], [1320, 0.02, 0.5]],
    tief: [[392, 0, 0.75], [588, 0.03, 0.65]],
    doppelt: [[660, 0, 0.3], [990, 0.02, 0.28], [880, 0.34, 0.42], [1320, 0.36, 0.4]],
    dampf: [[523, 0, 0.7], [659, 0.04, 0.62], [784, 0.08, 0.55]],
    // Tief und lang, wie vom See her: die Belohnung der dritten Karte.
    schiffshorn: [[147, 0, 1.2], [185, 0.02, 1.1], [220, 0.05, 0.9]],
  };
  const WHISTLE_NAMES = Object.keys(WHISTLES);

  function playWhistle(name) {
    const parts = WHISTLES[name] || WHISTLES.hoch;
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime + 0.01;
    parts.forEach(([freq, at, duration]) => {
      tone(freq, now + at, duration, "triangle", 0.035);
      // Eine Spur daneben: das leichte Schweben macht aus zwei Tönen eine Pfeife.
      tone(freq * 1.006, now + at, duration, "triangle", 0.022);
    });
  }

  // ---------------------------------------------------------------------------
  // Wie oft ein Spiel für seinen Wagen gespielt sein muss
  // ---------------------------------------------------------------------------
  // Das hängt am Wagen-Set: im ersten reichen fünf Runden je Spiel, im zweiten
  // braucht es neun. Massgebend ist train-progress.js (SETS) – auf den
  // Spielseiten ist die Datei aber nicht geladen, deshalb steht die Zahl je
  // Set hier noch einmal, klein und ohne Rest; validate-train-progress.mjs
  // hält beide gleich. Welches Set gilt, spiegelt firebase.js aus der Cloud
  // nach lernapp.train.set; ohne Eintrag gilt das erste.
  const WAGON_ROUNDS = { "1": 5, "2": 9 };

  function wagonSetId() {
    try {
      const raw = JSON.parse(localStorage.getItem("lernapp.train.set") || "null");
      const id = raw && typeof raw === "object" ? String(raw.id || "") : "";
      return WAGON_ROUNDS[id] ? id : "1";
    } catch { return "1"; }
  }

  // In der App sagt diese Zahl, nach wie vielen Runden ein Wagen fertig ist;
  // die Spiele rechnen daraus den Satz "noch zwei Runden, dann wächst dein
  // Wagen". Hier wächst nichts – der Satz wird nirgends angezeigt
  // (game-shell.js), die Zahl bleibt trotzdem stehen, damit sich ein Spiel
  // unverändert aus der App herüberkopieren lässt.
  function wagonRounds() {
    return WAGON_ROUNDS[wagonSetId()];
  }

  // ---------------------------------------------------------------------------
  // Öffentliche API
  // ---------------------------------------------------------------------------
  window.LernappKids = {
    KEYS,
    // Sterne
    getStars, setStars,
    // Wagen-Set: wie viele Runden ein Spiel für seinen Wagen braucht
    wagonSetId, wagonRounds,

    // TTS (nur auf Lautsprecher-Klick)
    ttsSupported, ttsEnabled, setTtsEnabled, speak, stopSpeaking,
    // Hilfe-Lautsprecher
    setHelp, pushHelp, speakHelp, mountHelpButton, currentHelp,
    // Maskottchen + Effekte
    mascotSVG, burstConfetti, playJingle, playChime, playStarSound, vibrate, prefersReducedMotion,
    // Ton-Schalter
    audioEnabled, setAudioEnabled, updateAudioToggle,
    // Lok-Pfeife
    WHISTLE_NAMES, playWhistle,
    // Dampfhorn, Auspuffschläge und das Rattern der Zahnradstrecke
    playHorn, chuff, playRattle,
    // Menü-Musik
    startMusic, stopMusic, musicPlaying,
    // Ausrichtung
    lockLandscape,
    // Verlauf
    setLastPlayed, getLastPlayed,
    // Speicher-Helfer
    readJSON, writeJSON,
  };

  // Der Knopf wird überall angelegt, zeigt sich aber nur, wenn der Bildschirm
  // einen Hilfetext angemeldet hat. Die Startseite meldet keinen an – dort
  // erklären die Kacheln sich selbst. Dialoge über der Startseite (z. B. "Wer
  // spielt?") schieben einen Text nach und lassen den Knopf so erscheinen.
  // ---------------------------------------------------------------------------
  // Querformat
  // ---------------------------------------------------------------------------
  // Die App ist auf Querformat ausgelegt: der Zug aus Lok und fünf Wagen ist
  // breit, und hochkant bliebe er ein flacher Streifen. Das Manifest schreibt
  // die Lage bewusst nicht mehr fest – eine im Manifest erzwungene Ausrichtung
  // wird bei der Installation in die Android-App eingebrannt und hindert sie
  // auf manchen Geräten am Starten. Gedreht wird darum erst zur Laufzeit:
  // lockLandscape() hält die Lage fest, sobald das erste Mal getippt wird, und
  // bis dahin zeigt dieser Hinweis, dass das Gerät zu drehen ist. Nur ein Bild,
  // kein Text: die Kinder können noch nicht lesen.
  function mountRotateHint() {
    if (document.querySelector(".rotate-hint")) return;
    const hint = document.createElement("div");
    hint.className = "rotate-hint";
    hint.setAttribute("role", "alert");
    hint.setAttribute("aria-label", "Bitte drehe das Gerät quer.");
    hint.innerHTML = `
      <svg viewBox="0 0 120 100" aria-hidden="true" focusable="false">
        <rect class="rotate-hint-device" x="42" y="8" width="36" height="62" rx="7"/>
        <circle class="rotate-hint-dot" cx="60" cy="63" r="2.6"/>
        <path class="rotate-hint-arrow" d="M26 84 a34 34 0 0 1 68 0" />
        <polygon class="rotate-hint-tip" points="94,76 102,86 86,88" />
      </svg>`;
    // Jeder Tipp auf den Hinweis versucht es noch einmal mit dem Festhalten
    // der Querlage. Der erste Versuch beim allerersten Antippen der Seite kann
    // scheitern – etwa im Browser statt in der installierten App –, und ein
    // Kind, das den Hinweis antippt, meint genau das: dreh dich.
    hint.addEventListener("pointerdown", lockLandscape);
    document.body.append(hint);
  }

  // Im installierten Vollbild lässt sich die Ausrichtung wirklich festhalten.
  // Der Aufruf braucht eine Nutzergeste und scheitert sonst still – deshalb
  // hängt er am ersten Antippen und schluckt jeden Fehler.
  function lockLandscape() {
    try {
      const lock = screen.orientation?.lock;
      if (typeof lock !== "function") return;
      lock.call(screen.orientation, "landscape").catch(() => {});
    } catch { /* nicht erlaubt – dann bleibt der Dreh-Hinweis */ }
  }

  // ---------------------------------------------------------------------------
  // Kein Zoom
  // ---------------------------------------------------------------------------
  // Die App füllt das Bild und rechnet damit, dass sie es ganz hat: der Zug
  // wird auf die Fensterbreite gemessen, die Spielfelder auf die Fensterhöhe.
  // Wer mit zwei Fingern hineinzieht, sieht danach einen Ausschnitt, in dem die
  // Hälfte der Knöpfe ausserhalb liegt – und ein Kind findet ohne Hilfe nicht
  // mehr heraus.
  //
  // Abgestellt wird das an drei Stellen, weil keine allein reicht: <meta
  // viewport> in jeder Seite, touch-action im Stylesheet, und hier die
  // gesture-Ereignisse. Safari auf dem iPhone hört seit Jahren weder auf
  // user-scalable=no noch auf touch-action am Wurzelelement; es meldet
  // stattdessen eigene Ereignisse, und nur deren Absage hält den Zoom auf.
  function blockZoom() {
    ["gesturestart", "gesturechange", "gestureend"].forEach((typ) => {
      document.addEventListener(typ, (event) => event.preventDefault(), { passive: false });
    });

    // Zwei Finger, die sich bewegen: das ist ein Zoom und kein Spielzug. Ein
    // einzelner Finger bleibt unberührt – über ihn läuft jedes Wischen, jedes
    // Ziehen und jedes Tippen in den Spielen.
    document.addEventListener("touchmove", (event) => {
      if (event.touches.length > 1 && event.cancelable) event.preventDefault();
    }, { passive: false, capture: true });

    // Der Doppeltipp-Zoom bleibt bewusst dem touch-action im Stylesheet
    // überlassen. Ihn hier zusätzlich abzufangen hiesse, den zweiten Tipp
    // wegzunehmen – und schnelles Tippen an derselben Stelle ist in Turmbau und
    // Tier-Sprung der Spielzug selbst.
  }

  function mountFixedButtons() {
    mountHelpButton();
    mountAudioToggle();
    mountRotateHint();
    blockZoom();
    document.addEventListener("pointerdown", lockLandscape, { once: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountFixedButtons);
  else mountFixedButtons();
})();
