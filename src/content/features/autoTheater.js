/*
 * Auto theater mode: switches to theater mode once each time you open a
 * channel. If you leave theater mode, it stays off until the next channel.
 */
(function () {
  const NF = window.NFTwitch;
  const CHECK_MS = 1000;

  let timer = 0;
  let handled = null; // channel we already took care of

  function check() {
    const channel = NF.currentChannel();
    // Only the channel's main (live) page, not /videos, /about, etc.
    const onLivePage = channel && /^\/[^/]+\/?$/.test(location.pathname);
    if (!onLivePage) {
      handled = null;
      return;
    }
    if (handled === channel) return;
    if (NF.$(NF.SEL.theaterActive)) {
      handled = channel;
      return;
    }
    const button = NF.playerButton('theater');
    if (!button) return; // player still loading
    button.click();
    handled = channel;
  }

  NF.register('autoTheater', {
    start() {
      handled = null;
      timer = setInterval(check, CHECK_MS);
      check();
    },
    stop() {
      clearInterval(timer);
    },
  });
})();
