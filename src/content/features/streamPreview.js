/*
 * Stream preview on twitch.tv: resting the pointer on a live channel in the
 * sidebar (★ Favorites, Kick, YouTube, and Twitch's own lists) opens a card with the
 * stream's live thumbnail, title, game and viewers (see src/shared/preview.js).
 * It takes the place of Twitch's own, smaller hover card while it is open.
 */
(function () {
  const NF = window.NFTwitch;
  const kickIds = new Map(); // Kick slug -> channel id, which Kick's thumbnail links use

  const twitchThumb = (login) => `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login}-640x360.jpg`;
  const kickThumb = (id) => `https://web.kick.com/api/v1/channels/${id}/thumbnail.jpeg`;

  // What the sidebar link already says about the channel.
  function describe(link) {
    const text = (selector) => link.querySelector(selector)?.textContent.trim() || '';
    if (link.closest('#nftw-youtube')) {
      // YouTube's live thumbnail is 4:3 with bars, which the card's 16:9 crop removes.
      const id = link.dataset.videoId;
      return { kick: false, thumb: id ? `https://i.ytimg.com/vi/${id}/hqdefault_live.jpg` : null, name: text('.nftw-name'), game: text('.nftw-game'), viewers: text('.nftw-viewers'), title: link.dataset.title || '' };
    }
    if (link.closest('#nftw-kick')) {
      const login = new URL(link.href).pathname.split('/')[1]?.toLowerCase();
      if (!login) return null;
      const id = link.dataset.channelId || kickIds.get(login);
      const info = { kick: true, thumb: id ? kickThumb(id) : null, name: text('.nftw-name'), game: text('.nftw-game'), viewers: text('.nftw-viewers'), title: link.dataset.title || '' };
      // Channels from your Kick follows come without an id; ask Kick once.
      if (!id) {
        info.more = async () => {
          const found = await kickId(login);
          return { thumb: found ? kickThumb(found) : null };
        };
      }
      return info;
    }
    const login = (link.getAttribute('href') || '').split('/')[1]?.toLowerCase();
    if (!login || !/^\w+$/.test(login)) return null;
    const info = { kick: false, thumb: twitchThumb(login) };
    if (link.closest('#nftw-favorites')) {
      return { ...info, name: text('.nftw-name'), game: text('.nftw-game'), viewers: text('.nftw-viewers'), title: link.dataset.title || '' };
    }
    // Twitch's own cards. Followed also lists offline channels; those have no preview.
    const status = link.querySelector('[data-a-target="side-nav-live-status"]');
    if (link.querySelector('.side-nav-card__avatar--offline') || (status && !status.querySelector('.tw-channel-status-indicator'))) return null;
    return {
      ...info,
      name: link.querySelector('[data-a-target="side-nav-title"]')?.getAttribute('title') || '',
      game: link.querySelector('.side-nav-card__metadata p')?.getAttribute('title') || '',
      viewers: status?.querySelector('span[aria-hidden]')?.textContent.trim() || '',
      title: '',
      // The card doesn't show the stream title; look it up.
      async more() {
        const user = (await NF.lookup([login]))?.[login];
        if (!user) return {};
        if (!user.live) return null;
        return { name: user.displayName, game: user.game, viewers: user.viewers, title: user.title };
      },
    };
  }

  async function kickId(login) {
    if (kickIds.has(login)) return kickIds.get(login);
    try {
      const res = await chrome.runtime.sendMessage({ type: 'kick', slugs: [login] });
      const id = (res?.ok && res.channels[login]?.channelId) || null;
      if (id) kickIds.set(login, id);
      return id;
    } catch {
      return null; // extension reloaded while this tab stayed open
    }
  }

  const preview = globalThis.NFTwitchPreview.create({
    links: '#nftw-favorites a.nftw-card, #nftw-kick a.nftw-card, #nftw-youtube a.nftw-card, a.side-nav-card__link, a.side-nav-card',
    sidebar: (link) => link.closest(NF.SEL.sideNav),
    describe,
  });

  NF.register('streamPreview', { start: preview.start, stop: preview.stop });
})();
