---
id: intro
title: Introduction
slug: /
sidebar_position: 1
---

# ProtoHax UserScript

ProtoHax UserScript lets you write your own ProtoHax client modules in
TypeScript. A userscript declares a module (its name and options) and hooks
into the live game session: game events, packets, entities and the world, the
local player, the inventory, and the raw packet connection. It can also draw
its own UI on the client: HUD elements and full screens.

Your modules show up in the client menu under the **Script** category, next to
the built-in ones. They work just like first-party modules: users can toggle
them, tweak their sliders, toggles and color pickers, and they can read and
drive the game the same way.

## The `@protohax/userscript` package

All the types come from one npm package:
[`@protohax/userscript`](https://www.npmjs.com/package/@protohax/userscript).

:::warning[0.x is unstable]

The API is still at **0.x** and still taking shape. Any release can include
breaking changes until 1.x. Expect to update your scripts between client
versions, and pin the package version your script was built against.

:::

The package is **types-only**: a single `index.d.ts`, no runtime code. That's
on purpose.

- **Types** describe the authoring API and the host's game model. Your editor
  autocompletes things like `ctx.session.entityState.localPlayer.inventory` and
  type-checks every packet payload.
- **Values** you import (`defineModule`, `moduleManager`, the entity classes,
  `AbstractBlockLocationTracker`, `nbt`, `utils`) are resolved at runtime to the
  host's **live singletons** once your script is bundled into the client. Your
  script and the client share one game state, one module manager, and one
  (patched) `prismarine-nbt`.

So you install the package for the types, and the client supplies the
implementation when your script runs.

:::warning[No ICU in the client's V8]

The client's V8 is built with ICU disabled, so there's no internationalization
support at runtime:

- **`Intl` doesn't exist.** `Intl.NumberFormat`, `Intl.DateTimeFormat`,
  `Intl.Collator` and friends throw a `ReferenceError`.
- **Locale-aware methods ignore the locale.** `toLocaleString`,
  `localeCompare`, `toLocaleUpperCase` and the like accept locale and options
  arguments but fall back to plain, non-localized behavior.
- **Unicode property escapes don't work.** A regex like `/\p{L}/u` is a
  `SyntaxError`.

TypeScript's `lib` still declares all of these, so the type checker won't warn
you. Watch out for npm packages that lean on `Intl` (date, number and
pluralization libraries especially): they'll bundle fine and fail when the
script runs.

:::

## Install

The easiest start is the
[template repository](https://github.com/hax0r31337/ProtoHax-UserScript-Template).
It comes with the bundler, the deploy script, and a working example module:

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

:::note[Keep `skipLibCheck` on]

Versions before 0.5 need it: their `.d.ts` copies the host's packet definitions
verbatim, including a harmless duplicate declaration. From 0.5 on the
declarations type-check cleanly, but `skipLibCheck: true` is still
recommended. Your own code is fully checked against the API either way.

:::

Your script ships as a **single ES module** with `@protohax/userscript` left
external. That import is what connects your script to the host's live
singletons. [Project Setup](/guides/project-setup) covers the bundler config
and where the built file goes.

## A first module

```ts
import { defineModule } from "@protohax/userscript";

defineModule(
  { name: "AutoSprint" },
  {
    speed: { type: "number", def: 1, min: 0, max: 5, step: 0.1 },
  },
  (ctx) => {
    // The game's own tick, fired from native before the player moves.
    // Position and motion you write here apply in that same tick.
    ctx.on("movement_tick", (state) => {
      state.strafe(ctx.options.speed.value, 1);
    });
  },
);
```

That's the whole shape of a module: a **schema** that declares the options
once, and a **setup function** that runs per session, reads the options from
`ctx.options`, and subscribes to events. The next pages go through each part.

## Where to go next

- [Project Setup](/guides/project-setup): the template, bundling, and installing your script.
- [Getting Started](/guides/getting-started): the module lifecycle in detail.
- [Modules](/guides/modules): metadata, the Script category, and toggling.
- [Options](/guides/options): sliders, toggles, enums, colors.
- [Events & Packets](/guides/events-and-packets): subscribing to the session.
- [Movement](/api/movement): `movement_tick`, `MovementState`, jumping, and sprint and sneak control.
- [Input](/api/input): `input_tick`, `InputState`, and overriding the player's keys.
- [UI Widgets](/ui): HUD elements and screens of your own, built with Preact.
- [API Reference](/api/session): the session, entities, world, inventory, and packets.
