/*
 * Fullscreen chat on kick.com: while the player is fullscreen, the channel's
 * chat shows over the right side of the video (see src/shared/fullscreenChat.js).
 */
(async function () {
  const store = globalThis.NFTwitchStorage;
  // First path parts on kick.com that aren't channels.
  const NOT_CHANNELS = new Set(['browse', 'following', 'categories', 'category', 'search', 'settings', 'dashboard', 'popout', 'drops', 'events', 'video', 'clips', 'subscriptions', 'messages', 'transactions']);

  // Kick's chat markup; update it here if Kick changes it.
  const SEE_THROUGH = `
    html, body, #channel-chatroom, #channel-chatroom .bg-surface-bg-lowest { background: transparent !important; }
    #channel-chatroom { text-shadow: 0 0 2px #000, 0 0 3px #000; }
  `;

  let settings = await store.getSettings();
  let running = false;

  const chat = globalThis.NFTwitchFullscreenChat.create({
    chatUrl() {
      const parts = location.pathname.split('/').filter(Boolean);
      // A channel page is kick.com/<channel>; its videos and clips have no live chat.
      return parts.length === 1 && !NOT_CHANNELS.has(parts[0].toLowerCase()) ? `https://kick.com/popout/${parts[0]}/chat` : null;
    },
    isPlayer: (element) => !!element.querySelector('video#video-player'),
    css: SEE_THROUGH,
  });

  function apply() {
    const want = !!settings.kickFullscreenChat;
    if (want === running) return;
    running = want;
    if (want) chat.start();
    else chat.stop();
  }

  apply();
  store.onChange(async (change) => {
    if (!change.settings) return;
    settings = await store.getSettings();
    apply();
  });
})();
