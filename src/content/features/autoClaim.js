/*
 * Auto-claim bonus points: clicks the channel points bonus chest under the
 * chat as soon as it shows up (Twitch offers one every ~15 minutes).
 */
(function () {
  const NF = window.NFTwitch;
  const CHECK_MS = 2000;

  let timer = 0;

  function check() {
    const button = NF.$(NF.SEL.claimBonus)?.closest('button');
    if (!button || button.disabled) return;
    button.click();
    const found = NF.player();
    if (found) NF.playerToast(found.player, 'Bonus points claimed');
  }

  NF.register('autoClaim', {
    start() {
      timer = setInterval(check, CHECK_MS);
      check();
    },
    stop() {
      clearInterval(timer);
    },
  });
})();
