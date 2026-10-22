/*
 * Picture-in-picture button: pops the stream out into the browser's small
 * floating window, which stays on top of your other tabs and apps. Press it
 * again, or close that window, to bring the stream back.
 */
(function () {
  const NF = window.NFTwitch;
  const BUTTON_ID = 'nftw-pip';
  const CHECK_MS = 1000;

  let timer = 0;

  async function toggle() {
    const found = NF.player();
    if (!found?.video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        found.video.disablePictureInPicture = false;
        await found.video.requestPictureInPicture();
      }
    } catch {
      NF.playerToast(found.player, "Picture-in-picture isn't available right now");
    }
    updateButton();
  }

  // Keeps the button in the player controls (Twitch re-renders them).
  function ensureButton() {
    const existing = document.getElementById(BUTTON_ID);
    const group = NF.$(NF.SEL.playerRightControls);
    if (!group || !document.pictureInPictureEnabled) return existing?.remove();
    if (!existing || !group.contains(existing)) {
      existing?.remove();
      group.prepend(NF.el('button', { id: BUTTON_ID, class: 'nftw-player-btn', type: 'button', onclick: toggle }, pipIcon()));
    }
    updateButton();
  }

  function updateButton() {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    const on = !!document.pictureInPictureElement;
    const label = on ? 'Back from picture-in-picture' : 'Picture-in-picture';
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  // A screen with a small window in its corner.
  function pipIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of ['M20 11V6.5A1.5 1.5 0 0 0 18.5 5h-14A1.5 1.5 0 0 0 3 6.5v11A1.5 1.5 0 0 0 4.5 19H10', 'M13.5 13.5h7v5.5h-7z']) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    return svg;
  }

  NF.register('pipButton', {
    start() {
      timer = setInterval(ensureButton, CHECK_MS);
      document.addEventListener('enterpictureinpicture', updateButton, true);
      document.addEventListener('leavepictureinpicture', updateButton, true);
      ensureButton();
    },
    stop() {
      clearInterval(timer);
      document.removeEventListener('enterpictureinpicture', updateButton, true);
      document.removeEventListener('leavepictureinpicture', updateButton, true);
      document.getElementById(BUTTON_ID)?.remove();
    },
  });
})();
