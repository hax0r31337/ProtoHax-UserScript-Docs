import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// Explicit sidebar so the ordering reads as a learning path, then a reference.
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
      label: 'API Reference',
      collapsed: false,
      items: [
        'api/session',
        'api/entities',
        'api/local-player',
        'api/world',
        'api/inventory',
        'api/packets',
        'api/module-manager',
        'api/combat-helpers',
        'api/utilities',
      ],
    },
  ],
};

export default sidebars;
