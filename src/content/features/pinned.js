/*
 * Pinned favorites: a "Favorites" section above Followed Channels listing the
 * favorites who are live right now, sorted by viewers or by your own order.
 */
(function () {
  const NF = window.NFTwitch;
  const SECTION_ID = 'nftw-favorites';
  const HIDDEN_CLASS = 'nftw-dup-hidden';
  const REFRESH_MS = 60_000;

  let active = false;
  let settings = null;
  let live = [];
  let signature = '';
  let stopWatching = null;
  let refreshTimer = 0;

  async function refresh(force = false) {
    try {
      await update(force);
    } catch (err) {
      if (NF.alive()) console.warn('[NF Extension] favorites refresh failed:', err);
    }
  }

  async function update(force) {
    const favorites = await NF.storage.getFavorites();
    let next = [];
    if (favorites.length) {
      const users = await NF.lookup(favorites.map((f) => f.login), force);
      if (!users) return; // Twitch unreachable: keep showing what we had
      const order = new Map(favorites.map((f, i) => [f.login, i]));
      next = Object.values(users).filter((u) => u?.live);
      if (settings.pinnedSort === 'manual') next.sort((a, b) => order.get(a.login) - order.get(b.login));
      else next.sort((a, b) => b.viewers - a.viewers);
    }
    if (!active) return;
    live = next;
    render();
  }

  // Runs on every side nav mutation, including the ones it causes itself, so
  // it only touches the DOM when something actually changed.
  function render() {
    if (!active) return;
    const anchor = NF.favoritesAnchor(settings.pinnedPosition);
    if (!anchor) return;

    let section = document.getElementById(SECTION_ID);
    if (!section) {
      section = build();
      signature = '';
    }
    // The Kick section may sit right after us; that still counts as in place.
    let after = section.nextElementSibling;
    if (after?.id === 'nftw-kick') after = after.nextElementSibling;
    if (after !== anchor) anchor.before(section);

    const collapsed = NF.isSideNavCollapsed();
    const next = JSON.stringify([collapsed, live.map((u) => [u.login, u.displayName, u.avatar, u.viewers, u.game, u.title])]);
    if (next !== signature) {
      signature = next;
      section.classList.toggle('nftw-collapsed', collapsed);
      section.hidden = live.length === 0;
      section.querySelector('.nftw-list').replaceChildren(...live.map(card));
    }
    hideDuplicates();
  }

  function build() {
    const star = NF.el('span', { class: 'nftw-header-star' }, NF.starIcon(14));
    return NF.el('div', { id: SECTION_ID, class: 'nftw-section', role: 'group', 'aria-label': 'Favorites' }, [
      NF.el('div', { class: 'nftw-header' }, [star, NF.el('h3', { class: 'nftw-header-title', text: 'Favorites' })]),
      NF.el('div', { class: 'nftw-list' }),
    ]);
  }

  function card(user) {
    const viewers = NF.formatViewers(user.viewers);
    const tooltip = `${user.displayName} · ${user.game || 'Live'} · ${viewers} viewers` + (user.title ? `\n${user.title}` : '');
    return NF.el('a', { class: 'nftw-card', href: `/${user.login}`, title: tooltip, onclick: (e) => open(e, user.login) }, [
      NF.el('img', { class: 'nftw-avatar', src: user.avatar, alt: '', loading: 'lazy' }),
      NF.el('div', { class: 'nftw-meta' }, [
        NF.el('div', { class: 'nftw-row' }, [
          NF.el('span', { class: 'nftw-name', text: user.displayName }),
          NF.el('span', { class: 'nftw-viewers' }, [NF.el('span', { class: 'nftw-dot' }), viewers]),
        ]),
        NF.el('div', { class: 'nftw-game', text: user.game }),
      ]),
    ]);
  }

  // Plain click: switch channel inside Twitch. Ctrl/middle click: new tab as usual.
  function open(event, login) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    NF.navigate(`/${login}`);
  }

  function hideDuplicates() {
    const followed = NF.followedSection(true);
    if (!followed) return;
    const hide = new Set(settings.hideDuplicates ? live.map((u) => u.login) : []);
    for (const link of followed.querySelectorAll('a[href]')) {
      const row = link.closest(NF.SEL.cardRow);
      const target = row && followed.contains(row) ? row : link;
      const login = (link.getAttribute('href').split('/')[1] || '').toLowerCase();
      const want = hide.has(login);
      if (target.classList.contains(HIDDEN_CLASS) !== want) target.classList.toggle(HIDDEN_CLASS, want);
    }
  }

  function onVisible() {
    if (document.visibilityState === 'visible') refresh();
  }

  NF.register('pinned', {
    start(next) {
      active = true;
      settings = next;
      stopWatching = NF.watchSideNav(render);
      refreshTimer = setInterval(refresh, REFRESH_MS);
      document.addEventListener('visibilitychange', onVisible);
      refresh();
    },
    update(next) {
      settings = next;
      refresh();
    },
    onFavorites() {
      refresh();
    },
    stop() {
      active = false;
      stopWatching?.();
      clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', onVisible);
      document.getElementById(SECTION_ID)?.remove();
      NF.$$(`.${HIDDEN_CLASS}`).forEach((el) => el.classList.remove(HIDDEN_CLASS));
      live = [];
      signature = '';
    },
  });
})();
