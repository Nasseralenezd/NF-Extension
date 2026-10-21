/*
 * Service worker: looks up channels on Twitch and Kick (live status, viewers,
 * game, avatar) for the content scripts and the popup.
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

async function gql(query, variables) {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'Client-Id': CLIENT_ID, 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Twitch answered ${res.status}`);
  const json = await res.json();
  if (!json.data) throw new Error(json.errors?.[0]?.message || 'Twitch sent no data');
  return json.data;
}

async function fetchBatch(logins) {
  const data = await gql(QUERY, { logins });
  const found = new Map();
  for (const user of data.users || []) {
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

/* ---------- Kick ----------
 * Kick's official API needs a developer key, so this uses the same JSON
 * endpoints kick.com's own pages use. Channel pages are public; the list of
 * channels you follow needs your kick.com login.
 */
const KICK = 'https://kick.com';
const KICK_TTL_MS = 60_000;
const KICK_FOLLOWED_TTL_MS = 120_000; // the follow list takes several requests, so ask less often
const KICK_FOLLOWED_MAX_PAGES = 40; // 5 channels per page: up to 200 live follows
const KICK_PARALLEL = 4;

const kickCache = new Map(); // slug -> { at, channel }, channel null when it doesn't exist
let kickFollowedCache = null; // { at, result }

function shapeKick(c) {
  const stream = c.livestream;
  return {
    login: c.slug,
    channelId: c.id ?? null, // Kick's live thumbnails are addressed by this id
    displayName: c.user?.username || c.slug,
    avatar: c.user?.profile_pic || '',
    live: !!stream?.is_live,
    viewers: stream?.viewer_count ?? 0,
    title: stream?.session_title ?? '',
    game: stream?.categories?.[0]?.name ?? '',
  };
}

async function kickChannel(slug, force) {
  const hit = kickCache.get(slug);
  if (!force && hit && Date.now() - hit.at < KICK_TTL_MS) return hit.channel;
  const res = await fetch(`${KICK}/api/v2/channels/${encodeURIComponent(slug)}`, { headers: { Accept: 'application/json' } });
  if (res.status === 404) {
    kickCache.set(slug, { at: Date.now(), channel: null });
    return null;
  }
  if (!res.ok) throw new Error(`Kick answered ${res.status}`);
  const channel = shapeKick(await res.json());
  kickCache.set(slug, { at: Date.now(), channel });
  return channel;
}

/** { slug: channel | null }. Slugs Kick couldn't be asked about are left out. */
async function kickChannels(slugs, force) {
  const out = {};
  const queue = [...new Set(slugs.map((s) => String(s).toLowerCase()))];
  const worker = async () => {
    while (queue.length) {
      const slug = queue.shift();
      try {
        out[slug] = await kickChannel(slug, force);
      } catch {
        // unknown for now (network or Kick blocking); try again next refresh
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(KICK_PARALLEL, queue.length) }, worker));
  return out;
}

// One entry of Kick's followed-channels list: { channel_slug, user_username,
// profile_picture, is_live, viewer_count, show_view_count, category_name,
// session_title }.
function shapeFollowed(item) {
  if (!item?.channel_slug) return null;
  return {
    login: item.channel_slug.toLowerCase(),
    displayName: item.user_username || item.channel_slug,
    avatar: item.profile_picture || '',
    live: !!item.is_live,
    viewers: item.viewer_count ?? 0,
    hideViewers: item.show_view_count === false, // the streamer hides the count on Kick
    title: item.session_title ?? '',
    game: item.category_name ?? '',
  };
}

// The channels you follow that are live, using the login kick.com keeps in
// its session_token cookie. The token is only ever sent to kick.com. Kick
// sends 5 channels per page with live channels first, so paging stops at the
// first offline one.
async function fetchKickFollowed() {
  let token = null;
  try {
    const cookie = await chrome.cookies.get({ url: KICK, name: 'session_token' });
    if (cookie?.value) token = decodeURIComponent(cookie.value);
  } catch {}
  if (!token) return { loggedIn: false, channels: [] };

  const live = [];
  let cursor = 0;
  for (let page = 0; page < KICK_FOLLOWED_MAX_PAGES; page++) {
    const res = await fetch(`${KICK}/api/v2/channels/followed?cursor=${cursor}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'omit',
    });
    if (res.status === 401) return { loggedIn: false, channels: [] };
    if (!res.ok) throw new Error(`Kick answered ${res.status}`);
    const { channels = [], nextCursor } = await res.json();
    const shaped = channels.map(shapeFollowed).filter(Boolean);
    live.push(...shaped.filter((c) => c.live));
    if (shaped.some((c) => !c.live) || nextCursor == null || !channels.length) break;
    cursor = nextCursor;
  }
  return { loggedIn: true, channels: live };
}

async function kickFollowed(force) {
  if (!force && kickFollowedCache && Date.now() - kickFollowedCache.at < KICK_FOLLOWED_TTL_MS) return kickFollowedCache.result;
  const result = await fetchKickFollowed();
  kickFollowedCache = { at: Date.now(), result };
  return result;
}

async function kickLookup({ slugs = [], followed = false, force = false }) {
  const [channels, follow] = await Promise.all([
    kickChannels(slugs, force),
    followed ? kickFollowed(force).catch((err) => ({ loggedIn: null, channels: [], error: String(err?.message || err) })) : null,
  ]);
  return { channels, followed: follow };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const reply = (promise) => {
    promise.then(
      (result) => sendResponse({ ok: true, ...result }),
      (error) => sendResponse({ ok: false, error: String(error?.message || error) })
    );
    return true; // answer asynchronously
  };
  if (message?.type === 'lookup') return reply(lookup(message.logins || [], message.force).then((users) => ({ users })));
  if (message?.type === 'kick') return reply(kickLookup(message));
});
