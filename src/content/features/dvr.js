/*
 * DVR switch. The seek bar itself (src/content/dvr-main.js) runs in Twitch's
 * own page context, where the player can be reached; this tells it whether
 * the feature is on, with a data attribute on <html>.
 */
(function () {
  const NF = window.NFTwitch;

  NF.register('dvr', {
    start() {
      document.documentElement.dataset.nftwDvr = '';
    },
    stop() {
      delete document.documentElement.dataset.nftwDvr;
    },
  });
})();
