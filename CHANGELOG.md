# Changelog

## 1.7.0 — 2026-10-21

All new features are off by default.

- **Twitch**:
  - **Stream preview**: rest the pointer on a live channel in the sidebar (★ Favorites, Kick, Followed or Live Channels) to see its live thumbnail, title, game and viewers. It replaces Twitch's own small hover card while it's open.
  - **DVR**: a seek bar over the whole broadcast on live channels. Drag back to any moment, or use the arrow keys (10 seconds), without leaving the channel or its live chat; LIVE catches up. Needs a channel that keeps past broadcasts.
  - **Audio compressor**: a player button that evens out loud and quiet moments.
  - **Fullscreen chat**: chat over the right side of the video in fullscreen, see-through, still usable.
  - **Auto refresh on player errors** #1000 to #5000.
  - **Stop front-page autoplay** for the featured stream on Twitch's home page.
- **Kick**:
  - **Favorites on kick.com**: your live Kick channels in their own section above Following in kick.com's sidebar.
  - **Only Following in the sidebar**: hides kick.com's other sidebar sections.
  - **Stream preview** on kick.com's sidebar, and **Fullscreen chat** on Kick's player.
- **YouTube**: **Auto quality** (Highest, 1080p, 720p or 480p).
- **X**: **Hide promoted posts**, and **Hide sidebar clutter** (trends, Today's News, Who to follow, Premium, the Grok button).

## 1.6.0 — 2026-10-21

- **A tab for each site in the popup**: Twitch, Kick, YouTube and Twitter, with each site's logo. Twitch and Kick keep their lists (Favorites, Channels) next to their features.
- **YouTube** (new, all off by default):
  - **Classic grid**: 4, 5, 6, 7 or 8 videos per row on Home, Subscriptions and channel pages.
  - **Hide Shorts**: Shorts shelves, Shorts in feeds and search results, the channel Shorts tab and the Shorts menu entry.
  - **Scroll volume** over the video; YouTube's volume bar follows and remembers it.
- **X / Twitter** (new, off by default): **Dim mode** shows X's dark theme in the softer dark-blue Dim colors instead of pure black.
- **Kick**:
  - **Keep high quality** (new, off by default): every stream on kick.com plays at the highest quality you can watch, instead of Kick's Auto mode, which lowers it now and then.
  - **Scroll volume on kick.com** is now its own switch in the Kick tab, with its own step, and off by default. If it stops working after the update, turn it on there.
  - The Kick section in Twitch's sidebar shows Kick's logo.
- The extension now asks for access to youtube.com and x.com, for the new features there. They send nothing anywhere; see PRIVACY.md.
- Needs Chromium 111 or newer (was 102).

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
