/*
 * Service worker: looks up channels on Twitch, Kick and YouTube (live status,
 * viewers, game, avatar) for the content scripts and the popup.
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

/* ---------- YouTube ----------
 * Whether YouTube channels are live, using the small lookups youtube.com's
 * own pages use (no developer key). YouTube only answers those when they
 * come from youtube.com, so a session rule marks this extension's own
 * requests to them that way; nothing else is changed. Your YouTube login is
 * used for one lookup only: which channels you subscribe to are live.
 */
const YT = 'https://www.youtube.com';
const YT_CLIENT = { clientName: 'WEB', clientVersion: '2.20261020.00.00', hl: 'en' };
const YT_TTL_MS = 120_000;
const YT_CHANNEL_TTL_MS = 7 * 24 * 3600_000; // channel names and avatars change rarely
const YT_PARALLEL = 3;
const YT_SUBSCRIPTIONS_MAX = 50; // live subscriptions looked up at most, each takes a few requests

const YT_RETRY_MS = 30 * 60_000; // after a channel page couldn't be read
const ytStreams = new Map(); // channel id -> { at, stream }, stream a promise that lookups at the same time share
const ytFailedAt = new Map(); // key -> when its channel page last couldn't be read
let ytChannels = null; // key -> { at, id, name, avatar }, kept in storage.local
let ytSubscriptionsCache = null; // { at, result }
let ytRule = null;

function youtubeRule() {
  ytRule ??= chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [1],
    addRules: [
      {
        id: 1,
        priority: 1,
        action: { type: 'modifyHeaders', requestHeaders: [{ header: 'origin', operation: 'set', value: YT }] },
        condition: { urlFilter: '|https://www.youtube.com/youtubei/', initiatorDomains: [chrome.runtime.id], resourceTypes: ['xmlhttprequest'] },
      },
    ],
  });
  return ytRule;
}

// auth: headers that sign the request with your youtube.com login (see ytAuth);
// only then does the browser send your YouTube cookies with it.
async function ytPost(endpoint, body, auth = null) {
  await youtubeRule();
  const res = await fetch(`${YT}/youtubei/v1/${endpoint}?prettyPrint=false`, {
    method: 'POST',
    credentials: auth ? 'include' : 'omit',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ context: { client: YT_CLIENT }, ...body }),
  });
  if (!res.ok) throw new Error(`YouTube answered ${res.status}`);
  return res.json();
}

const decodeHtml = (text) =>
  text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|#39|apos);/gi, (whole, code) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[code.toLowerCase()];
    if (named) return named;
    const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
  });

// The channel's id, name and avatar, from its page (about 1 MB, so it's kept for a week).
async function ytChannelInfo(key) {
  ytChannels ??= (await chrome.storage.local.get('ytChannels')).ytChannels || {};
  const hit = ytChannels[key];
  if (hit && Date.now() - hit.at < YT_CHANNEL_TTL_MS) return hit.id ? hit : null;
  if (Date.now() - (ytFailedAt.get(key) || 0) < YT_RETRY_MS) throw new Error('waiting before asking YouTube again');
  const res = await fetch(`${YT}/${key.startsWith('UC') ? `channel/${key}` : key}`, { credentials: 'omit' });
  let info = null;
  if (res.ok) {
    const html = await res.text();
    const id = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/)?.[1];
    if (!id) {
      ytFailedAt.set(key, Date.now()); // a consent page, for example
      throw new Error('YouTube sent no channel page');
    }
    const meta = (property) => decodeHtml(html.match(new RegExp(`<meta property="og:${property}" content="([^"]*)"`))?.[1] || '');
    info = { at: Date.now(), id, name: meta('title') || key, avatar: meta('image') };
  } else if (res.status !== 404) {
    ytFailedAt.set(key, Date.now());
    throw new Error(`YouTube answered ${res.status}`);
  }
  ytChannels[key] = info || { at: Date.now() };
  chrome.storage.local.set({ ytChannels });
  return info;
}

// The first value under `key` anywhere in one of YouTube's answers.
function findDeep(root, key) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (node[key]) return node[key];
    stack.push(...Object.values(node));
  }
  return null;
}

