/*
 * Shortcuts & screenshot, on channel and video pages:
 *   T theater   F fullscreen   C clip   S screenshot
 * Keys are ignored while you type (chat, search) or hold Ctrl / Alt / Cmd.
 * Optionally adds a camera button to the player controls.
 */
(function () {
  const NF = window.NFTwitch;
  const BUTTON_ID = 'nftw-screenshot';
  const CHECK_MS = 1000;

  let settings = null;
  let timer = 0;

  function isTyping(target) {
    return !!target?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]');
  }

  function onKeyDown(event) {
    if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    if (isTyping(event.target)) return;
    if (!NF.currentChannel() && !location.pathname.startsWith('/videos/')) return; // not on the home page carousel etc.
    const found = NF.player();
    if (!found) return;

    switch (event.key.toLowerCase()) {
      case 't':
        NF.playerButton('theater', found.player)?.click();
        break;
      case 'f': {
        // Twitch's player already handles F when it has focus. Only step in
        // if fullscreen didn't change, so it never toggles twice.
        const before = document.fullscreenElement;
        setTimeout(() => {
          if (document.fullscreenElement === before) NF.$(NF.SEL.fullscreenButton, found.player)?.click();
        }, 60);
        break;
      }
      case 'c':
        NF.playerButton('clip', found.player)?.click();
        break;
      case 's':
        screenshot();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function screenshot() {
    const found = NF.player();
    const video = found?.video;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    const flash = NF.el('div', { class: 'nftw-flash' });
    found.player.append(flash);
    setTimeout(() => flash.remove(), 400);

    try {
      canvas.toBlob((blob) => {
        if (!blob) return NF.playerToast(found.player, 'Screenshot failed');
        const url = URL.createObjectURL(blob);
        const link = NF.el('a', { href: url, download: `${NF.currentChannel() || 'twitch'}_${stamp()}.png` });
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        NF.playerToast(found.player, 'Screenshot saved');
      }, 'image/png');
    } catch {
      NF.playerToast(found.player, "This video can't be captured");
    }
  }

  // e.g. 2025-01-31_18-45-07
  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  }

  // Keeps the camera button in the player controls (Twitch re-renders them).
  function ensureButton() {
    const existing = document.getElementById(BUTTON_ID);
    const group = settings.screenshotButton && NF.$(NF.SEL.playerRightControls);
    if (!group) return existing?.remove();
    if (existing && group.contains(existing)) return;
    existing?.remove();
    const button = NF.el(
      'button',
      { id: BUTTON_ID, class: 'nftw-player-btn', type: 'button', title: 'Screenshot (s)', 'aria-label': 'Screenshot (s)', onclick: screenshot },
      cameraIcon()
    );
    group.prepend(button);
  }

  function cameraIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of ['M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.4-2h6.2l1.4 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z', 'M12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z']) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    return svg;
  }

  NF.register('shortcuts', {
    start(next) {
      settings = next;
      document.addEventListener('keydown', onKeyDown);
      timer = setInterval(ensureButton, CHECK_MS);
      ensureButton();
    },
    update(next) {
      settings = next;
      ensureButton();
    },
    stop() {
      document.removeEventListener('keydown', onKeyDown);
      clearInterval(timer);
      document.getElementById(BUTTON_ID)?.remove();
    },
  });
})();
