---
id: modules
title: Modules
sidebar_position: 2
---

# Modules

The first argument to `defineModule` is the module's **static identity** — a
`ModuleMeta`. It decides how the module appears and behaves in the client menu.

```ts
import { defineModule, ModuleMode } from "@protohax/userscript";

defineModule(
  {
    name: "AutoClicker",
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
| `name` | `string` | — (required) | Unique display name. Also what the module's [id](#module-ids) is built from. |
| `mode` | [`ModuleMode`](#modulemode) | `Singleton` | Whether one instance exists or many. |
| `togglable` | `boolean` | `true` | Whether the module can be toggled on/off. |
| `defaultState` | `boolean` | `false` | Initial enabled state for a togglable module. |

## The `Script` category

There is no `category` field. **Every module you register with `defineModule`
is filed under the `Script` category** in the client menu — one place the user
can look to see everything their userscripts added, separate from the built-in
`Combat` / `Movement` / `Utility` / `Client` / `HUD` groups.

The `ModuleCategory` enum is still exported, since it is the type of
`ModuleInfo.category` when you inspect modules through the
[`moduleManager`](/api/module-manager):

```ts
enum ModuleCategory {
  Combat   = "Combat",
  Movement = "Movement",
  Utility  = "Utility",
  Client   = "Client",
  HUD      = "HUD",
  Script   = "Script",  // every defineModule module
}
```

:::note[Changed in 0.3.0]

`ModuleMeta.category` used to be required, and picked any of the built-in
groups. It has been removed. Drop it from your `defineModule` calls — the
modules will move to the **Script** category on their own.

:::

## Module ids

Every instance your module spawns is namespaced under `script:`. The instance
created when the module registers gets `script:<name>`; extra instances of an
`Atomic` module get `script:<random>`. Built-in modules are not namespaced —
their primary instance's id is simply the module name.

```ts
defineModule({ name: "Auto Sprint" }, { /* … */ }, (ctx) => { /* … */ });

moduleManager.getModule("script:Auto Sprint"); // yours
moduleManager.getModule("Kill Aura");          // built-in
```

The namespace is what lets the client tell your settings apart from a built-in
module's in a saved config. **Config for a script that is not installed is kept,
not discarded**: uninstall a module's script, load and re-save your config, put
the script back, and its options come back with it. The same holds if you flip a
module between `Singleton` and `Atomic` — the extra instances are parked while
the module is a singleton and restored if it goes back to `Atomic`.

:::warning

Renaming a module changes its id, and the client has no way to connect the new
id to the old one. Its saved options, keybind and shortcut stay behind under the
old name.

:::

## `ModuleMode`

```ts
enum ModuleMode {
  Atomic,     // may be spawned multiple times, each with a distinct id
  Singleton,  // exactly one instance (the default)
}
```

- **`Singleton`** — the common case. One instance, with the id
  `script:<name>`. You cannot spawn a second copy.
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