// "5,436 watching now" in the live video's details.
function watching(meta) {
  const counter = findDeep(meta, 'videoViewCountRenderer');
  return counter ? Number(counter.originalViewCount || (counter.unlabeledViewCountValue?.simpleText || '').replace(/\D/g, '')) || 0 : 0;
}

// What the channel is streaming: { live, videoId, title, game, viewers }.
async function fetchYtStream(channelId) {
  const stream = { live: false, videoId: null, title: '', game: '', viewers: 0 };
  // A channel's /live address leads to its live video, or back to the channel when it's offline.
  const resolved = await ytPost('navigation/resolve_url', { url: `${YT}/channel/${channelId}/live` });
  const videoId = resolved.endpoint?.watchEndpoint?.videoId;
  if (!videoId) return stream;
  const [player, meta] = await Promise.all([ytPost('player', { videoId }), ytPost('updated_metadata', { videoId }).catch(() => null)]);
  const details = player.videoDetails || {};
  const micro = player.microformat?.playerMicroformatRenderer || {};
  // /live can also lead to a stream that's only scheduled.
  if (!details.isLive || micro.liveBroadcastDetails?.isLiveNow === false) return stream;
  return { live: true, videoId, title: details.title || '', game: micro.category || '', viewers: meta ? watching(meta) : 0 };
}

function ytStream(channelId, force) {
  const hit = ytStreams.get(channelId);
  // Even a forced refresh shares a lookup that started a moment ago: the same
  // channel can be on your list and in your subscriptions.
  if (hit && Date.now() - hit.at < (force ? 5_000 : YT_TTL_MS)) return hit.stream;
  const stream = fetchYtStream(channelId);
  ytStreams.set(channelId, { at: Date.now(), stream });
  stream.catch(() => {
    if (ytStreams.get(channelId)?.stream === stream) ytStreams.delete(channelId);
  });
  return stream;
}

async function ytChannel(key, force) {
  const info = await ytChannelInfo(key);
  if (!info) return null;
  return { login: key, channelId: info.id, displayName: info.name, avatar: info.avatar, ...(await ytStream(info.id, force)) };
}

/** [[item, result]] for each item, a few at a time and in order. Items that failed are left out. */
async function ytEach(items, task) {
  const out = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = [items[i], await task(items[i])];
      } catch {
        // unknown for now; try again next refresh
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(YT_PARALLEL, items.length) }, worker));
  return out.filter(Boolean);
}

// Your youtube.com login cookies (SAPISID and its newer variants), each with
// the name of the hash youtube.com signs with it. Null when you're not logged in.
async function ytLoginCookies() {
  const cookie = (name) => chrome.cookies.get({ url: YT, name }).then((c) => c?.value || null, () => null);
  const [sapisid, sapisid1p, sapisid3p] = await Promise.all(['SAPISID', '__Secure-1PAPISID', '__Secure-3PAPISID'].map(cookie));
  const signed = [['SAPISIDHASH', sapisid || sapisid3p], ['SAPISID1PHASH', sapisid1p], ['SAPISID3PHASH', sapisid3p]].filter(([, value]) => value);
  return signed.length ? signed : null;
}

// Who youtube.com is acting as right now: which of your Google accounts
// (SESSION_INDEX) and, for a brand-account channel, that channel
// (DELEGATED_SESSION_ID). YouTube's own service worker reads them from this
// small file; field n of its message sits at index n - 1. {} (your first
// account) when it can't be read.
async function ytIdentity() {
  try {
    const res = await fetch(`${YT}/sw.js_data`, { credentials: 'include' });
    if (!res.ok) return {};
    const data = JSON.parse((await res.text()).replace(/^\)\]\}'\s*/, ''));
    const fields = data.find((entry) => entry?.[0] === 'yt.sw.adr')?.[2] || [];
    const text = (n) => (typeof fields[n - 1] === 'string' && fields[n - 1]) || null;
    return { sessionIndex: Number.isInteger(fields[3]) ? fields[3] : 0, pageId: text(8), delegation: text(11), userSessionId: text(12) };
  } catch {
    return {};
  }
}

