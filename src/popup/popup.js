/*
 * Popup: one tab per site (Twitch, Kick, YouTube, Twitter). Twitch, Kick and
 * YouTube have a channel list and a Features view; sites without features yet
 * show a "coming soon" page. Tabs and feature switches are generated from the
 * registry in src/shared/features.js.
 */
(async function () {
  const { FEATURES, PLATFORMS: SITES, GROUPS } = NFTwitchFeatures;
  const store = NFTwitchStorage;
  const $ = (selector) => document.querySelector(selector);
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Site logos (24 x 24 vector shapes) for the tabs and the coming-soon page.
  const SITE_ICONS = {
    twitch: [
      ['polygon', { points: '20.571,11.143 17.143,14.571 13.714,14.571 10.714,17.571 10.714,14.571 6.857,14.571 6.857,1.714 20.571,1.714', fill: '#fff' }],
      ['path', { fill: '#9146ff', d: 'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z' }],
    ],
    kick: [['path', { fill: '#53fc18', d: 'M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z' }]],
    youtube: [
      ['path', { fill: '#ff0033', d: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z' }],
      ['path', { fill: '#fff', d: 'M9.545 15.568V8.432L15.818 12z' }],
    ],
    twitter: [['path', { fill: '#e7e9ea', d: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z' }]],
  };

  // Sites with a favorites list, and everything that differs between them.
  const LISTS = {
    twitch: {
      label: 'Twitch',
      url: (login) => `https://www.twitch.tv/${login}`,
      example: 'shroud',
      site: 'twitch.tv',
      placeholder: 'Streamer name or twitch.tv link',
      emptyTitle: 'No favorites yet',
      emptyText: 'Click the ★ next to Follow on any channel, type a name above, or import a list.',
      hint: 'Drag to reorder. Live favorites show in your Twitch sidebar.',
      file: 'nf-extension-twitch',
    },
    kick: {
      label: 'Kick',
      url: (login) => `https://kick.com/${login}`,
      example: 'xqc',
      site: 'kick.com',
      placeholder: 'Kick name or kick.com link',
      emptyTitle: 'No Kick channels added',
      emptyText: "Type a Kick name above. Channels you follow on Kick show up on their own while you're logged in to kick.com.",
      hint: 'Live Kick channels show under Favorites in your Twitch sidebar.',
      file: 'nf-extension-kick',
    },
    youtube: {
      label: 'YouTube',
      url: (login) => `https://www.youtube.com/${login.startsWith('UC') ? `channel/${login}` : login}`,
      example: '@lofigirl',
      site: 'youtube.com',
      placeholder: 'YouTube @handle or channel link',
      emptyTitle: 'No YouTube channels added',
      emptyText: "Type a channel's @handle or paste its youtube.com link above. Channels you subscribe to show up on their own while you're logged in to youtube.com.",
      hint: 'Live YouTube channels show under Kick in your Twitch sidebar.',
      file: 'nf-extension-youtube',
    },
  };

  // Per platform: the list (in your order) and looked-up channels
  // (login -> channel, or null when it doesn't exist).
  const state = {
    twitch: { list: [], users: {} },
    kick: { list: [], users: {}, followed: undefined }, // followed: undefined = not checked yet
    youtube: { list: [], users: {}, subscriptions: undefined }, // subscriptions: undefined = not checked yet
  };
  let platform = 'twitch'; // the selected site tab
  let view = recall('nftw-view') === 'features' ? 'features' : 'favorites';
  let settings = await store.getSettings();
  let messageTimer = 0;
  let dragging = false; // while a row is being dragged, re-renders wait
  let renderPending = false;

  const cur = () => state[platform];
  const P = () => LISTS[platform];

  /* ---------- helpers ---------- */

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of [].concat(children)) if (child != null) node.append(child);
    return node;
  }

  function icon(width, height, viewBox, draw) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('aria-hidden', 'true');
    for (const [tag, attrs] of draw) {
      const shape = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) shape.setAttribute(k, v);
      svg.append(shape);
    }
    return svg;
  }

  const gripIcon = () =>
    icon(10, 16, '0 0 10 16', [[2, 2], [8, 2], [2, 8], [8, 8], [2, 14], [8, 14]].map(([cx, cy]) => ['circle', { cx, cy, r: 1.5 }]));
  const closeIcon = () => icon(12, 12, '0 0 12 12', [['path', { d: 'M2 2l8 8M10 2l-8 8' }]]);
  const siteIcon = (id, size) => {
    const svg = icon(size, size, '0 0 24 24', SITE_ICONS[id] || []);
    svg.classList.add('site-icon');
    return svg;
  };

  function formatViewers(n) {
    const short = (x) => String(x >= 100 ? Math.round(x) : Math.round(x * 10) / 10);
    if (n >= 1e6) return short(n / 1e6) + 'M';
    if (n >= 1e3) return short(n / 1e3) + 'K';
    return String(n);
  }

  const displayName = (login, p = platform) => state[p].users[login]?.displayName || login;

  /**
   * Looks channels up on a platform: { login: channel | null }. On Kick and
   * YouTube, a name the site couldn't be asked about is left out (unknown,
   * not missing). Resolves to null when nothing could be checked.
   */
  async function lookup(logins, force = false, p = platform) {
    try {
      if (p === 'twitch') {
        const res = await chrome.runtime.sendMessage({ type: 'lookup', logins, force });
        return res?.ok ? res.users : null;
      }
      if (p === 'youtube') {
        const res = await chrome.runtime.sendMessage({ type: 'youtube', channels: logins, force });
        return res?.ok ? res.channels : null;
      }
      const res = await chrome.runtime.sendMessage({ type: 'kick', slugs: logins, followed: false, force });
      return res?.ok ? res.channels : null;
    } catch {
      return null;
    }
  }

  function say(text, tone = '', action = null) {
    const box = $('#message');
    box.className = 'message' + (tone ? ` is-${tone}` : '');
    box.replaceChildren(text);
    if (action) box.append(el('button', { type: 'button', text: action.label, onclick: action.run }));
    clearTimeout(messageTimer);
    // Longer messages (like import results) stay up longer.
    if (tone !== 'error') messageTimer = setTimeout(() => box.replaceChildren(), Math.max(action ? 6000 : 3500, text.length * 70));
  }

  function remember(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }

  function recall(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  /* ---------- site tabs ---------- */

  const siteLabel = (id) => SITES.find(([site]) => site === id)?.[1] || id;
  const liveFeatures = (id) => FEATURES.filter((f) => f.platform === id && f.status === 'live');

  function setupSiteTabs() {
    const tabs = SITES.map(([id, label]) =>
      el('button', { role: 'tab', id: `tab-${id}`, 'data-platform': id, 'aria-controls': 'panel', 'aria-selected': 'false', tabindex: '-1', onclick: () => selectSite(id) }, [
        siteIcon(id, 16),
        label,
      ])
    );
    tabs.forEach((tab, i) => {
      tab.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        selectSite(next.dataset.platform);
        next.focus();
      });
    });
    $('#platform-tabs').replaceChildren(...tabs);
    for (const button of document.querySelectorAll('[data-view]')) {
      button.addEventListener('click', () => selectView(button.dataset.view));
    }
  }

  function selectSite(next) {
    platform = next;
    remember('nftw-platform', next);
    for (const tab of document.querySelectorAll('#platform-tabs [role="tab"]')) {
      const on = tab.dataset.platform === next;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    }
    document.body.dataset.platform = next;
    $('#panel').setAttribute('aria-labelledby', `tab-${next}`);
    $('#import-panel').hidden = true;
    $('#followed-panel').hidden = true;
    $('#message').replaceChildren();
    renderFollowedButton();

    const hasList = next in LISTS;
    const hasFeatures = liveFeatures(next).length > 0;
    $('#views').hidden = !hasList || !hasFeatures;
    $('#view-soon').hidden = hasList || hasFeatures;
    if (!hasList && !hasFeatures) {
      $('#view-favorites').hidden = true;
      $('#view-features').hidden = true;
      renderSoonPage();
      renderSummary();
      return;
    }
    if (hasFeatures) renderFeatures();
    if (hasList) {
      $('#view-favorites-label').textContent = next === 'twitch' ? 'Favorites' : 'Channels';
      $('#add-input').placeholder = P().placeholder;
      $('label[for="add-input"]').textContent = P().placeholder;
      $('#fav-empty-title').textContent = P().emptyTitle;
      $('#fav-empty-text').textContent = P().emptyText;
      $('#fav-hint').textContent = P().hint;
      renderFavorites();
      refreshUsers();
      if (next === 'kick') refreshKickFollowed();
      if (next === 'youtube') refreshYoutubeSubscriptions();
    }
    selectView(hasList ? view : 'features', !hasList);
  }

  // Favorites | Features inside a site tab. A site without a list only has Features.
  function selectView(next, temporary = false) {
    if (!temporary) {
      view = next;
      remember('nftw-view', next);
    }
    for (const button of document.querySelectorAll('[data-view]')) {
      button.setAttribute('aria-pressed', String(button.dataset.view === next));
    }
    $('#view-favorites').hidden = next !== 'favorites';
    $('#view-features').hidden = next !== 'features';
  }

  function renderSummary() {
    const summary = $('#summary');
    if (!(platform in LISTS)) {
      summary.textContent = liveFeatures(platform).length ? `${siteLabel(platform)} tweaks` : `${siteLabel(platform)} features coming soon`;
      return;
    }
    const { list, users } = cur();
    if (!list.length) {
      summary.textContent = platform === 'twitch' ? 'Pin your favorite streamers' : `${siteLabel(platform)} channels in your Twitch sidebar`;
      return;
    }
    const liveCount = list.filter((f) => users[f.login]?.live).length;
    summary.replaceChildren(el('span', { class: 'live-num', text: String(liveCount) }), ` of ${list.length} live now`);
  }

  /* ---------- favorites ---------- */

  function renderFavorites() {
    if (dragging) {
      renderPending = true;
      return;
    }
    const { list } = cur();
    $('#fav-list').replaceChildren(...list.map(row));
    $('#fav-empty').hidden = list.length > 0;
    $('#fav-hint').hidden = list.length < (platform === 'twitch' ? 2 : 1);
    $('#export-button').disabled = list.length === 0;

    $('#fav-count').textContent = list.length || '';
    renderSummary();
    renderFollowStatus();
  }

  function row(fav) {
    const user = cur().users[fav.login];
    const name = user?.displayName || fav.login;
    const status = user?.live
      ? [el('span', { class: 'live-dot' }), `${formatViewers(user.viewers)}${user.game ? ` · ${user.game}` : ''}`]
      : user === null
        ? 'Channel not found'
        : user
          ? 'Offline'
          : '…';

    const avatar = el('span', { class: 'avatar' }, user?.avatar ? el('img', { src: user.avatar, alt: '' }) : name.replace(/^@/, '')[0]);

    return el('li', { class: 'fav' + (user?.live ? ' is-live' : ''), draggable: 'true', 'data-login': fav.login }, [
      el('button', { class: 'grip', type: 'button', title: 'Drag, or Alt + ↑ / ↓', 'aria-label': `Move ${name}`, onkeydown: (e) => moveWithKeys(e, fav.login) }, gripIcon()),
      avatar,
      el('div', { class: 'info' }, [
        el('button', { class: 'name', type: 'button', text: name, title: `Open ${name} on ${P().label}`, onclick: () => openChannel(fav.login) }),
        el('div', { class: 'status', title: user?.title || '' }, status),
      ]),
      el('button', { class: 'remove', type: 'button', title: 'Remove', 'aria-label': `Remove ${name}`, onclick: () => remove(fav) }, closeIcon()),
    ]);
  }

  // Kick and YouTube views: whether the channels you follow (or subscribe to) there are included.
  function renderFollowStatus() {
    const box = $('#follow-status');
    box.hidden = platform !== 'kick' && platform !== 'youtube';
    if (!box.hidden) box.textContent = platform === 'kick' ? kickStatus() : youtubeStatus();
  }

  function kickStatus() {
    const followed = state.kick.followed;
    if (!settings.kick) return 'The Kick section is turned off. Turn on "Kick channels" in Features.';
    if (!settings.kickFollowed) return 'Channels you follow on Kick are not included (Features → Kick channels).';
    if (followed === undefined) return 'Checking the channels you follow on Kick…';
    if (followed.loggedIn === false) return 'Log in to kick.com in this browser to also show the channels you follow there.';
    if (followed.loggedIn === null) return "Couldn't reach Kick to get the channels you follow. It will try again.";
    const live = followed.channels.length; // the background only returns live follows
    return live
      ? `${live} channel${live === 1 ? '' : 's'} you follow on Kick ${live === 1 ? 'is' : 'are'} live now and in your sidebar too.`
      : 'None of the channels you follow on Kick are live right now.';
  }

  function youtubeStatus() {
    const subscribed = state.youtube.subscriptions;
    if (!settings.ytLive) return 'The YouTube section is turned off. Turn on "YouTube live channels" in Features.';
    if (!settings.ytSubs) return 'Channels you subscribe to on YouTube are not included (Features → YouTube live channels).';
    if (subscribed === undefined) return 'Checking the channels you subscribe to on YouTube…';
    if (subscribed.loggedIn === false) return 'Log in to youtube.com in this browser to also show the channels you subscribe to there.';
    if (subscribed.loggedIn === null) return `Couldn't reach YouTube to get the channels you subscribe to${subscribed.error ? ` (${subscribed.error})` : ''}. It will try again.`;
    const total = subscribed.total || 0; // how many subscriptions YouTube listed
    if (!total) return "You're logged in to youtube.com, but YouTube lists no subscriptions for this account.";
    const live = subscribed.channels.length; // the background only returns live subscriptions
    const yours = `your ${total} YouTube subscription${total === 1 ? '' : 's'}`;
    return live
      ? `${live} of ${yours} ${live === 1 ? 'is' : 'are'} live now and in your sidebar too.`
      : `None of ${yours} ${total === 1 ? 'is' : 'are'} live right now.`;
  }

  async function refreshKickFollowed() {
    if (!settings.kick || !settings.kickFollowed) return renderFollowStatus();
    try {
      const res = await chrome.runtime.sendMessage({ type: 'kick', slugs: [], followed: true });
      state.kick.followed = res?.ok ? res.followed : { loggedIn: null, channels: [] };
    } catch {
      state.kick.followed = { loggedIn: null, channels: [] };
    }
    renderFollowStatus();
  }

  async function refreshYoutubeSubscriptions() {
    if (!settings.ytLive || !settings.ytSubs) return renderFollowStatus();
    try {
      const res = await chrome.runtime.sendMessage({ type: 'youtube', channels: [], subscriptions: true });
      state.youtube.subscriptions = res?.ok ? res.subscriptions : { loggedIn: null, channels: [] };
    } catch {
      state.youtube.subscriptions = { loggedIn: null, channels: [] };
    }
    renderFollowStatus();
  }

  function openChannel(login) {
    chrome.tabs.create({ url: P().url(login) });
  }

  async function remove(fav) {
    const p = platform;
    const index = state[p].list.findIndex((f) => f.login === fav.login);
    await store.removeFavorite(fav.login, p);
    say(`Removed ${displayName(fav.login, p)}.`, '', {
      label: 'Undo',
      run: async () => {
        const list = await store.getFavorites(p);
        if (!list.some((f) => f.login === fav.login)) {
          list.splice(Math.min(index, list.length), 0, fav);
          await store.setFavorites(list, p);
        }
        say(`${displayName(fav.login, p)} is back.`, 'ok');
      },
    });
  }

  async function saveOrder(logins) {
    const s = cur();
    const byLogin = new Map(s.list.map((f) => [f.login, f]));
    const seen = new Set();
    const next = logins.filter((l) => !seen.has(l) && seen.add(l)).map((l) => byLogin.get(l)).filter(Boolean);
    // Anything added while dragging (not in the dragged rows) keeps its place at the end.
    for (const f of s.list) if (!seen.has(f.login)) next.push(f);
    if (next.map((f) => f.login).join() === s.list.map((f) => f.login).join()) return;
    s.list = next;
    await store.setFavorites(next, platform);
  }

  function moveWithKeys(event, login) {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    const logins = cur().list.map((f) => f.login);
    const from = logins.indexOf(login);
    const to = from + (event.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= logins.length) return;
    logins.splice(to, 0, logins.splice(from, 1)[0]);
    saveOrder(logins).then(() => document.querySelector(`.fav[data-login="${login}"] .grip`)?.focus());
  }

  function setupDrag() {
    const list = $('#fav-list');
    let dragged = null;
    list.addEventListener('dragstart', (e) => {
      dragged = e.target.closest('.fav');
      if (!dragged) return;
      dragging = true;
      dragged.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragged.dataset.login);
    });
    list.addEventListener('dragover', (e) => {
      if (!dragged || !list.contains(dragged)) return;
      e.preventDefault();
      const over = e.target.closest('.fav');
      if (!over || over === dragged) return;
      const rect = over.getBoundingClientRect();
      over[e.clientY > rect.top + rect.height / 2 ? 'after' : 'before'](dragged);
    });
    list.addEventListener('dragend', () => {
      if (!dragged) return;
      dragged.classList.remove('dragging');
      dragged = null;
      dragging = false;
      saveOrder([...list.children].map((li) => li.dataset.login)).finally(() => {
        if (!renderPending) return;
        renderPending = false;
        renderFavorites();
      });
    });
  }

  function setupAddForm() {
    const form = $('#add-form');
    const input = $('#add-input');
    const button = $('#add-button');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const p = platform;
      const { label, example, site } = LISTS[p];
      const login = store.normalizeLogin(input.value, p);
      if (!login) return say(`Type a ${label} name like "${example}", or paste a ${site} link.`, 'error');
      if (state[p].list.some((f) => f.login === login)) return say(`${displayName(login, p)} is already in your ${label} list.`);

      button.disabled = true;
      say(`Checking ${label}…`);
      const found = await lookup([login], true, p);
      button.disabled = false;

      if (found && found[login] === null) return say(`There's no ${label} channel called "${login}".`, 'error');
      const user = found?.[login];
      if (user) state[p].users[login] = user;
      try {
        await store.addFavorite({ login }, p);
      } catch (err) {
        return say(`Couldn't save: ${err.message}`, 'error');
      }
      input.value = '';
      input.focus();
      say(user ? `Added ${user.displayName}.` : `Added ${login}. ${label} didn't answer, so the name wasn't checked.`, 'ok');
    });
  }

  /* ---------- import / export ---------- */

  function setupBackup() {
    const fileInput = $('#import-file');
    $('#export-button').addEventListener('click', exportFavorites);
    $('#import-button').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      fileInput.value = ''; // so picking the same file again still fires
      if (file) importFile(file);
    });
    $('#import-cancel').addEventListener('click', () => {
      $('#import-panel').hidden = true;
      say('Import cancelled.');
    });
  }

  // Writes the same format the importer reads first: a plain list of names.
  function exportFavorites() {
    const list = cur().list;
    const json = JSON.stringify(list.map((f) => f.login), null, 2);
    const url = URL.createObjectURL(new Blob([json + '\n'], { type: 'application/json' }));
    const link = el('a', { href: url, download: `${P().file}-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say(`Exported ${list.length} ${P().label} channels.`, 'ok');
  }

  async function importFile(file) {
    const p = platform;
    const { label } = LISTS[p];
    $('#import-panel').hidden = true;
    let parsed;
    try {
      parsed = store.parseImport(await file.text(), p);
    } catch (err) {
      return say(`Couldn't read ${file.name}: ${err instanceof SyntaxError ? "it isn't valid JSON" : err.message}.`, 'error');
    }
    if (!parsed.logins.length) return say(`No ${label} names found in ${file.name}.`, 'error');

    // Drop names the platform doesn't know (deleted or renamed channels). If
    // it can't be reached, import everything unchecked.
    say(`Checking ${parsed.logins.length} names on ${label}…`);
    const found = await lookup(parsed.logins, false, p);
    let logins = parsed.logins;
    let missing = [];
    if (found) {
      Object.assign(state[p].users, found);
      missing = logins.filter((l) => found[l] === null);
      logins = logins.filter((l) => found[l] !== null);
    }
    if (!logins.length) return say(`None of the names in ${file.name} are ${label} channels.`, 'error');

    const result = { platform: p, logins, missing, invalid: parsed.invalid, checked: !!found };
    if (!state[p].list.length) return runImport(result, false);

    const current = new Set(state[p].list.map((f) => f.login));
    const fresh = logins.filter((l) => !current.has(l)).length;
    $('#import-summary').replaceChildren(
      'Found ',
      el('strong', { text: `${logins.length} ${label} channels` }),
      ` in ${file.name}. ` + (fresh < logins.length ? `${logins.length - fresh} are already in your list.` : 'None are in your list yet.')
    );
    const add = $('#import-add');
    add.textContent = fresh ? `Add ${fresh} new` : 'Nothing new to add';
    add.disabled = fresh === 0;
    add.onclick = () => runImport(result, false);
    $('#import-replace').onclick = () => runImport(result, true);
    $('#message').replaceChildren();
    $('#import-panel').hidden = false;
  }

  /* ---------- Import from Followed (Twitch) ---------- */

  let followed = []; // the channels you follow: { login, displayName, avatar }
  const picked = new Set();

  function setupFollowed() {
    $('#followed-button').addEventListener('click', openFollowed);
    $('#followed-filter').addEventListener('input', renderFollowed);
    $('#followed-all').addEventListener('change', (e) => {
      for (const f of visibleFollowed()) if (!isFavorite(f.login)) e.target.checked ? picked.add(f.login) : picked.delete(f.login);
      renderFollowed();
    });
    $('#followed-add').addEventListener('click', addFollowed);
    $('#followed-cancel').addEventListener('click', () => ($('#followed-panel').hidden = true));
  }

  function renderFollowedButton() {
    $('#followed-button').hidden = platform !== 'twitch' || !settings.importFollowed;
    if ($('#followed-button').hidden) $('#followed-panel').hidden = true;
  }

  const isFavorite = (login) => state.twitch.list.some((f) => f.login === login);

  function visibleFollowed() {
    const q = $('#followed-filter').value.trim().toLowerCase();
    return q ? followed.filter((f) => f.login.includes(q) || f.displayName.toLowerCase().includes(q)) : followed;
  }

  async function openFollowed() {
    $('#import-panel').hidden = true;
    say('Getting the channels you follow on Twitch…');
    let res = null;
    try {
      res = await chrome.runtime.sendMessage({ type: 'twitchFollowed' });
    } catch {}
    if (!res?.ok) return say(`Couldn't get the channels you follow from Twitch${res?.error ? ` (${res.error})` : ''}. Try again in a moment.`, 'error');
    if (!res.loggedIn) return say('Log in to twitch.tv in this browser, then try again.', 'error');
    if (!res.channels.length) return say("You don't follow any channels on Twitch yet.", 'error');
    $('#message').replaceChildren();
    followed = res.channels.sort((a, b) => a.displayName.localeCompare(b.displayName));
    picked.clear();
    $('#followed-filter').value = '';
    renderFollowed();
    $('#followed-panel').hidden = false;
    $('#followed-filter').focus();
  }

  function renderFollowed() {
    const shown = visibleFollowed();
    $('#followed-list').replaceChildren(
      ...shown.map((f) => {
        const pinned = isFavorite(f.login);
        return el('li', {}, [
          el('label', {}, [
            el('input', {
              type: 'checkbox',
              checked: pinned || picked.has(f.login),
              disabled: pinned,
              onchange: (e) => {
                e.target.checked ? picked.add(f.login) : picked.delete(f.login);
                renderFollowedCount();
              },
            }),
            el('span', { class: 'avatar' }, f.avatar ? el('img', { src: f.avatar, alt: '' }) : f.displayName[0]),
            el('span', { class: 'name', text: f.displayName }),
            pinned ? el('span', { class: 'pinned', text: '★ pinned' }) : null,
          ]),
        ]);
      })
    );
    const open = shown.filter((f) => !isFavorite(f.login));
    $('#followed-all').checked = open.length > 0 && open.every((f) => picked.has(f.login));
    $('#followed-all').disabled = !open.length;
    renderFollowedCount();
  }

  function renderFollowedCount() {
    const add = $('#followed-add');
    add.textContent = picked.size ? `Pin ${picked.size}` : 'Pin';
    add.disabled = !picked.size;
  }

  async function addFollowed() {
    const logins = followed.filter((f) => picked.has(f.login)).map((f) => f.login);
    $('#followed-panel').hidden = true;
    let added;
    try {
      added = await store.importFavorites(logins, { replace: false, platform: 'twitch' });
    } catch (err) {
      return say(`Couldn't save: ${err.message}`, 'error');
    }
    say(`Pinned ${added} channel${added === 1 ? '' : 's'} you follow.`, 'ok');
  }

  async function runImport({ platform: p, logins, missing, invalid, checked }, replace) {
    const { label } = LISTS[p];
    $('#import-panel').hidden = true;
    let added;
    try {
      added = await store.importFavorites(logins, { replace, platform: p });
    } catch (err) {
      return say(`Couldn't save: ${err.message}`, 'error');
    }
    const notes = [];
    if (missing.length) notes.push(`skipped ${missing.length} not on ${label} (${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''})`);
    if (invalid) notes.push(`${invalid} unreadable`);
    if (!checked) notes.push(`${label} didn't answer, so names weren't checked`);
    const head = replace ? `Replaced your ${label} list with ${added} channels` : `Imported ${added} ${label} channels`;
    say(head + (notes.length ? `; ${notes.join('; ')}.` : '.'), 'ok');
  }

  async function refreshUsers(p = platform) {
    const { list, users } = state[p];
    if (!list.length) return;
    const found = await lookup(list.map((f) => f.login), false, p);
    if (!found) return;
    Object.assign(users, found);
    if (p === platform) renderFavorites();
  }

  /* ---------- features ---------- */

  // The selected site's switches, grouped, then its planned features.
  function renderFeatures() {
    const live = liveFeatures(platform);
    const soon = FEATURES.filter((f) => f.platform === platform && f.status === 'soon');
    const blocks = [];
    for (const [group, title] of GROUPS) {
      const inGroup = live.filter((f) => f.group === group);
      if (!inGroup.length) continue;
      blocks.push(el('h2', { class: 'group-title', text: title }), ...inGroup.map((f) => featureCard(f)));
    }
    if (soon.length) blocks.push(el('h2', { class: 'group-title', text: 'Coming soon' }), el('ul', { class: 'soon-list' }, soon.map(soonItem)));
    $('#feature-list').replaceChildren(...blocks);
  }

  function featureCard(feature) {
    const card = el('div', { class: 'feature' + (settings[feature.id] ? '' : ' is-off') });
    const toggle = el('input', {
      class: 'switch',
      type: 'checkbox',
      role: 'switch',
      checked: !!settings[feature.id],
      onchange: (e) => {
        card.classList.toggle('is-off', !e.target.checked);
        store.setSetting(feature.id, e.target.checked);
      },
    });
    card.append(
      el('label', { class: 'feature-head' }, [
        el('span', { class: 'feature-text' }, [
          el('span', { class: 'feature-name', text: feature.name }),
          el('span', { class: 'feature-desc', text: feature.description }),
        ]),
        toggle,
      ])
    );
    if (feature.options?.length) {
      card.append(el('div', { class: 'options' }, feature.options.map((o) => optionControl(o, settings[o.id]))));
    }
    return card;
  }

  function optionControl(option, value) {
    if (option.type === 'toggle') {
      return el('label', { class: 'option' }, [
        option.label,
        el('input', { class: 'switch small', type: 'checkbox', role: 'switch', checked: !!value, onchange: (e) => store.setSetting(option.id, e.target.checked) }),
      ]);
    }

    if (option.type === 'select') {
      const group = el('div', { class: 'segmented', role: 'group', 'aria-label': option.label });
      for (const [choice, label] of option.choices) {
        group.append(
          el('button', {
            type: 'button',
            text: label,
            'aria-pressed': String(choice === value),
            onclick: (e) => {
              for (const b of group.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
              store.setSetting(option.id, choice);
            },
          })
        );
      }
      return el('div', { class: 'option' }, [option.label, group]);
    }

    if (option.type === 'range') {
      const output = el('output', { text: `${value}${option.unit || ''}` });
      const input = el('input', {
        type: 'range',
        min: option.min,
        max: option.max,
        step: option.step,
        value,
        'aria-label': option.label,
        oninput: (e) => (output.textContent = `${e.target.value}${option.unit || ''}`),
        onchange: (e) => store.setSetting(option.id, Number(e.target.value)),
      });
      return el('div', { class: 'option' }, [option.label, el('span', { class: 'range' }, [input, output])]);
    }

    if (option.type === 'text') {
      // Saved a moment after you stop typing, and when you leave the box.
      let timer = 0;
      const save = (input) => {
        clearTimeout(timer);
        store.setSetting(option.id, input.value.trim());
      };
      const input = el('input', {
        class: 'text-field',
        type: 'text',
        value: value || '',
        placeholder: option.placeholder,
        spellcheck: 'false',
        oninput: (e) => {
          clearTimeout(timer);
          timer = setTimeout(() => save(e.target), 600);
        },
        onchange: (e) => save(e.target),
      });
      return el('label', { class: 'option option-text' }, [option.label, input]);
    }

    return null;
  }

  function soonItem(f) {
    return el('li', { class: 'soon' }, [
      el('span', { class: 'soon-text' }, [el('span', { class: 'soon-name', text: f.name }), el('span', { class: 'soon-desc', text: f.description })]),
      el('span', { class: 'pill', text: 'Planned' }),
    ]);
  }

  // A site with no features yet (YouTube, Twitter for now).
  function renderSoonPage() {
    $('#soon-mark').replaceChildren(siteIcon(platform, 44));
    $('#soon-title').textContent = `${siteLabel(platform)} features are coming soon`;
    $('#soon-list').replaceChildren(...FEATURES.filter((f) => f.platform === platform && f.status === 'soon').map(soonItem));
  }

  /* ---------- start ---------- */

  $('#version').textContent = `v${chrome.runtime.getManifest().version}`;
  setupSiteTabs();
  setupAddForm();
  setupBackup();
  setupFollowed();
  setupDrag();

  [state.twitch.list, state.kick.list, state.youtube.list] = await Promise.all([store.getFavorites('twitch'), store.getFavorites('kick'), store.getFavorites('youtube')]);
  const saved = recall('nftw-platform');
  selectSite(SITES.some(([id]) => id === saved) ? saved : 'twitch'); // renders the tab and looks its channels up

  store.onChange(async (change) => {
    if (change.settings) {
      settings = await store.getSettings();
      renderFollowedButton();
      if (platform === 'kick') refreshKickFollowed();
      if (platform === 'youtube') refreshYoutubeSubscriptions();
    }
    for (const [key, p] of [['favorites', 'twitch'], ['kickFavorites', 'kick'], ['youtubeFavorites', 'youtube']]) {
      if (!change[key]) continue;
      state[p].list = change[key];
      if (p === platform) renderFavorites();
      if (state[p].list.some((f) => !(f.login in state[p].users))) refreshUsers(p);
    }
  });
})();
