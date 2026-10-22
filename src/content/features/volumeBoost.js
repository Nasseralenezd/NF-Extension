/*
 * Volume boost: a button in the player controls that makes quiet streams
 * louder than 100%, by the Boost amount in its options. The sound goes
 * through the shared Web Audio path (src/shared/audio.js), after the Audio
 * compressor when that's on too. The button's state is remembered.
 */
(function () {
  const NF = window.NFTwitch;
  const sound = globalThis.NFTwitchAudio;
  const BUTTON_ID = 'nftw-boost';
  const CHECK_MS = 1000;

  let settings = null;
  let timer = 0;

  const boosted = () => settings.boostOn === true; // off until you press the button
  const gain = () => (boosted() ? (Number(settings.boostLevel) || 150) / 100 : 1);

  async function sync() {
    const video = NF.player()?.video;
    return video ? sound.set(video, { boost: gain() }) : 'off';
  }

  async function toggle() {
    const on = !boosted();
    settings = { ...settings, boostOn: on };
    updateButton();
    const result = await sync();
    const found = NF.player();
    if (found) NF.playerToast(found.player, result === 'taken' ? 'Another extension already handles this sound' : on ? `Volume boost ${Math.round(gain() * 100)}%` : 'Volume boost off');
    NF.storage.setSetting('boostOn', on).catch(() => {});
  }

  function onGesture() {
    if (boosted()) sync();
  }

  // Keeps the button in the player controls (Twitch re-renders them).
  function ensureButton() {
    const existing = document.getElementById(BUTTON_ID);
    const group = NF.$(NF.SEL.playerRightControls);
    if (!group) return existing?.remove();
    if (!existing || !group.contains(existing)) {
      existing?.remove();
      group.prepend(NF.el('button', { id: BUTTON_ID, class: 'nftw-player-btn', type: 'button', onclick: toggle }, boostIcon()));
    }
    updateButton();
  }

  function updateButton() {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    const label = boosted() ? `Volume boost: ${Math.round(gain() * 100)}%` : 'Volume boost: off';
    button.setAttribute('aria-pressed', String(boosted()));
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  // A speaker with a plus.
  function boostIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of ['M4 9.5h3.5L12 5.5v13l-4.5-4H4z', 'M18 8.5v7', 'M14.5 12h7']) {
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

  NF.register('volumeBoost', {
    start(next) {
      settings = next;
      timer = setInterval(tick, CHECK_MS);
      document.addEventListener('pointerdown', onGesture, true);
      document.addEventListener('keydown', onGesture, true);
      tick();
    },
    update(next) {
      settings = next; // the level, or the button pressed in another tab
      tick();
    },
    stop() {
      clearInterval(timer);
      document.removeEventListener('pointerdown', onGesture, true);
      document.removeEventListener('keydown', onGesture, true);
      document.getElementById(BUTTON_ID)?.remove();
      const video = NF.player()?.video;
      if (video) sound.set(video, { boost: 1 });
    },
  });
})();
