# Privacy Policy

_Last updated: October 21, 2026_

NF Extension is a browser extension that adds features to twitch.tv, kick.com, youtube.com and x.com. This policy explains what data it handles. In short: it collects nothing about you, and it sends nothing to its author.

## What the extension stores

All of this stays in your browser:

- **Your favorites lists**: the Twitch and Kick channel names you add.
- **Your settings**: which features are on and their options.

These are saved in `chrome.storage.sync`. If you are signed in to your browser with sync turned on, your browser syncs them across your own devices.

The extension also keeps:

- A short-lived cache of looked-up channel information (live status, viewer count, game, avatar link), in `chrome.storage.session`. It is cleared when the browser closes, and entries expire after 10 minutes.
- Which sidebar sections you folded, in `chrome.storage.local`.
- The popup's last-opened site tab and view, in the popup's local storage.

## What the extension sends, and to whom

The extension makes these network requests on its own, to learn whether channels are live, and their viewer counts, games and avatars:

- **Twitch:** the names in your Twitch favorites (and any name you type in the popup to add) go to Twitch's GraphQL endpoint at `https://gql.twitch.tv`. These requests are anonymous: they do not include your Twitch cookies, login or any other personal data.
- **Kick channels:** the names in your Kick list go to `https://kick.com`, one channel at a time. These requests do not include your login.
- **Channels you follow on Kick** (only while "Include channels I follow on Kick" is on): the extension reads Kick's `session_token` login cookie from your browser and sends it **only to kick.com**, to request the list of channels you follow. The cookie is never stored by the extension, never sent anywhere else, and never shown or shared.

How Twitch and Kick handle these requests is covered by [Twitch's Privacy Notice](https://www.twitch.tv/p/legal/privacy-notice/) and [Kick's Privacy Policy](https://kick.com/privacy-policy).

When the extension shows channel avatars, your browser loads those images from Twitch's and Kick's image servers.

With **Stream preview** on, resting the pointer on a live channel in Twitch's sidebar loads that channel's live thumbnail from Twitch's or Kick's image servers, without telling them which page you're on. For a channel in Twitch's own lists, its name also goes to Twitch's GraphQL endpoint (as above) to get the stream title. For a Kick channel that comes from your Kick follows, its name goes to kick.com once to find its thumbnail. On kick.com itself, hovering a channel in Kick's sidebar asks kick.com for that channel's details.

With **DVR** on, a live channel's page asks Twitch's GraphQL endpoint (anonymously, as above) when the broadcast started and for its recording, and rewinding plays that recording from Twitch's video servers, as Twitch's own player does. **Fullscreen chat** shows the site's own pop-out chat (twitch.tv or kick.com) over the video. **Favorites on kick.com** looks up the names on your Kick list on kick.com, as the Kick section on Twitch does. **Auto refresh on player errors** keeps the times of its recent reloads in that tab's session storage, so it can stop if a stream keeps failing.

The features on kick.com, YouTube and X make no network requests of their own. They only change the pages in your browser: Kick's volume and quality (chosen in Kick's own player, which remembers them), YouTube's grid, Shorts and volume (YouTube's own player remembers the volume), and X's colors.

## What the extension does not do

- No analytics, telemetry, tracking or advertising.
- No data is sent to the author or any third party other than Twitch and Kick, as described above.
- It does not read, store or send your messages, account details or browsing history on Twitch, Kick, YouTube or X.
- Screenshots and exported favorites files are saved only to your own computer.

## Permissions

| Permission | Purpose |
|---|---|
| `storage` | Save your favorites and settings |
| `cookies` | Read your kick.com login cookie, only to request the channels you follow on Kick |
| `https://gql.twitch.tv/*` | Look up the live status of your Twitch favorites |
| `https://kick.com/*` | Look up the live status of your Kick channels and the channels you follow on Kick |
| Content scripts on `https://www.twitch.tv/*` | Add the extension's features to Twitch pages |
| Content scripts on `https://kick.com/*` | Scroll volume on Kick's player (it saves the new volume in Kick's own `volume` cookie, as Kick's slider does) and Keep high quality |
| Content scripts on `https://www.youtube.com/*` | Classic grid, Hide Shorts and Scroll volume on YouTube |
| Content scripts on `https://x.com/*` and `https://twitter.com/*` | Dim mode on X |

## Your control

- Remove favorites or turn features off at any time in the popup. Turning off "Include channels I follow on Kick" stops the extension from reading your Kick login cookie.
- Export your favorites to a file from the popup.
- Uninstalling the extension deletes everything it stored.

## Changes

If this policy changes, the new version will be published in this repository with an updated date.

## Contact

Questions? Open an issue at [github.com/Nasseralenezd/NF-Extension/issues](https://github.com/Nasseralenezd/NF-Extension/issues).
