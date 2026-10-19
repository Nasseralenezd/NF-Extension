/*
 * Hide sidebar clutter: hides sponsored cards in Followed Channels and whole
 * recommendation sections, each with its own switch. Sections are told apart
 * by what they link to, not by their (translated) titles.
 */
(function () {
  const NF = window.NFTwitch;
  const HIDDEN_CLASS = 'nftw-clutter-hidden';
  const FOLLOWED_CARD = '[data-a-id^="followed-channel-"]';

  // Which switch hides a section, judged by the cards inside it.
  const SECTION_KINDS = [
    ['hideLiveChannels', '[data-a-id^="recommended-channel-"]'],
    ['hideViewersAlsoWatch', '[data-a-id^="similarity-channel-"]'],
    ['hideRecCategories', 'a[href^="/directory/category/"], a[href^="/directory/game/"]'],
  ];

  let settings = null;
  let stopWatching = null;

  function run() {
    const nav = NF.sideNav();
    if (!nav) return;
    const hide = new Set();
    const followed = NF.followedSection(true);

    for (const section of NF.$$(NF.SEL.section, nav)) {
      if (section === followed) continue; // never hide your Followed list
      const kind = SECTION_KINDS.find(([, cards]) => section.querySelector(cards));
      if (kind && settings[kind[0]]) hide.add(section);
    }

    if (settings.hideSponsored) {
      // A sponsored card sits in the Followed list but isn't a followed
      // channel. Only judge when real followed cards are marked (expanded
      // sidebar), so nothing is hidden by mistake.
      if (followed?.querySelector(FOLLOWED_CARD)) {
        for (const link of followed.querySelectorAll('a[href]')) {
          if (link.matches(FOLLOWED_CARD) || link.closest(FOLLOWED_CARD)) continue;
          const row = link.closest(NF.SEL.cardRow);
          if (row && followed.contains(row)) hide.add(row);
        }
      }
    }

    for (const el of NF.$$(`.${HIDDEN_CLASS}`)) if (!hide.has(el)) el.classList.remove(HIDDEN_CLASS);
    for (const el of hide) if (!el.classList.contains(HIDDEN_CLASS)) el.classList.add(HIDDEN_CLASS);
  }

  NF.register('hideSidebarClutter', {
    start(next) {
      settings = next;
      stopWatching = NF.watchSideNav(run);
    },
    update(next) {
      settings = next;
      run();
    },
    stop() {
      stopWatching?.();
      NF.$$(`.${HIDDEN_CLASS}`).forEach((el) => el.classList.remove(HIDDEN_CLASS));
    },
  });
})();
