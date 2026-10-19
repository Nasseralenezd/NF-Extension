/*
 * Popup: manage favorites, turn features on and off, see what's coming.
 * Feature toggles are generated from the registry in src/shared/features.js.
 */
(async function () {
  const { FEATURES, GROUPS } = NFTwitchFeatures;
  const store = NFTwitchStorage;
  const $ = (selector) => document.querySelector(selector);
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let favorites = [];
  const users = {}; // login -> lookup result (null when the channel doesn't exist)
  let messageTimer = 0;
  let dragging = false; // while a row is being dragged, re-renders wait
  let renderPending = false;

  /* ---------- helpers ---------- */

  function el(tag, props = {}, children = []) {
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
  }

  function icon(width, height, viewBox, draw) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('aria-hidden', 'true');
    for (const [tag, attrs] of draw) {
      const shape = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) shape.setAttribute(k, v);
      svg.append(shape);
    }
    return svg;
  }

  const gripIcon = () =>
    icon(10, 16, '0 0 10 16', [[2, 2], [8, 2], [2, 8], [8, 8], [2, 14], [8, 14]].map(([cx, cy]) => ['circle', { cx, cy, r: 1.5 }]));
  const closeIcon = () => icon(12, 12, '0 0 12 12', [['path', { d: 'M2 2l8 8M10 2l-8 8' }]]);

  function formatViewers(n) {
    const short = (x) => String(x >= 100 ? Math.round(x) : Math.round(x * 10) / 10);
    if (n >= 1e6) return short(n / 1e6) + 'M';
    if (n >= 1e3) return short(n / 1e3) + 'K';
    return String(n);
  }

  const displayName = (login) => users[login]?.displayName || login;

  async function lookup(logins, force = false) {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'lookup', logins, force });
      return res?.ok ? res.users : null;
    } catch {
      return null;
    }
  }

  function say(text, tone = '', action = null) {
    const box = $('#message');
    box.className = 'message' + (tone ? ` is-${tone}` : '');
    box.replaceChildren(text);
    if (action) box.append(el('button', { type: 'button', text: action.label, onclick: action.run }));
    clearTimeout(messageTimer);
    // Longer messages (like import results) stay up longer.
    if (tone !== 'error') messageTimer = setTimeout(() => box.replaceChildren(), Math.max(action ? 6000 : 3500, text.length * 70));
  }

  /* ---------- tabs ---------- */

  function setupTabs() {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const select = (tab) => {
      for (const t of tabs) {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      }
      try {
        localStorage.setItem('nftw-tab', tab.id);
      } catch {}
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        select(next);
        next.focus();
      });
    });
    let saved = null;
    try {
      saved = localStorage.getItem('nftw-tab');
    } catch {}
    const initial = tabs.find((t) => t.id === saved);
    if (initial) select(initial);
  }

  /* ---------- favorites ---------- */

  function renderFavorites() {
    if (dragging) {
      renderPending = true;
      return;
    }
    const list = $('#fav-list');
    list.replaceChildren(...favorites.map(row));
    $('#fav-empty').hidden = favorites.length > 0;
    $('#fav-hint').hidden = favorites.length < 2;
    $('#fav-count').textContent = favorites.length || '';
    $('#export-button').disabled = favorites.length === 0;

    const summary = $('#summary');
    if (!favorites.length) {
      summary.textContent = 'Pin your favorite streamers';
    } else {
      const liveCount = favorites.filter((f) => users[f.login]?.live).length;
      summary.replaceChildren(el('span', { class: 'live-num', text: String(liveCount) }), ` of ${favorites.length} live now`);
    }
  }

  function row(fav) {
    const user = users[fav.login];
    const name = user?.displayName || fav.name || fav.login;
    const status = user?.live
      ? [el('span', { class: 'live-dot' }), `${formatViewers(user.viewers)}${user.game ? ` · ${user.game}` : ''}`]
      : user === null
        ? 'Channel not found'
        : user
          ? 'Offline'
          : '…';

    const avatar = el('span', { class: 'avatar' }, user?.avatar ? el('img', { src: user.avatar, alt: '' }) : name[0]);

    return el('li', { class: 'fav' + (user?.live ? ' is-live' : ''), draggable: 'true', 'data-login': fav.login }, [
      el('button', { class: 'grip', type: 'button', title: 'Drag, or Alt + ↑ / ↓', 'aria-label': `Move ${name}`, onkeydown: (e) => moveWithKeys(e, fav.login) }, gripIcon()),
      avatar,
      el('div', { class: 'info' }, [
        el('button', { class: 'name', type: 'button', text: name, title: `Open ${name} on Twitch`, onclick: () => openChannel(fav.login) }),
        el('div', { class: 'status', title: user?.title || '' }, status),
      ]),
      el('button', { class: 'remove', type: 'button', title: 'Remove', 'aria-label': `Remove ${name}`, onclick: () => remove(fav) }, closeIcon()),
    ]);
  }

  function openChannel(login) {
    chrome.tabs.create({ url: `https://www.twitch.tv/${login}` });
  }

  async function remove(fav) {
    const index = favorites.findIndex((f) => f.login === fav.login);
    await store.removeFavorite(fav.login);
    say(`Removed ${displayName(fav.login)}.`, '', {
      label: 'Undo',
      run: async () => {
        const list = await store.getFavorites();
        if (!list.some((f) => f.login === fav.login)) {
          list.splice(Math.min(index, list.length), 0, fav);
          await store.setFavorites(list);
        }
        say(`${displayName(fav.login)} is back.`, 'ok');
      },
    });
  }

  async function saveOrder(logins) {
    const byLogin = new Map(favorites.map((f) => [f.login, f]));
    const seen = new Set();
    const next = logins.filter((l) => !seen.has(l) && seen.add(l)).map((l) => byLogin.get(l)).filter(Boolean);
    // Anything added while dragging (not in the dragged rows) keeps its place at the end.
    for (const f of favorites) if (!seen.has(f.login)) next.push(f);
    if (next.map((f) => f.login).join() === favorites.map((f) => f.login).join()) return;
    favorites = next;
    await store.setFavorites(next);
  }

  function moveWithKeys(event, login) {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    const logins = favorites.map((f) => f.login);
    const from = logins.indexOf(login);
    const to = from + (event.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= logins.length) return;
    logins.splice(to, 0, logins.splice(from, 1)[0]);
    saveOrder(logins).then(() => document.querySelector(`.fav[data-login="${login}"] .grip`)?.focus());
  }

  function setupDrag() {
    const list = $('#fav-list');
    let dragged = null;
    list.addEventListener('dragstart', (e) => {
      dragged = e.target.closest('.fav');
      if (!dragged) return;
      dragging = true;
      dragged.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragged.dataset.login);
    });
    list.addEventListener('dragover', (e) => {
      if (!dragged || !list.contains(dragged)) return;
      e.preventDefault();
      const over = e.target.closest('.fav');
      if (!over || over === dragged) return;
      const rect = over.getBoundingClientRect();
      over[e.clientY > rect.top + rect.height / 2 ? 'after' : 'before'](dragged);
    });
    list.addEventListener('dragend', () => {
      if (!dragged) return;
      dragged.classList.remove('dragging');
      dragged = null;
      dragging = false;
      saveOrder([...list.children].map((li) => li.dataset.login)).finally(() => {
        if (!renderPending) return;
        renderPending = false;
        renderFavorites();
      });
    });
  }

  function setupAddForm() {
    const form = $('#add-form');
    const input = $('#add-input');
    const button = $('#add-button');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const login = store.normalizeLogin(input.value);
      if (!login) return say('Type a Twitch name like "shroud", or paste a twitch.tv link.', 'error');
      if (favorites.some((f) => f.login === login)) return say(`${displayName(login)} is already in your favorites.`);

      button.disabled = true;
      say('Checking Twitch…');
      const found = await lookup([login], true);
      button.disabled = false;

      if (found && !found[login]) return say(`There's no Twitch channel called "${login}".`, 'error');
      const user = found?.[login];
      if (user) users[login] = user;
      try {
        await store.addFavorite({ login });
      } catch (err) {
        return say(`Couldn't save: ${err.message}`, 'error');
      }
      input.value = '';
      input.focus();
      say(user ? `Added ${user.displayName}.` : `Added ${login}. Twitch didn't answer, so the name wasn't checked.`, 'ok');
    });
  }

  /* ---------- import / export ---------- */

  function setupBackup() {
    const fileInput = $('#import-file');
    $('#export-button').addEventListener('click', exportFavorites);
    $('#import-button').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      fileInput.value = ''; // so picking the same file again still fires
      if (file) importFile(file);
    });
    $('#import-cancel').addEventListener('click', () => {
      $('#import-panel').hidden = true;
      say('Import cancelled.');
    });
  }

  // Writes the same format the importer reads first: a plain list of names.
  function exportFavorites() {
    const json = JSON.stringify(favorites.map((f) => f.login), null, 2);
    const url = URL.createObjectURL(new Blob([json + '\n'], { type: 'application/json' }));
    const link = el('a', { href: url, download: `nf-twitch-favorites-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say(`Exported ${favorites.length} streamers.`, 'ok');
  }

  async function importFile(file) {
    $('#import-panel').hidden = true;
    let parsed;
    try {
      parsed = store.parseImport(await file.text());
    } catch (err) {
      return say(`Couldn't read ${file.name}: ${err instanceof SyntaxError ? "it isn't valid JSON" : err.message}.`, 'error');
    }
    if (!parsed.logins.length) return say(`No Twitch names found in ${file.name}.`, 'error');

    // Drop names Twitch doesn't know (deleted or renamed channels). If Twitch
    // can't be reached, import everything unchecked.
    say(`Checking ${parsed.logins.length} names on Twitch…`);
    const found = await lookup(parsed.logins);
    let logins = parsed.logins;
    let missing = [];
    if (found) {
      Object.assign(users, found);
      missing = logins.filter((l) => found[l] === null);
      logins = logins.filter((l) => found[l] !== null);
    }
    if (!logins.length) return say(`None of the names in ${file.name} are Twitch channels.`, 'error');

    const result = { file: file.name, logins, missing, invalid: parsed.invalid, checked: !!found };
    if (!favorites.length) return runImport(result, false);

    const current = new Set(favorites.map((f) => f.login));
    const fresh = logins.filter((l) => !current.has(l)).length;
    const summary = $('#import-summary');
    summary.replaceChildren(
      'Found ',
      el('strong', { text: `${logins.length} streamers` }),
      ` in ${file.name}. ` + (fresh < logins.length ? `${logins.length - fresh} are already in your list.` : 'None are in your list yet.')
    );
    const add = $('#import-add');
    add.textContent = fresh ? `Add ${fresh} new` : 'Nothing new to add';
    add.disabled = fresh === 0;
    add.onclick = () => runImport(result, false);
    $('#import-replace').onclick = () => runImport(result, true);
    $('#message').replaceChildren();
    $('#import-panel').hidden = false;
  }

  async function runImport({ logins, missing, invalid, checked }, replace) {
    $('#import-panel').hidden = true;
    let added;
    try {
      added = await store.importFavorites(logins, { replace });
    } catch (err) {
      return say(`Couldn't save: ${err.message}`, 'error');
    }
    const notes = [];
    if (missing.length) notes.push(`skipped ${missing.length} not on Twitch (${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''})`);
    if (invalid) notes.push(`${invalid} unreadable`);
    if (!checked) notes.push("Twitch didn't answer, so names weren't checked");
    const head = replace ? `Replaced your list with ${added} streamers` : `Imported ${added} streamers`;
    say(head + (notes.length ? `; ${notes.join('; ')}.` : '.'), 'ok');
  }

  async function refreshUsers() {
    if (!favorites.length) return;
    const found = await lookup(favorites.map((f) => f.login));
    if (!found) return;
    Object.assign(users, found);
    renderFavorites();
  }

  /* ---------- features ---------- */

  function renderFeatures(settings) {
    const live = FEATURES.filter((f) => f.status === 'live');
    const blocks = [];
    for (const [group, title] of GROUPS) {
      const inGroup = live.filter((f) => f.group === group);
      if (!inGroup.length) continue;
      blocks.push(el('h2', { class: 'group-title', text: title }), ...inGroup.map((f) => featureCard(f, settings)));
    }
    $('#feature-list').replaceChildren(...blocks);
  }

  function featureCard(feature, settings) {
    const card = el('div', { class: 'feature' + (settings[feature.id] ? '' : ' is-off') });
    const toggle = el('input', {
      class: 'switch',
      type: 'checkbox',
      role: 'switch',
      checked: !!settings[feature.id],
      onchange: (e) => {
        card.classList.toggle('is-off', !e.target.checked);
        store.setSetting(feature.id, e.target.checked);
      },
    });
    card.append(
      el('label', { class: 'feature-head' }, [
        el('span', { class: 'feature-text' }, [
          el('span', { class: 'feature-name', text: feature.name }),
          el('span', { class: 'feature-desc', text: feature.description }),
        ]),
        toggle,
      ])
    );
    if (feature.options?.length) {
      card.append(el('div', { class: 'options' }, feature.options.map((o) => optionControl(o, settings[o.id]))));
    }
    return card;
  }

  function optionControl(option, value) {
    if (option.type === 'toggle') {
      return el('label', { class: 'option' }, [
        option.label,
        el('input', { class: 'switch small', type: 'checkbox', role: 'switch', checked: !!value, onchange: (e) => store.setSetting(option.id, e.target.checked) }),
      ]);
    }

    if (option.type === 'select') {
      const group = el('div', { class: 'segmented', role: 'group', 'aria-label': option.label });
      for (const [choice, label] of option.choices) {
        group.append(
          el('button', {
            type: 'button',
            text: label,
            'aria-pressed': String(choice === value),
            onclick: (e) => {
              for (const b of group.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
              store.setSetting(option.id, choice);
            },
          })
        );
      }
      return el('div', { class: 'option' }, [option.label, group]);
    }

    if (option.type === 'range') {
      const output = el('output', { text: `${value}${option.unit || ''}` });
      const input = el('input', {
        type: 'range',
        min: option.min,
        max: option.max,
        value,
        'aria-label': option.label,
        oninput: (e) => (output.textContent = `${e.target.value}${option.unit || ''}`),
        onchange: (e) => store.setSetting(option.id, Number(e.target.value)),
      });
      return el('div', { class: 'option' }, [option.label, el('span', { class: 'range' }, [input, output])]);
    }

    return null;
  }

  function renderSoon() {
    const soon = FEATURES.filter((f) => f.status === 'soon');
    $('#soon-list').replaceChildren(
      ...soon.map((f) =>
        el('li', { class: 'soon' }, [
          el('span', { class: 'soon-text' }, [
            el('span', { class: 'soon-name', text: f.name }),
            el('span', { class: 'soon-desc', text: f.description }),
          ]),
          el('span', { class: 'pill', text: 'Planned' }),
        ])
      )
    );
  }

  /* ---------- start ---------- */

  $('#version').textContent = `v${chrome.runtime.getManifest().version}`;
  setupTabs();
  setupAddForm();
  setupBackup();
  setupDrag();
  renderSoon();
  renderFeatures(await store.getSettings());

  favorites = await store.getFavorites();
  renderFavorites();
  refreshUsers();

  store.onChange((change) => {
    if (!change.favorites) return;
    favorites = change.favorites;
    renderFavorites();
    if (favorites.some((f) => !(f.login in users))) refreshUsers();
  });
})();
