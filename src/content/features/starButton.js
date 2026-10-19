/*
 * Star button: a ★ next to Follow / Subscribe on channel pages. Click it to
 * pin or unpin that streamer.
 */
(function () {
  const NF = window.NFTwitch;
  const BUTTON_ID = 'nftw-star';
  const CHECK_MS = 700;

  let favorites = new Set();
  let timer = 0;

  // Twitch re-renders the channel header often, so this simply checks a few
  // times a second that the button is where it should be.
  function ensure() {
    const login = NF.currentChannel();
    const follow = login && NF.$(NF.SEL.followButton);
    let button = document.getElementById(BUTTON_ID);
    if (!follow) {
      button?.remove();
      return;
    }
    const wrapper = outerWrapper(follow);
    if (!button) button = build();
    if (button.nextElementSibling !== wrapper) wrapper.before(button);
    button.dataset.login = login;
    paint();
  }

  // The follow button sits inside a chain of single-child wrappers; the star
  // goes next to the outermost one so it lines up in the header's button row.
  function outerWrapper(el) {
    let node = el;
    while (node.parentElement && node.parentElement.childElementCount === 1) node = node.parentElement;
    return node;
  }

  function build() {
    return NF.el('button', { id: BUTTON_ID, class: 'nftw-star-btn', type: 'button', onclick: toggle }, NF.starIcon(20));
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
      await NF.storage.setFavorite(login, on);
    } catch (err) {
      if (NF.alive()) console.warn('[NF for Twitch] could not save favorite:', err);
      try {
        load(await NF.storage.getFavorites()); // show what is really saved
      } catch {}
    }
  }

  function load(list) {
    favorites = new Set(list.map((f) => f.login));
    paint();
  }

  NF.register('starButton', {
    async start() {
      timer = setInterval(ensure, CHECK_MS);
      load(await NF.storage.getFavorites());
      if (timer) ensure(); // unless stopped while loading
    },
    onFavorites(list) {
      load(list);
    },
    stop() {
      clearInterval(timer);
      timer = 0;
      document.getElementById(BUTTON_ID)?.remove();
    },
  });
})();
