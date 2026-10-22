/*
 * Kick's player, for the kick.com features that work on it (Auto theater
 * mode, Audio compressor, Auto refresh, Shortcuts). Kick can keep hidden
 * copies of a page around while it brings in the next one, so only what's on
 * screen counts. Used as globalThis.NFTwitchKickPlayer.
 */
(function () {
  // First path parts on kick.com that aren't channels.
  const NOT_CHANNELS = new Set(['browse', 'following', 'categories', 'category', 'search', 'settings', 'dashboard', 'popout', 'drops', 'events', 'video', 'clips', 'subscriptions', 'messages', 'transactions']);

  const shown = (el) => !!el && el.getClientRects().length > 0;

  /** The stream's <video> on this page, or null. */
  function video() {
    return [...document.querySelectorAll('#injected-channel-player video#video-player')].find(shown) || null;
  }

  /** The box around the video, where the player's own overlays (and our messages) go. */
  function box(v = video()) {
    return v?.closest('#injected-embedded-channel-player-video, #injected-channel-player') || null;
  }

  /** One of the player's own buttons: 'video-player-theatre-mode', 'video-player-pip', ... */
  function button(testId) {
    return [...document.querySelectorAll(`[data-testid="${testId}"]`)].find(shown) || null;
  }

  /** The buttons on the right of the player's controls (PiP, Clip, Theater, Fullscreen, Settings). */
  function controls() {
    return button('video-player-fullscreen')?.parentElement || null;
  }

  /** The channel this page belongs to (kick.com/<channel>/...), or null. */
  function channel() {
    const first = location.pathname.split('/')[1]?.toLowerCase();
    return first && !NOT_CHANNELS.has(first) ? first : null;
  }

  /** A short message in the middle-top of the player (the volume overlay's look). */
  function toast(text) {
    const at = box();
    if (!at) return;
    let node = at.querySelector('.nftw-toast');
    if (!node) {
      node = document.createElement('div');
      node.className = 'nftw-osd nftw-toast nftw-kick-osd';
      node.setAttribute('role', 'status');
      at.append(node);
    }
    node.textContent = text;
    node.classList.add('nftw-osd--on');
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('nftw-osd--on'), 1400);
  }

  /** A button for the player's controls, drawn like Kick's own (it borrows their classes). */
  function playerButton(id, label, paths, onClick) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of paths) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    const node = document.createElement('button');
    node.id = id;
    node.type = 'button';
    node.className = `${button('video-player-theatre-mode')?.className || ''} nftw-kick-btn`;
    node.title = label;
    node.setAttribute('aria-label', label);
    node.append(svg);
    node.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return node;
  }

  function isTyping(target) {
    return !!target?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]');
  }

  // False once the extension was reloaded or updated while this tab stayed open.
  function alive() {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  }

  globalThis.NFTwitchKickPlayer = { video, box, button, controls, channel, toast, playerButton, isTyping, alive };
})();
