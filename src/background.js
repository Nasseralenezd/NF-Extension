/*
 * Service worker: looks up channels on Twitch (live status, viewers, game,
 * avatar) for the content scripts and the popup.
 *
 * Uses Twitch's public GraphQL endpoint with the web site's own Client-Id,
 * the same approach BetterTTV, FrankerFaceZ and 7TV use. No sign-in needed.
 */
const GQL_URL = 'https://gql.twitch.tv/gql';
const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
const QUERY = `query NFTwitchUsers($logins: [String!]) {
  users(logins: $logins) {
    login
    displayName
    profileImageURL(width: 70)
    stream { viewersCount title game { displayName } }
  }
}`;
const TTL_MS = 45_000;
const KEEP_MS = 10 * 60_000;
const BATCH = 100;

// login -> { at, user }, where user is null when the channel doesn't exist.
const cache = new Map();
let hydrated = null;

// Service workers are stopped when idle, so the cache is mirrored to session storage.
function hydrate() {
  hydrated ??= chrome.storage.session.get('lookupCache').then(({ lookupCache }) => {
    for (const [login, entry] of Object.entries(lookupCache || {})) {
      if (!cache.has(login)) cache.set(login, entry);
    }
  });
  return hydrated;
}

function persist() {
  const now = Date.now();
  for (const [login, entry] of cache) {
    if (now - entry.at > KEEP_MS) cache.delete(login);
  }
  chrome.storage.session.set({ lookupCache: Object.fromEntries(cache) });
}

function shape(user) {
  const stream = user.stream;
  return {
    login: user.login,
    displayName: user.displayName,
    avatar: user.profileImageURL,
    live: !!stream,
    viewers: stream?.viewersCount ?? 0,
    title: stream?.title ?? '',
    game: stream?.game?.displayName ?? '',
  };
}

async function fetchBatch(logins) {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'Client-Id': CLIENT_ID, 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ query: QUERY, variables: { logins } }),
  });
  if (!res.ok) throw new Error(`Twitch answered ${res.status}`);
  const json = await res.json();
  if (!json.data) throw new Error(json.errors?.[0]?.message || 'Twitch sent no data');

  const found = new Map();
  for (const user of json.data.users || []) {
    if (user) found.set(user.login.toLowerCase(), shape(user));
  }
  const at = Date.now();
  for (const login of logins) cache.set(login, { at, user: found.get(login) ?? null });
}

async function lookup(logins, force) {
  await hydrate();
  const wanted = [...new Set(logins.map((l) => String(l).toLowerCase()))];
  const now = Date.now();
  const stale = wanted.filter((login) => force || !(cache.has(login) && now - cache.get(login).at < TTL_MS));

  for (let i = 0; i < stale.length; i += BATCH) {
    await fetchBatch(stale.slice(i, i + BATCH));
  }
  if (stale.length) persist();

  return Object.fromEntries(wanted.map((login) => [login, cache.get(login)?.user ?? null]));
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'lookup') return;
  lookup(message.logins || [], message.force).then(
    (users) => sendResponse({ ok: true, users }),
    (error) => sendResponse({ ok: false, error: String(error?.message || error) })
  );
  return true; // answer asynchronously
});
