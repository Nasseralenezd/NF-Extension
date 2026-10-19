# Privacy Policy

_Last updated: October 19, 2026_

NF for Twitch is a browser extension that adds features to twitch.tv. This policy explains what data it handles. In short: it collects nothing about you, and it sends nothing to its author.

## What the extension stores

All of this stays in your browser:

- **Your favorites list**: the Twitch channel names you pin.
- **Your settings**: which features are on and their options.

These are saved in `chrome.storage.sync`. If you are signed in to your browser with sync turned on, your browser syncs them across your own devices.

The extension also keeps:

- A short-lived cache of looked-up channel information (live status, viewer count, game, avatar link), in `chrome.storage.session`. It is cleared when the browser closes, and entries expire after 10 minutes.
- The popup's last-opened tab, in the popup's local storage.

## What the extension sends, and to whom

The extension makes one kind of network request on its own: it sends the **names of the channels in your favorites** (and any name you type in the popup to add) to Twitch's GraphQL endpoint at `https://gql.twitch.tv`. This is how it learns whether those channels are live, and their viewer counts, games and avatars.

- These requests are anonymous. They do not include your Twitch cookies, login or any other personal data.
- Twitch's handling of these requests is covered by [Twitch's Privacy Notice](https://www.twitch.tv/p/legal/privacy-notice/).

When the extension shows channel avatars, your browser loads those images from Twitch's image servers, as twitch.tv itself does.

## What the extension does not do

- No analytics, telemetry, tracking or advertising.
- No data is sent to the author or any third party other than Twitch, as described above.
- It does not read, store or send your Twitch messages, account details or browsing history.
- Screenshots and exported favorites files are saved only to your own computer.

## Permissions

| Permission | Purpose |
|---|---|
| `storage` | Save your favorites and settings |
| `https://gql.twitch.tv/*` | Look up the live status of your favorites |
| Content scripts on `https://www.twitch.tv/*` | Add the extension's features to Twitch pages |

## Your control

- Remove favorites or turn features off at any time in the popup.
- Export your favorites to a file from the popup.
- Uninstalling the extension deletes everything it stored.

## Changes

If this policy changes, the new version will be published in this repository with an updated date.

## Contact

Questions? Open an issue at [github.com/Nasseralenezd/nf-twitch/issues](https://github.com/Nasseralenezd/nf-twitch/issues).
