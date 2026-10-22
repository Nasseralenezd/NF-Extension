/*
 * Star button on kick.com: a ★ in the row with Follow and Subscribe on
 * channel pages pins the channel to your Kick favorites (the Channels list in
 * the popup's Kick tab), or unpins it.
 */
(async function () {
  const store = globalThis.NFTwitchStorage;
  const BUTTON_ID = 'nftw-kick-star';
  const HEADER_BUTTONS = '[data-testid="follow-button"], [data-testid="unfollow-button"], [data-testid="sub-button"]';
  const SLUG = /^[a-z0-9_-]{1,32}$/;
  const CHECK_MS = 700;

  let settings = await store.getSettings();
  let favorites = new Set();
  let timer = 0;

  const alive = () => {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  };

  // kick.com/<slug>, also on its videos and clips pages.
  function currentSlug() {
    const slug = location.pathname.split('/')[1]?.toLowerCase();
    return slug && SLUG.test(slug) ? slug : null;
  }

  // The row of buttons in the channel header: Follow and Subscribe (signed
  // out), or the bell, heart, Gift Subs and Subscribe. Only what's on screen
  // counts: Kick keeps hidden copies of pages around while it brings in the
  // next one, and those have their own Follow button.
  function buttonRow() {
    const shown = (el) => el.offsetParent !== null;
    const find = (root) => [...root.querySelectorAll(HEADER_BUTTONS)].filter((b) => shown(b) && !b.closest('#sidebar-wrapper, [data-radix-popper-content-wrapper]'));
    // Look around the channel's name first.
    let header = [...document.querySelectorAll('#channel-username')].find(shown)?.parentElement;
    while (header && header !== document.body && !find(header).length) header = header.parentElement;
    const buttons = find(header && header !== document.body ? header : document);
    if (!buttons.length) return null;
    // The box right around them; the bell and heart may sit in a box of their own.
    let row = buttons[0].parentElement;
    for (let up = 0; up < 2 && !buttons.every((b) => row.contains(b)); up++) row = row.parentElement;
    return buttons.every((b) => row.contains(b)) ? row : buttons[0].parentElement;
  }

  // Kick redraws the channel header as you move between channels, so this
  // checks a few times a second that the star is first in that row.
  function ensure() {
    if (!alive()) return stop(); // extension was reloaded
    const slug = currentSlug();
    const row = slug && buttonRow();
    let button = document.getElementById(BUTTON_ID);
    if (!row) {
      button?.remove();
      return;
    }
    if (!button) button = build();
    if (row.firstElementChild !== button) row.prepend(button);
    // As tall as Kick's own buttons there, and square.
    const size = `${row.querySelector(HEADER_BUTTONS)?.offsetHeight || 40}px`;
    if (button.style.height !== size) button.style.height = button.style.width = size;
    button.dataset.login = slug;
    paint();
  }

  function build() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M12 2.8l2.83 5.73 6.33.92-4.58 4.46 1.08 6.3L12 17.24l-5.66 2.97 1.08-6.3-4.58-4.46 6.33-.92L12 2.8z');
    svg.append(path);
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.append(svg);
    button.addEventListener('click', toggle);
    return button;
  }

  function paint() {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    const on = favorites.has(button.dataset.login);
    if (button.getAttribute('aria-pressed') === String(on)) return;
    const label = on ? 'Unpin from favorites' : 'Pin to favorites';
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  async function toggle(event) {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget;
    const login = button.dataset.login;
    if (!login) return;

    button.classList.remove('nftw-pop');
    void button.offsetWidth; // restart the animation
    button.classList.add('nftw-pop');

    const on = !favorites.has(login);
    if (on) favorites.add(login);
    else favorites.delete(login);
    paint();
    try {
      // Queued in order, so quick double clicks end in the state of the last click.
      await store.setFavorite(login, on, 'kick');
    } catch (err) {
      if (alive()) console.warn('[NF Extension] could not save Kick favorite:', err);
      try {
        load(await store.getFavorites('kick')); // show what is really saved
      } catch {}
    }
  }

  function load(list) {
    favorites = new Set(list.map((f) => f.login));
    paint();
  }

  function stop() {
    clearInterval(timer);
    timer = 0;
    document.getElementById(BUTTON_ID)?.remove();
  }

  async function apply() {
    if (settings.kickStar && !timer) {
      timer = setInterval(ensure, CHECK_MS);
      load(await store.getFavorites('kick'));
      if (timer) ensure(); // unless turned off while loading
    } else if (!settings.kickStar && timer) {
      stop();
    }
  }

  apply();
  store.onChange(async (change) => {
    if (change.settings) {
      settings = await store.getSettings();
      apply();
    }
    if (change.kickFavorites) load(change.kickFavorites);
  });
})();
