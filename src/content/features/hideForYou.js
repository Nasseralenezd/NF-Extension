/*
 * Hide For You: hides everything Twitch shows above Followed Channels (the
 * For You title, stories and streaks). The collapse arrow and your Favorites
 * section stay.
 *
 * Two layers: CSS rules for the parts we know (see content.css, turned on by
 * a class on <html>, so they apply instantly), plus a structural pass that
 * hides any other block Twitch adds above Followed.
 */
(function () {
  const NF = window.NFTwitch;
  const HIDDEN_CLASS = 'nftw-foryou-hidden';
  const ROOT_CLASS = 'nftw-hide-foryou';

  let stopWatching = null;

  function run() {
    const followed = NF.followedSection(true);
    if (!followed) return;
    const favorites = document.getElementById('nftw-favorites');
    const hide = new Set(NF.blocksAbove(followed).filter((el) => !favorites || !el.contains(favorites)));

    for (const el of NF.$$(`.${HIDDEN_CLASS}`)) {
      if (!hide.has(el)) el.classList.remove(HIDDEN_CLASS);
    }
    for (const el of hide) {
      if (!el.classList.contains(HIDDEN_CLASS)) el.classList.add(HIDDEN_CLASS);
    }
  }

  NF.register('hideForYou', {
    start() {
      document.documentElement.classList.add(ROOT_CLASS);
      stopWatching = NF.watchSideNav(run);
    },
    stop() {
      stopWatching?.();
      document.documentElement.classList.remove(ROOT_CLASS);
      NF.$$(`.${HIDDEN_CLASS}`).forEach((el) => el.classList.remove(HIDDEN_CLASS));
    },
  });
})();
