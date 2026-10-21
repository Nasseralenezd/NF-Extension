# Privacy Policy

_Last updated: October 21, 2026_

NF Extension is a browser extension that adds features to twitch.tv. This policy explains what data it handles. In short: it collects nothing about you, and it sends nothing to its author.

## What the extension stores

All of this stays in your browser:

- **Your favorites lists**: the Twitch and Kick channel names you add.
- **Your settings**: which features are on and their options.

These are saved in `chrome.storage.sync`. If you are signed in to your browser with sync turned on, your browser syncs them across your own devices.

The extension also keeps:

- A short-lived cache of looked-up channel information (live status, viewer count, game, avatar link), in `chrome.storage.session`. It is cleared when the browser closes, and entries expire after 10 minutes.
- The popup's last-opened tab, in the popup's local storage.

## What the extension sends, and to whom

The extension makes these network requests on its own, to learn whether channels are live, and their viewer counts, games and avatars:

- **Twitch:** the names in your Twitch favorites (and any name you type in the popup to add) go to Twitch's GraphQL endpoint at `https://gql.twitch.tv`. These requests are anonymous: they do not include your Twitch cookies, login or any other personal data.
- **Kick channels:** the names in your Kick list go to `https://kick.com`, one channel at a time. These requests do not include your login.
- **Channels you follow on Kick** (only while "Include channels I follow on Kick" is on): the extension reads Kick's `session_token` login cookie from your browser and sends it **only to kick.com**, to request the list of channels you follow. The cookie is never stored by the extension, never sent anywhere else, and never shown or shared.

How Twitch and Kick handle these requests is covered by [Twitch's Privacy Notice](https://www.twitch.tv/p/legal/privacy-notice/) and [Kick's Privacy Policy](https://kick.com/privacy-policy).

When the extension shows channel avatars, your browser loads those images from Twitch's and Kick's image servers.

## What the extension does not do

- No analytics, telemetry, tracking or advertising.
- No data is sent to the author or any third party other than Twitch and Kick, as described above.
- It does not read, store or send your Twitch messages, account details or browsing history.
- Screenshots and exported favorites files are saved only to your own computer.

## Permissions

| Permission | Purpose |
|---|---|
| `storage` | Save your favorites and settings |
| `cookies` | Read your kick.com login cookie, only to request the channels you follow on Kick |
| `https://gql.twitch.tv/*` | Look up the live status of your Twitch favorites |
| `https://kick.com/*` | Look up the live status of your Kick channels and the channels you follow on Kick |
| Content scripts on `https://www.twitch.tv/*` | Add the extension's features to Twitch pages |
| Content scripts on `https://kick.com/*` | Scroll volume on Kick's player (it saves the new volume in Kick's own `volume` cookie, as Kick's slider does) |

## Your control

- Remove favorites or turn features off at any time in the popup. Turning off "Include channels I follow on Kick" stops the extension from reading your Kick login cookie.
- Export your favorites to a file from the popup.
- Uninstalling the extension deletes everything it stored.

## Changes

If this policy changes, the new version will be published in this repository with an updated date.

## Contact

Questions? Open an issue at [github.com/Nasseralenezd/NF-Extension/issues](https://github.com/Nasseralenezd/NF-Extension/issues).
