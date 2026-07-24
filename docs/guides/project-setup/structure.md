---
id: structure
title: Structure & Sharing
---

# Structure & Sharing

## One entry, any number of modules

A module is registered by evaluating a
[`defineModule`](/guides/getting-started) call, so a script can declare as many
as it likes — in the entry file itself, or in files the entry imports:

```ts
// src/index.ts
import { defineModule, ModuleCategory } from "@protohax/userscript";

defineModule(
  { name: "AutoSprint", category: ModuleCategory.Movement },
  {
    speed: { type: "number", def: 1, min: 0, max: 5, step: 0.1 },
  },
  (ctx) => {
    ctx.on("tick", () => ctx.session.entityState.localPlayer.strafe(ctx.options.speed.value, 1));
  },
);
```

Splitting across files is a matter of taste — the bundler inlines everything the
entry reaches either way. If a file only registers a module and exports nothing,
import it for its side effect:

```ts
import "./modules/auto-sprint";
```

What you should *not* do is add a second bundler entry point: that produces a
second output file.

## Importing another script

A `phaxuser:` import reaches a *different* file in the client's scripts folder,
resolved at load time the same way `@protohax/userscript` is. The path is
relative to that folder:

```ts
// <scripts>/lib/math.js  ->
import { clamp } from "phaxuser:lib/math.js";

// <scripts>/shared.js  ->
import shared from "phaxuser:shared.js";
```

Use it for code you want to **share between scripts** — a helper library, a
common config — rather than for splitting one script across files. Everything
inside your own `src/` should be a normal relative import so it gets bundled;
`phaxuser:` is for reaching things that ship as their own file.

Two consequences for the build:

**Keep the specifier external.** Like the facade, it must survive into the
output — bundle it and there is nothing left to resolve:

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

For a library you control, declare its shape too — the specific declaration wins
over the wildcard, and you get real type checking back:

```ts
declare module "phaxuser:lib/math.js" {
  export function clamp(value: number, min: number, max: number): number;
}
```

The target script exports what any ES module does; make sure the file you are
importing actually ships to the scripts folder alongside the one importing it.