// youtube.com signs its requests with your login: for each login cookie, a
// hash of your session id (marked _u), the time, the cookie and the site.
// The hashes and cookies go only to youtube.com.
async function ytAuth(cookies, identity) {
  const time = Math.floor(Date.now() / 1000);
  const user = identity.userSessionId;
  const sign = async ([scheme, value]) => {
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode([user, time, value, YT].filter(Boolean).join(' ')));
    return `${scheme} ${time}_${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}${user ? '_u' : ''}`;
  };
  const headers = { Authorization: (await Promise.all(cookies.map(sign))).join(' '), 'X-Origin': YT, 'X-Goog-AuthUser': String(identity.sessionIndex || 0) };
  if (identity.pageId) headers['X-Goog-PageId'] = identity.pageId;
  return headers;
}

// Every guideEntryRenderer under node, in order. Long subscription lists keep
// the rest under "Show more" (guideCollapsibleEntryRenderer), which this covers.
function guideEntries(node, out = []) {
  if (node?.guideEntryRenderer) out.push(node.guideEntryRenderer);
  else if (node && typeof node === 'object') for (const value of Object.values(node)) guideEntries(value, out);
  return out;
}

// The channels you subscribe to that are live, from the lookup behind the
// red dots in youtube.com's own sidebar: { loggedIn, total, channels }, total
// being how many subscriptions YouTube listed.
async function fetchYoutubeSubscriptions() {
  const cookies = await ytLoginCookies();
  if (!cookies) return { loggedIn: false, channels: [] };
  // Ask like youtube.com's own sidebar: as the account and channel you're
  // using there, and for the live dots, which YouTube otherwise leaves out.
  const identity = await ytIdentity();
  const context = { client: YT_CLIENT, ...(identity.delegation && { user: { serializedDelegationContext: identity.delegation } }) };
  const guide = await ytPost('guide', { context, fetchLiveState: true }, await ytAuth(cookies, identity));
  if (guide.responseContext?.mainAppWebResponseContext?.loggedOut) return { loggedIn: false, channels: [] };
  const channels = [];
  let total = 0;
  for (const entry of guideEntries(findDeep(guide, 'guideSubscriptionsSectionRenderer'))) {
    const id = entry.navigationEndpoint?.browseEndpoint?.browseId;
    if (!/^UC[\w-]{22}$/.test(id || '')) continue;
    total++;
    if (!entry.badges?.liveBroadcasting) continue;
    const thumbs = entry.thumbnail?.thumbnails || [];
    channels.push({
      login: id,
      channelId: id,
      displayName: entry.formattedTitle?.simpleText || id,
      avatar: (thumbs[thumbs.length - 1]?.url || '').replace(/^\/\//, 'https://'),
    });
  }
  return { loggedIn: true, total, channels: channels.slice(0, YT_SUBSCRIPTIONS_MAX) };
}

async function youtubeSubscriptions(force) {
  if (!force && ytSubscriptionsCache && Date.now() - ytSubscriptionsCache.at < YT_TTL_MS) return ytSubscriptionsCache.result;
  const result = await fetchYoutubeSubscriptions();
  ytSubscriptionsCache = { at: Date.now(), result };
  return result;
}

// Your live subscriptions, with what each one is streaming.
async function liveSubscriptions(force) {
  const { loggedIn, total, channels } = await youtubeSubscriptions(force);
  const found = await ytEach(channels, async (channel) => ({ ...channel, ...(await ytStream(channel.channelId, force)) }));
  return { loggedIn, total, channels: found.map(([, channel]) => channel).filter((c) => c.live) };
}

/**
 * { channels: { key: channel | null }, subscriptions: { loggedIn, total, channels } | null }.
 * Channels YouTube couldn't be asked about are left out.
 */
async function youtubeLookup({ channels = [], subscriptions = false, force = false }) {
  const [found, subscribed] = await Promise.all([
    ytEach([...new Set(channels)], (key) => ytChannel(key, force)),
    subscriptions ? liveSubscriptions(force).catch((err) => ({ loggedIn: null, channels: [], error: String(err?.message || err) })) : null,
  ]);
  return { channels: Object.fromEntries(found), subscriptions: subscribed };
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
  if (message?.type === 'youtube') return reply(youtubeLookup(message));
});
