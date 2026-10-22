/*
 * Chat width: drag chat's left edge to make it wider or narrower, and the
 * width is remembered. Twitch sizes chat, and the video beside it, with a
 * fixed 34rem; while <html class="nftw-chat-width"> is set, content.css uses
 * --nftw-chat-width there instead. Double-click the edge for Twitch's own
 * width again.
 */
(function () {
  const NF = window.NFTwitch;
  const HANDLE_ID = 'nftw-chat-resizer';
  const MIN = 250;
  const CHECK_MS = 1000;

  let timer = 0;

  const clampWidth = (px) => Math.round(Math.min(Math.max(MIN, window.innerWidth * 0.6), Math.max(MIN, px)));

  function applyWidth(px) {
    const root = document.documentElement;
    root.classList.toggle('nftw-chat-width', !!px);
    if (px) root.style.setProperty('--nftw-chat-width', `${clampWidth(px)}px`);
    else root.style.removeProperty('--nftw-chat-width');
  }

  // The handle sits on the open chat's left edge, last in its column so it's
  // above chat's own boxes (Twitch re-renders them).
  function ensureHandle() {
    const column = document.querySelector('.channel-root__right-column--expanded');
    let handle = document.getElementById(HANDLE_ID);
    if (!column) return handle?.remove();
    if (!handle) handle = build();
    if (column.lastElementChild !== handle) column.append(handle);
  }

  function build() {
    const handle = NF.el('div', {
      id: HANDLE_ID,
      class: 'nftw-chat-resizer',
      role: 'separator',
      'aria-orientation': 'vertical',
      'aria-label': 'Chat width',
      title: "Drag to resize chat. Double-click for Twitch's own width.",
    });
    handle.addEventListener('pointerdown', drag);
    handle.addEventListener('dblclick', () => {
      applyWidth(null);
      NF.storage.setSetting('chatWidthPx', null).catch(() => {});
    });
    return handle;
  }

  function drag(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    const right = handle.parentElement.getBoundingClientRect().right; // chat's right edge stays put
    let width = null;
    const move = (e) => {
      width = clampWidth(right - e.clientX);
      applyWidth(width);
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      document.documentElement.classList.remove('nftw-chat-resizing');
      if (width) NF.storage.setSetting('chatWidthPx', width).catch(() => {});
    };
    handle.setPointerCapture(event.pointerId);
    document.documentElement.classList.add('nftw-chat-resizing');
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  NF.register('chatWidth', {
    start(settings) {
      applyWidth(settings.chatWidthPx);
      timer = setInterval(ensureHandle, CHECK_MS);
      ensureHandle();
    },
    update(settings) {
      applyWidth(settings.chatWidthPx); // also a width set in another tab
    },
    stop() {
      clearInterval(timer);
      document.getElementById(HANDLE_ID)?.remove();
      applyWidth(null);
    },
  });
})();
