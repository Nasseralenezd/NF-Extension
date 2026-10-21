/*
 * Stop front-page autoplay: the featured stream at the top of Twitch's home
 * page stays paused until you press play in it yourself.
 */
(function () {
  const NF = window.NFTwitch;
  const CAROUSEL = '.featured-content-carousel';
  const PLAY_BUTTON = '[data-a-target="player-play-pause-button"]';

  let allowed = new WeakSet(); // featured videos you started yourself

  function pause(video) {
    if (video.paused || allowed.has(video)) return;
    // Twitch's own button keeps its player and controls in step.
    const button = video.closest('[data-a-target="video-player"]')?.querySelector(PLAY_BUTTON);
    if (button?.getAttribute('data-a-player-state') === 'playing') button.click();
    else video.pause();
  }

  function onPlay(event) {
    if (event.target instanceof HTMLVideoElement && event.target.closest(CAROUSEL)) pause(event.target);
  }

  // A click or key press inside the featured player means you want to watch it.
  function onUserInput(event) {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const player = event.target.closest('[data-a-target="video-player"]');
    const video = player?.closest(CAROUSEL) && player.querySelector('video');
    if (video) allowed.add(video);
  }

  NF.register('stopFrontAutoplay', {
    start() {
      // Media events don't bubble, but a capturing listener still sees them.
      document.addEventListener('play', onPlay, true);
      document.addEventListener('playing', onPlay, true);
      document.addEventListener('pointerdown', onUserInput, true);
      document.addEventListener('keydown', onUserInput, true);
      NF.$$(`${CAROUSEL} video`).forEach(pause); // it may have started before this ran
    },
    stop() {
      document.removeEventListener('play', onPlay, true);
      document.removeEventListener('playing', onPlay, true);
      document.removeEventListener('pointerdown', onUserInput, true);
      document.removeEventListener('keydown', onUserInput, true);
      allowed = new WeakSet();
    },
  });
})();
