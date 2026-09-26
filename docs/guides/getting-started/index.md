---
id: index
title: Getting Started
slug: /guides/getting-started
---

# Getting Started

:::tip

Need a project to put this in first? [Project Setup](/guides/project-setup)
covers the template, the bundler, and where the built file goes.

:::

You create every script module with a single call:

```ts
import { defineModule } from "@protohax/userscript";

defineModule(meta, schema, setup);
```

- **`meta`**: the module's static identity (name, mode, …). See
  [Modules](/guides/modules).
- **`schema`**: a plain object that declares the module's options. See
  [Options](/guides/options).
- **`setup`**: a function that wires up listeners for one session.

Here's a complete module:

```ts
defineModule(
  { name: "Example" },
  {
    enabled: { type: "boolean", name: "Feature", def: true },
  },
  (ctx) => {
    ctx.on("tick", () => {
      if (ctx.options.enabled.value) doSomething(ctx);
    });
  },
);
```

## In this section

- [The Two Phases](/guides/getting-started/two-phases): what runs once, what
  runs per session, and why the difference matters.
- [The Context](/guides/getting-started/context): everything `ctx` can do, and
  when listeners fire.

## Next

- [Modules](/guides/modules): the `meta` object in full.
- [Options](/guides/options): the schema, with every option kind, nesting, and modes.
- [Events & Packets](/guides/events-and-packets): the full event and packet maps.
