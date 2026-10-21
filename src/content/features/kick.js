/*
 * Kick channels: a "Kick" section right under ★ Favorites listing the Kick
 * channels that are live right now, from your Kick list in the popup plus
 * (optionally) the channels you follow on kick.com. Clicking one opens it on
 * kick.com in a new tab.
 */
(function () {
  const NF = window.NFTwitch;
  const SECTION_ID = 'nftw-kick';
  const REFRESH_MS = 60_000;

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
      if (NF.alive()) console.warn('[NF Extension] Kick refresh failed:', err);
    }
  }

  async function update(force) {
    const manual = (await NF.storage.getFavorites('kick')).map((f) => f.login);
    let next = [];
    if (manual.length || settings.kickFollowed) {
      const res = await chrome.runtime.sendMessage({ type: 'kick', slugs: manual, followed: !!settings.kickFollowed, force });
      if (!res?.ok) return; // Kick unreachable: keep showing what we had

      const channels = new Map();
      manual.forEach((slug, order) => {
        if (res.channels[slug]) channels.set(slug, { ...res.channels[slug], order });
      });
      (res.followed?.channels || []).forEach((c, i) => {
        if (!channels.has(c.login)) channels.set(c.login, { ...c, order: manual.length + i });
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

    // Right after Favorites when that section exists, otherwise where it would be.
    const favorites = document.getElementById('nftw-favorites');
    if (favorites) {
      if (favorites.nextElementSibling !== section) favorites.after(section);
    } else {
      const anchor = NF.favoritesAnchor(settings.pinnedPosition);
      if (!anchor) return;
      if (section.nextElementSibling !== anchor) anchor.before(section);
    }

    const collapsed = NF.isSideNavCollapsed();
    const next = JSON.stringify([collapsed, live.map((c) => [c.login, c.displayName, c.avatar, c.viewers, c.hideViewers, c.game, c.title])]);
    if (next !== signature) {
      signature = next;
      section.classList.toggle('nftw-collapsed', collapsed);
      section.hidden = live.length === 0;
      section.querySelector('.nftw-list').replaceChildren(...live.map(card));
    }
    NF.applyFold(section, 'Kick', folded, live.length);
  }

  function build() {
    return NF.el('div', { id: SECTION_ID, class: 'nftw-section nftw-kick', role: 'group', 'aria-label': 'Kick' }, [
      NF.sectionHeader(NF.el('span', { class: 'nftw-kick-logo', 'aria-hidden': 'true', text: 'K' }), 'Kick', toggleFold),
      NF.el('div', { class: 'nftw-list' }),
    ]);
  }

  function toggleFold() {
    folded = !folded;
    render();
    NF.storage.setFolded('kick', folded).catch(() => {});
  }

  function card(channel) {
    // Some streamers hide their viewer count on Kick; show just "Live" for them.
    const viewers = channel.hideViewers ? 'Live' : NF.formatViewers(channel.viewers);
    const tooltip =
      `${channel.displayName} on Kick · ${channel.game || 'Live'}` +
      (channel.hideViewers ? '' : ` · ${viewers} viewers`) +
      (channel.title ? `\n${channel.title}` : '');
    return NF.el(
      'a',
      { class: 'nftw-card', href: `https://kick.com/${channel.login}`, target: '_blank', rel: 'noopener noreferrer', title: tooltip },
      [
        channel.avatar
          ? NF.el('img', { class: 'nftw-avatar', src: channel.avatar, alt: '', loading: 'lazy' })
          : NF.el('span', { class: 'nftw-avatar nftw-avatar--letter', text: channel.displayName[0] }),
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

  NF.register('kick', {
    start(next) {
      active = true;
      settings = next;
      stopWatching = NF.watchSideNav(render);
      refreshTimer = setInterval(refresh, REFRESH_MS);
      document.addEventListener('visibilitychange', onVisible);
      NF.storage.getUi().then((ui) => {
        folded = !!ui.folded.kick;
        render();
      }, () => {});
      refresh();
    },
    update(next) {
      settings = next;
      refresh();
    },
    onKickFavorites() {
      refresh();
    },
    onUi(ui) {
      folded = !!ui.folded.kick;
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
