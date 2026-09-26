---
id: two-phases
title: The Two Phases
---

# The Two Phases

A module has two phases, mirroring how the host itself splits definitions from
instances. Knowing what runs in each one is the key to writing correct modules.

```ts
defineModule(
  { name: "Example" },

  // ── Phase 1: the schema — interpreted ONCE at registration ──
  {
    enabled: { type: "boolean", name: "Feature", def: true },
  },

  // ── Phase 2: setup(ctx) — runs PER SESSION ──
  (ctx) => {
    // A fresh ctx for each session; ctx.options is shared and typed from the schema.
    ctx.on("tick", () => {
      if (ctx.options.enabled.value) doSomething(ctx);
    });
  },
);
```

## Phase 1 — the schema

The schema is interpreted **once**, when the module registers with the client.
It declares the options the module shows in the menu, including nested options,
drawers, and [modes](/guides/options#modes) with their own behavior.

Since this happens only once, every session shares the same option handles.
Reading `option.value` inside a listener always gives you the current menu
value.

## Phase 2 — `setup(ctx)`

Setup runs **once per session**. A session is one connection to a server.

Each time, it gets a fresh [`ModuleContext`](/guides/getting-started/context),
called `ctx`:

- `ctx.session` is that session.
- `ctx.options` holds the handles declared by the schema.

Everything you subscribe through `ctx` is bound to the session and **torn down
with it automatically**. You never unsubscribe by hand.

## The legacy builder

Scripts written with the original two-argument form,
`defineModule(meta, (options) => (ctx) => { ... })`, still work. It's
deprecated in favor of the schema. See
[Options → The legacy builder](/guides/options#the-legacy-builder).
