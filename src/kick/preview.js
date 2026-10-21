/*
 * Stream preview on kick.com: resting the pointer on a channel in Kick's
 * sidebar (Following and Recommended) opens a card with the stream's live
 * thumbnail, title, category and viewers (see src/shared/preview.js). It
 * takes the place of Kick's own small tooltip while it is open.
 */
(async function () {
  const store = globalThis.NFTwitchStorage;
  const LINKS = [
    '#sidebar-wrapper a[data-testid^="sidebar-following-channel-"]',
    '#sidebar-wrapper a[data-testid^="sidebar-recommended-channel-"]',
    '#sidebar-wrapper a[data-testid="nftw-kick-favorite"]', // Favorites section (sidebar.js)
  ].join(', ');
  const TTL_MS = 60_000;
  const cache = new Map(); // slug -> { at, info }, info null when offline

  let settings = await store.getSettings();
  let running = false;

  // The stream's details, from the same page data Kick's own pages use.
  async function channel(slug) {
    const hit = cache.get(slug);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.info;
    const res = await fetch(`/api/v2/channels/${encodeURIComponent(slug)}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Kick answered ${res.status}`);
    const c = await res.json();
    const stream = c.livestream;
    const info = stream?.is_live
      ? {
          thumb: `https://web.kick.com/api/v1/channels/${c.id}/thumbnail.jpeg`,
          name: c.user?.username || slug,
          game: stream.categories?.[0]?.name || '',
          title: stream.session_title || '',
        }
      : null;
    cache.set(slug, { at: Date.now(), info });
    return info;
  }

  const preview = globalThis.NFTwitchPreview.create({
    links: LINKS,
    sidebar: (link) => link.closest('#sidebar-wrapper'),
    describe(link) {
      const slug = (link.getAttribute('href') || '').split('/')[1]?.toLowerCase();
      if (!slug) return null;
      // Name and category show while the sidebar is open; the rest comes from Kick.
      const [name = '', game = ''] = [...link.querySelectorAll('span.truncate')].map((span) => span.textContent.trim());
      return { kick: true, thumb: null, name, game, viewers: link.querySelector('span[title]')?.textContent.trim() || '', title: '', more: () => channel(slug) };
    },
  });

  function apply() {
    const want = !!settings.kickPreview;
    if (want === running) return;
    running = want;
    if (want) preview.start();
    else preview.stop();
  }

  apply();
  store.onChange(async (change) => {
    if (!change.settings) return;
    settings = await store.getSettings();
    apply();
  });
})();
