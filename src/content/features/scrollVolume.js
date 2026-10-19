/*
 * Scroll volume: the mouse wheel over the video player turns the volume up or
 * down. It moves Twitch's own volume slider, so Twitch's UI and the volume it
 * remembers stay in sync.
 */
(function () {
  const NF = window.NFTwitch;
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

  // Twitch applies a new volume a moment after the slider moves, so during a
  // quick scroll each tick builds on the last value we set, not the video's.
  const BURST_MS = 400;

  let settings = null;
  let hideTimer = 0;
  let last = { value: 0, at: 0 };

  function onWheel(event) {
    if (!event.deltaY || event.ctrlKey) return; // Ctrl + wheel is browser zoom
    const target = event.target;
    if (!(target instanceof Element)) return;
    const player = target.closest(NF.SEL.player);
    if (!player) return;
    // Let scrollable menus inside the player (quality, settings) scroll normally.
    if (target.closest('[role="menu"], [role="dialog"]')) return;
    const video = player.querySelector('video');
    if (!video) return;

    event.preventDefault();
    event.stopPropagation();

    const step = settings.scrollStep / 100;
    const now = Date.now();
    const current = now - last.at < BURST_MS ? last.value : video.muted ? 0 : video.volume;
    const next = clamp(Math.round((current + (event.deltaY < 0 ? step : -step)) * 100) / 100);
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

  NF.register('scrollVolume', {
    start(next) {
      settings = next;
      document.addEventListener('wheel', onWheel, { capture: true, passive: false });
    },
    update(next) {
      settings = next;
    },
    stop() {
      document.removeEventListener('wheel', onWheel, { capture: true });
      NF.$$('.nftw-volume').forEach((el) => el.remove());
    },
  });
})();
