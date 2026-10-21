/*
 * Settings and favorites, kept in chrome.storage.sync so they follow you
 * across browsers signed in to the same account.
 *
 * Each platform has its own list of channel names in your own order:
 *   favorites         Twitch, e.g. ["lirik", "shroud"]
 *   kickFavorites     Kick, e.g. ["xqc"]
 *   youtubeFavorites  YouTube, e.g. ["@lofigirl", "UCBJycsmduvYEL83R_U4JriQ"] (handles or channel ids)
 * Sync storage allows 8 KB per key, which fits roughly 600 names per list.
 * Display names, avatars and live status are looked up on demand (see
 * background.js). Older versions stored Twitch favorites as [{ login, name }]
 * objects; those are still read.
 *
 * The functions below hand out [{ login, name }] so callers don't care, and
 * take an optional platform ('twitch' by default, 'kick' or 'youtube').
 */
(function (root) {
  const { defaultSettings } = root.NFTwitchFeatures;
  const area = chrome.storage.sync;

  const PLATFORMS = {
    twitch: { key: 'favorites', site: /twitch\.tv\/([^/?#\s]+)/i, name: /^[a-z0-9_]{1,25}$/ },
    kick: { key: 'kickFavorites', site: /kick\.com\/([^/?#\s]+)/i, name: /^[a-z0-9_-]{1,32}$/ },
    youtube: { key: 'youtubeFavorites', normalize: youtubeChannel },
  };

  // "@Handle", "handle", a youtube.com/@handle or /channel/UC… link -> "@handle"
  // or the "UC…" id (ids are case-sensitive, handles aren't).
  function youtubeChannel(value) {
    const url = value.match(/youtube\.com\/(?:channel\/(UC[\w-]{22})|(@[\w.-]+))/i);
    if (url) value = url[1] || url[2];
    if (/^UC[\w-]{22}$/.test(value)) return value;
    const handle = value.replace(/^@/, '').toLowerCase();
    return /^[\w.-]{3,30}$/.test(handle) ? `@${handle}` : null;
  }
  const keyOf = (platform = 'twitch') => PLATFORMS[platform].key;

  async function getSettings() {
    const { settings } = await area.get('settings');
    return { ...defaultSettings(), ...(settings || {}) };
  }

  // Writes read the current value and then save it back, so they run one at a
  // time; otherwise two quick changes could overwrite each other.
  let queue = Promise.resolve();
  function serial(task) {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run;
  }

  function setSetting(key, value) {
    return serial(async () => {
      const settings = await getSettings();
      settings[key] = value;
      await area.set({ settings });
    });
  }

  /** Stored value (strings, or objects from older versions) -> [{ login, name }]. */
  function fromStored(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((f) => (typeof f === 'string' ? f : f?.login))
      .filter(Boolean)
      .map((login) => ({ login, name: login }));
  }

  const toStored = (favorites) => favorites.map((f) => (typeof f === 'string' ? f : f.login));

  async function getFavorites(platform) {
    const key = keyOf(platform);
    const stored = await area.get(key);
    return fromStored(stored[key]);
  }

  function setFavorites(favorites, platform) {
    return serial(() => area.set({ [keyOf(platform)]: toStored(favorites) }));
  }

  async function isFavorite(login, platform) {
    const favorites = await getFavorites(platform);
    return favorites.some((f) => f.login === login);
  }

  function addFavorite({ login }, platform) {
    return serial(async () => {
      const favorites = await getFavorites(platform);
      if (favorites.some((f) => f.login === login)) return false;
      await area.set({ [keyOf(platform)]: [...toStored(favorites), login] });
      return true;
    });
  }

  function removeFavorite(login, platform) {
    return serial(async () => {
      const favorites = await getFavorites(platform);
      await area.set({ [keyOf(platform)]: toStored(favorites.filter((f) => f.login !== login)) });
    });
  }

  /** Pins (on = true) or unpins a login. Queued with other writes, so the last call wins. */
  function setFavorite(login, on, platform) {
    return serial(async () => {
      const current = toStored(await getFavorites(platform)).filter((l) => l !== login);
      await area.set({ [keyOf(platform)]: on ? [...current, login] : current });
    });
  }

  /**
   * Adds logins to your favorites (or replaces the list with them), keeping
   * the order given and skipping ones you already have. Returns how many
   * were added.
   */
  function importFavorites(logins, { replace = false, platform } = {}) {
    return serial(async () => {
      const current = replace ? [] : toStored(await getFavorites(platform));
      const seen = new Set(current);
      const added = logins.filter((login) => !seen.has(login) && seen.add(login));
      await area.set({ [keyOf(platform)]: [...current, ...added] });
      return added.length;
    });
  }

  /** Accepts "name", "@name" or a channel URL (twitch.tv/…, kick.com/…, youtube.com/…). Returns a login or null. */
  function normalizeLogin(input, platform = 'twitch') {
    const rules = PLATFORMS[platform];
    let value = String(input || '').trim();
    if (rules.normalize) return rules.normalize(value);
    const url = value.match(rules.site);
    if (url) value = url[1];
    value = value.replace(/^@/, '').toLowerCase();
    return rules.name.test(value) ? value : null;
  }

  /**
   * Reads a favorites file. Takes what Export writes (a list of names) plus
   * common shapes from other tools: lists of links or objects with a login /
   * username / channel field, optionally wrapped as { favorites: [...] }.
   * Returns { logins, invalid } with duplicates removed. Throws on bad JSON.
   */
  function parseImport(text, platform = 'twitch') {
    const data = JSON.parse(text);
    const list = Array.isArray(data)
      ? data
      : ['favorites', 'channels', 'streamers', 'users', 'list'].map((key) => data?.[key]).find(Array.isArray);
    if (!list) throw new Error('there is no list of streamers in it');

    const logins = new Set();
    let invalid = 0;
    for (const item of list) {
      const raw =
        typeof item === 'string'
          ? item
          : item && (item.login ?? item.slug ?? item.username ?? item.user_login ?? item.broadcaster_login ?? item.channel ?? item.name ?? item.displayName);
      const login = normalizeLogin(raw, platform);
      if (login) logins.add(login);
      else invalid++;
    }
    return { logins: [...logins], invalid };
  }

  /*
   * Sidebar UI state that isn't a setting, such as which sections are folded.
   * Kept in this browser only (chrome.storage.local): { folded: { favorites, kick } }.
   */
  async function getUi() {
    const { ui } = await chrome.storage.local.get('ui');
    return { ...(ui || {}), folded: { ...(ui?.folded || {}) } };
  }

  function setFolded(section, folded) {
    return serial(async () => {
      const ui = await getUi();
      ui.folded[section] = folded;
      await chrome.storage.local.set({ ui });
    });
  }

  /** Calls back with { settings?, favorites?, kickFavorites?, youtubeFavorites?, ui? } holding the new values that changed. */
  function onChange(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      const out = {};
      if (areaName === 'sync') {
        if (changes.settings) out.settings = changes.settings.newValue;
        if (changes.favorites) out.favorites = fromStored(changes.favorites.newValue);
        if (changes.kickFavorites) out.kickFavorites = fromStored(changes.kickFavorites.newValue);
        if (changes.youtubeFavorites) out.youtubeFavorites = fromStored(changes.youtubeFavorites.newValue);
      } else if (areaName === 'local' && changes.ui) {
        out.ui = { folded: {}, ...(changes.ui.newValue || {}) };
      }
      if (Object.keys(out).length) callback(out);
    });
  }

  root.NFTwitchStorage = {
    getSettings,
    setSetting,
    getFavorites,
    setFavorites,
    isFavorite,
    addFavorite,
    removeFavorite,
    setFavorite,
    importFavorites,
    normalizeLogin,
    parseImport,
    getUi,
    setFolded,
    onChange,
  };
})(globalThis);
