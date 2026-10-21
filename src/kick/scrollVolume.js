/*
 * Scroll volume on kick.com: the mouse wheel over Kick's player turns the
 * volume up or down, with its own switch and step in the popup's Kick tab
 * ("Scroll volume"). Kick's own volume slider
 * follows the video, and the new volume is saved in Kick's "volume" cookie,
 * as Kick's slider does, so it sticks after a reload.
 */
(async function () {
  const store = globalThis.NFTwitchStorage;
  const PLAYER = '#injected-channel-player, #injected-embedded-channel-player-video';
  // Kick applies the volume at once, but during a quick scroll each tick
  // still builds on the last value we set rather than re-reading the video.
  const BURST_MS = 400;

  let settings = await store.getSettings();
  let last = { value: 0, at: 0 };
  let hideTimer = 0;

  const alive = () => {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  };

  function onWheel(event) {
    if (!alive()) return document.removeEventListener('wheel', onWheel, { capture: true }); // extension was reloaded
    if (!settings.scrollVolumeKick) return;
    if (!event.deltaY || event.ctrlKey) return; // Ctrl + wheel is browser zoom
    const target = event.target;
    if (!(target instanceof Element)) return;
    const player = target.closest(PLAYER);
    if (!player) return;
    // Let menus inside the player (quality, settings) scroll normally.
    if (target.closest('[role="menu"], [role="dialog"], [role="listbox"]')) return;
    const video = player.querySelector('video');
    if (!video) return;

    event.preventDefault();
    event.stopPropagation();

    const step = settings.scrollStepKick / 100;
    const now = Date.now();
    const current = now - last.at < BURST_MS ? last.value : video.muted ? 0 : video.volume;
    const next = Math.min(1, Math.max(0, Math.round((current + (event.deltaY < 0 ? step : -step)) * 100) / 100));
    last = { value: next, at: now };

    const unmuting = video.muted && next > 0;
    video.volume = next;
    video.muted = next === 0;
    save(next);
    // On unmute, Kick's player restores the volume (and cookie) it remembers;
    // put ours back once it has.
    if (unmuting) {
      setTimeout(() => {
        if (last.value !== next) return; // scrolled again meanwhile
        video.volume = next;
        save(next);
      }, 80);
    }
    showOverlay(player, next);
  }

  // Kick's own slider remembers the volume in this cookie; keep it in step.
  function save(value) {
    document.cookie = `volume=${value}; path=/; max-age=31536000; samesite=lax`;
  }

  function showOverlay(player, value) {
    let overlay = player.querySelector('.nftw-volume');
    if (!overlay) {
      const span = (cls, child) => {
        const node = document.createElement('span');
        node.className = cls;
        if (child) node.append(child);
        return node;
      };
      overlay = document.createElement('div');
      overlay.className = 'nftw-osd nftw-volume nftw-kick-osd';
      overlay.setAttribute('role', 'status');
      overlay.append(span('nftw-osd-label'), span('nftw-osd-bar', span('nftw-osd-fill')), span('nftw-osd-value'));
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

  store.onChange(async (change) => {
    if (change.settings) settings = await store.getSettings();
  });

  document.addEventListener('wheel', onWheel, { capture: true, passive: false });
})();
