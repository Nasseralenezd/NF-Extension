/*
 * Fullscreen chat: while the player is fullscreen, the channel's chat shows
 * over the right side of the video, see-through so the stream stays visible,
 * and you can still read, scroll and type. It is the site's own pop-out chat
 * in a frame, so you're logged in there as usual. Shared by twitch.tv and
 * kick.com; each site says where its chat is and how to make it see-through.
 */
(function (root) {
  /**
   * chatUrl(): the pop-out chat address for the channel on screen, or null.
   * isPlayer(element): true when that fullscreen element is the stream's player.
   * css: rules put into the chat page to make its backgrounds see-through.
   */
  function create({ chatUrl, isPlayer, css }) {
    let box = null; // the overlay, kept between fullscreen visits on the same channel
    let url = null;

    function build(src) {
      const frame = document.createElement('iframe');
      frame.className = 'nftw-fs-chat-frame';
      frame.title = 'Chat';
      frame.src = src;
      frame.addEventListener('load', () => seeThrough(frame));
      const node = document.createElement('div');
      node.className = 'nftw-fs-chat';
      node.append(frame);
      return node;
    }

    // The chat page is on the same site, so its look can be adjusted from here.
    function seeThrough(frame) {
      try {
        const doc = frame.contentDocument;
        const style = doc.createElement('style');
        style.textContent = css;
        doc.head.append(style);
        // A frame only shows through when its color scheme matches the page's.
        frame.style.colorScheme = getComputedStyle(doc.documentElement).colorScheme;
      } catch {
        // can't reach it: the chat just stays solid
      }
    }

    function sync() {
      const target = document.fullscreenElement;
      const next = target && isPlayer(target) ? chatUrl() : null;
      if (!next) {
        box?.classList.remove('nftw-fs-chat--on');
        return;
      }
      if (!box || url !== next) {
        box?.remove();
        box = build(next);
        url = next;
      }
      if (box.parentElement !== target) target.append(box);
      box.classList.add('nftw-fs-chat--on');
    }

    return {
      start() {
        document.addEventListener('fullscreenchange', sync);
        sync();
      },
      stop() {
        document.removeEventListener('fullscreenchange', sync);
        box?.remove();
        box = url = null;
      },
    };
  }

  root.NFTwitchFullscreenChat = { create };
})(globalThis);
