/*
 * Scroll volume: the mouse wheel over the video player turns the volume up or
 * down. It moves Twitch's own volume slider, so Twitch's UI and the volume it
 * remembers stay in sync.
 *
 * Twitch extensions on the video sit in frames that get the wheel instead of
 * this page. Our small script in those frames (src/content/extension-frame.js)
 * asks whether it's on the player; while Scroll volume is on, the frames on
 * the player pass their wheel here.
 */
(function () {
  const NF = window.NFTwitch;
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const EXTENSION_ORIGIN = /^https:\/\/[\w-]+\.ext-twitch\.tv$/;

  // Twitch applies a new volume a moment after the slider moves, so during a
  // quick scroll each tick builds on the last value we set, not the video's.
  const BURST_MS = 400;

  let active = false;
  let settings = null;
  let hideTimer = 0;
  let last = { value: 0, at: 0 };
  const extensionFrames = new Map(); // frame window -> its origin, for frames on the player

  function onWheel(event) {
    if (!event.deltaY || event.ctrlKey) return; // Ctrl + wheel is browser zoom
    const target = event.target;
    if (!(target instanceof Element)) return;
    const player = target.closest(NF.SEL.player);
    if (!player) return;
    // Let scrollable menus inside the player (quality, settings) scroll normally.
    if (target.closest('[role="menu"], [role="dialog"]')) return;
    if (!player.querySelector('video')) return;

    event.preventDefault();
    event.stopPropagation();
    turn(player, event.deltaY < 0);
  }

  // One step of the wheel on this player.
  function turn(player, up) {
    const video = player.querySelector('video');
    if (!video) return;
    const step = settings.scrollStep / 100;
    const now = Date.now();
    const current = now - last.at < BURST_MS ? last.value : video.muted ? 0 : video.volume;
    const next = clamp(Math.round((current + (up ? step : -step)) * 100) / 100);
    last = { value: next, at: now };
    setVolume(player, video, next);
    showOverlay(player, next);
  }

  function setVolume(player, video, value) {
    const slider = NF.$(NF.SEL.volumeSlider, player);
    if (!slider) {
      video.volume = value;
      video.muted = value === 0;
      return;
    }
    nativeValue.call(slider, String(value));
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function showOverlay(player, value) {
    let overlay = player.querySelector('.nftw-volume');
    if (!overlay) {
      overlay = NF.el('div', { class: 'nftw-osd nftw-volume', role: 'status' }, [
        NF.el('span', { class: 'nftw-osd-label' }),
        NF.el('span', { class: 'nftw-osd-bar' }, NF.el('span', { class: 'nftw-osd-fill' })),
        NF.el('span', { class: 'nftw-osd-value' }),
      ]);
      player.append(overlay);
    }
    const percent = Math.round(value * 100);
    overlay.querySelector('.nftw-osd-label').textContent = percent === 0 ? 'Muted' : 'Volume';
    overlay.querySelector('.nftw-osd-fill').style.width = `${percent}%`;
    overlay.querySelector('.nftw-osd-value').textContent = `${percent}%`;
    overlay.classList.add('nftw-osd--on');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => overlay.classList.remove('nftw-osd--on'), 900);
  }

  const clamp = (v) => Math.min(1, Math.max(0, v));

  // The player an extension frame sits on: the frame, or a frame it's inside, is in the player.
  function playerOf(source) {
    for (const player of NF.$$(NF.SEL.player)) {
      for (const frame of player.querySelectorAll('iframe')) {
        for (let w = source, depth = 0; w && depth < 4; w = w.parent === w ? null : w.parent, depth++) {
          if (w === frame.contentWindow) return player;
        }
      }
    }
    return null;
  }

  function armFrames() {
    for (const [frame, origin] of extensionFrames) {
      if (frame.closed) extensionFrames.delete(frame);
      else frame.postMessage({ type: 'nftw-wheel-arm', on: active }, origin);
    }
  }

  // Listens even while off, so frames that said hello can be armed when it's turned on.
  window.addEventListener('message', (event) => {
    if (!EXTENSION_ORIGIN.test(event.origin) || !event.source) return;
    const type = event.data?.type;
    if (type === 'nftw-wheel-hello') {
      if (!playerOf(event.source)) return; // e.g. panel extensions under the stream
      extensionFrames.set(event.source, event.origin);
      event.source.postMessage({ type: 'nftw-wheel-arm', on: active }, event.origin);
    } else if (type === 'nftw-wheel' && active) {
      const player = playerOf(event.source);
      if (player) turn(player, event.data.up === true);
    }
  });

  NF.register('scrollVolume', {
    start(next) {
      active = true;
      settings = next;
      document.addEventListener('wheel', onWheel, { capture: true, passive: false });
      armFrames();
    },
    update(next) {
      settings = next;
    },
    stop() {
      active = false;
      document.removeEventListener('wheel', onWheel, { capture: true });
      NF.$$('.nftw-volume').forEach((el) => el.remove());
      armFrames();
    },
  });
})();
