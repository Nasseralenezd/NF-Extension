/*
 * YouTube features (content script, runs at document start):
 *   Classic grid  - more videos per row (4 to 8) on Home, Subscriptions and
 *                   channel pages. CSS in youtube.css, switched on by a class.
 *   Hide Shorts   - hides Shorts shelves, Shorts in feeds and search, and the
 *                   Shorts menu entry. CSS in youtube.css.
 *   Scroll volume - the wheel itself is handled by youtube-main.js, which runs
 *                   in YouTube's own page context so it can use the player's
 *                   volume controls. This script only tells it the step (via a
 *                   data attribute on <html>), or removes it when turned off.
 *   Auto quality  - the same way: youtube-main.js sets the quality, this
 *                   script tells it which one.
 */
(async function () {
  const store = globalThis.NFTwitchStorage;
  const root = document.documentElement;

  function apply(settings) {
    root.classList.toggle('nftw-yt-grid', !!settings.ytGrid);
    if (settings.ytGrid) root.style.setProperty('--nftw-yt-columns', String(Number(settings.ytGridColumns) || 5));
    else root.style.removeProperty('--nftw-yt-columns');

    root.classList.toggle('nftw-yt-noshorts', !!settings.ytHideShorts);

    if (settings.ytScrollVolume) root.dataset.nftwYtScroll = String(settings.ytScrollStep || 1);
    else delete root.dataset.nftwYtScroll;

    if (settings.ytQuality) root.dataset.nftwYtQuality = settings.ytQualityLevel || 'highest';
    else delete root.dataset.nftwYtQuality;
  }

  apply(await store.getSettings());
  store.onChange(async (change) => {
    if (change.settings) apply(await store.getSettings());
  });
})();
