---
id: index
title: Getting Started
slug: /guides/getting-started
---

# Getting Started

> Need a project to put this in first? [Project Setup](/guides/project-setup)
> covers the template, the bundler, and where the built file goes.

Every script module is created with a single call:

```ts
import { defineModule, ModuleCategory } from "@protohax/userscript";

defineModule(meta, schema, setup);
```

- **`meta`** — the module's static identity (name, category, …). See
  [Modules](/guides/modules).
- **`schema`** — a plain object declaring the module's options. See
  [Options](/guides/options).
- **`setup`** — a function that wires listeners for one session.

A complete module:

```ts
defineModule(
  { name: "Example", category: ModuleCategory.Client },
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

- **[The Two Phases](/guides/getting-started/two-phases)** — what runs once,
  what runs per session, and why the boundary matters.
- **[The Context](/guides/getting-started/context)** — everything `ctx` can do,
  and when listeners fire.

## Next

- [Modules](/guides/modules) — the `meta` object in full.
- [Options](/guides/options) — the schema: every option kind, nesting, and modes.
- [Events & Packets](/guides/events-and-packets) — the full event and packet maps.
