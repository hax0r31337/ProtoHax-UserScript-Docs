# ProtoHax UserScript Docs

Documentation site for [`@protohax/userscript`](https://www.npmjs.com/package/@protohax/userscript) —
the TypeScript API for writing ProtoHax client modules.

Built with [Docusaurus](https://docusaurus.io/).

## Structure

```
docs/
  intro.md                 # overview, install, tsconfig
  guides/                  # learning path
    getting-started.md
    modules.md
    options.md
    events-and-packets.md
  api/                     # reference
    session.md
    entities.md
    local-player.md
    world.md
    inventory.md
    packets.md
    module-manager.md
    utilities.md
```

## Local development

```bash
npm install
npm start          # dev server with hot reload
```

## Build

```bash
npm run build      # static site into build/
npm run serve      # preview the production build
```
