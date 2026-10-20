/*
 * Shared helpers for the content scripts.
 *
 * Every Twitch selector lives in SEL below. When Twitch changes its page and
 * a feature stops working, this table is the one place to fix.
 */
(function () {
  const NF = (window.NFTwitch = { modules: new Map() });
  NF.storage = globalThis.NFTwitchStorage;

  /** Content features call this; main.js starts and stops them from settings. */
  NF.register = (id, feature) => NF.modules.set(id, feature);

  NF.SEL = {
    sideNav: '[data-test-selector="side-nav"], .side-nav',
    sideNavContent: '.side-bar-contents, #side-nav', // the channel lists, without the collapse arrow (tried in this order)
    sideNavCollapsed: '.side-nav--collapsed, [data-a-target="side-nav-bar-collapsed"]',
    section: '.side-nav-section',
    followedCard: '[data-test-selector="followed-channel"], [data-a-id^="followed-channel-"]',
    cardRow: '.tw-transition', // one per channel inside a section's list
    showMore: '[data-a-target="side-nav-show-more-button"]',
    sideNavArrow: '[data-a-target="side-nav-arrow"]',
    followButton: '[data-a-target="follow-button"], [data-a-target="unfollow-button"]',
    player: '[data-a-target="video-player"], .video-player',
    volumeSlider: '[data-a-target="player-volume-slider"]',
    playerRightControls: '.player-controls__right-control-group',
    settingsButton: '[data-a-target="player-settings-button"]',
    settingsMenu: '[data-a-target="player-settings-menu"]',
    qualityMenuItem: '[data-a-target="player-settings-menu-item-quality"]',
    qualityOption: '[data-a-target="player-settings-submenu-quality-option"]',
    fullscreenButton: '[data-a-target="player-fullscreen-button"]',
    theaterActive: '.persistent-player--theatre, .channel-page__video-player--theatre-mode',
    claimBonus: '.claimable-bonus__icon', // inside the "Claim Bonus" button
  };

  // Player buttons without a stable data-a-target, found by the hotkey shown
  // in their (translated) label, e.g. "Theatre Mode (alt+t)".
  const HOTKEY_LABEL = { theater: /alt\+t\)/i, clip: /alt\+x\)/i };

  // First path segments on twitch.tv that are not channel pages.
  const RESERVED = new Set([
    'activate', 'annual-recap', 'bits', 'broadcast', 'collections', 'creatorcamp', 'dashboard', 'directory',
    'downloads', 'drops', 'embed', 'event', 'friends', 'following', 'inventory', 'jobs', 'legal', 'login',
    'logout', 'manager', 'messages', 'moderator', 'p', 'popout', 'prime', 'privacy', 'products', 'redeem',
    'search', 'settings', 'signup', 'store', 'subscriptions', 'team', 'turbo', 'u', 'user', 'videos', 'wallet',
  ]);
  const LOGIN_RE = /^[a-z0-9_]{1,25}$/;

  NF.$ = (selector, root = document) => root.querySelector(selector);
  NF.$$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  /** Small element builder: NF.el('a', { class, href, text, onclick }, children). */
  NF.el = function (tag, props = {}, children = []) {
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
  };

  /** A star icon built with DOM calls (no innerHTML, which Twitch may block). */
  NF.starIcon = function (size = 20) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M12 2.8l2.83 5.73 6.33.92-4.58 4.46 1.08 6.3L12 17.24l-5.66 2.97 1.08-6.3-4.58-4.46 6.33-.92L12 2.8z');
    svg.append(path);
    return svg;
  };

  /** Resolves with the first element matching `selector`, or null after `timeout` ms. */
  NF.waitFor = function (selector, timeout = 2000, root = document) {
    const start = Date.now();
    return new Promise((resolve) => {
      (function poll() {
        const el = root.querySelector(selector);
        if (el || Date.now() - start > timeout) return resolve(el);
        setTimeout(poll, 50);
      })();
    });
  };

  NF.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /** The main video player on the page and its <video>, if any. */
  NF.player = function () {
    const player = NF.$(NF.SEL.player);
    return player ? { player, video: player.querySelector('video') } : null;
  };

  /** A player button found by its hotkey label: NF.playerButton('theater' | 'clip'). */
  NF.playerButton = function (name, root = NF.$(NF.SEL.player)) {
    if (!root) return null;
    return NF.$$('button[aria-label]', root).find((b) => HOTKEY_LABEL[name].test(b.getAttribute('aria-label'))) || null;
  };

  /** A short message in the middle-top of the player (reuses the volume overlay style). */
  NF.playerToast = function (player, text) {
    let toast = player.querySelector('.nftw-toast');
    if (!toast) {
      toast = NF.el('div', { class: 'nftw-osd nftw-toast', role: 'status' });
      player.append(toast);
    }
    toast.textContent = text;
    toast.classList.add('nftw-osd--on');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('nftw-osd--on'), 1400);
  };

  /**
   * False once the extension was reloaded or updated while this tab stayed
   * open: this old copy of the script can no longer reach the extension.
   */
  NF.alive = function () {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  };

  NF.sideNav = () => NF.$(NF.SEL.sideNav);
  NF.isSideNavCollapsed = () => !!NF.$(NF.SEL.sideNavCollapsed);

  /**
   * The Followed Channels section. With strict = false, falls back to the
   * first sidebar section (signed out, or a layout we can't identify).
   */
  NF.followedSection = function (strict) {
    const nav = NF.sideNav();
    if (!nav) return null;
    const bySelector = NF.$(NF.SEL.followedCard, nav)?.closest(NF.SEL.section);
    if (bySelector) return bySelector;
    // The aria-label is translated, so this only helps in English.
    const byLabel = NF.$$(NF.SEL.section, nav).find((s) => /follow/i.test(s.getAttribute('aria-label') || ''));
    if (byLabel) return byLabel;
    return strict ? null : NF.$(NF.SEL.section, nav);
  };

  /**
   * Everything the sidebar shows above `el` (For You, stories, streaks...),
   * collected level by level up to the sidebar content. The last item is the
   * topmost block. Our own sections (ids starting with "nftw-") are never included.
   */
  NF.blocksAbove = function (el) {
    const root = NF.SEL.sideNavContent.split(',').map((s) => NF.$(s.trim())).find(Boolean);
    const blocks = [];
    if (!root?.contains(el)) return blocks;
    for (let node = el; node && node !== root; node = node.parentElement) {
      for (let prev = node.previousElementSibling; prev; prev = prev.previousElementSibling) {
        if (!prev.id?.startsWith('nftw-')) blocks.push(prev);
      }
    }
    return blocks;
  };

  /**
   * Where our sidebar sections go: before the topmost sidebar block
   * (position "top") or before Followed Channels ("followed").
   */
  NF.favoritesAnchor = function (position) {
    const followed = NF.followedSection(false);
    if (!followed) return null;
    if (position === 'top') {
      const above = NF.blocksAbove(followed);
      if (above.length) return above[above.length - 1];
    }
    return followed;
  };

  /**
   * Calls `callback` at most every 150 ms while the side nav is changing.
   * (Not a debounce: animated parts like the stories ring change constantly,
   * so waiting for a quiet moment could wait forever.) Twitch can replace the
   * whole side nav, so this re-attaches to the current one.
   * Returns a function that stops watching.
   */
  NF.watchSideNav = function (callback) {
    let watched = null;
    let timer = 0;
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = 0;
        callback();
      }, 150);
    };
    const observer = new MutationObserver(schedule);
    const attach = () => {
      const nav = NF.sideNav();
      if (nav === watched) return;
      observer.disconnect();
      watched = nav;
      if (nav) observer.observe(nav, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      schedule();
    };
    attach();
    const interval = setInterval(attach, 1000);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
      observer.disconnect();
    };
  };

  /** The channel login for the current page, or null when it isn't a channel page. */
  NF.currentChannel = function () {
    const first = (location.pathname.split('/')[1] || '').toLowerCase();
    if (!first || RESERVED.has(first) || !LOGIN_RE.test(first)) return null;
    return first;
  };

  /** Navigates inside Twitch without reloading the page. */
  NF.navigate = function (path) {
    if (location.pathname === path) return;
    history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  };

  /** Asks the background worker about channels: { login: user | null }, or null on failure. */
  NF.lookup = async function (logins, force = false) {
    if (!logins.length) return {};
    try {
      const res = await chrome.runtime.sendMessage({ type: 'lookup', logins, force });
      if (res?.ok) return res.users;
      console.warn('[NF for Twitch] lookup failed:', res?.error);
    } catch (err) {
      // "Extension context invalidated" happens when the extension is reloaded
      // while this tab stays open. Refreshing the tab fixes it.
      if (NF.alive()) console.warn('[NF for Twitch]', err);
    }
    return null;
  };

  /** 950 -> "950", 1234 -> "1.2K", 146000 -> "146K", 2500000 -> "2.5M" (Twitch's format). */
  NF.formatViewers = function (n) {
    const short = (x) => String(x >= 100 ? Math.round(x) : Math.round(x * 10) / 10);
    if (n >= 1e6) return short(n / 1e6) + 'M';
    if (n >= 1e3) return short(n / 1e3) + 'K';
    return String(n);
  };
})();
