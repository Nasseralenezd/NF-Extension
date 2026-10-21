/*
 * YouTube live channels: a "YouTube" section under Kick (or under ★ Favorites)
 * listing the YouTube channels that are live right now, from your YouTube
 * list in the popup plus (optionally) the channels you subscribe to on
 * youtube.com. Clicking one opens the live stream on YouTube in a new tab.
 */
(function () {
  const NF = window.NFTwitch;
  const SECTION_ID = 'nftw-youtube';
  const REFRESH_MS = 120_000; // YouTube lookups are bigger than Twitch's, so less often

  let active = false;
  let settings = null;
  let live = [];
  let signature = '';
  let stopWatching = null;
  let refreshTimer = 0;
  let folded = false; // section folded by clicking its header

  async function refresh(force = false) {
    try {
      await update(force);
    } catch (err) {
      if (NF.alive()) console.warn('[NF Extension] YouTube refresh failed:', err);
    }
  }

  async function update(force) {
    const manual = (await NF.storage.getFavorites('youtube')).map((f) => f.login);
    let next = [];
    if (manual.length || settings.ytSubs) {
      const res = await chrome.runtime.sendMessage({ type: 'youtube', channels: manual, subscriptions: !!settings.ytSubs, force });
      if (!res?.ok) return; // YouTube unreachable: keep showing what we had

      // By channel id: your list names a channel by @handle or id, your subscriptions by id.
      const channels = new Map();
      manual.forEach((key, order) => {
        const c = res.channels[key];
        if (c && !channels.has(c.channelId)) channels.set(c.channelId, { ...c, order });
      });
      (res.subscriptions?.channels || []).forEach((c, i) => {
        if (!channels.has(c.channelId)) channels.set(c.channelId, { ...c, order: manual.length + i });
      });
      next = [...channels.values()].filter((c) => c.live);
      if (settings.pinnedSort === 'manual') next.sort((a, b) => a.order - b.order);
      else next.sort((a, b) => b.viewers - a.viewers);
    }
    if (!active) return;
    live = next;
    render();
  }

  function render() {
    if (!active) return;
    let section = document.getElementById(SECTION_ID);
    if (!section) {
      section = build();
      signature = '';
    }

    // Right under Kick, or under Favorites, or where Favorites would be.
    const above = document.getElementById('nftw-kick') || document.getElementById('nftw-favorites');
    if (above) {
      if (above.nextElementSibling !== section) above.after(section);
    } else {
      const anchor = NF.favoritesAnchor(settings.pinnedPosition);
      if (!anchor) return;
      if (section.nextElementSibling !== anchor) anchor.before(section);
    }

    const collapsed = NF.isSideNavCollapsed();
    const next = JSON.stringify([collapsed, !!settings.streamPreview, live.map((c) => [c.login, c.videoId, c.displayName, c.avatar, c.viewers, c.game, c.title])]);
    if (next !== signature) {
      signature = next;
      section.classList.toggle('nftw-collapsed', collapsed);
      section.hidden = live.length === 0;
      section.querySelector('.nftw-list').replaceChildren(...live.map(card));
    }
    NF.applyFold(section, 'YouTube', folded, live.length);
  }

  function build() {
    return NF.el('div', { id: SECTION_ID, class: 'nftw-section nftw-youtube', role: 'group', 'aria-label': 'YouTube' }, [
      NF.sectionHeader(NF.youtubeIcon(14), 'YouTube', toggleFold),
      NF.el('div', { class: 'nftw-list' }),
    ]);
  }

  function toggleFold() {
    folded = !folded;
    render();
    NF.storage.setFolded('youtube', folded).catch(() => {});
  }

  function card(channel) {
    const viewers = NF.formatViewers(channel.viewers);
    const tooltip = `${channel.displayName} on YouTube · ${channel.game || 'Live'} · ${viewers} watching` + (channel.title ? `\n${channel.title}` : '');
    return NF.el(
      'a',
      {
        class: 'nftw-card',
        href: `https://www.youtube.com/watch?v=${channel.videoId}`,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: settings.streamPreview ? null : tooltip, // Stream preview's hover card replaces it
        'data-title': channel.title || null,
        'data-video-id': channel.videoId,
      },
      [
        channel.avatar
          ? NF.el('img', { class: 'nftw-avatar', src: channel.avatar, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' })
          : NF.el('span', { class: 'nftw-avatar nftw-avatar--letter', text: channel.displayName.replace(/^@/, '')[0] }),
        NF.el('div', { class: 'nftw-meta' }, [
          NF.el('div', { class: 'nftw-row' }, [
            NF.el('span', { class: 'nftw-name', text: channel.displayName }),
            NF.el('span', { class: 'nftw-viewers' }, [NF.el('span', { class: 'nftw-dot' }), viewers]),
          ]),
          NF.el('div', { class: 'nftw-game', text: channel.game }),
        ]),
      ]
    );
  }

  function onVisible() {
    if (document.visibilityState === 'visible') refresh();
  }

  NF.register('ytLive', {
    start(next) {
      active = true;
      settings = next;
      stopWatching = NF.watchSideNav(render);
      refreshTimer = setInterval(refresh, REFRESH_MS);
      document.addEventListener('visibilitychange', onVisible);
      NF.storage.getUi().then((ui) => {
        folded = !!ui.folded.youtube;
        render();
      }, () => {});
      refresh();
    },
    update(next) {
      settings = next;
      refresh();
    },
    onYoutubeFavorites() {
      refresh();
    },
    onUi(ui) {
      folded = !!ui.folded.youtube;
      render();
    },
    stop() {
      active = false;
      stopWatching?.();
      clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', onVisible);
      document.getElementById(SECTION_ID)?.remove();
      live = [];
      signature = '';
    },
  });
})();
