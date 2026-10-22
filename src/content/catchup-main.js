/*
 * Catch up to live, in Twitch's own page context (catchUp.js turns it on).
 * Twitch won't play live streams faster than normal, and after a pause it
 * goes back to live by itself, so this is for falling behind after buffering.
 * While <html data-nftw-catchup="N"> is set:
 *  - the player is told to come back at live after it has had to buffer
 *    (its own rebuffer-to-live setting, which Twitch leaves off), and
 *  - when it's still more than N seconds behind with plenty of video already
 *    downloaded, it skips ahead through that video, keeping a second in hand.
 *    Each skip makes it buffer for a moment, so it only skips when that's
 *    worth it, and at most once every 10 seconds.
 * Rewinding with the DVR plays a recording, which this leaves alone.
 */
(function () {
  const TICK_MS = 1000;
  const REST_MS = 10_000; // between skips
  const MIN_AHEAD = 2.5; // seconds downloaded ahead before a skip is worth it

  let lastSkip = 0;
  let told = null; // the player told to rebuffer to live

  // Twitch keeps its player object on the player's React component (as in dvr-main.js).
  function findPlayer() {
    const element = document.querySelector('[data-a-target="video-player"]');
    const key = element && Object.keys(element).find((k) => k.startsWith('__reactFiber$'));
    for (let fiber = key && element[key], depth = 0; fiber && depth < 80; fiber = fiber.return, depth++) {
      const player = fiber.memoizedProps?.mediaPlayerInstance;
      if (typeof player?.load === 'function') return player;
    }
    return null;
  }

  function tick() {
    const delay = Number(document.documentElement.getAttribute('data-nftw-catchup'));
    const player = delay > 0 && findPlayer();
    if (!player) return;
    try {
      // Stays on for this player; a new channel brings a new player, which Twitch sets up again.
      if (told !== player) {
        player.setRebufferToLive(true);
        told = player;
      }
      const live = !Number.isFinite(player.getDuration()); // a recording has an end, live doesn't
      if (!live || player.getState() !== 'Playing' || player.isPaused() || Date.now() - lastSkip < REST_MS) return;
      const ahead = player.getBufferDuration();
      if (!(player.getLiveLatency() > delay) || !(ahead > MIN_AHEAD)) return;
      lastSkip = Date.now();
      player.seekTo(player.getPosition() + ahead - 1);
    } catch {
      // the player is being replaced (another channel); try again next tick
    }
  }

  setInterval(tick, TICK_MS);
})();
