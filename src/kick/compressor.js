/*
 * Audio compressor on kick.com: a button in Kick's player controls that
 * evens out loud and quiet moments, so one volume works for the whole
 * stream. The sound goes through the same path as on Twitch
 * (src/shared/audio.js). Clicking the button turns it on or off, and that
 * choice is remembered.
 */
(async function () {
  const store = globalThis.NFTwitchStorage;
  const sound = globalThis.NFTwitchAudio;
  const kick = globalThis.NFTwitchKickPlayer;
  const BUTTON_ID = 'nftw-kick-compressor';
  const CHECK_MS = 1000;
  // Sound bars squeezed between two lines.
  const ICON = ['M3 5h18', 'M3 19h18', 'M6 10v4', 'M10 8.5v7', 'M14 9.5v5', 'M18 11v2'];

  let settings = await store.getSettings();
  let timer = 0;
  const applied = new WeakMap(); // video -> the setting its sound last got

  const wanted = () => settings.kickCompressorOn !== false; // on until you turn it off

  // Once a video's sound goes through Web Audio it can't go back, so "off"
  // means straight through, without the compressor. A video is only touched
  // again when the setting changes, or until it worked (the browser waits
  // for a click on the page first).
  async function sync(force = false) {
    const video = kick.video();
    if (!video) return 'off';
    const on = wanted();
    if (!force && applied.get(video) === on) return on ? 'on' : 'off';
    const result = await sound.set(video, { compress: on });
    if (on ? result === 'on' : result !== 'waiting') applied.set(video, on);
    return result;
  }

  async function toggle() {
    const on = !wanted();
    settings = { ...settings, kickCompressorOn: on };
    updateButton();
    const result = await sync(true);
    kick.toast(result === 'taken' ? 'Another extension already handles this sound' : on ? 'Audio compressor on' : 'Audio compressor off');
    store.setSetting('kickCompressorOn', on).catch(() => {});
  }

  function onGesture() {
    if (wanted()) sync();
  }

  // Keeps the button in the player controls (Kick redraws them as the player loads).
  function ensureButton() {
    const group = kick.controls();
    let button = document.getElementById(BUTTON_ID);
    if (!group) return button?.remove();
    if (!button) button = kick.playerButton(BUTTON_ID, '', ICON, toggle);
    if (!group.contains(button)) group.prepend(button);
    updateButton();
  }

  function updateButton() {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    const label = wanted() ? 'Audio compressor: on' : 'Audio compressor: off';
    if (button.title === label) return;
    button.setAttribute('aria-pressed', String(wanted()));
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  function tick() {
    if (!kick.alive()) return setEnabled(false); // extension was reloaded
    ensureButton();
    sync();
  }

  function setEnabled(on) {
    clearInterval(timer);
    timer = 0;
    document.removeEventListener('pointerdown', onGesture, true);
    document.removeEventListener('keydown', onGesture, true);
    if (on) {
      timer = setInterval(tick, CHECK_MS);
      document.addEventListener('pointerdown', onGesture, true);
      document.addEventListener('keydown', onGesture, true);
      tick();
      return;
    }
    document.getElementById(BUTTON_ID)?.remove();
    // Straight through again for the video this tab was compressing.
    const video = kick.video();
    if (video && applied.get(video)) sound.set(video, { compress: false });
    if (video) applied.delete(video);
  }

  setEnabled(!!settings.kickCompressor);
  store.onChange(async (change) => {
    if (!change.settings) return;
    const was = !!settings.kickCompressor;
    settings = await store.getSettings(); // also picks up the button state from other tabs
    if (!!settings.kickCompressor !== was) setEnabled(!!settings.kickCompressor);
    else if (timer) tick();
  });
})();
