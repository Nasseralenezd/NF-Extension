/*
 * Settings and favorites, kept in chrome.storage.sync so they follow you
 * across browsers signed in to the same account.
 *
 * Favorites are stored as a plain list of logins in your own order:
 * ["lirik", "shroud", ...]. Sync storage allows 8 KB per key, which fits
 * roughly 600 streamers this way. Display names, avatars and live status are
 * looked up on demand (see background.js). Older versions stored
 * [{ login, name }] objects; those are still read.
 *
 * The functions below hand out [{ login, name }] so callers don't care.
 */
(function (root) {
  const { defaultSettings } = root.NFTwitchFeatures;
  const area = chrome.storage.sync;
  const LOGIN_RE = /^[a-z0-9_]{1,25}$/;

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

  async function getFavorites() {
    const { favorites } = await area.get('favorites');
    return fromStored(favorites);
  }

  function setFavorites(favorites) {
    return serial(() => area.set({ favorites: toStored(favorites) }));
  }

  async function isFavorite(login) {
    const favorites = await getFavorites();
    return favorites.some((f) => f.login === login);
  }

  function addFavorite({ login }) {
    return serial(async () => {
      const favorites = await getFavorites();
      if (favorites.some((f) => f.login === login)) return false;
      await area.set({ favorites: [...toStored(favorites), login] });
      return true;
    });
  }

  function removeFavorite(login) {
    return serial(async () => {
      const favorites = await getFavorites();
      await area.set({ favorites: toStored(favorites.filter((f) => f.login !== login)) });
    });
  }

  /** Pins (on = true) or unpins a login. Queued with other writes, so the last call wins. */
  function setFavorite(login, on) {
    return serial(async () => {
      const current = toStored(await getFavorites()).filter((l) => l !== login);
      await area.set({ favorites: on ? [...current, login] : current });
    });
  }

  /**
   * Adds logins to your favorites (or replaces the list with them), keeping
   * the order given and skipping ones you already have. Returns how many
   * were added.
   */
  function importFavorites(logins, { replace = false } = {}) {
    return serial(async () => {
      const current = replace ? [] : toStored(await getFavorites());
      const seen = new Set(current);
      const added = logins.filter((login) => !seen.has(login) && seen.add(login));
      await area.set({ favorites: [...current, ...added] });
      return added.length;
    });
  }

  /** Accepts "name", "@name" or any twitch.tv URL. Returns a login or null. */
  function normalizeLogin(input) {
    let value = String(input || '').trim();
    const url = value.match(/twitch\.tv\/([^/?#\s]+)/i);
    if (url) value = url[1];
    value = value.replace(/^@/, '').toLowerCase();
    return LOGIN_RE.test(value) ? value : null;
  }

  /**
   * Reads a favorites file. Takes what Export writes (a list of names) plus
   * common shapes from other tools: lists of links or objects with a login /
   * username / channel field, optionally wrapped as { favorites: [...] }.
   * Returns { logins, invalid } with duplicates removed. Throws on bad JSON.
   */
  function parseImport(text) {
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
          : item && (item.login ?? item.username ?? item.user_login ?? item.broadcaster_login ?? item.channel ?? item.name ?? item.displayName);
      const login = normalizeLogin(raw);
      if (login) logins.add(login);
      else invalid++;
    }
    return { logins: [...logins], invalid };
  }

  /** Calls back with { settings?, favorites? } holding the new values that changed. */
  function onChange(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync') return;
      const out = {};
      if (changes.settings) out.settings = changes.settings.newValue;
      if (changes.favorites) out.favorites = fromStored(changes.favorites.newValue);
      if (out.settings || out.favorites) callback(out);
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
    onChange,
  };
})(globalThis);
