---
id: intro
title: Introduction
slug: /
sidebar_position: 1
---

# ProtoHax UserScript

**ProtoHax UserScript** lets you write your own ProtoHax client modules in
TypeScript. A userscript declares a module — its name, category, and options —
and wires up listeners against the live game session: game events, packets, the
entity/world model, the local player, inventory, and the raw packet connection.

Modules you author this way sit alongside the built-in ones in the client menu.
They can be toggled on and off, expose sliders and toggles and color pickers,
and read or drive the game exactly like a first-party module.

## The `@protohax/userscript` package

Everything is typed through a single package on npm:

> **[`@protohax/userscript`](https://www.npmjs.com/package/@protohax/userscript)**

:::warning[0.x is unstable]

The userscript API is at version **0.x**: it is still taking shape, and
**breaking changes can land in any release** until 1.x is reached. Expect to
update your scripts between client versions, and pin the package version your
script was built against.

:::

This package is **types-only**. It ships a single `index.d.ts` and no runtime
code. That is deliberate:

- The **types** describe the authoring API and the host's own game model, so
  your editor autocompletes `ctx.session.entityState.localPlayer.jump()` and
  type-checks every packet payload.
- The **values** you import from it — `defineModule`, `moduleManager`, the entity
  classes, `AbstractBlockLocationTracker`, `nbt`, `utils` — are resolved at
  runtime to the host's **live singletons** when your script is bundled into the
  client. Your script and the client share one instance of the game state, one
  module manager, and one (patched) `prismarine-nbt`.

In other words: you install the package for the types, and the ProtoHax client
supplies the implementation when your script runs.

## Install

Start from the
**[template repository](https://github.com/hax0r31337/ProtoHax-UserScript-Template)** —
it comes with the bundler, the deploy script, and a worked example module
already wired up:

```bash
git clone https://github.com/hax0r31337/ProtoHax-UserScript-Template my-script
cd my-script
npm install
npm run build
```

Or add the package to an existing project:

```bash
npm install --save-dev @protohax/userscript
```

## `tsconfig.json`

A minimal config that works with the published declarations:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true
  }
}
```

> **Note — `skipLibCheck` is required.** The published `.d.ts` vendors the host's
> packet definitions verbatim, which contain a harmless duplicate declaration.
> `skipLibCheck: true` lets your project type-check cleanly while still fully
> checking *your* code against the API.

A script ships as a **single ES module** with `@protohax/userscript` left
external — that import is what binds your script to the host's live singletons.
[Project Setup](/guides/project-setup) covers the bundler configuration and
where the built file goes.

## A first module

```ts
import { defineModule, ModuleCategory } from "@protohax/userscript";

defineModule(
  { name: "AutoSprint", category: ModuleCategory.Movement },
  {
    speed: { type: "number", def: 1, min: 0, max: 5, step: 0.1 },
  },
  (ctx) => {
    ctx.on("tick", () => {
      ctx.session.entityState.localPlayer.strafe(ctx.options.speed.value, 1);
    });
  },
);
```

That is the whole shape of a module: **a schema declaring the options once, and
a per-session setup function** that reads them from `ctx.options` and
subscribes to events. The next pages walk through each layer.

## Where to go next

- **[Project Setup](/guides/project-setup)** — the template, bundling, and installing your script.
- **[Getting Started](/guides/getting-started)** — the module lifecycle in detail.
- **[Modules](/guides/modules)** — metadata, categories, and toggling.
- **[Options](/guides/options)** — sliders, toggles, enums, colors.
- **[Events & Packets](/guides/events-and-packets)** — subscribing to the session.
- **[API Reference](/api/session)** — the session, entities, world, inventory, and packets.
