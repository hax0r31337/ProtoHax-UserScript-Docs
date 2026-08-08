---
id: two-phases
title: The Two Phases
---

# The Two Phases

Authoring mirrors the host's own definition/instance split. There are two
distinct phases, and understanding the boundary between them is the key to
writing correct modules.

```ts
defineModule(
  { name: "Example" },

  // ── Phase 1: the schema — interpreted ONCE at registration ──
  {
    // Declares the options. These are shared by every session.
    enabled: { type: "boolean", name: "Feature", def: true },
  },

  // ── Phase 2: setup(ctx) — runs PER SESSION ──
  (ctx) => {
    // Wire listeners against `ctx`. A fresh ctx is created for each
    // session the module runs in; `ctx.options` carries the live option
    // handles, typed from the schema.
    ctx.on("tick", () => {
      if (ctx.options.enabled.value) doSomething(ctx);
    });
  },
);
```

## Phase 1 — the schema

Interpreted **once**, when the module is registered with the client. It
**declares the options** the module exposes in the menu — including nested
options, drawers, and [modes](/guides/options#modes) with per-mode behavior.
Because declaration happens once, the option handles are shared across every
session — reading `option.value` inside a listener always sees the current menu
value.

## Phase 2 — `setup(ctx)`

Runs **once per session** (a session is one connection to a server). It receives
a fresh [`ModuleContext`](/guides/getting-started/context) — `ctx` — whose
`session` is that session and whose `options` are the handles declared by the
schema. Everything you subscribe through `ctx` is automatically **bound and
torn down with the session**; you never unsubscribe by hand.

## The legacy builder

Scripts written against the original two-argument form —
`defineModule(meta, (options) => (ctx) => { ... })` — keep working. It is
deprecated in favor of the schema; see
[Options → The legacy builder](/guides/options#the-legacy-builder).
