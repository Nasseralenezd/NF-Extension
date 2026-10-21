/*
 * X Dim mode: shows X's black dark theme in the softer dark-blue Dim colors.
 *
 * Two layers:
 *  - X's current site draws its theme from color variables; a class on
 *    <html> switches on twitter.css, which gives the dark theme's variables
 *    the Dim palette.
 *  - Older parts of X use small one-color style rules instead (for example
 *    ".r-kemksi { background-color: rgb(0, 0, 0) }"). For those, this finds
 *    the rules that use a black-theme color and switches the color inside the
 *    rule itself, so X's other rules still win over it where they did (text
 *    starts out black and a later rule makes it white, for example). Colors
 *    set right on an element (style="") get a matching override.
 * Both only act while X is in its dark theme, and turning Dim mode off
 * puts X's own colors back.
 */
(async function () {
  const store = globalThis.NFTwitchStorage;
  const STYLE_ID = 'nftw-x-dim';
  const SCAN_MS = 1500;

  // Lights out color -> Dim color
  const PALETTE = {
    'rgb(0, 0, 0)': 'rgb(21, 32, 43)', // page background
    'rgb(22, 24, 28)': 'rgb(30, 39, 50)', // cards, search box
    'rgb(32, 35, 39)': 'rgb(39, 51, 64)', // raised areas, hover
    'rgb(47, 51, 54)': 'rgb(56, 68, 77)', // borders and dividers
    'rgb(113, 118, 123)': 'rgb(139, 152, 165)', // secondary text
  };
  // Color properties that get checked (color variables, --name, are checked too)
  const PROPERTIES = ['background-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'color', 'fill'];
  // A few colors sit in style="" attributes instead (avatars, @handles), which
  // only !important beats. These match the exact color in the attribute, so
  // nothing else changes.
  const INLINE_CSS = Object.entries(PALETTE)
    .flatMap(([from, to]) => [
      `[style*="background-color: ${from}"] { background-color: ${to} !important; }`,
      `[style^="color: ${from}"], [style*="; color: ${from}"] { color: ${to} !important; }`,
      `[style*="border-color: ${from}"] { border-color: ${to} !important; }`,
      ...['top', 'right', 'bottom', 'left'].map((side) => `[style*="border-${side}-color: ${from}"] { border-${side}-color: ${to} !important; }`),
    ])
    .join('\n');

  let enabled = false;
  let timer = 0;
  let style = null;
  let seen = new WeakMap(); // stylesheet -> its number of rules when last checked
  const changed = []; // { declaration, property, value, priority } to put back

  // X marks its dark theme with <html data-theme="dark"> and announces it in
  // <meta name="theme-color" content="#000000">. Dim mode changes neither.
  function lightsOut() {
    if (document.documentElement.dataset.theme === 'dark') return true;
    const meta = document.querySelector('meta[name="theme-color"]')?.content?.trim().toLowerCase();
    if (meta) return meta === '#000000' || meta === '#000';
    return !style && !!document.body && getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)';
  }

  function scan() {
    if (!document.body) return;
    if (!lightsOut()) return clear(); // Default or Dim theme: nothing to do
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `body { background-color: ${PALETTE['rgb(0, 0, 0)']} !important; }\n${INLINE_CSS}`;
      document.head.append(style);
    }

    for (const sheet of document.styleSheets) {
      if (sheet.ownerNode === style) continue;
      let rules;
      try {
        rules = sheet.cssRules; // X's own style tags; other sites' sheets throw
      } catch {
        continue;
      }
      // X inserts rules anywhere in its sheets, so a changed sheet is read
      // again in full; rules already switched no longer match.
      if (seen.get(sheet) === rules.length) continue;
      seen.set(sheet, rules.length);
      for (const rule of rules) dimRule(rule);
    }
  }

  // "rgb(0, 0, 0)" -> "rgb(21, 32, 43)". X's sign-in screens fade colors with
  // a variable, so "rgba(0, 0, 0, var(--fade))" -> "rgba(21, 32, 43, var(--fade))".
  function dimmed(value) {
    const match = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,.*)?\)$/.exec(value);
    if (!match) return '';
    const dim = PALETTE[`rgb(${match[1]}, ${match[2]}, ${match[3]})`];
    if (!dim) return '';
    return match[4] ? `rgba(${dim.slice(4, -1)}${match[4]})` : dim;
  }

  function dimRule(rule) {
    if (rule.cssRules) for (const inner of rule.cssRules) dimRule(inner); // rules inside @media
    const declaration = rule.style;
    if (!declaration) return;
    for (const property of [...declaration]) {
      if (!property.startsWith('--') && !PROPERTIES.includes(property)) continue;
      const value = declaration.getPropertyValue(property).trim();
      const dim = dimmed(value);
      if (!dim) continue;
      const priority = declaration.getPropertyPriority(property);
      changed.push({ declaration, property, value, priority });
      declaration.setProperty(property, dim, priority);
    }
  }

  function clear() {
    style?.remove();
    style = null;
    for (const { declaration, property, value, priority } of changed.splice(0)) {
      declaration.setProperty(property, value, priority);
    }
    seen = new WeakMap(); // turning it back on starts fresh
  }

  function apply(settings) {
    const next = !!settings.xDim;
    if (next === enabled) return;
    enabled = next;
    clearInterval(timer);
    document.documentElement.classList.toggle('nftw-x-dim', enabled); // variables, see twitter.css
    if (enabled) {
      scan();
      timer = setInterval(scan, SCAN_MS); // X keeps adding style rules as you browse
    } else {
      clear();
    }
  }

  apply(await store.getSettings());
  store.onChange(async (change) => {
    if (change.settings) apply(await store.getSettings());
  });
})();
