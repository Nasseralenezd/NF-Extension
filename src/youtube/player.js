/*
 * YouTube player tweaks (content script):
 *   Autoplay off     - YouTube's autoplay switch is turned off whenever it's
 *                      on, and a countdown to the next video that starts
 *                      anyway is cancelled. Playlists keep playing.
 *   Auto theater     - each video opens in theater (wide) mode; switching
 *                      back still works for that video.
 *   Audio compressor - a button in the player that evens out loud and quiet
 *                      moments. The sound goes through the shared path in
 *                      src/shared/audio.js; the button's on/off is remembered.
 */
(async function () {
  const store = globalThis.NFTwitchStorage;
  const sound = globalThis.NFTwitchAudio;
  const BUTTON_ID = 'nftw-yt-compressor';
  const CHECK_MS = 1000;

  let settings = await store.getSettings();
  let theaterDone = ''; // video already switched to theater

  const alive = () => {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  };
  const player = () => document.getElementById('movie_player');
  const shown = (el) => !!el && el.offsetParent !== null && getComputedStyle(el).display !== 'none';

  function autoplayOff() {
    const box = player();
    if (!box || box.classList.contains('ad-showing')) return;
    // The switch itself, as if you had clicked it.
    if (document.querySelector('.ytp-autonav-toggle-button[aria-checked="true"]')) document.querySelector('button.ytp-autonav-toggle')?.click();
    // "Up next in 5": cancelled, unless you're going through a playlist.
    const countdown = document.querySelector('.ytp-autonav-endscreen-countdown-overlay');
    if (shown(countdown) && !new URLSearchParams(location.search).has('list')) countdown.querySelector('.ytp-autonav-endscreen-upnext-cancel-button')?.click();
  }

  // Once per video, when its player is ready: wide, unless it already is.
  function theater() {
    const id = location.pathname === '/watch' && new URLSearchParams(location.search).get('v');
    const flexy = document.querySelector('ytd-watch-flexy');
    const button = document.querySelector('.ytp-size-button');
    if (!id || id === theaterDone || !flexy || !button || document.fullscreenElement) return;
    if (!(player()?.querySelector('video')?.readyState >= 1)) return;
    theaterDone = id;
    if (!flexy.hasAttribute('theater')) button.click();
  }

  /* ---------- Audio compressor ---------- */

  const compressing = () => settings.ytCompressorOn !== false; // on until you turn it off

  async function syncSound() {
    const video = player()?.querySelector('video');
    return video ? sound.set(video, { compress: !!settings.ytCompressor && compressing() }) : 'off';
  }

  async function toggleCompressor(event) {
    event.preventDefault();
    event.stopPropagation();
    const on = !compressing();
    settings = { ...settings, ytCompressorOn: on };
    updateButton();
    const result = await syncSound();
    toast(result === 'taken' ? 'Another extension already handles this sound' : on ? 'Audio compressor on' : 'Audio compressor off');
    store.setSetting('ytCompressorOn', on).catch(() => {});
  }

  // Keeps the button in the player's right controls (YouTube redraws them).
  function ensureButton() {
    const existing = document.getElementById(BUTTON_ID);
    const group = document.querySelector('#movie_player .ytp-right-controls-left') || document.querySelector('#movie_player .ytp-right-controls');
    if (!settings.ytCompressor || !group) return existing?.remove();
    if (!existing || !group.contains(existing)) {
      existing?.remove();
      const button = document.createElement('button');
      button.id = BUTTON_ID;
      button.className = 'ytp-button nftw-yt-btn';
      button.type = 'button';
      button.append(compressorIcon());
      button.addEventListener('click', toggleCompressor);
      group.prepend(button);
    }
    updateButton();
  }

  function updateButton() {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    const label = compressing() ? 'Audio compressor: on' : 'Audio compressor: off';
    if (button.title === label) return;
    button.setAttribute('aria-pressed', String(compressing()));
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  // Sound bars squeezed between two lines (the same icon as on Twitch and Kick).
  function compressorIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of ['M3 5h18', 'M3 19h18', 'M6 10v4', 'M10 8.5v7', 'M14 9.5v5', 'M18 11v2']) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    return svg;
  }

  // A short message over the video (styles in osd.css).
  function toast(text) {
    const box = player();
    if (!box) return;
    let note = box.querySelector('.nftw-toast');
    if (!note) {
      note = document.createElement('div');
      note.className = 'nftw-osd nftw-toast';
      note.setAttribute('role', 'status');
      box.append(note);
    }
    note.textContent = text;
    note.classList.add('nftw-osd--on');
    clearTimeout(note._timer);
    note._timer = setTimeout(() => note.classList.remove('nftw-osd--on'), 1400);
  }

  // Browsers only let sound through Web Audio after a click or key press on the page.
  function onGesture() {
    if (settings.ytCompressor && compressing()) syncSound();
  }

  function tick() {
    if (!alive()) return stop(); // extension was reloaded
    if (settings.ytNoAutoplay) autoplayOff();
    if (settings.ytTheater) theater();
    ensureButton();
    syncSound();
  }

  // This old copy steps aside until the tab is refreshed: no button, sound straight through.
  function stop() {
    clearInterval(timer);
    document.removeEventListener('pointerdown', onGesture, true);
    document.removeEventListener('keydown', onGesture, true);
    document.getElementById(BUTTON_ID)?.remove();
    const video = player()?.querySelector('video');
    if (video) sound.set(video, { compress: false });
  }

  const timer = setInterval(tick, CHECK_MS);
  document.addEventListener('pointerdown', onGesture, true);
  document.addEventListener('keydown', onGesture, true);
  store.onChange(async (change) => {
    if (!change.settings) return;
    settings = await store.getSettings();
    tick();
  });
})();
