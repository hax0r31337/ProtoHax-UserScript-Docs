---
id: structure
title: Structure & Sharing
---

# Structure & Sharing

## One entry, any number of modules

A module is registered when a [`defineModule`](/guides/getting-started) call
runs. So one script can declare as many modules as you like, either in the
entry file or in files the entry imports:

```ts
// src/index.ts
import { defineModule } from "@protohax/userscript";

defineModule(
  { name: "AutoSprint" },
  {
    speed: { type: "number", def: 1, min: 0, max: 5, step: 0.1 },
  },
  (ctx) => {
    ctx.on("movement_tick", (state) => state.strafe(ctx.options.speed.value, 1));
  },
);
```

How you split files is up to you. The bundler inlines everything the entry
reaches either way. If a file only registers a module and exports nothing,
import it for its side effect:

```ts
import "./modules/auto-sprint";
```

:::warning

Don't add a second bundler entry point. That produces a second output file.

:::

## Importing another script

A `phaxuser:` import reaches a *different* file in the client's scripts folder.
It's resolved at load time, just like `@protohax/userscript`. The path is
relative to the scripts folder:

```ts
// <scripts>/lib/math.js
import { clamp } from "phaxuser:lib/math.js";

// <scripts>/shared.js
import shared from "phaxuser:shared.js";
```

Use it to **share code between scripts**, like a helper library or a common
config. Don't use it to split one script across files. Anything inside your own
`src/` should be a normal relative import so it gets bundled; `phaxuser:` is for
things that ship as their own file.

This affects your build in two ways.

**Keep the specifier external.** Like the facade, it has to survive into the
output. If it gets bundled, there's nothing left to resolve at load time:

```js
// rollup.config.mjs
external: ["@protohax/userscript", /^phaxuser:/],
```

**Declare it for TypeScript**, which can't resolve the scheme on its own. A
shorthand ambient declaration types every such import as `any`:

```ts
// src/phaxuser.d.ts
declare module "phaxuser:*";
```

For a library you control, declare its shape too. The specific declaration wins
over the wildcard, so you get real type checking back:

```ts
declare module "phaxuser:lib/math.js" {
  export function clamp(value: number, min: number, max: number): number;
}
```

The target script exports things like any other ES module. Just make sure the
file you import actually ships to the scripts folder alongside the script that
imports it.
