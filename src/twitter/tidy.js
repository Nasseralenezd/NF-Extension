/*
 * Tidy X:
 *   Hide promoted posts - ads in the timeline and in replies. An ad shows "Ad"
 *                         in its header where a post has its timestamp, so
 *                         that missing timestamp is what gives it away (it
 *                         works in every language).
 *   Hide sidebar clutter - the side column parts you pick, and the floating
 *                         Grok button. They're found by markers X puts on
 *                         them that don't depend on the language.
 * Both mark what they find with a class, and twitter.css hides it.
 */
(async function () {
  const store = globalThis.NFTwitchStorage;
  const AD_CLASS = 'nftw-x-ad';
  const HIDDEN_CLASS = 'nftw-x-hidden';
  const THROTTLE_MS = 250;

  // Side column parts: setting -> how to find something inside that part.
  const PARTS = {
    xHidePremium: (column) => column.querySelector('a[href^="/i/premium_sign_up"]'),
    xHideNews: (column) => column.querySelector('[data-testid="news_sidebar"]'),
    xHideTrends: (column) => column.querySelector('[data-testid="trend"]'),
    xHideFollow: (column) => column.querySelector('[data-testid="UserCell"]'),
  };

  let settings = await store.getSettings();
  let observer = null;
  let timer = 0;

  function scan() {
    timer = 0;
    if (settings.xHidePromoted) markAds();
    if (settings.xHideClutter) markSidebar();
  }

  function markAds() {
    for (const article of document.querySelectorAll('article')) {
      const header = article.querySelector('[data-testid="User-Name"]'); // the post's own header comes first
      if (!header) continue; // still drawing
      article.closest('[data-testid="cellInnerDiv"]')?.classList.toggle(AD_CLASS, !header.querySelector('time'));
    }
  }

  function markSidebar() {
    const column = document.querySelector('[data-testid="sidebarColumn"]');
    if (!column) return;
    const found = Object.entries(PARTS).map(([setting, find]) => [setting, find(column)]);
    // The column is a stack of boxes; the stack is the closest element that
    // holds every part (and the footer). Each part's box is its child there.
    const anchors = found.map(([, node]) => node).filter(Boolean);
    const footer = column.querySelector('nav a[href$="/tos"]');
    if (footer) anchors.push(footer);
    if (anchors.length < 2) return;
    let stack = anchors[0].parentElement;
    while (stack && !anchors.every((node) => stack.contains(node))) stack = stack.parentElement;
    if (!stack || !column.contains(stack)) return;
    for (const [setting, node] of found) {
      let box = node;
      while (box && box.parentElement !== stack) box = box.parentElement;
      box?.classList.toggle(HIDDEN_CLASS, !!settings[setting]);
    }
  }

  function schedule() {
    timer ||= setTimeout(scan, THROTTLE_MS); // X redraws constantly; check at most 4 times a second
  }

  function apply() {
    const root = document.documentElement;
    const on = !!(settings.xHidePromoted || settings.xHideClutter);
    root.classList.toggle('nftw-x-nogrok', !!(settings.xHideClutter && settings.xHideGrok));
    // Turning a feature off shows everything it hid.
    if (!settings.xHidePromoted) document.querySelectorAll(`.${AD_CLASS}`).forEach((n) => n.classList.remove(AD_CLASS));
    if (!settings.xHideClutter) document.querySelectorAll(`.${HIDDEN_CLASS}`).forEach((n) => n.classList.remove(HIDDEN_CLASS));
    if (on && !observer) {
      observer = new MutationObserver(schedule);
      observer.observe(document, { childList: true, subtree: true });
    } else if (!on && observer) {
      observer.disconnect();
      observer = null;
    }
    if (on) scan();
  }

  apply();
  store.onChange(async (change) => {
    if (!change.settings) return;
    settings = await store.getSettings();
    apply();
  });
})();
