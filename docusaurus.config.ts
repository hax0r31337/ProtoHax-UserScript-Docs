import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'ProtoHax UserScript',
  tagline: 'Write ProtoHax client modules in TypeScript',
  favicon: 'img/favicon.svg',

  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  url: 'https://userscript.protohax.net',
  baseUrl: '/',

  organizationName: 'hax0r31337',
  projectName: 'ProtoHax-UserScript-Docs',

  onBrokenLinks: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  // Brand typography: Lexend (the ProtoHax wordmark) + JetBrains Mono for code.
  headTags: [
    {
      tagName: 'link',
      attributes: {rel: 'preconnect', href: 'https://fonts.googleapis.com'},
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossorigin: 'anonymous',
      },
    },
  ],

  stylesheets: [
    'https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/', // serve the docs at the site root
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      'docusaurus-plugin-copy-page-button',
      {
        // emit a plain-markdown URL (/page.md) per doc, and point the AI links at it
        generateMarkdownRoutes: true,
        enabledActions: ['copy', 'view', 'chatgpt', 'claude'],
      },
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'ProtoHax UserScript',
      logo: {
        alt: 'ProtoHax UserScript',
        src: 'img/logo.svg',
      },
      items: [
        {
          href: 'https://protohax.net/',
          label: 'Home',
          position: 'left',
        },
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/hax0r31337/ProtoHax-UserScript-Template',
          label: 'Template',
          position: 'right',
        },
        {
          href: 'https://www.npmjs.com/package/@protohax/userscript',
          label: 'npm',
          position: 'right',
        },
        {
          href: 'https://github.com/hax0r31337/ProtoHax-UserScript-Docs',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Introduction', to: '/'},
            {label: 'Getting Started', to: '/guides/getting-started'},
            {label: 'API Reference', to: '/api/session'},
          ],
        },
        {
          title: 'Package',
          items: [
            {
              label: '@protohax/userscript',
              href: 'https://www.npmjs.com/package/@protohax/userscript',
            },
            {
              label: 'Template repository',
              href: 'https://github.com/hax0r31337/ProtoHax-UserScript-Template',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/hax0r31337/ProtoHax-UserScript-Docs',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} ProtoHax. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      // Monokai — prism-react-renderer ships it under its Prism name, `okaidia`.
      darkTheme: prismThemes.okaidia,
      additionalLanguages: ['bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
