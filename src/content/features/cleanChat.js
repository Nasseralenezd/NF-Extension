/*
 * Cleaner chat: each option turns on a class on <html>; the matching CSS
 * rules in content.css do the hiding, so new chat lines are covered at once.
 */
(function () {
  const NF = window.NFTwitch;
  const CLASSES = {
    chatHideBadges: 'nftw-chat-nobadges',
    chatHideCheers: 'nftw-chat-nocheers',
    chatHideHighlights: 'nftw-chat-nohighlights',
    chatCompact: 'nftw-chat-compact',
  };

  function apply(settings) {
    for (const [option, cls] of Object.entries(CLASSES)) {
      document.documentElement.classList.toggle(cls, !!(settings && settings[option]));
    }
  }

  NF.register('cleanChat', {
    start: apply,
    update: apply,
    stop() {
      apply(null);
    },
  });
})();
