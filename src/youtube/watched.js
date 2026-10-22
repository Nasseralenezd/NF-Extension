/*
 * Hide watched videos: marks the videos you've watched at least as far as
 * you picked (YouTube's red bar under the thumbnail), and youtube.css hides
 * the marked ones on Home, in Subscriptions and in the suggestions next to a
 * video. youtube.js turns it on with data-nftw-yt-watched="80" on <html>.
 */
(function () {
  const root = document.documentElement;
  const MARK = 'nftw-yt-watched';
  const CHECK_MS = 1000;
  // The red bar in both thumbnail styles; its width is how much you've watched.
  const BARS = '.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment, ytd-thumbnail-overlay-resume-playback-renderer #progress';
  const ITEMS = 'ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model';

  function mark() {
    const least = Number(root.dataset.nftwYtWatched);
    const watched = new Set();
    if (least) {
      for (const bar of document.querySelectorAll(BARS)) {
        if (!(parseFloat(bar.style.width) >= least)) continue;
        // The whole grid cell where there is one, so no empty gap is left.
        const item = bar.closest('ytd-rich-item-renderer') || bar.closest(ITEMS);
        if (item) watched.add(item);
      }
    }
    // YouTube reuses cards for other videos as you scroll and move between pages.
    for (const item of document.querySelectorAll(`.${MARK}`)) if (!watched.has(item)) item.classList.remove(MARK);
    for (const item of watched) item.classList.add(MARK);
  }

  setInterval(mark, CHECK_MS);
})();
