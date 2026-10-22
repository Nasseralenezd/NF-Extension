/*
 * One sound path per video for the tweaks that change how a stream sounds
 * (Audio compressor, Volume boost), on any of the sites. A video's sound can
 * go through Web Audio only once and never back, so they share it:
 *   video -> compressor (when on) -> gain (the boost) -> speakers
 * Used as NFTwitchAudio.set(video, { compress: true }) or { boost: 1.5 }.
 */
(function () {
  let context = null; // made on first use
  const paths = new WeakMap(); // video -> { source, compressor, gain }
  const wants = new WeakMap(); // video -> { compress, boost }
  const taken = new WeakSet(); // videos whose sound something else already routes (another extension)

  // Browsers only let sound through Web Audio after you've clicked or pressed
  // a key on the page. Until then the stream plays untouched.
  async function ready() {
    context ??= new AudioContext();
    if (context.state === 'suspended' && navigator.userActivation?.hasBeenActive) await context.resume().catch(() => {});
    return context.state === 'running';
  }

  function build(video) {
    const compressor = context.createDynamicsCompressor();
    // The settings FrankerFaceZ uses.
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;
    const path = { source: context.createMediaElementSource(video), compressor, gain: context.createGain() };
    path.gain.connect(context.destination);
    paths.set(video, path);
    return path;
  }

  /**
   * Changes one tweak for this video's sound: { compress: true | false } or
   * { boost: 1.5 } (1 = as loud as the player says). Resolves to 'on' when the
   * sound goes through the path, 'off' when it plays as the site sends it,
   * 'waiting' until you've clicked the page, or 'taken' when another
   * extension already handles it.
   */
  async function set(video, change) {
    const want = { compress: false, boost: 1, ...wants.get(video), ...change };
    wants.set(video, want);
    const neutral = !want.compress && want.boost === 1;
    if (taken.has(video)) return 'taken';
    // Untouched and staying that way. The sites feed their streams to the
    // video themselves (no address, or a blob: one); sound from another
    // site's address would go silent through Web Audio.
    if (!paths.has(video) && (neutral || (video.currentSrc && !video.currentSrc.startsWith('blob:')))) return 'off';
    if (!(await ready())) return 'waiting';
    let path = paths.get(video);
    try {
      path ??= build(video);
    } catch {
      taken.add(video); // a video's sound can only be routed once
      return 'taken';
    }
    const now = wants.get(video); // the latest wish, if another call came in while waiting
    const status = !now.compress && now.boost === 1 ? 'off' : 'on';
    // Features ask every second; only rewire when something changed, so the sound never hiccups.
    if (path.compress === now.compress && path.boost === now.boost) return status;
    path.source.disconnect();
    path.compressor.disconnect();
    path.gain.gain.value = now.boost;
    if (now.compress) {
      path.source.connect(path.compressor);
      path.compressor.connect(path.gain);
    } else {
      path.source.connect(path.gain);
    }
    path.compress = now.compress;
    path.boost = now.boost;
    return status;
  }

  /** What this video's sound goes through now: { routed, compress, boost }. */
  function state(video) {
    const want = { compress: false, boost: 1, ...wants.get(video) };
    return { routed: paths.has(video), compress: want.compress, boost: want.boost };
  }

  globalThis.NFTwitchAudio = { set, state, isTaken: (video) => taken.has(video) };
})();
