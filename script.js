(() => {
  'use strict';

  const STORAGE = {
    stats: 'umang-ff-panel:stats',
    settings: 'umang-ff-panel:settings',
    hud: 'umang-ff-panel:hud'
  };
  const defaults = { general: 90, 'red-dot': 85, scope2: 80, scope4: 75, sniper: 50, 'free-look': 70 };
  const settingIds = Object.keys(defaults);
  const $ = (id) => document.getElementById(id);

  function readJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  const stats = Object.assign({ sessions: 0, hits: 0, best: 0 }, readJSON(STORAGE.stats, {}));
  stats.sessions = Number.isFinite(Number(stats.sessions)) ? Math.max(0, Number(stats.sessions)) : 0;
  stats.hits = Number.isFinite(Number(stats.hits)) ? Math.max(0, Number(stats.hits)) : 0;
  stats.best = Number.isFinite(Number(stats.best)) ? Math.max(0, Number(stats.best)) : 0;

  function renderStats() {
    $('sessions').textContent = String(stats.sessions);
    $('hits').textContent = String(stats.hits);
    $('best').textContent = stats.best ? String(stats.best) : '—';
  }
  renderStats();

  // Aim trainer: all activity stays in this page and is not connected to the game.
  const arena = $('arena');
  const hint = $('arena-hint');
  const startButton = $('start-btn');
  const timerDisplay = $('timer');
  const gameState = $('game-state');
  const result = $('result');
  const ROUND_MS = 20000;
  let roundActive = false;
  let roundHits = 0;
  let roundStartedAt = 0;
  let timerInterval = null;

  function removeTarget() {
    const target = arena.querySelector('.target');
    if (target) target.remove();
  }

  function spawnTarget() {
    removeTarget();
    const target = document.createElement('button');
    target.type = 'button';
    target.className = 'target';
    target.setAttribute('aria-label', 'Tap target');
    const inset = 23;
    const width = Math.max(0, arena.clientWidth - inset * 2);
    const height = Math.max(0, arena.clientHeight - inset * 2);
    target.style.left = `${inset + Math.random() * width}px`;
    target.style.top = `${inset + Math.random() * height}px`;
    arena.appendChild(target);
  }

  function finishRound() {
    if (!roundActive) return;
    roundActive = false;
    window.clearInterval(timerInterval);
    timerInterval = null;
    removeTarget();
    hint.hidden = false;
    hint.innerHTML = 'ROUND COMPLETE<br><small>Press start to play again</small>';
    gameState.textContent = 'ROUND COMPLETE';
    timerDisplay.textContent = '0.0';
    startButton.disabled = false;
    startButton.textContent = 'PLAY AGAIN';
    stats.best = Math.max(stats.best, roundHits);
    saveJSON(STORAGE.stats, stats);
    renderStats();
    result.textContent = `Round complete — ${roundHits} ${roundHits === 1 ? 'hit' : 'hits'}.`;
  }

  startButton.addEventListener('click', () => {
    if (roundActive) return;
    roundHits = 0;
    roundStartedAt = performance.now();
    roundActive = true;
    stats.sessions += 1;
    saveJSON(STORAGE.stats, stats);
    renderStats();
    hint.hidden = true;
    gameState.textContent = 'ROUND IN PROGRESS';
    timerDisplay.textContent = '20.0';
    result.textContent = 'Tap each target when it appears.';
    startButton.disabled = true;
    startButton.textContent = 'ROUND IN PROGRESS';
    spawnTarget();

    timerInterval = window.setInterval(() => {
      const remaining = Math.max(0, ROUND_MS - (performance.now() - roundStartedAt));
      timerDisplay.textContent = (remaining / 1000).toFixed(1);
      if (remaining <= 0) finishRound();
    }, 50);
  });

  arena.addEventListener('click', (event) => {
    if (!roundActive || !event.target.closest('.target')) return;
    roundHits += 1;
    stats.hits += 1;
    saveJSON(STORAGE.stats, stats);
    renderStats();
    result.textContent = `${roundHits} ${roundHits === 1 ? 'hit' : 'hits'} this round.`;
    spawnTarget();
  });

  $('reset-btn').addEventListener('click', () => {
    roundActive = false;
    window.clearInterval(timerInterval);
    timerInterval = null;
    removeTarget();
    hint.hidden = false;
    hint.innerHTML = 'PRESS START<br><small>Then tap the targets</small>';
    gameState.textContent = 'READY WHEN YOU ARE';
    timerDisplay.textContent = '20.0';
    startButton.disabled = false;
    startButton.textContent = 'START 20s ROUND';
    result.textContent = 'Your score will appear here.';
  });

  // Load, update, and save the personal sensitivity values on this device.
  const savedSettings = readJSON(STORAGE.settings, {});
  function updateSetting(id, value) {
    const input = $(id);
    const numericValue = Math.min(200, Math.max(0, Number(value)));
    input.value = String(Number.isFinite(numericValue) ? numericValue : defaults[id]);
    $(`${id}-val`).value = input.value;
    $(`${id}-val`).textContent = input.value;
  }

  settingIds.forEach((id) => {
    updateSetting(id, Object.prototype.hasOwnProperty.call(savedSettings, id) ? savedSettings[id] : defaults[id]);
    $(id).addEventListener('input', () => updateSetting(id, $(id).value));
  });

  function collectSettings() {
    return Object.fromEntries(settingIds.map((id) => [id, Number($(id).value)]));
  }

  $('save-settings').addEventListener('click', () => {
    $('save-note').textContent = saveJSON(STORAGE.settings, collectSettings())
      ? 'Settings saved on this device.'
      : 'Could not save settings. Check your browser storage permissions.';
  });

  $('reset-settings').addEventListener('click', () => {
    settingIds.forEach((id) => updateSetting(id, defaults[id]));
    const saved = saveJSON(STORAGE.settings, defaults);
    $('save-note').textContent = saved ? 'Defaults restored and saved on this device.' : 'Defaults restored for this visit, but could not be saved.';
  });

  // HUD notes are stored locally; they are never sent to a server.
  const hudNotes = $('hud-notes');
  try {
    hudNotes.value = localStorage.getItem(STORAGE.hud) || '';
  } catch (error) {
    // The form still works for the current page if browser storage is unavailable.
  }
  $('save-hud').addEventListener('click', () => {
    let saved = false;
    try {
      localStorage.setItem(STORAGE.hud, hudNotes.value);
      saved = true;
    } catch (error) {
      saved = false;
    }
    $('hud-status').textContent = saved ? 'HUD notes saved on this device.' : 'Could not save notes. Check your browser storage permissions.';
  });
})();
