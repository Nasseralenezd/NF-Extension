/*
 * Audio compressor: a button in the player controls that evens out loud and
 * quiet moments, so one volume works for the whole stream. The stream's sound
 * goes through Web Audio's compressor (the same settings FrankerFaceZ uses).
 * Clicking the button turns it on or off, and that choice is remembered.
 */
(function () {
  const NF = window.NFTwitch;
  const BUTTON_ID = 'nftw-compressor';
  const CHECK_MS = 1000;

  let settings = null;
  let timer = 0;
  let context = null; // AudioContext, made on first use
  const graphs = new WeakMap(); // video element -> { source, compressor, on }
  const taken = new WeakSet(); // videos whose sound something else already routes (another extension)

  const wanted = () => settings.compressorOn !== false; // on until you turn it off

  // Once a video's sound goes through Web Audio it can't go back, so "off"
  // means straight through, without the compressor.
  function route(video, on) {
    let graph = graphs.get(video);
    if (!graph) {
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -50;
      compressor.knee.value = 40;
      compressor.ratio.value = 12;
      compressor.attack.value = 0;
      compressor.release.value = 0.25;
      graph = { source: context.createMediaElementSource(video), compressor };
      graphs.set(video, graph);
    }
    graph.source.disconnect();
    graph.compressor.disconnect();
    if (on) {
      graph.source.connect(graph.compressor);
      graph.compressor.connect(context.destination);
    } else {
      graph.source.connect(context.destination);
    }
    graph.on = on;
  }

  // Browsers only let sound through Web Audio after you've clicked or pressed
  // a key on the page. Until then the stream plays untouched.
  async function ready() {
    context ??= new AudioContext();
    if (context.state === 'suspended' && navigator.userActivation?.hasBeenActive) await context.resume().catch(() => {});
    return context.state === 'running';
  }

  async function sync() {
    const video = NF.player()?.video;
    if (!video) return;
    const on = wanted();
    const graph = graphs.get(video);
    // Untouched and staying that way. Twitch feeds its stream to the video
    // itself (no address, or a blob: one); sound from another site's address
    // would go silent through Web Audio.
    const ownStream = !video.currentSrc || video.currentSrc.startsWith('blob:');
    if (!graph && (!on || taken.has(video) || !ownStream)) return;
    if (!(await ready())) return;
    if (graph?.on === on) return;
    try {
      route(video, on);
    } catch {
      taken.add(video); // a video's sound can only be routed once
    }
  }

  async function toggle() {
    const on = !wanted();
    settings = { ...settings, compressorOn: on };
    updateButton();
    await sync();
    const found = NF.player();
    if (found) {
      const busy = found.video && taken.has(found.video);
      NF.playerToast(found.player, busy ? 'Another extension already handles this sound' : on ? 'Audio compressor on' : 'Audio compressor off');
    }
    NF.storage.setSetting('compressorOn', on).catch(() => {});
  }

  function onGesture() {
    if (wanted()) sync();
  }

  // Keeps the button in the player controls (Twitch re-renders them).
  function ensureButton() {
    const existing = document.getElementById(BUTTON_ID);
    const group = NF.$(NF.SEL.playerRightControls);
    if (!group) return existing?.remove();
    if (!existing || !group.contains(existing)) {
      existing?.remove();
      group.prepend(NF.el('button', { id: BUTTON_ID, class: 'nftw-player-btn', type: 'button', onclick: toggle }, compressorIcon()));
    }
    updateButton();
  }

  function updateButton() {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    const label = wanted() ? 'Audio compressor: on' : 'Audio compressor: off';
    button.setAttribute('aria-pressed', String(wanted()));
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  // Sound bars squeezed between two lines.
  function compressorIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of ['M3 5h18', 'M3 19h18', 'M6 10v4', 'M10 8.5v7', 'M14 9.5v5', 'M18 11v2']) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    return svg;
  }

  function tick() {
    ensureButton();
    sync();
  }

  NF.register('audioCompressor', {
    start(next) {
      settings = next;
      timer = setInterval(tick, CHECK_MS);
      document.addEventListener('pointerdown', onGesture, true);
      document.addEventListener('keydown', onGesture, true);
      tick();
    },
    update(next) {
      settings = next; // also picks up the button state from other tabs
      tick();
    },
    stop() {
      clearInterval(timer);
      document.removeEventListener('pointerdown', onGesture, true);
      document.removeEventListener('keydown', onGesture, true);
      document.getElementById(BUTTON_ID)?.remove();
      // Straight through again for the video this tab was compressing.
      const video = NF.player()?.video;
      if (video && graphs.get(video)?.on) route(video, false);
    },
  });
})();
