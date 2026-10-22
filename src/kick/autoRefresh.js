/*
 * Auto refresh on player errors, on kick.com: when the stream stops and
 * doesn't come back, the page reloads by itself. Kick's player shows no
 * error of its own for this; it reconnects after short drops, and a stream
 * that ended turns into the offline page. So this watches the video: if it
 * should be playing but hasn't moved for a while, waiting for data or with a
 * media error, it reloads. It gives up after a few reloads in a row so a
 * stream that keeps failing can't trap the tab in a reload loop.
 */
(async function () {
  const store = globalThis.NFTwitchStorage;
  const kick = globalThis.NFTwitchKickPlayer;
  const CHECK_MS = 1000;
  const STUCK_MS = 20_000; // no progress for this long; Kick's own reconnecting gets that long first
  const MAX_RELOADS = 3; // within WINDOW_MS, per page
  const WINDOW_MS = 10 * 60_000;
  const KEY = 'nftw-kick-auto-refresh';

  let settings = await store.getSettings();
  let timer = 0;
  let last = null; // { video, time, at }: the last progress seen
  let gaveUp = false;

  function recentReloads(page) {
    try {
      const log = JSON.parse(sessionStorage.getItem(KEY) || '{}');
      return (log[page] || []).filter((at) => Date.now() - at < WINDOW_MS);
    } catch {
      return [];
    }
  }

  function noteReload(page, reloads) {
    try {
      const log = JSON.parse(sessionStorage.getItem(KEY) || '{}');
      log[page] = [...reloads, Date.now()];
      sessionStorage.setItem(KEY, JSON.stringify(log));
    } catch {}
  }

  function check() {
    if (!kick.alive()) return setEnabled(false); // extension was reloaded
    const video = kick.video();
    // Nothing to watch: no stream here, you paused it, it ended, or the tab
    // is in the background (where browsers hold video back).
    if (!video || video.paused || video.ended || document.hidden) {
      last = null;
      return;
    }
    const now = Date.now();
    if (!last || last.video !== video || video.currentTime !== last.time) {
      last = { video, time: video.currentTime, at: now };
      gaveUp = false;
      return;
    }
    const failing = !!video.error || video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;
    if (!failing || now - last.at < STUCK_MS) return;

    const page = location.pathname;
    const reloads = recentReloads(page);
    if (reloads.length >= MAX_RELOADS) {
      if (!gaveUp) kick.toast('Auto refresh stopped: the player keeps failing');
      gaveUp = true; // say it once
      return;
    }
    noteReload(page, reloads);
    location.reload();
  }

  function setEnabled(on) {
    clearInterval(timer);
    timer = 0;
    last = null;
    if (on) timer = setInterval(check, CHECK_MS);
  }

  setEnabled(!!settings.kickAutoRefresh);
  store.onChange(async (change) => {
    if (!change.settings) return;
    const was = !!settings.kickAutoRefresh;
    settings = await store.getSettings();
    if (!!settings.kickAutoRefresh !== was) setEnabled(!!settings.kickAutoRefresh);
  });
})();
