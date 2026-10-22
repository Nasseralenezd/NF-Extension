/*
 * Highlight favorites in chat: messages from your favorite streamers stand
 * out in any chat. Twitch marks each chat line with its author's login
 * (data-a-user); lines from a favorite get a class that content.css colors.
 */
(function () {
  const NF = window.NFTwitch;
  const CLASS = 'nftw-chat-fav';

  let active = false;
  let favorites = new Set();
  let stopWatching = null;

  const mark = (line) => line.classList.toggle(CLASS, favorites.has(line.getAttribute('data-a-user') || ''));

  function load(list) {
    if (!active) return;
    favorites = new Set(list.map((f) => f.login));
    document.querySelectorAll('.chat-line__message').forEach(mark);
  }

  NF.register('chatFavorites', {
    async start() {
      active = true;
      stopWatching = NF.watchChat(mark);
      load(await NF.storage.getFavorites());
    },
    onFavorites: load,
    stop() {
      active = false;
      stopWatching?.();
      stopWatching = null;
      document.querySelectorAll(`.${CLASS}`).forEach((line) => line.classList.remove(CLASS));
    },
  });
})();
