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
 *   Default playback speed - also youtube-main.js, told the speed here.
 *   Hide end-screen clutter - CSS in youtube.css, one class per part.
 *   Hide watched videos - watched.js marks them, youtube.css hides them.
 *   Shorts in the normal player - here: Shorts addresses and links open as
 *                   regular videos.
 * Autoplay off, Auto theater mode and Audio compressor are in player.js.
 */
(async function () {
  const store = globalThis.NFTwitchStorage;
  const root = document.documentElement;
  const SHORTS = /^\/shorts\/([\w-]{11})/;
  let shortsPlayer = false;

  // A Shorts address (/shorts/ID) opens as a regular video (/watch?v=ID).
  function leaveShorts() {
    const id = shortsPlayer && location.pathname.match(SHORTS)?.[1];
    if (id) location.replace(`/watch?v=${id}`);
  }

  // A click on a Shorts link goes straight to the normal player, without
  // passing through the Shorts one. Ctrl / middle clicks open a new tab,
  // which then leaves the Shorts page by itself.
  function onClick(event) {
    if (!shortsPlayer || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href^="/shorts/"]') : null;
    const id = link?.getAttribute('href').match(SHORTS)?.[1];
    if (!id) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(`/watch?v=${id}`);
  }

  function apply(settings) {
    root.classList.toggle('nftw-yt-grid', !!settings.ytGrid);
    if (settings.ytGrid) root.style.setProperty('--nftw-yt-columns', String(Number(settings.ytGridColumns) || 5));
    else root.style.removeProperty('--nftw-yt-columns');

    root.classList.toggle('nftw-yt-noshorts', !!settings.ytHideShorts);

    if (settings.ytScrollVolume) root.dataset.nftwYtScroll = String(settings.ytScrollStep || 1);
    else delete root.dataset.nftwYtScroll;

    if (settings.ytQuality) root.dataset.nftwYtQuality = settings.ytQualityLevel || 'highest';
    else delete root.dataset.nftwYtQuality;

    if (settings.ytSpeed) root.dataset.nftwYtSpeed = String(settings.ytSpeedValue || '1.5');
    else delete root.dataset.nftwYtSpeed;

    root.classList.toggle('nftw-yt-noendcards', !!(settings.ytEndScreen && settings.ytEndCards));
    root.classList.toggle('nftw-yt-noendgrid', !!(settings.ytEndScreen && settings.ytEndGrid));

    root.classList.toggle('nftw-yt-hidewatched', !!settings.ytHideWatched);
    if (settings.ytHideWatched) root.dataset.nftwYtWatched = String(settings.ytHideWatchedPercent || '80');
    else delete root.dataset.nftwYtWatched;

    shortsPlayer = !!settings.ytShortsPlayer;
    leaveShorts();
  }

  document.addEventListener('click', onClick, true);
  // YouTube moves between pages without loading them (and the Shorts player
  // swipes from one Short to the next), so the address is checked as it changes.
  window.addEventListener('yt-navigate-finish', leaveShorts);
  window.addEventListener('popstate', leaveShorts);
  setInterval(leaveShorts, 1000);

  apply(await store.getSettings());
  store.onChange(async (change) => {
    if (change.settings) apply(await store.getSettings());
  });
})();
