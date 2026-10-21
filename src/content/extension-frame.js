/*
 * Runs inside the frames of Twitch extensions (*.ext-twitch.tv). The ones on
 * the video player cover it, so the mouse wheel goes to their page and never
 * reaches Scroll volume on twitch.tv. The Twitch page tells the frames that
 * sit on its player when Scroll volume is on; while it is, a wheel the
 * extension doesn't use (nothing under the pointer to scroll) is passed to
 * the Twitch page, which changes the volume. Nothing else is read or changed.
 */
(function () {
  if (window.top === window) return;
  const TWITCH = 'https://www.twitch.tv';
  let armed = false;

  // A scrolling box under the pointer keeps the wheel, and so does the
  // extension's page while it can still scroll that way.
  function scrollsItself(target, deltaY) {
    for (let el = target instanceof Element ? target : null; el && el !== document.documentElement; el = el.parentElement || el.getRootNode().host || null) {
      if (/auto|scroll|overlay/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1) return true;
    }
    const page = document.scrollingElement;
    return !!page && (deltaY < 0 ? page.scrollTop > 0 : page.scrollTop + page.clientHeight < page.scrollHeight - 1);
  }

  function onWheel(event) {
    if (!armed || !event.deltaY || event.ctrlKey || event.defaultPrevented) return; // Ctrl + wheel is browser zoom
    if (scrollsItself(event.target, event.deltaY)) return;
    event.preventDefault();
    window.top.postMessage({ type: 'nftw-wheel', up: event.deltaY < 0 }, TWITCH);
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window.top || event.origin !== TWITCH || event.data?.type !== 'nftw-wheel-arm') return;
    armed = event.data.on === true;
  });
  window.addEventListener('wheel', onWheel, { passive: false });

  // Ask the Twitch page whether this frame is on its player, again a few
  // times in case it wasn't listening yet.
  for (const ms of [0, 1000, 4000, 10000]) {
    setTimeout(() => armed || window.top.postMessage({ type: 'nftw-wheel-hello' }, TWITCH), ms);
  }
})();
