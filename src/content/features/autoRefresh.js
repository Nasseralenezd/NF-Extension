/*
 * Auto refresh on player errors: when Twitch's player stops with error
 * #1000, #2000, #3000, #4000 or #5000 (shown over the video as "Error
 * #2000"...), the page reloads by itself. It waits a moment first, in case
 * the player recovers on its own, and gives up after a few reloads in a row
 * so a stream that keeps failing can't trap the tab in a reload loop.
 */
(function () {
  const NF = window.NFTwitch;
  const ERROR_GATE = '[data-a-target="player-overlay-content-gate"]';
  const CODES = /#([1-5])000\b/;
  const CHECK_MS = 1000;
  const GRACE_MS = 3000; // the error must still be there after this long
  const MAX_RELOADS = 3; // within WINDOW_MS, per channel
  const WINDOW_MS = 10 * 60_000;
  const KEY = 'nftw-auto-refresh';

  let timer = 0;
  let seenAt = 0; // when the current error appeared

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
    const found = NF.player();
    const gate = found?.player.querySelector(ERROR_GATE);
    if (!gate || !CODES.test(gate.textContent)) {
      seenAt = 0;
      return;
    }
    seenAt ||= Date.now();
    if (Date.now() - seenAt < GRACE_MS) return;

    const page = location.pathname;
    const reloads = recentReloads(page);
    if (reloads.length >= MAX_RELOADS) {
      if (seenAt > 0) NF.playerToast(found.player, 'Auto refresh stopped: the player keeps failing');
      seenAt = -1; // say it once
      return;
    }
    noteReload(page, reloads);
    location.reload();
  }

  NF.register('autoRefresh', {
    start() {
      seenAt = 0;
      timer = setInterval(check, CHECK_MS);
    },
    stop() {
      clearInterval(timer);
    },
  });
})();
