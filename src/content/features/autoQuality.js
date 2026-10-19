/*
 * Auto quality: once per channel you open, picks your preferred quality in
 * the player's settings menu (or the closest one below it). The menu is made
 * invisible while this happens, so you don't see it flash. Changing quality
 * by hand afterwards sticks until you open another channel.
 */
(function () {
  const NF = window.NFTwitch;
  const BUSY_CLASS = 'nftw-quality-busy';
  const CHECK_MS = 1500;
  const MAX_TRIES = 5;

  let settings = null;
  let timer = 0;
  let busy = false;
  let doneFor = null; // "channel|quality" already applied
  let tries = { key: null, count: 0 };

  async function check() {
    if (busy) return;
    const channel = NF.currentChannel();
    const found = NF.player();
    if (!channel || !found?.video || found.video.readyState < 2 || !found.video.videoHeight) return;

    const key = `${channel}|${settings.quality}`;
    if (doneFor === key) return;
    if (tries.key !== key) tries = { key, count: 0 };
    if (tries.count >= MAX_TRIES) return;
    tries.count++;

    busy = true;
    try {
      if (await apply(found.player)) doneFor = key;
    } finally {
      busy = false;
    }
  }

  async function apply(player) {
    const button = NF.$(NF.SEL.settingsButton, player);
    if (!button) return false;
    document.documentElement.classList.add(BUSY_CLASS);
    try {
      button.click();
      const item = await NF.waitFor(NF.SEL.qualityMenuItem, 1500);
      if (!item) return false;
      item.click();
      if (!(await NF.waitFor(NF.SEL.qualityOption, 1500))) return false;
      const option = pick(NF.$$(NF.SEL.qualityOption), settings.quality);
      if (!option) return false;
      if (!option.querySelector('input')?.checked) (option.querySelector('label') || option).click();
      return true;
    } finally {
      await NF.sleep(120);
      if (NF.$(NF.SEL.settingsMenu)) button.click(); // close the menu again
      document.documentElement.classList.remove(BUSY_CLASS);
    }
  }

  // Options read like "Auto", "1440p60 (Source)", "1080p60", "720p60"...
  function pick(options, preference) {
    const list = options
      .map((el, index) => ({ el, index, height: Number((el.textContent.match(/(\d{3,4})p/) || [])[1]) }))
      .filter((o) => o.height) // drops "Auto"
      .sort((a, b) => b.height - a.height || a.index - b.index);
    if (!list.length) return null;
    if (preference === 'source') return list[0].el;
    const max = Number(preference);
    return (list.find((o) => o.height <= max) || list[list.length - 1]).el;
  }

  NF.register('autoQuality', {
    start(next) {
      settings = next;
      doneFor = null;
      timer = setInterval(check, CHECK_MS);
      check();
    },
    update(next) {
      settings = next; // a new quality choice applies on the current channel too
    },
    stop() {
      clearInterval(timer);
    },
  });
})();
