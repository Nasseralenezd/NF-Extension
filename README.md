<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="NF for Twitch icon">
</p>

<h1 align="center">NF for Twitch</h1>

<p align="center">
  Pin your favorite streamers to the top of Twitch's sidebar, and tidy up the rest of the site.
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/github/manifest-json/v/Nasseralenezd/nf-twitch?color=9146FF&label=version">
  <img alt="Manifest V3" src="https://img.shields.io/badge/manifest-v3-9146FF">
  <img alt="Chrome, Edge, Brave" src="https://img.shields.io/badge/browsers-Chrome%20%7C%20Edge%20%7C%20Brave-555">
  <img alt="No build step" src="https://img.shields.io/badge/build-none-555">
</p>

---

NF for Twitch is a lightweight browser extension for [twitch.tv](https://www.twitch.tv). It keeps the streamers you care about in their own **★ Favorites** section of the sidebar, and adds a set of optional quality-of-life tweaks for the sidebar, the player and chat.

Everything is controlled from the toolbar popup, and changes apply to open Twitch tabs instantly, without a reload.

<table align="center">
  <tr>
    <td align="center"><img src="docs/screenshots/sidebar-favorites.png" width="240" alt="The ★ Favorites section at the top of Twitch's sidebar, listing live favorites with game and viewer count"></td>
    <td align="center"><img src="docs/screenshots/popup-favorites.png" width="270" alt="The popup's Favorites tab: add box, import and export, and the list of favorites with live status"></td>
    <td align="center"><img src="docs/screenshots/popup-features.png" width="270" alt="The popup's Features tab, with switches grouped under Sidebar"></td>
  </tr>
  <tr>
    <td align="center"><sub>★ Favorites in the sidebar</sub></td>
    <td align="center"><sub>Manage favorites in the popup</sub></td>
    <td align="center"><sub>Turn features on and off</sub></td>
  </tr>
</table>

## Features

### Sidebar

| Feature | What it does | Default |
|---|---|---|
| **Pinned favorites** | A ★ Favorites section listing your favorites who are live right now, either at the top of the sidebar or just above Followed Channels. Sorted by viewers or by your own order, and optionally hidden from the Followed list so they don't show twice. | On (Top, by viewers) |
| **Auto-expand Followed** | Clicks "Show More" until every followed channel is listed. It can also open the sidebar when it starts collapsed. | On |
| **Hide For You** | Removes the For You block (stories, streaks) above your Followed list. | Off |
| **Hide sidebar clutter** | Separate switches for sponsored cards in Followed, Live Channels, Viewers Also Watch and Recommended Categories. | Off |

### Channel & player

| Feature | What it does | Default |
|---|---|---|
| **Star button** | A ★ next to Follow on channel pages pins or unpins that streamer. | On |
| **Scroll volume** | The mouse wheel over the player changes the volume, from 1% to 20% per step. It moves Twitch's own slider, so Twitch remembers the volume. | On (1%) |
| **Auto quality** | Every channel starts at Source, 1080p, 720p or 480p, or the closest quality below. | Off |
| **Auto theater mode** | Switches to theater mode when you open a channel. | Off |
| **Shortcuts & screenshot** | Keyboard shortcuts (below) plus full-resolution PNG screenshots of the stream, with a camera button in the player controls. | Off |

<p align="center">
  <img src="docs/screenshots/star-button.png" width="317" alt="The ★ button, gold when pinned, next to Twitch's Follow and Subscribe buttons"><br>
  <sub>The ★ button next to Follow: gold means the streamer is pinned.</sub>
</p>

### Chat

| Feature | What it does | Default |
|---|---|---|
| **Auto-claim bonus points** | Clicks the channel points bonus chest for you while you watch. | Off |
| **Cleaner chat** | Separate switches to hide badges, Bits (cheer emotes, leaderboard, button) and the banners on top of chat (hype train, predictions), plus compact line spacing. | Off |

Features with sub-options have them all switched on, so a feature does something as soon as you enable it. Untick the parts you don't want.

### Favorites management

- **Add** a streamer with the ★ on their channel page, or type a name or paste a `twitch.tv` link in the popup.
- **Reorder** by dragging, or with <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> on a row's handle. Remove with one click, with Undo.
- **Import / export** your list as a JSON file (see [Import format](#import-format)).
- Favorites and settings sync across browsers signed in to the same account (up to about 600 favorites).

## Keyboard shortcuts

These need **Shortcuts & screenshot** switched on. They work on any page with a player, and are ignored while you type in chat or search, or while you hold <kbd>Ctrl</kbd>, <kbd>Alt</kbd> or <kbd>Cmd</kbd>.

| Key | Action |
|---|---|
| <kbd>T</kbd> | Theater mode on/off |
| <kbd>F</kbd> | Fullscreen on/off |
| <kbd>C</kbd> | Create a clip |
| <kbd>S</kbd> | Save a screenshot (`channel_YYYY-MM-DD_HH-MM-SS.png`) |
| Mouse wheel over the player | Volume up/down (with **Scroll volume** on) |

## Installation

The extension isn't on the Chrome Web Store yet. Installing it yourself takes about a minute.

1. Download **`nf-for-twitch-<version>.zip`** from the [latest release](https://github.com/Nasseralenezd/nf-twitch/releases/latest) and extract it.<br>
   Or get the source: **Code → Download ZIP**, or clone it:
   ```bash
   git clone https://github.com/Nasseralenezd/nf-twitch.git
   ```
2. Open your browser's extensions page: `chrome://extensions`, `edge://extensions` or `brave://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the folder that contains `manifest.json`.
5. Optional: pin NF for Twitch to the toolbar (puzzle-piece icon → pin).

Requires a Chromium-based browser, version 102 or newer.

### Updating

Download the latest release zip and replace your old folder with it (or run `git pull`), click the reload icon on the extension's card in the extensions page, then refresh any open Twitch tabs.

## Import format

**Export** writes a plain list of channel names:

```json
["lirik", "shroud", "summit1g"]
```

**Import** reads that format and also accepts:

- `twitch.tv` links or `@name` entries, e.g. `["https://www.twitch.tv/lirik"]`
- objects with a `login`, `username`, `user_login`, `broadcaster_login`, `channel`, `name` or `displayName` field
- any of the above wrapped in an object under `favorites`, `channels`, `streamers`, `users` or `list`

When you already have favorites, you choose whether to add the new ones or replace your list. Channels that no longer exist on Twitch are skipped (as long as Twitch can be reached to check).

## Privacy

NF for Twitch has no account, no analytics and no tracking.

- The only request the extension makes on its own sends the **names of your favorite channels** (and names you add) to Twitch's GraphQL endpoint, `gql.twitch.tv`, to get their live status, viewer count, game and avatar. No cookies or sign-in are sent.
- Your favorites and settings are stored in your browser's `chrome.storage.sync`. Looked-up channel data is cached for a few minutes in session storage.
- Avatars load from Twitch's image servers. Screenshots and exports are saved only to your computer.

The full policy is in [PRIVACY.md](PRIVACY.md).

### Permissions

| Permission | Why it's needed |
|---|---|
| `storage` | Save your favorites and settings |
| `https://gql.twitch.tv/*` | Look up which favorites are live |
| Content scripts on `https://www.twitch.tv/*` | Add the features to Twitch pages |

## How it works

Plain JavaScript and CSS (Manifest V3), with no build step and no dependencies.

```
manifest.json
icons/                      Extension icons (16, 48, 128 px)
src/
  background.js             Service worker: live-status lookups with a short cache
  shared/
    features.js             Feature registry: names, groups, defaults, options
    storage.js              Settings and favorites storage, import parser
  content/
    dom.js                  Twitch selectors and shared page helpers
    main.js                 Starts and stops features from your settings
    content.css             Styles injected into Twitch
    features/               One file per feature
  popup/                    Toolbar popup (Favorites, Features, Coming soon)
```

### Adding a feature

1. Add an entry to `FEATURES` in [`src/shared/features.js`](src/shared/features.js). The popup builds the switch and its options from it, under the feature's group. `status: 'soon'` lists it under "Coming soon" instead.
2. Create `src/content/features/<name>.js` that calls `NFTwitch.register('<id>', { start(settings), stop(), update?(settings), onFavorites?(list) })`.
3. Add the file to `content_scripts[0].js` in [`manifest.json`](manifest.json), before `src/content/main.js`.

## Troubleshooting

- **A feature stopped working after a Twitch update.** Twitch changes its page now and then. Every selector the extension depends on is in the `SEL` table at the top of [`src/content/dom.js`](src/content/dom.js), plus a few marked rules in [`content.css`](src/content/content.css). Please [open an issue](https://github.com/Nasseralenezd/nf-twitch/issues) with what broke.
- **Nothing happens after updating the extension.** Refresh the Twitch tab; tabs opened before the update still run the old version.
- **Favorites show no live status.** Live status comes from Twitch's undocumented GraphQL endpoint (the same one BetterTTV and FrankerFaceZ use). If Twitch changes it, the Favorites section stops updating until the extension is fixed.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## Disclaimer

NF for Twitch is an independent project. It is not affiliated with, endorsed by, or sponsored by Twitch Interactive, Inc. Twitch is a trademark of Twitch Interactive, Inc.

## License

© 2026 Nasseralenezd. All rights reserved.

The source is published for reference and personal use; no license is granted to redistribute or republish it.
