/*
 * Stream preview's hover card: resting the pointer on a live channel in a
 * sidebar opens a card beside the sidebar with the stream's live thumbnail,
 * title, game and viewer count. Shared by twitch.tv and kick.com; each site
 * says which links to watch and what it knows about each channel.
 *
 * While the card is open, <html> has the class "nftw-previewing", so each
 * site's CSS can hide that site's own, smaller hover card.
 */
(function (root) {
  const OPEN_CLASS = 'nftw-previewing';
  const SHOW_MS = 200; // rest this long on a channel before the card opens
  const HIDE_MS = 100; // grace period when moving from one channel to the next
  const CHECK_MS = 400; // closes the card if the sidebar redraws under the pointer

  /** 950 -> "950", 1234 -> "1.2K", 146000 -> "146K", 2500000 -> "2.5M" */
  function formatViewers(n) {
    const short = (x) => String(x >= 100 ? Math.round(x) : Math.round(x * 10) / 10);
    if (n >= 1e6) return short(n / 1e6) + 'M';
    if (n >= 1e3) return short(n / 1e3) + 'K';
    return String(n);
  }

  function el(tag, className, children = []) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.append(...children);
    return node;
  }

  /**
   * links: selector for the channel links to watch.
   * sidebar(link): the element the card lines up beside.
   * describe(link): null when there's nothing to preview, otherwise
   *   { kick, thumb, name, game, viewers, title, more }, where viewers is a
   *   number or text, and more() optionally fetches missing fields (it
   *   resolves to null when the channel turns out to be offline).
   */
  function create({ links, sidebar, describe }) {
    let card = null; // the preview element
    let current = null; // the link it is showing
    let pending = null; // the link waiting out SHOW_MS
    let showTimer = 0;
    let hideTimer = 0;
    let checkTimer = 0;
    let generation = 0; // answers that arrive after the pointer moved on are dropped

    function build() {
      const img = document.createElement('img');
      img.alt = '';
      img.referrerPolicy = 'no-referrer'; // the image server doesn't learn which page you're on
      const node = el('div', 'nftw-preview', [
        el('div', 'nftw-preview-thumb', [img, el('span', 'nftw-preview-live', ['Live']), el('span', 'nftw-preview-viewers')]),
        el('div', 'nftw-preview-info', [el('div', 'nftw-preview-title'), el('div', 'nftw-preview-sub')]),
      ]);
      node.setAttribute('aria-hidden', 'true');
      img.addEventListener('load', () => node.classList.add('nftw-preview--loaded'));
      img.addEventListener('error', () => node.classList.add('nftw-preview--noimage'));
      document.body.append(node);
      return node;
    }

    function fill(info) {
      card.classList.toggle('nftw-preview--kick', !!info.kick);
      card.querySelector('.nftw-preview-title').textContent = info.title || '';
      card.querySelector('.nftw-preview-sub').textContent = [info.name, info.game].filter(Boolean).join(' · ');
      const viewers = typeof info.viewers === 'number' ? formatViewers(info.viewers) : info.viewers;
      // "Live" instead of a number: the streamer hides their viewer count on Kick.
      card.querySelector('.nftw-preview-viewers').textContent = viewers && viewers !== 'Live' ? `${viewers} viewers` : '';
    }

    function setThumb(url, waiting) {
      const img = card.querySelector('img');
      card.classList.remove('nftw-preview--loaded', 'nftw-preview--noimage');
      if (!url) {
        img.removeAttribute('src');
        if (!waiting) card.classList.add('nftw-preview--noimage');
        return;
      }
      // Both sites refresh the image on their own (Kick within seconds,
      // Twitch every 5 minutes), and Kick rejects links with anything added.
      img.src = url;
      if (img.complete && img.naturalWidth) card.classList.add('nftw-preview--loaded'); // cached
    }

    // Beside the sidebar, level with the channel, kept inside the window.
    function place(link) {
      const row = link.getBoundingClientRect();
      const height = card.offsetHeight;
      const top = Math.max(8, Math.min(row.top + row.height / 2 - height / 2, innerHeight - height - 8));
      card.style.left = `${Math.round((sidebar(link) || link).getBoundingClientRect().right + 8)}px`;
      card.style.top = `${Math.round(top)}px`;
    }

    async function show(link) {
      const info = describe(link);
      if (!info) return hide();
      const mine = ++generation;
      current = link;
      card ??= build();
      fill(info);
      setThumb(info.thumb, !!info.more);
      place(link);
      card.classList.add('nftw-preview--on');
      document.documentElement.classList.add(OPEN_CLASS);
      clearInterval(checkTimer);
      checkTimer = setInterval(check, CHECK_MS);
      if (!info.more) return;

      let extra;
      try {
        extra = await info.more();
      } catch {
        extra = {}; // keep what the sidebar showed
      }
      if (mine !== generation) return;
      if (extra === null) return hide(); // offline after all
      const next = { ...info, ...extra };
      fill(next);
      if (next.thumb !== info.thumb || !next.thumb) setThumb(next.thumb, false);
      place(link); // a title can change the card's height
    }

    function hide() {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearInterval(checkTimer);
      generation++;
      current = pending = null;
      card?.classList.remove('nftw-preview--on');
      document.documentElement.classList.remove(OPEN_CLASS);
    }

    function check() {
      if (!current?.isConnected || !current.matches(':hover')) hide();
    }

    function onOver(event) {
      const link = event.target instanceof Element ? event.target.closest(links) : null;
      if (!link || !sidebar(link)) return;
      clearTimeout(hideTimer);
      if (link === current || link === pending) return;
      clearTimeout(showTimer);
      pending = link;
      // Already open: follow the pointer to the next channel right away.
      showTimer = setTimeout(
        () => {
          pending = null;
          show(link);
        },
        current ? 0 : SHOW_MS
      );
    }

    function onOut(event) {
      const link = event.target instanceof Element ? event.target.closest(links) : null;
      if (!link || (event.relatedTarget instanceof Node && link.contains(event.relatedTarget))) return;
      if (link === pending) {
        clearTimeout(showTimer);
        pending = null;
      }
      if (link === current) hideTimer = setTimeout(hide, HIDE_MS);
    }

    // Scrolling the sidebar moves the channel away from the card. Other
    // scrolling (chat keeps scrolling by itself) leaves it alone.
    function onScroll(event) {
      const box = event.target === document ? document.documentElement : event.target;
      if (current && box instanceof Node && box.contains(current)) hide();
    }

    return {
      start() {
        document.addEventListener('mouseover', onOver, true);
        document.addEventListener('mouseout', onOut, true);
        document.addEventListener('scroll', onScroll, { capture: true, passive: true });
        document.addEventListener('pointerdown', hide, true);
        document.addEventListener('visibilitychange', hide);
        window.addEventListener('blur', hide);
      },
      stop() {
        hide();
        document.removeEventListener('mouseover', onOver, true);
        document.removeEventListener('mouseout', onOut, true);
        document.removeEventListener('scroll', onScroll, { capture: true });
        document.removeEventListener('pointerdown', hide, true);
        document.removeEventListener('visibilitychange', hide);
        window.removeEventListener('blur', hide);
        card?.remove();
        card = null;
      },
    };
  }

  root.NFTwitchPreview = { create };
})(globalThis);
