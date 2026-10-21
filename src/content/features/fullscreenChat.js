/*
 * Fullscreen chat on twitch.tv: while the player is fullscreen, the channel's
 * chat shows over the right side of the video (see src/shared/fullscreenChat.js).
 */
(function () {
  const NF = window.NFTwitch;

  // Twitch's chat class names; update them here if Twitch changes them.
  const SEE_THROUGH = `
    html, body, #root, .stream-chat, .stream-chat-header, .chat-shell, .chat-room, .chat-room__content,
    .chat-list--default, .chat-list--other, .chat-scrollable-area__message-container, .scrollable-area,
    .chat-input, .chat-input__buttons-container { background: transparent !important; }
    .chat-room { text-shadow: 0 0 2px #000, 0 0 3px #000; }
    [data-a-target="chat-input"] { background: rgba(0, 0, 0, 0.6) !important; }
  `;

  const chat = globalThis.NFTwitchFullscreenChat.create({
    chatUrl() {
      const login = NF.currentChannel(); // live channel pages only, not videos
      return login ? `https://www.twitch.tv/popout/${login}/chat?popout=` : null;
    },
    isPlayer(element) {
      const video = NF.player()?.video;
      return !!video && element.contains(video);
    },
    css: SEE_THROUGH,
  });

  NF.register('fullscreenChat', { start: chat.start, stop: chat.stop });
})();
