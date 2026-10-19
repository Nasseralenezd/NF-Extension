/*
 * Auto-expand: keeps clicking "Show More" in Followed Channels until the whole
 * list is showing. Optionally opens the sidebar once if it starts collapsed.
 */
(function () {
  const NF = window.NFTwitch;
  const MAX_CLICKS = 30;
  const LOAD_WAIT_MS = 2000;

  let settings = null;
  let stopWatching = null;
  let clicks = 0;
  let pending = null; // { count, at } after a click, until the list grows
  let finished = new WeakSet(); // sections we fully expanded; if you click "Show Less" we leave it be
  let openedSidebar = false;

  function run() {
    if (settings.openSidebar && !openedSidebar && NF.isSideNavCollapsed()) {
      const arrow = NF.$(NF.SEL.sideNavArrow);
      if (arrow) {
        openedSidebar = true;
        arrow.click();
        return;
      }
    }

    const section = NF.followedSection(true);
    if (!section || finished.has(section)) return;
    const count = section.querySelectorAll('a[href]').length;

    if (pending) {
      if (count > pending.count) pending = null; // the last click loaded more
      else if (Date.now() - pending.at < LOAD_WAIT_MS) return; // still loading
      else return done(section); // clicking didn't add anything
    }

    const button = NF.$(NF.SEL.showMore, section);
    if (!button) {
      if (clicks > 0) done(section);
      return;
    }
    if (clicks >= MAX_CLICKS) return done(section);
    clicks++;
    pending = { count, at: Date.now() };
    button.click();
  }

  function done(section) {
    finished.add(section);
    pending = null;
  }

  NF.register('autoExpand', {
    start(next) {
      settings = next;
      clicks = 0;
      pending = null;
      finished = new WeakSet();
      stopWatching = NF.watchSideNav(run);
    },
    update(next) {
      settings = next;
    },
    stop() {
      stopWatching?.();
    },
  });
})();
