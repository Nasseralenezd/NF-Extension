/*
 * DVR for Twitch live streams. This file runs in Twitch's own page context
 * (not the extension's), because only there can the player be reached.
 *
 * A seek bar above the player controls spans the whole broadcast so far,
 * with the time on the left and LIVE on the right. Clicking or dragging back
 * plays from that moment, and the arrow keys jump 10 seconds; it all happens
 * in the same player, so you stay on the channel with its live chat. LIVE
 * jumps back. Rewinding plays Twitch's own recording of the broadcast, which
 * runs only seconds behind live, so the channel must keep past broadcasts.
 *
 * It has no access to the extension's settings: dvr.js puts
 * <html data-nftw-dvr> while the feature is on and removes it when it's off.
 */
(function () {
  const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'; // Twitch's own web client id, as in background.js
  const BAR_ID = 'nftw-dvr';
  const TICK_MS = 500;
  const LIVE_SNAP = 15; // this many seconds from the end counts as live
  const ARROW_STEP = 10;
  const INFO_MS = 5 * 60_000; // how often the stream's start and recording are read again

  let state = null; // the live channel on screen
  let dragging = null; // position on the bar (0..1) while dragging

  const enabled = () => document.documentElement.hasAttribute('data-nftw-dvr');
  const pageChannel = () => (location.pathname.split('/')[1] || '').toLowerCase();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Twitch keeps its player object on the player's React component.
  function findPlayer() {
    const element = document.querySelector('[data-a-target="video-player"]');
    const key = element && Object.keys(element).find((k) => k.startsWith('__reactFiber$'));
    for (let fiber = key && element[key], depth = 0; fiber && depth < 80; fiber = fiber.return, depth++) {
      const player = fiber.memoizedProps?.mediaPlayerInstance;
      if (typeof player?.load === 'function') return player;
    }
    return null;
  }

  async function gql(query, variables) {
    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: { 'Client-Id': CLIENT_ID, 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (!json.data) throw new Error(json.errors?.[0]?.message || 'Twitch sent no data');
    return json.data;
  }

  // When the broadcast started, and its recording (null when the channel doesn't keep past broadcasts).
  async function readStream(login) {
    const data = await gql('query NFTwitchDvr($login: String!) { user(login: $login) { stream { createdAt archiveVideo { id createdAt } } } }', { login });
    const stream = data.user?.stream;
    if (!stream) return null;
    const startedAt = Date.parse(stream.createdAt);
    const video = stream.archiveVideo;
    return { startedAt, recording: video ? { id: video.id, offset: (Date.parse(video.createdAt) - startedAt) / 1000 } : null };
  }

  function usher(path, params) {
    const query = new URLSearchParams({ allow_source: 'true', player_backend: 'mediaplayer', playlist_include_framerate: 'true', p: String(Math.floor(Math.random() * 1e7)), ...params });
    return `https://usher.ttvnw.net/${path}?${query}`;
  }

  async function recordingPath(id) {
    const data = await gql('query NFTwitchDvrVideo($id: ID!) { videoPlaybackAccessToken(id: $id, params: { platform: "web", playerBackend: "mediaplayer", playerType: "site" }) { value signature } }', { id });
    const token = data.videoPlaybackAccessToken;
    if (!token) throw new Error('no access to the recording');
    return usher(`vod/${id}.m3u8`, { nauth: token.value, nauthsig: token.signature });
  }

  // The address Twitch itself was playing, while its pass is still good (it
  // carries your own access, a subscription for example), otherwise a fresh one.
  async function livePath(login) {
    const saved = state.livePath;
    try {
      if (saved && JSON.parse(new URL(saved).searchParams.get('token')).expires > Date.now() / 1000 + 60) return saved;
    } catch {}
    const data = await gql('query NFTwitchDvrLive($login: String!) { streamPlaybackAccessToken(channelName: $login, params: { platform: "web", playerBackend: "mediaplayer", playerType: "site" }) { value signature } }', { login });
    const token = data.streamPlaybackAccessToken;
    return usher(`api/v2/channel/hls/${login}.m3u8`, { sig: token.signature, token: token.value });
  }

  const uptime = () => Math.max(1, (Date.now() - state.info.startedAt) / 1000);

  // Seconds since the broadcast started, for the moment on screen.
  function position() {
    const total = uptime();
    return state.dvr ? Math.min(total, state.info.recording.offset + state.player.getPosition()) : total;
  }

  async function seek(target) {
    if (!state?.info || state.busy) return;
    if (target >= uptime() - LIVE_SNAP) return goLive();
    const { recording } = state.info;
    if (!recording) return toast("This channel doesn't keep past broadcasts, so there's nothing to rewind");
    const at = Math.max(0, target - recording.offset);
    if (state.dvr) return state.player.seekTo(at);
    state.busy = true;
    try {
      const path = await recordingPath(recording.id);
      state.livePath = state.player.getPath();
      state.player.load(path);
      // A recording that is still growing first reports an endless length.
      for (let i = 0; i < 100 && !Number.isFinite(state.player.getDuration()); i++) await sleep(100);
      state.player.seekTo(at);
      state.player.play();
      state.dvr = true;
    } catch {
      toast("Couldn't open this stream's recording");
    } finally {
      state.busy = false;
    }
  }

  async function goLive() {
    if (!state?.dvr || state.busy) return;
    state.busy = true;
    try {
      state.player.load(await livePath(state.login));
      state.player.play();
      state.dvr = false;
    } catch {
      toast("Couldn't get back to live, reload the page");
    } finally {
      state.busy = false;
    }
  }

  // e.g. 33694 -> "09:21:34"
  function clock(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  }

  // A short message over the video (styles in osd.css, like the extension's other ones).
  function toast(text) {
    const player = document.querySelector('[data-a-target="video-player"]');
    if (!player) return;
    let node = player.querySelector('.nftw-toast');
    if (!node) {
      node = document.createElement('div');
      node.className = 'nftw-osd nftw-toast';
      node.setAttribute('role', 'status');
      player.append(node);
    }
    node.textContent = text;
    node.classList.add('nftw-osd--on');
    clearTimeout(node._nftwTimer);
    node._nftwTimer = setTimeout(() => node.classList.remove('nftw-osd--on'), 2200);
  }

  function buildBar() {
    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      node.className = className;
      if (text) node.textContent = text;
      return node;
    };
    const bar = el('div', 'nftw-dvr');
    bar.id = BAR_ID;
    const live = el('button', 'nftw-dvr-live', 'Live');
    live.type = 'button';
    live.title = 'Back to live';
    live.addEventListener('click', goLive);
    const track = el('div', 'nftw-dvr-track');
    track.setAttribute('role', 'slider');
    track.setAttribute('aria-label', 'Rewind');
    const tip = el('span', 'nftw-dvr-tip');
    track.append(el('span', 'nftw-dvr-fill'), tip);

    const fraction = (event) => {
      const rect = track.getBoundingClientRect();
      return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    };
    track.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      track.setPointerCapture(event.pointerId);
      dragging = fraction(event);
      render();
    });
    track.addEventListener('pointermove', (event) => {
      const f = fraction(event);
      tip.textContent = clock(f * uptime());
      tip.style.left = `${f * 100}%`;
      if (dragging != null) {
        dragging = f;
        render();
      }
    });
    track.addEventListener('pointerup', () => {
      if (dragging == null) return;
      const target = dragging * uptime();
      dragging = null;
      seek(target);
    });
    bar.append(el('div', 'nftw-dvr-row'), track);
    bar.firstChild.append(el('span', 'nftw-dvr-time'), live);
    return bar;
  }

  function render() {
    const controls = document.querySelector('[data-a-target="player-controls"]');
    if (!controls) return;
    let bar = document.getElementById(BAR_ID);
    if (!bar || bar.parentElement !== controls) {
      bar?.remove();
      bar = buildBar();
      controls.prepend(bar); // its first row, so it shows and hides with Twitch's controls
    }
    const total = uptime();
    const at = dragging != null ? dragging * total : position();
    bar.querySelector('.nftw-dvr-time').textContent = clock(at);
    bar.querySelector('.nftw-dvr-fill').style.width = `${Math.min(100, (at / total) * 100)}%`;
    bar.classList.toggle('nftw-dvr--live', !state.dvr);
    bar.classList.toggle('nftw-dvr--fixed', !state.info.recording); // nothing to rewind into
    const track = bar.querySelector('.nftw-dvr-track');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', String(Math.round(total)));
    track.setAttribute('aria-valuenow', String(Math.round(at)));
    track.setAttribute('aria-valuetext', clock(at));
  }

  function removeBar() {
    document.getElementById(BAR_ID)?.remove();
  }

  function tick() {
    if (!enabled()) {
      if (state?.dvr) goLive();
      removeBar();
      return;
    }
    const player = findPlayer();
    const login = pageChannel();
    if (!player || !login) return removeBar();
    // Another channel, or Twitch built a new player: start over.
    if (!state || state.login !== login || state.player !== player) {
      state = { login, player, info: undefined, readAt: 0, dvr: false, busy: false, livePath: null };
    }
    // Twitch switched back to live by itself (after a reconnect, for example).
    if (state.dvr && !state.busy && !String(player.getPath()).includes('/vod/')) state.dvr = false;
    // Not this channel's live stream (offline, a rerun, another channel's player...).
    if (!state.dvr && !state.busy && player.getLoadedChannelLogin?.() !== login) return removeBar();
    if (state.info === undefined || Date.now() - state.readAt > INFO_MS) {
      state.readAt = Date.now();
      const asked = state;
      readStream(login).then(
        (info) => (asked.info = info),
        () => {}
      );
    }
    if (!state.info) return removeBar();
    render();
  }

  // Arrow keys jump 10 seconds back or ahead, unless you're typing.
  function onKeyDown(event) {
    if (!enabled() || !state?.info?.recording || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return;
    if (!document.getElementById(BAR_ID)) return;
    event.preventDefault();
    seek(position() + (event.key === 'ArrowLeft' ? -ARROW_STEP : ARROW_STEP));
  }

  setInterval(tick, TICK_MS);
  document.addEventListener('keydown', onKeyDown);
})();
