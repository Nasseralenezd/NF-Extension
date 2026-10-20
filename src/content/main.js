/*
 * Starts and stops the registered features from your settings. Changes made
 * in the popup apply to open Twitch tabs right away, without a reload.
 */
(async function () {
  const NF = window.NFTwitch;
  const running = new Set();
  let settings = await NF.storage.getSettings();

  function apply() {
    for (const [id, feature] of NF.modules) {
      const on = !!settings[id];
      try {
        if (on && !running.has(id)) {
          running.add(id);
          feature.start(settings);
        } else if (!on && running.has(id)) {
          running.delete(id);
          feature.stop();
        } else if (on) {
          feature.update?.(settings);
        }
      } catch (err) {
        console.error(`[NF for Twitch] ${id}:`, err);
      }
    }
  }

  NF.storage.onChange(async (change) => {
    if (change.settings) {
      settings = await NF.storage.getSettings();
      apply();
    }
    if (change.favorites) {
      for (const id of running) NF.modules.get(id).onFavorites?.(change.favorites);
    }
    if (change.kickFavorites) {
      for (const id of running) NF.modules.get(id).onKickFavorites?.(change.kickFavorites);
    }
  });

  apply();

  // When the extension is reloaded or updated, Chrome leaves this old copy
  // running in open tabs, cut off from the extension. Remove everything it
  // added so the page goes back to normal until the tab is refreshed.
  const aliveCheck = setInterval(() => {
    if (NF.alive()) return;
    clearInterval(aliveCheck);
    for (const id of running) {
      try {
        NF.modules.get(id).stop();
      } catch {}
    }
    running.clear();
  }, 3000);
})();
