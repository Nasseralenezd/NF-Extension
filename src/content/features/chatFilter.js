/*
 * Chat filter: hides chat messages that contain any of the words you list,
 * and highlights messages with any of the others. Matching ignores case and
 * also looks at emote names, so you can filter an emote too. Separate words
 * or phrases with commas.
 */
(function () {
  const NF = window.NFTwitch;
  const HIDE = 'nftw-chat-hide';
  const FLAG = 'nftw-chat-flag';

  let hide = [];
  let flag = [];
  let stopWatching = null;

  // "Spoiler, give away" -> ['spoiler', 'give away']
  const words = (text) =>
    String(text || '')
      .toLowerCase()
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean);

  function check(line) {
    const body = line.querySelector('[data-a-target="chat-line-message-body"]');
    const emotes = body ? [...body.querySelectorAll('img[alt]')].map((img) => img.alt) : [];
    const text = `${body?.textContent || ''} ${emotes.join(' ')}`.toLowerCase();
    line.classList.toggle(HIDE, hide.some((w) => text.includes(w)));
    line.classList.toggle(FLAG, flag.some((w) => text.includes(w)));
  }

  function apply(settings) {
    hide = words(settings.chatFilterHide);
    flag = words(settings.chatFilterHighlight);
    document.querySelectorAll('.chat-line__message').forEach(check);
  }

  NF.register('chatFilter', {
    start(settings) {
      apply(settings);
      stopWatching = NF.watchChat(check);
    },
    update: apply,
    stop() {
      stopWatching?.();
      stopWatching = null;
      document.querySelectorAll(`.${HIDE}, .${FLAG}`).forEach((line) => line.classList.remove(HIDE, FLAG));
    },
  });
})();
