/*
 * Cleaner chat on kick.com: each option turns on a class on <html>; the
 * matching rules in kick.css do the hiding, so new chat lines are covered at
 * once.
 */
(async function () {
  const store = globalThis.NFTwitchStorage;
  const kick = globalThis.NFTwitchKickPlayer;
  const CLASSES = {
    kickChatHideBadges: 'nftw-kick-chat-nobadges',
    kickChatHideSubs: 'nftw-kick-chat-nosubs',
    kickChatHideBots: 'nftw-kick-chat-nobots',
    kickChatCompact: 'nftw-kick-chat-compact',
  };

  let settings = await store.getSettings();
  let aliveTimer = 0;

  function apply(next) {
    let any = false;
    for (const [option, cls] of Object.entries(CLASSES)) {
      const on = !!(next?.kickCleanChat && next[option]);
      document.documentElement.classList.toggle(cls, on);
      any ||= on;
    }
    // Once the extension is reloaded this copy can't hear about changes any
    // more; put chat back the way Kick shows it until the tab is refreshed.
    clearInterval(aliveTimer);
    if (any) aliveTimer = setInterval(() => kick.alive() || apply(null), 5000);
  }

  apply(settings);
  store.onChange(async (change) => {
    if (!change.settings) return;
    settings = await store.getSettings();
    apply(settings);
  });
})();
