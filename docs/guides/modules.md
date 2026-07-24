---
id: modules
title: Modules
sidebar_position: 2
---

# Modules

The first argument to `defineModule` is the module's **static identity** — a
`ModuleMeta`. It decides how the module appears and behaves in the client menu.

```ts
import { defineModule, ModuleCategory, ModuleMode } from "@protohax/userscript";

defineModule(
  {
    name: "AutoClicker",
    category: ModuleCategory.Combat,
    mode: ModuleMode.Singleton, // default
    togglable: true,            // default
    defaultState: false,        // default
  },
  { /* schema */ },
  (ctx) => { /* ... */ },
);
```

## `ModuleMeta`

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `name` | `string` | — (required) | Unique display name. Also the module's id for singleton modules. |
| `category` | [`ModuleCategory`](#modulecategory) | — (required) | Which menu group it appears under. |
| `mode` | [`ModuleMode`](#modulemode) | `Singleton` | Whether one instance exists or many. |
| `togglable` | `boolean` | `true` | Whether the module can be toggled on/off. |
| `defaultState` | `boolean` | `false` | Initial enabled state for a togglable module. |

## `ModuleCategory`

The menu group the module is filed under:

```ts
enum ModuleCategory {
  Combat   = "Combat",
  Movement = "Movement",
  Utility  = "Utility",
  Client   = "Client",
  HUD      = "HUD",
}
```

## `ModuleMode`

```ts
enum ModuleMode {
  Atomic,     // may be spawned multiple times, each with a distinct id
  Singleton,  // exactly one instance (the default); its id is the module name
}
```

- **`Singleton`** — the common case. One instance, and its `id` is the module
  `name`. You cannot spawn a second copy.
- **`Atomic`** — the module can be spawned multiple times with distinct ids
  (managed via the [`moduleManager`](/api/module-manager)). Use this for modules
  the user may want several independent copies of.

## Togglable vs. non-togglable

A **togglable** module has an on/off switch; its listeners fire only while on
(see [The Context](/guides/getting-started/context#listeners-only-fire-while-enabled)),
and `onEnable`/`onDisable` fire on each transition.

Set `togglable: false` for a module that is always "on" as long as it exists —
it has no switch, and its listeners run for the whole life of the session.

## Reacting to option changes globally

Inside a session you read options directly (`option.value`) and observe them
with `option.subscribe(...)` — see [Options](./options). If you need to react to
a module spawning or its options changing from *outside* a session (e.g. another
module coordinating with it), use the
[`moduleManager`](/api/module-manager) — `moduleManager.listenChanges(id, cb)`
and `moduleManager.events`.
