/*
 * kick.com sidebar:
 *   Favorites       - your live Kick favorites (the Channels list in the popup's Kick
 *                     tab) in their own section above Following. The rows are copies
 *                     of Kick's own rows, so they keep Kick's look as it changes.
 *   Only Following  - hides every channel section except Following (and Favorites).
 */
(async function () {
  const store = globalThis.NFTwitchStorage;
  const SECTION_ID = 'nftw-kick-favorites';
  const DUP_CLASS = 'nftw-kick-dup';
  const FOLLOWING_ROW = 'a[data-testid^="sidebar-following-channel-"]';
  const KICK_ROW = `${FOLLOWING_ROW}, a[data-testid^="sidebar-recommended-channel-"]`;
  const CHECK_MS = 1000;
  const REFRESH_MS = 60_000;

  let settings = await store.getSettings();
  let live = []; // live favorites, in display order
  let timer = 0;
  let refreshTimer = 0;
  let signature = '';

  const alive = () => {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  };

  /** 950 -> "950", 1234 -> "1.2K", 146000 -> "146K" (Kick's format) */
  function formatViewers(n) {
    const short = (x) => String(x >= 100 ? Math.round(x) : Math.round(x * 10) / 10);
    if (n >= 1e6) return short(n / 1e6) + 'M';
    if (n >= 1e3) return short(n / 1e3) + 'K';
    return String(n);
  }

  async function refresh() {
    if (!alive()) return stopAll(); // extension was reloaded
    const slugs = (await store.getFavorites('kick')).map((f) => f.login);
    let next = [];
    if (slugs.length) {
      let res = null;
      try {
        res = await chrome.runtime.sendMessage({ type: 'kick', slugs });
      } catch {}
      if (!res?.ok) return; // Kick unreachable: keep what we had
      next = slugs.map((slug, order) => res.channels[slug] && { ...res.channels[slug], order }).filter((c) => c?.live);
      if (settings.pinnedSort === 'manual') next.sort((a, b) => a.order - b.order);
      else next.sort((a, b) => b.viewers - a.viewers);
    }
    live = next;
    render();
  }

  function render() {
    const wrap = document.getElementById('sidebar-wrapper');
    const ours = document.getElementById(SECTION_ID);
    // A row to copy, preferably not the highlighted one for the channel you're on.
    const rows = [...(wrap?.querySelectorAll(KICK_ROW) || [])];
    const template = rows.find((a) => a.dataset.state !== 'active') || rows[0];
    const shell = template?.closest('section');
    hideDuplicates(wrap);
    if (!settings.kickSiteFavorites || !live.length || !template || !shell) {
      ours?.remove();
      signature = '';
      return;
    }
    // Rebuilt when the favorites change or Kick redraws its rows (open or folded sidebar).
    const next = JSON.stringify([template.className, template.childElementCount, live.map((c) => [c.login, c.avatar, c.displayName, c.game, c.viewers])]);
    if (!ours || next !== signature) {
      ours?.remove();
      shell.before(build(shell, template));
      signature = next;
    } else if (ours.nextElementSibling !== shell && !ours.contains(shell)) {
      shell.before(ours); // Kick moved things around
    }
  }

  function build(shell, template) {
    const section = shell.cloneNode(false);
    section.id = SECTION_ID;
    const header = shell.firstElementChild?.tagName === 'DIV' ? shell.firstElementChild.cloneNode(true) : null;
    if (header) {
      header.textContent = 'Favorites';
      section.append(header);
    }
    for (const channel of live) section.append(row(template, channel));
    return section;
  }

  function row(template, channel) {
    const wrapper = template.parentElement.tagName === 'BUTTON' ? template.parentElement.cloneNode(true) : template.cloneNode(true);
    wrapper.classList.remove(DUP_CLASS); // the row it was copied from may be hidden as a duplicate
    const link = wrapper.matches('a') ? wrapper : wrapper.querySelector('a');
    link.href = `/${channel.login}`;
    link.setAttribute('data-testid', 'nftw-kick-favorite');
    link.removeAttribute('data-state');
    link.removeAttribute('aria-describedby');
    const img = link.querySelector('img');
    if (img) {
      img.src = channel.avatar || img.src;
      img.alt = channel.displayName;
      img.removeAttribute('srcset');
    }
    const [name, game] = link.querySelectorAll('span.truncate');
    if (name) name.textContent = channel.displayName;
    if (game) game.textContent = channel.game;
    const viewers = link.querySelector('span[title]');
    if (viewers) {
      viewers.title = String(channel.viewers);
      viewers.textContent = formatViewers(channel.viewers);
    }
    link.addEventListener('click', (event) => openChannel(event, channel.login));
    return wrapper;
  }

  // Kick's own link to the same channel switches pages without a reload; use it when it's there.
  function openChannel(event, login) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const own = [...document.querySelectorAll(`#sidebar-wrapper :is(${KICK_ROW})`)].find((a) => a.getAttribute('href') === `/${login}`);
    if (!own) return;
    event.preventDefault();
    own.click();
  }

  // Favorites aren't listed twice: Kick's own Following rows for them are hidden.
  function hideDuplicates(wrap) {
    const hide = new Set(settings.kickSiteFavorites && settings.kickFavHideDup ? live.map((c) => c.login) : []);
    for (const link of wrap?.querySelectorAll(FOLLOWING_ROW) || []) {
      const target = link.parentElement.tagName === 'BUTTON' ? link.parentElement : link;
      const want = hide.has((link.getAttribute('href') || '').split('/')[1]?.toLowerCase());
      if (target.classList.contains(DUP_CLASS) !== want) target.classList.toggle(DUP_CLASS, want);
    }
  }

  function stopAll() {
    clearInterval(timer);
    clearInterval(refreshTimer);
    timer = refreshTimer = 0;
    document.getElementById(SECTION_ID)?.remove();
    document.querySelectorAll(`.${DUP_CLASS}`).forEach((n) => n.classList.remove(DUP_CLASS));
    signature = '';
  }

  function apply() {
    document.documentElement.classList.toggle('nftw-kick-only-following', !!settings.kickOnlyFollowing);
    if (settings.kickSiteFavorites && !timer) {
      timer = setInterval(render, CHECK_MS);
      refreshTimer = setInterval(refresh, REFRESH_MS);
      refresh();
    } else if (!settings.kickSiteFavorites && timer) {
      stopAll();
    } else if (timer) {
      refresh(); // sort order or the duplicates option may have changed
    }
  }

  apply();
  store.onChange(async (change) => {
    if (change.settings) {
      settings = await store.getSettings();
      apply();
    } else if (change.kickFavorites && timer) {
      refresh();
    }
  });
})();
