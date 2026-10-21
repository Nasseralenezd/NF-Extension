/*
 * Feature registry, shared by the popup and the content scripts.
 *
 * To add a feature: add an entry here with its platform ('twitch', 'kick',
 * 'youtube' or 'twitter') and status 'live', then add the content script that
 * implements it (for Twitch: a file in src/content/features/ that calls
 * NFTwitch.register('<id>', { start, stop })) and list it in manifest.json.
 * The popup builds its switches from this list, in the platform's tab and
 * under the feature's group heading. Entries with status 'soon' show up as
 * planned in that platform's tab.
 */
(function (root) {
  // The popup's tabs, in order.
  const PLATFORMS = [
    ['twitch', 'Twitch'],
    ['kick', 'Kick'],
    ['youtube', 'YouTube'],
    ['twitter', 'Twitter'],
  ];

  // Headings inside a platform's Features view, in order.
  const GROUPS = [
    ['sidebar', 'Sidebar'],
    ['player', 'Channel & player'],
    ['chat', 'Chat'],
    ['twitchSidebar', 'In the Twitch sidebar'],
    ['onKick', 'On kick.com'],
    ['ytFeed', 'Home & feeds'],
    ['ytPlayer', 'Player'],
    ['xDisplay', 'Display'],
    ['xTimeline', 'Timeline & sidebar'],
  ];

  const FEATURES = [
    /* ---------- Twitch: sidebar ---------- */
    {
      id: 'pinned',
      platform: 'twitch',
      group: 'sidebar',
      name: 'Pinned favorites',
      description: 'Your live favorites get their own section in the sidebar.',
      status: 'live',
      default: true,
      options: [
        {
          id: 'pinnedPosition',
          type: 'select',
          label: 'Position',
          default: 'top',
          choices: [
            ['top', 'Top'],
            ['followed', 'Above Followed'],
          ],
        },
        { id: 'hideDuplicates', type: 'toggle', label: 'Hide them from the Followed list', default: true },
        {
          id: 'pinnedSort',
          type: 'select',
          label: 'Sort by',
          default: 'viewers',
          choices: [
            ['viewers', 'Viewers'],
            ['manual', 'My order'],
          ],
        },
      ],
    },
    {
      id: 'autoExpand',
      platform: 'twitch',
      group: 'sidebar',
      name: 'Auto-expand Followed',
      description: 'Clicks "Show More" for you so every followed channel is listed.',
      status: 'live',
      default: true,
      options: [{ id: 'openSidebar', type: 'toggle', label: 'Also open the sidebar when it is collapsed', default: false }],
    },
    {
      id: 'streamPreview',
      platform: 'twitch',
      group: 'sidebar',
      name: 'Stream preview',
      description: 'Hover a live channel in the sidebar to see its live stream thumbnail, title and viewers.',
      status: 'live',
      default: false,
    },
    {
      id: 'hideForYou',
      platform: 'twitch',
      group: 'sidebar',
      name: 'Hide For You',
      description: 'Removes the For You block (stories, streaks) above your Followed list.',
      status: 'live',
      default: false,
    },
    {
      id: 'hideSidebarClutter',
      platform: 'twitch',
      group: 'sidebar',
      name: 'Hide sidebar clutter',
      description: 'Removes the sidebar parts you pick below.',
      status: 'live',
      default: false,
      options: [
        { id: 'hideSponsored', type: 'toggle', label: 'Sponsored cards in Followed', default: true },
        { id: 'hideLiveChannels', type: 'toggle', label: 'Live Channels (recommended)', default: true },
        { id: 'hideViewersAlsoWatch', type: 'toggle', label: 'Viewers Also Watch', default: true },
        { id: 'hideRecCategories', type: 'toggle', label: 'Recommended Categories', default: true },
      ],
    },

    /* ---------- Twitch: channel & player ---------- */
    {
      id: 'starButton',
      platform: 'twitch',
      group: 'player',
      name: 'Star button',
      description: 'A ★ next to Follow on channel pages to pin or unpin that streamer.',
      status: 'live',
      default: true,
    },
    {
      id: 'scrollVolume',
      platform: 'twitch',
      group: 'player',
      name: 'Scroll volume',
      description: 'Mouse wheel over the player turns the volume up or down.',
      status: 'live',
      default: true,
      options: [{ id: 'scrollStep', type: 'range', label: 'Step', min: 1, max: 20, unit: '%', default: 1 }],
    },
    {
      id: 'audioCompressor',
      platform: 'twitch',
      group: 'player',
      name: 'Audio compressor',
      description: 'A button in the player that evens out loud and quiet moments, so one volume works for the whole stream.',
      status: 'live',
      default: false,
    },
    {
      id: 'autoQuality',
      platform: 'twitch',
      group: 'player',
      name: 'Auto quality',
      description: 'Every stream starts at the quality you pick (or the closest one below it).',
      status: 'live',
      default: false,
      options: [
        {
          id: 'quality',
          type: 'select',
          label: 'Quality',
          default: 'source',
          choices: [
            ['source', 'Source'],
            ['1080', '1080p'],
            ['720', '720p'],
            ['480', '480p'],
          ],
        },
      ],
    },
    {
      id: 'dvr',
      platform: 'twitch',
      group: 'player',
      name: 'DVR (rewind live streams)',
      description: 'A seek bar over the whole broadcast on live channels: drag back to any moment, or use the arrow keys (10 s), and press LIVE to catch up. Needs a channel that keeps past broadcasts.',
      status: 'live',
      default: false,
    },
    {
      id: 'fullscreenChat',
      platform: 'twitch',
      group: 'player',
      name: 'Fullscreen chat',
      description: 'While the player is fullscreen, chat shows over the right side of the video. You can still read, scroll and type.',
      status: 'live',
      default: false,
    },
    {
      id: 'autoRefresh',
      platform: 'twitch',
      group: 'player',
      name: 'Auto refresh on player errors',
      description: 'Reloads the page by itself when the player stops with error #1000, #2000, #3000, #4000 or #5000.',
      status: 'live',
      default: false,
    },
    {
      id: 'stopFrontAutoplay',
      platform: 'twitch',
      group: 'player',
      name: 'Stop front-page autoplay',
      description: "The featured stream at the top of Twitch's home page stays paused until you press play.",
      status: 'live',
      default: false,
    },
    {
      id: 'autoTheater',
      platform: 'twitch',
      group: 'player',
      name: 'Auto theater mode',
      description: 'Switches to theater mode when you open a channel.',
      status: 'live',
      default: false,
    },
    {
      id: 'shortcuts',
      platform: 'twitch',
      group: 'player',
      name: 'Shortcuts & screenshot',
      description: 'On channel and video pages press T theater, F fullscreen, C clip, S screenshot.',
      status: 'live',
      default: false,
      options: [{ id: 'screenshotButton', type: 'toggle', label: 'Screenshot button in the player', default: true }],
    },

    /* ---------- Twitch: chat ---------- */
    {
      id: 'autoClaim',
      platform: 'twitch',
      group: 'chat',
      name: 'Auto-claim bonus points',
      description: 'Clicks the channel points bonus chest for you while you watch.',
      status: 'live',
      default: false,
    },
    {
      id: 'cleanChat',
      platform: 'twitch',
      group: 'chat',
      name: 'Cleaner chat',
      description: 'Hides the chat clutter you pick below.',
      status: 'live',
      default: false,
      options: [
        { id: 'chatHideBadges', type: 'toggle', label: 'Badges next to names', default: true },
        { id: 'chatHideCheers', type: 'toggle', label: 'Bits: cheer emotes, leaderboard, button', default: true },
        { id: 'chatHideHighlights', type: 'toggle', label: 'Banners on top (hype train, predictions…)', default: true },
        { id: 'chatCompact', type: 'toggle', label: 'Compact lines', default: true },
      ],
    },

    /* ---------- Kick ---------- */
    {
      id: 'kick',
      platform: 'kick',
      group: 'twitchSidebar',
      name: 'Kick channels',
      description: 'Live Kick channels get their own section under Favorites. Clicking one opens it on kick.com in a new tab.',
      status: 'live',
      default: false,
      options: [{ id: 'kickFollowed', type: 'toggle', label: 'Include channels I follow on Kick (when logged in to kick.com)', default: true }],
    },
    {
      id: 'kickSiteFavorites',
      platform: 'kick',
      group: 'onKick',
      name: 'Favorites on kick.com',
      description: "Your live Kick channels (the Channels list in this tab) get their own section above Following in kick.com's sidebar.",
      status: 'live',
      default: false,
      options: [{ id: 'kickFavHideDup', type: 'toggle', label: 'Hide them from the Following list', default: true }],
    },
    {
      id: 'kickOnlyFollowing',
      platform: 'kick',
      group: 'onKick',
      name: 'Only Following in the sidebar',
      description: "Hides kick.com's other sidebar sections (Recommended and the like), so it lists only the channels you follow.",
      status: 'live',
      default: false,
    },
    {
      id: 'scrollVolumeKick',
      platform: 'kick',
      group: 'onKick',
      name: 'Scroll volume',
      description: "Mouse wheel over Kick's player turns the volume up or down. Kick remembers it, as with its own slider.",
      status: 'live',
      default: false,
      options: [{ id: 'scrollStepKick', type: 'range', label: 'Step', min: 1, max: 20, unit: '%', default: 1 }],
    },
    {
      id: 'kickPreview',
      platform: 'kick',
      group: 'onKick',
      name: 'Stream preview',
      description: "Hover a channel in kick.com's sidebar to see its live stream thumbnail, title and viewers.",
      status: 'live',
      default: false,
    },
    {
      id: 'kickFullscreenChat',
      platform: 'kick',
      group: 'onKick',
      name: 'Fullscreen chat',
      description: "While Kick's player is fullscreen, chat shows over the right side of the video. You can still read, scroll and type.",
      status: 'live',
      default: false,
    },
    {
      id: 'kickQuality',
      platform: 'kick',
      group: 'onKick',
      name: 'Keep high quality',
      description: "Every stream plays at the highest quality you can watch, instead of Kick's Auto, which lowers it now and then.",
      status: 'live',
      default: false,
    },

    /* ---------- YouTube ---------- */
    {
      id: 'ytLive',
      platform: 'youtube',
      group: 'twitchSidebar',
      name: 'YouTube live channels',
      description: 'Live YouTube channels get their own section under Kick in the Twitch sidebar: those on the Channels list in this tab, and the channels you subscribe to. Clicking one opens it on YouTube in a new tab.',
      status: 'live',
      default: false,
      options: [{ id: 'ytSubs', type: 'toggle', label: 'Include channels I subscribe to on YouTube (when logged in to youtube.com)', default: true }],
    },
    {
      id: 'ytGrid',
      platform: 'youtube',
      group: 'ytFeed',
      name: 'Classic grid',
      description: 'More videos in each row on Home, Subscriptions and channel pages.',
      status: 'live',
      default: false,
      options: [
        {
          id: 'ytGridColumns',
          type: 'select',
          label: 'Videos per row',
          default: '5',
          choices: [
            ['4', '4'],
            ['5', '5'],
            ['6', '6'],
            ['7', '7'],
            ['8', '8'],
          ],
        },
      ],
    },
    {
      id: 'ytHideShorts',
      platform: 'youtube',
      group: 'ytFeed',
      name: 'Hide Shorts',
      description: 'Removes Shorts shelves, Shorts in feeds and search results, and the Shorts menu entry.',
      status: 'live',
      default: false,
    },
    {
      id: 'ytQuality',
      platform: 'youtube',
      group: 'ytPlayer',
      name: 'Auto quality',
      description: 'Every video starts at the quality you pick (or the best one below it). Changing it in the player still works.',
      status: 'live',
      default: false,
      options: [
        {
          id: 'ytQualityLevel',
          type: 'select',
          label: 'Quality',
          default: 'highest',
          choices: [
            ['highest', 'Highest'],
            ['hd1080', '1080p'],
            ['hd720', '720p'],
            ['large', '480p'],
          ],
        },
      ],
    },
    {
      id: 'ytScrollVolume',
      platform: 'youtube',
      group: 'ytPlayer',
      name: 'Scroll volume',
      description: "Mouse wheel over the video turns the volume up or down. YouTube's volume bar follows and remembers it.",
      status: 'live',
      default: false,
      options: [{ id: 'ytScrollStep', type: 'range', label: 'Step', min: 1, max: 20, unit: '%', default: 1 }],
    },

    /* ---------- Twitter / X ---------- */
    {
      id: 'xDim',
      platform: 'twitter',
      group: 'xDisplay',
      name: 'Dim mode',
      description: "Shows X's dark theme in the softer dark-blue Dim colors instead of pure black. Works while X is set to Lights out.",
      status: 'live',
      default: false,
    },

    {
      id: 'xHidePromoted',
      platform: 'twitter',
      group: 'xTimeline',
      name: 'Hide promoted posts',
      description: 'Removes ads (posts marked "Ad") from your timeline and replies.',
      status: 'live',
      default: false,
    },
    {
      id: 'xHideClutter',
      platform: 'twitter',
      group: 'xTimeline',
      name: 'Hide sidebar clutter',
      description: 'Removes the side column parts you pick below.',
      status: 'live',
      default: false,
      options: [
        { id: 'xHideTrends', type: 'toggle', label: "What's happening (trends)", default: true },
        { id: 'xHideNews', type: 'toggle', label: "Today's News", default: true },
        { id: 'xHideFollow', type: 'toggle', label: 'Who to follow', default: true },
        { id: 'xHidePremium', type: 'toggle', label: 'Subscribe to Premium', default: true },
        { id: 'xHideGrok', type: 'toggle', label: 'Grok button (bottom right)', default: true },
      ],
    },

    /* ---------- planned ---------- */
    { id: 'notifications', platform: 'twitch', name: 'Live notifications', description: 'A desktop alert when a favorite goes live.', status: 'soon' },
    { id: 'importFollowed', platform: 'twitch', name: 'Import from Followed', description: 'Pick several followed channels and star them at once.', status: 'soon' },
    { id: 'chatTweaks', platform: 'twitch', name: 'Highlight favorites in chat', description: 'Make messages from your favorites stand out in any chat.', status: 'soon' },
  ];

  function defaultSettings() {
    const settings = {};
    for (const feature of FEATURES) {
      if (feature.status !== 'live') continue;
      settings[feature.id] = feature.default;
      for (const option of feature.options || []) settings[option.id] = option.default;
    }
    return settings;
  }

  root.NFTwitchFeatures = { FEATURES, PLATFORMS, GROUPS, defaultSettings };
})(globalThis);
