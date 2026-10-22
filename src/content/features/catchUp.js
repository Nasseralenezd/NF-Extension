/*
 * Catch up to live: when a live stream falls behind after buffering, it
 * jumps back to live instead of playing on behind. The work
 * happens in catchup-main.js, in Twitch's own page context where the player
 * can be reached; this puts <html data-nftw-catchup="seconds"> for it while
 * the feature is on.
 */
(function () {
  const NF = window.NFTwitch;

  const apply = (settings) => document.documentElement.setAttribute('data-nftw-catchup', String(Number(settings.catchUpDelay) || 5));

  NF.register('catchUp', {
    start: apply,
    update: apply,
    stop() {
      document.documentElement.removeAttribute('data-nftw-catchup');
    },
  });
})();
