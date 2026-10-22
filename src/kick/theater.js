/*
 * Auto theater mode on kick.com: switches the player to theater mode once
 * each time you open a channel. If you leave theater mode, it stays off
 * until the next channel.
 */
(async function () {
  const store = globalThis.NFTwitchStorage;
  const kick = globalThis.NFTwitchKickPlayer;
  const CHECK_MS = 1000;

  let settings = await store.getSettings();
  let timer = 0;
  let handled = null; // channel we already took care of

  // Kick marks its layout with data-theatre="true" while theater mode is on.
  const inTheater = () => [...document.querySelectorAll('[data-theatre]')].some((el) => el.dataset.theatre === 'true' && el.getClientRects().length);

  function check() {
    if (!kick.alive()) return setEnabled(false); // extension was reloaded
    const channel = kick.channel();
    // Only the channel's main (live) page, not its videos or clips.
    if (!channel || !/^\/[^/]+\/?$/.test(location.pathname)) {
      handled = null;
      return;
    }
    if (handled === channel) return;
    const button = kick.button('video-player-theatre-mode');
    if (!button || !kick.video()) return; // player still loading, or the channel is offline
    if (!inTheater()) button.click();
    handled = channel;
  }

  function setEnabled(on) {
    clearInterval(timer);
    timer = 0;
    handled = null;
    if (!on) return;
    timer = setInterval(check, CHECK_MS);
    check();
  }

  setEnabled(!!settings.kickTheater);
  store.onChange(async (change) => {
    if (!change.settings) return;
    const was = !!settings.kickTheater;
    settings = await store.getSettings();
    if (!!settings.kickTheater !== was) setEnabled(!!settings.kickTheater);
  });
})();
