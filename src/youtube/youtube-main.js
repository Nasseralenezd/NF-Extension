/*
 * YouTube scroll volume, auto quality and default playback speed. This file
 * runs in YouTube's own page context (not the extension's), because only
 * there does the player expose its controls (setVolume,
 * setPlaybackQualityRange, setPlaybackRate...). Using them keeps YouTube's
 * own volume bar, quality and speed menus in step.
 *
 * It has no access to the extension's settings: youtube.js puts them on
 * <html> while a feature is on (data-nftw-yt-scroll="5",
 * data-nftw-yt-quality="hd1080", data-nftw-yt-speed="1.5") and removes them
 * when it's off.
 */
(function () {
  const PLAYER = '#movie_player, .html5-video-player';
  // YouTube's names for its qualities, best first.
  const LEVELS = ['highres', 'hd2880', 'hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];
  const QUALITY_MS = 1000;
  let hideTimer = 0;
  let qualityDone = ''; // "video id|wanted quality" already applied
  let speedDone = ''; // "video id|wanted speed" already applied

  // Each new video starts at the chosen speed, once (live streams stay at
  // normal speed); picking another speed in the player afterwards sticks.
  function applySpeed() {
    const wanted = Number(document.documentElement.dataset.nftwYtSpeed);
    if (!wanted) return;
    const player = document.getElementById('movie_player');
    if (typeof player?.setPlaybackRate !== 'function' || player.classList.contains('ad-showing')) return;
    const data = player.getVideoData?.();
    if (!data?.video_id || speedDone === `${data.video_id}|${wanted}`) return;
    if (data.isLive) {
      speedDone = `${data.video_id}|${wanted}`;
      return;
    }
    // Until the video is ready the player only offers normal speed.
    if (!player.getAvailablePlaybackRates?.().includes(wanted)) return;
    player.setPlaybackRate(wanted);
    speedDone = `${data.video_id}|${wanted}`;
  }

  // Each new video (and each change of the setting) gets the chosen quality
  // once; picking another quality in YouTube's menu afterwards sticks.
  function applyQuality() {
    const wanted = document.documentElement.dataset.nftwYtQuality;
    if (!wanted) return;
    const player = document.getElementById('movie_player');
    if (typeof player?.getAvailableQualityLevels !== 'function') return;
    const id = player.getVideoData?.()?.video_id;
    const levels = player.getAvailableQualityLevels().filter((level) => LEVELS.includes(level)); // best first, without "auto"
    if (!id || !levels.length || qualityDone === `${id}|${wanted}`) return;
    // The chosen quality, or the best one below it.
    const limit = wanted === 'highest' ? 0 : LEVELS.indexOf(wanted);
    const pick = levels.find((level) => LEVELS.indexOf(level) >= limit) || levels[levels.length - 1];
    player.setPlaybackQualityRange?.(pick, pick);
    player.setPlaybackQuality?.(pick);
    qualityDone = `${id}|${wanted}`;
  }

  function onWheel(event) {
    const step = Number(document.documentElement.dataset.nftwYtScroll);
    if (!step || !event.deltaY || event.ctrlKey) return; // off, or Ctrl + wheel (browser zoom)
    const target = event.target;
    if (!(target instanceof Element)) return;
    const player = target.closest(PLAYER);
    if (!player || typeof player.setVolume !== 'function') return;
    // Let YouTube's own menus (quality, captions...) scroll normally.
    if (target.closest('.ytp-popup, .ytp-settings-menu, .ytp-panel-menu')) return;

    event.preventDefault();
    event.stopPropagation();

    const current = player.isMuted() ? 0 : player.getVolume();
    const next = Math.min(100, Math.max(0, Math.round(current + (event.deltaY < 0 ? step : -step))));
    if (next > 0 && player.isMuted()) player.unMute();
    player.setVolume(next);
    if (next === 0) player.mute();
    showOverlay(player, next);
  }

  // Same look as the volume overlay on Twitch and Kick (styles in osd.css).
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
      overlay.className = 'nftw-osd nftw-volume';
      overlay.setAttribute('role', 'status');
      overlay.append(span('nftw-osd-label'), span('nftw-osd-bar', span('nftw-osd-fill')), span('nftw-osd-value'));
      player.append(overlay);
    }
    overlay.querySelector('.nftw-osd-label').textContent = value === 0 ? 'Muted' : 'Volume';
    overlay.querySelector('.nftw-osd-fill').style.width = `${value}%`;
    overlay.querySelector('.nftw-osd-value').textContent = `${value}%`;
    overlay.classList.add('nftw-osd--on');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => overlay.classList.remove('nftw-osd--on'), 900);
  }

  document.addEventListener('wheel', onWheel, { capture: true, passive: false });
  setInterval(() => {
    applyQuality();
    applySpeed();
  }, QUALITY_MS);
})();
