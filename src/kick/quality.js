/*
 * Keep high quality on kick.com: when a stream starts, picks the highest
 * quality you can watch in the player's settings menu. Kick's Auto mode
 * lowers the quality now and then; a fixed choice stays put. The menu is
 * invisible while this happens. Qualities that need a Kick login are
 * skipped, and a quality you pick yourself sticks until you open another
 * page.
 */
(async function () {
  const store = globalThis.NFTwitchStorage;
  const BUSY_CLASS = 'nftw-kick-quality-busy';
  const VIDEO = '#injected-channel-player video, video#video-player';
  const SETTINGS_BUTTON = 'button[aria-haspopup="menu"]:has(svg[data-ds-icon="Settings"])';
  const ITEMS = '[role="menu"][data-state="open"] [role="menuitemradio"]';
  const CHECK_MS = 1500;
  const MAX_TRIES = 5;

  let settings = await store.getSettings();
  let timer = 0;
  let busy = false;
  let loads = 0; // streams the player has loaded on this page
  let doneFor = null; // "path#load" already handled
  let tries = { key: null, count: 0 };
  let userPath = null; // page where you used the menu yourself

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const alive = () => {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  };

  async function check() {
    if (!alive()) return clearInterval(timer); // extension was reloaded
    if (busy || userPath === location.pathname) return;
    const video = document.querySelector(VIDEO);
    if (!video || video.readyState < 2 || !video.videoHeight) return;

    const key = `${location.pathname}#${loads}`;
    if (doneFor === key) return;
    const button = settingsButton(video);
    if (!button) return; // the player is still loading, or an ad is playing
    if (tries.key !== key) tries = { key, count: 0 };
    if (tries.count >= MAX_TRIES) return;
    tries.count++;

    busy = true;
    try {
      if (await apply(button)) doneFor = key;
    } finally {
      busy = false;
    }
  }

  // Kick swaps its controls out while the player loads and during ads.
  function settingsButton(video) {
    for (let box = video.parentElement, i = 0; box && i < 4; box = box.parentElement, i++) {
      const button = box.querySelector(SETTINGS_BUTTON);
      if (button) return button;
    }
    return null;
  }

  async function apply(button) {
    const focused = document.activeElement;
    document.documentElement.classList.add(BUSY_CLASS);
    try {
      toggleMenu(button);
      const items = await waitForItems(1500);
      if (!items) return false;
      const best = pick(items);
      if (best && best.getAttribute('aria-checked') !== 'true') best.click();
      return true;
    } finally {
      await sleep(120);
      if (button.getAttribute('aria-expanded') === 'true') toggleMenu(button); // close the menu again
      await sleep(150);
      document.documentElement.classList.remove(BUSY_CLASS);
      // Closing the menu focuses the settings button; give focus back.
      const now = document.activeElement;
      if (now !== focused && (now === button || now?.closest?.('[role="menu"]'))) {
        if (focused instanceof HTMLElement && focused !== document.body) focused.focus({ preventScroll: true });
        else now.blur();
      }
    }
  }

  // Kick's menus open on pointerdown rather than click.
  function toggleMenu(button) {
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', isPrimary: true }));
  }

  async function waitForItems(ms) {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) {
      const items = document.querySelectorAll(ITEMS);
      if (items.length) return [...items];
    }
    return null;
  }

  // Items read "Auto", "1080p60", "720p60", "480p"... A quality that needs a
  // Kick login carries a note after its name ("Login required").
  function pick(items) {
    const list = items
      .map((el) => {
        const [, height, fps] = el.textContent.match(/(\d{3,4})p(\d*)/) || [];
        const locked = [...el.children].slice(1).some((child) => child.textContent.trim());
        return { el, height: Number(height), fps: Number(fps) || 0, locked };
      })
      .filter((o) => o.height && !o.locked) // drops "Auto"
      .sort((a, b) => b.height - a.height || b.fps - a.fps);
    return list[0]?.el || null;
  }

  // A new stream in the player (another channel, or the stream reconnecting).
  document.addEventListener(
    'loadstart',
    (event) => {
      if (event.target instanceof HTMLVideoElement && event.target.matches(VIDEO)) loads++;
    },
    true
  );

  // You used the quality menu yourself: leave your choice alone on this page.
  const markUser = (event) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const menu = event.target.closest('[role="menu"]');
    if (menu && [...menu.querySelectorAll('[role="menuitemradio"]')].some((item) => /\d{3,4}p/.test(item.textContent))) {
      userPath = location.pathname;
    }
  };
  document.addEventListener('pointerdown', markUser, true);
  document.addEventListener('keydown', markUser, true);

  function setEnabled(on) {
    clearInterval(timer);
    timer = 0;
    if (!on) return;
    timer = setInterval(check, CHECK_MS);
    check();
  }

  setEnabled(!!settings.kickQuality);
  store.onChange(async (change) => {
    if (!change.settings) return;
    const was = !!settings.kickQuality;
    settings = await store.getSettings();
    if (!!settings.kickQuality !== was) setEnabled(!!settings.kickQuality);
  });
})();
