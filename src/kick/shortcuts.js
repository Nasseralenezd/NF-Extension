/*
 * Shortcuts & screenshot on kick.com, wherever Kick's player is:
 *   S screenshot   P picture-in-picture
 * Kick's player already has T theater, F fullscreen, M mute and C clip, so
 * those stay Kick's. Keys are ignored while you type (chat, search) or hold
 * Ctrl / Alt / Cmd. Optionally adds a camera button to the player.
 */
(async function () {
  const store = globalThis.NFTwitchStorage;
  const kick = globalThis.NFTwitchKickPlayer;
  const BUTTON_ID = 'nftw-kick-screenshot';
  const CHECK_MS = 1000;
  const CAMERA = ['M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.4-2h6.2l1.4 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z', 'M12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'];

  let settings = await store.getSettings();
  let timer = 0;

  function onKeyDown(event) {
    if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    if (kick.isTyping(event.target) || !kick.video()) return;
    switch (event.key.toLowerCase()) {
      case 's':
        screenshot();
        break;
      case 'p':
        pictureInPicture();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  // Kick's own picture-in-picture button, so its player keeps up; the video
  // itself if the button isn't there.
  function pictureInPicture() {
    const own = kick.button('video-player-pip');
    if (own) return own.click();
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    else kick.video()?.requestPictureInPicture().catch(() => {});
  }

  function screenshot() {
    const video = kick.video();
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    const flash = document.createElement('div');
    flash.className = 'nftw-kick-flash';
    kick.box(video)?.append(flash);
    setTimeout(() => flash.remove(), 400);

    try {
      canvas.toBlob((blob) => {
        if (!blob) return kick.toast('Screenshot failed');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${kick.channel() || 'kick'}_${stamp()}.png`;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        kick.toast('Screenshot saved');
      }, 'image/png');
    } catch {
      kick.toast("This video can't be captured");
    }
  }

  // e.g. 2025-01-31_18-45-07
  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  }

  // Keeps the camera button in the player controls (Kick redraws them as the player loads).
  function ensureButton() {
    if (!kick.alive()) return setEnabled(false); // extension was reloaded
    const group = settings.kickScreenshotButton && kick.controls();
    const existing = document.getElementById(BUTTON_ID);
    if (!group) return existing?.remove();
    if (existing && group.contains(existing)) return;
    existing?.remove();
    group.prepend(kick.playerButton(BUTTON_ID, 'Screenshot (s)', CAMERA, screenshot));
  }

  function setEnabled(on) {
    clearInterval(timer);
    timer = 0;
    document.removeEventListener('keydown', onKeyDown);
    if (!on) {
      document.getElementById(BUTTON_ID)?.remove();
      return;
    }
    document.addEventListener('keydown', onKeyDown);
    timer = setInterval(ensureButton, CHECK_MS);
    ensureButton();
  }

  setEnabled(!!settings.kickShortcuts);
  store.onChange(async (change) => {
    if (!change.settings) return;
    const was = !!settings.kickShortcuts;
    settings = await store.getSettings();
    if (!!settings.kickShortcuts !== was) setEnabled(!!settings.kickShortcuts);
    else if (timer) ensureButton();
  });
})();
