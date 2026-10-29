import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// Explicit order: guides first as a learning path, then the API reference.
const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Guides',
      collapsed: false,
      items: [
        {
          type: 'category',
          label: 'Project Setup',
          link: {type: 'doc', id: 'guides/project-setup/index'},
          items: [
            'guides/project-setup/bundling',
            'guides/project-setup/banner',
            'guides/project-setup/structure',
            'guides/project-setup/installing',
          ],
        },
        {
          type: 'category',
          label: 'Getting Started',
          link: {type: 'doc', id: 'guides/getting-started/index'},
          items: [
            'guides/getting-started/two-phases',
            'guides/getting-started/context',
          ],
        },
        'guides/modules',
        'guides/options',
        'guides/events-and-packets',
        'guides/debugging',
      ],
    },
    {
      type: 'category',
      label: 'UI Widgets',
      collapsed: false,
      link: {type: 'doc', id: 'ui/index'},
      items: [
        'ui/setup',
        'ui/widgets',
        'ui/hud-placement',
        'ui/theming',
        'ui/lite',
        'ui/web',
        'ui/custom-widgets',
        'ui/dom',
        'ui/examples',
      ],
    },
    {
      type: 'category',
      label: 'Baritone',
      collapsed: false,
      link: {type: 'doc', id: 'baritone/index'},
      items: [
        'baritone/commands',
        'baritone/state',
        'baritone/settings',
        'baritone/how-it-works',
        'baritone/examples',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      collapsed: false,
      items: [
        'api/session',
        'api/entities',
        'api/local-player',
        'api/movement',
        'api/input',
        'api/world',
        'api/inventory',
        'api/packets',
        'api/module-manager',
        'api/combat-helpers',
        'api/audio',
        'api/utilities',
      ],
    },
  ],
};

export default sidebars;
