/*
 * Feature registry, shared by the popup and the content scripts.
 *
 * To add a feature: add an entry here (status 'live'), then add a file in
 * src/content/features/ that calls NFTwitch.register('<id>', { start, stop })
 * and list it in manifest.json. The popup builds its toggles from this list,
 * under the heading of the feature's group. Entries with status 'soon' show
 * up in the popup's "Coming soon" tab.
 */
(function (root) {
  const GROUPS = [
    ['sidebar', 'Sidebar'],
    ['player', 'Channel & player'],
    ['chat', 'Chat'],
  ];

  const FEATURES = [
    /* ---------- sidebar ---------- */
    {
      id: 'pinned',
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
      id: 'kick',
      group: 'sidebar',
      name: 'Kick channels',
      description: 'Live Kick channels get their own section under Favorites. Clicking one opens it on kick.com in a new tab.',
      status: 'live',
      default: true,
      options: [{ id: 'kickFollowed', type: 'toggle', label: 'Include channels I follow on Kick (when logged in to kick.com)', default: true }],
    },
    {
      id: 'autoExpand',
      group: 'sidebar',
      name: 'Auto-expand Followed',
      description: 'Clicks "Show More" for you so every followed channel is listed.',
      status: 'live',
      default: true,
      options: [{ id: 'openSidebar', type: 'toggle', label: 'Also open the sidebar when it is collapsed', default: false }],
    },
    {
      id: 'hideForYou',
      group: 'sidebar',
      name: 'Hide For You',
      description: 'Removes the For You block (stories, streaks) above your Followed list.',
      status: 'live',
      default: false,
    },
    {
      id: 'hideSidebarClutter',
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

    /* ---------- channel & player ---------- */
    {
      id: 'starButton',
      group: 'player',
      name: 'Star button',
      description: 'A ★ next to Follow on channel pages to pin or unpin that streamer.',
      status: 'live',
      default: true,
    },
    {
      id: 'scrollVolume',
      group: 'player',
      name: 'Scroll volume',
      description: 'Mouse wheel over the player turns the volume up or down.',
      status: 'live',
      default: true,
      options: [{ id: 'scrollStep', type: 'range', label: 'Step', min: 1, max: 20, unit: '%', default: 1 }],
    },
    {
      id: 'autoQuality',
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
      id: 'autoTheater',
      group: 'player',
      name: 'Auto theater mode',
      description: 'Switches to theater mode when you open a channel.',
      status: 'live',
      default: false,
    },
    {
      id: 'shortcuts',
      group: 'player',
      name: 'Shortcuts & screenshot',
      description: 'On channel and video pages press T theater, F fullscreen, C clip, S screenshot.',
      status: 'live',
      default: false,
      options: [{ id: 'screenshotButton', type: 'toggle', label: 'Screenshot button in the player', default: true }],
    },

    /* ---------- chat ---------- */
    {
      id: 'autoClaim',
      group: 'chat',
      name: 'Auto-claim bonus points',
      description: 'Clicks the channel points bonus chest for you while you watch.',
      status: 'live',
      default: false,
    },
    {
      id: 'cleanChat',
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

    { id: 'notifications', name: 'Live notifications', description: 'A desktop alert when a favorite goes live.', status: 'soon' },
    { id: 'importFollowed', name: 'Import from Followed', description: 'Pick several followed channels and star them at once.', status: 'soon' },
    { id: 'chatTweaks', name: 'Highlight favorites in chat', description: 'Make messages from your favorites stand out in any chat.', status: 'soon' },
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

  root.NFTwitchFeatures = { FEATURES, GROUPS, defaultSettings };
})(globalThis);
