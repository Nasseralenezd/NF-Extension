# Changelog

## 1.5.0 — 2026-10-21

- **Collapsible sections**: click the ★ Favorites or Kick header to fold the section away. While folded it shows how many channels are live, and it stays folded after a reload.
- **Scroll volume on kick.com**: the mouse wheel over Kick's player changes the volume too, with the same step as on Twitch. Kick's slider follows and Kick remembers the volume. Turn it off with "Also on kick.com" under Scroll volume.
- **Kick channels is now off by default.** If you haven't switched it yourself, turn it on under Features → Kick channels.

## 1.4.1 — 2026-10-21

- Renamed to **NF Extension**, now that it covers Kick too. The repository moved to github.com/Nasseralenezd/NF-Extension (old links redirect).
- Your favorites and settings carry over unchanged.

## 1.4.0 — 2026-10-21

- **Kick channels**: a Kick section under ★ Favorites in the Twitch sidebar, showing which Kick channels are live. It lists the channels you add in the popup, plus the channels you follow on Kick while you're logged in to kick.com. Clicking one opens it on kick.com in a new tab.
- The popup's Favorites tab has a **Twitch | Kick** switch; each list has its own add, remove, reorder and import/export.
- Streamers who hide their viewer count on Kick show as "Live" without a number.
- New permissions: `cookies` (to read your kick.com login for your followed channels) and access to `kick.com`. See PRIVACY.md.

## 1.3.1 — 2026-10-19

- Renamed to **NF for Twitch**.
- Fixes from a full code review.
- Added a privacy policy, and the minimum browser version (Chromium 102) to the manifest.

## 1.3.0 — 2026-10-19

New features, all off by default:

- **Hide sidebar clutter**: sponsored cards in Followed, Live Channels, Viewers Also Watch and Recommended Categories, each with its own switch.
- **Auto quality**: start every channel at Source, 1080p, 720p or 480p.
- **Auto theater mode** when you open a channel.
- **Shortcuts & screenshot**: T theater, F fullscreen, C clip, S screenshot, plus a camera button in the player.
- **Auto-claim bonus points**: clicks the channel points bonus chest.
- **Cleaner chat**: hide badges, Bits and top banners; compact lines.

The popup's Features tab is now grouped into Sidebar, Channel & player, and Chat.

## 1.2.0 — 2026-10-19

- **Import / export** favorites as a JSON file, with add or replace.
- Favorites are stored as plain channel names, so the list fits about 600 streamers. Lists from earlier versions convert automatically.

## 1.1.1 — 2026-10-19

- Hide For You now also hides the stories and streak rows, instantly and without flicker.
- Sidebar features react faster on busy pages.

## 1.1.0 — 2026-10-19

- Favorites position option: top of the sidebar (new default) or above Followed Channels.
- New **Hide For You** feature.

## 1.0.0 — 2026-10-19

First release:

- Pinned favorites in the sidebar, live channels only.
- Auto-expand Followed Channels.
- Star button next to Follow.
- Scroll volume over the player.
- Toolbar popup: add, reorder and remove favorites; feature switches.
