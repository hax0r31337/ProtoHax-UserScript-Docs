---
id: modules
title: Modules
sidebar_position: 2
---

# Modules

The first argument to `defineModule` is the module's **static identity**, a
`ModuleMeta`. It controls how the module looks and behaves in the client menu.

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
| `name` | `string` | — (required) | Unique display name. The module's [id](#module-ids) is built from it. |
| `mode` | [`ModuleMode`](#modulemode) | `Singleton` | Whether there's one instance or many. |
| `togglable` | `boolean` | `true` | Whether the module can be toggled on and off. |
| `defaultState` | `boolean` | `false` | Starting enabled state for a togglable module. |

## The `Script` category

There's no `category` field. **Every module you register with `defineModule`
goes in the `Script` category** in the client menu. That gives users one place
to find everything their userscripts added, separate from the built-in
`Combat` / `Movement` / `Utility` / `Client` / `HUD` groups.

The `ModuleCategory` enum is still exported. It's the type of
`ModuleInfo.category`, which you'll see when inspecting modules through the
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

`ModuleMeta.category` used to be required and let you pick any built-in group.
It's been removed. Drop it from your `defineModule` calls, and your modules
will move to the **Script** category on their own.

:::

## Module ids

Every instance of your module gets an id under the `script:` namespace:

- The instance created at registration is `script:<name>`.
- Extra instances of an `Atomic` module are `script:<random>`.

Built-in modules have no namespace; their main instance's id is just the module
name.

```ts
defineModule({ name: "Auto Sprint" }, { /* … */ }, (ctx) => { /* … */ });

moduleManager.getModule("script:Auto Sprint"); // yours
moduleManager.getModule("Kill Aura");          // built-in
```

The namespace lets the client tell your settings apart from a built-in module's
in a saved config.

**Config for a script that isn't installed is kept, not thrown away.** If you
uninstall a script, load and re-save your config, then put the script back, its
options come back too. The same goes for switching a module between `Singleton`
and `Atomic`: the extra instances are set aside while it's a singleton and
restored if it goes back to `Atomic`.

:::warning

Renaming a module changes its id, and the client can't link the new id to the
old one. Its saved options, keybind, and shortcut stay behind under the old
name.

:::

## `ModuleMode`

```ts
enum ModuleMode {
  Atomic,     // can be spawned multiple times, each with its own id
  Singleton,  // exactly one instance (the default)
}
```

- **`Singleton`**: the common case. One instance, with the id `script:<name>`.
  You can't spawn a second copy.
- **`Atomic`**: the module can be spawned several times, each copy with its own
  id (managed through the [`moduleManager`](/api/module-manager)). Use it when
  users may want several independent copies.

## Togglable vs. non-togglable

A **togglable** module has an on/off switch. Its listeners only fire while it's
on (see [The Context](/guides/getting-started/context#listeners-only-fire-while-enabled)),
and `onEnable`/`onDisable` fire each time it's switched.

Set `togglable: false` for a module that's always "on" as long as it exists. It
has no switch, and its listeners run for the whole session.

## Reacting to option changes globally

Inside a session, you read options directly (`option.value`) and watch them
with `option.subscribe(...)`. See [Options](./options).

To react from *outside* a session, for example when another module needs to
coordinate with this one as it spawns or its options change, use the
[`moduleManager`](/api/module-manager): `moduleManager.listenChanges(id, cb)`
and `moduleManager.events`.
