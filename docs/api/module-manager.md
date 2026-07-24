---
id: module-manager
title: Module Manager
sidebar_position: 7
---

# Module Manager

`moduleManager` is the live registry of every module — built-in and scripted. It
is a top-level export (the same singleton the client uses), so you can inspect
other modules and observe their state from your script.

```ts
import { moduleManager } from "@protohax/userscript";
```

You normally don't touch it for your *own* module (you read options directly and
use `ctx`). Reach for it when a module needs to **coordinate with another
module** — read its enabled state or options, or react to it changing.

## `ModuleManager`

| Member | Signature | Description |
| --- | --- | --- |
| `getModule(id)` | `ModuleDefinition \| undefined` | Look up a live module instance by id. |
| `getModules()` | `MapIterator<ModuleDefinition>` | Iterate all live module instances. |
| `listenChanges(id, callback)` | `() => void` | Run `callback` whenever module `id` spawns or one of its options changes. Returns an unsubscribe fn. |
| `events` | `EventEmitter<ModuleEvents>` | Lifecycle/configuration events. |

### `ModuleEvents`

| Event | Payload |
| --- | --- |
| `spawn` | `(module: ModuleDefinition)` |
| `kill` | `(module: ModuleDefinition)` |
| `option_update` | `(module, option, path)` |
| `config_loaded` | `()` |

## `ModuleDefinition`

What `getModule` / `getModules` hand back:

| Member | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique id (equals the name for singletons). |
| `alias` | `string` | User-assigned display alias. |
| `triggerMode` | `ModuleTriggerMode` | `Toggle` or `WhileHeld`. |
| `state` | `Option<boolean>` | Enabled state as an option — read/set `.value`, `.subscribe` to observe. |
| `get moduleInfo` | `ModuleInfo` | Static identity: `{ name, category, mode }`. |
| `options()` | `MapIterator<Option<any>>` | Iterate the module's options. |
| `getOption(name)` | `Option<any> \| undefined` | Look up one option by its display name (as shown in the menu). |
| `subscribeOptions(callback)` | `() => void` | Observe every option in the module's tree, nested children and enum values included; `callback` receives `(option, path)`. Returns an unsubscribe fn. |

```ts
import { moduleManager } from "@protohax/userscript";

// is the built-in "Kill Aura" module enabled right now?
// (a singleton's id is its display name, spaces and all)
const killaura = moduleManager.getModule("Kill Aura");
if (killaura?.state.value) {
  // ...
}

// react to another module toggling
const unsubscribe = moduleManager.listenChanges("Kill Aura", () => {
  console.log("Kill Aura changed");
});
```

### Reading and writing a module's options

Each module hands back its options through `getOption(name)` (by the display name
shown in the menu) and `options()` (iterate them all). The returned
[`Option<T>`](/guides/options#reading--observing--optiont) works exactly like your
own — read `.value`, set `.value` (as if the user edited the menu), or
`.subscribe(...)` to observe.

```ts
import { moduleManager } from "@protohax/userscript";

const killaura = moduleManager.getModule("Kill Aura");

// read/write a single option by name
const swing = killaura?.getOption("Swing"); // Option<any> | undefined
if (swing) {
  console.log("swing enabled:", swing.value);
  swing.value = false;
}

// or walk every option on the module
for (const opt of killaura?.options() ?? []) {
  console.log(opt.name, "=", opt.value);
}
```

> **Note — untyped values.** `getOption`/`options` return `Option<any>` (the
> module's options aren't known at compile time), so `.value` is `any`. Cast or
> check at the call site if you need a specific type.

### Nested options

Options can carry whole subtrees — nested `child` options, drawers, and mode
configurables. Two members on `Option` open them up:

| Member | Type | Description |
| --- | --- | --- |
| `child` | `Configurable \| undefined` | The option's nested configurable. For an enum/mode selector this tracks the **selected** value's configurable. |
| `getConfigurableValues()` | `Configurable[]` | Every child configurable reachable from the option — for a selector, one per choice. |

Each `Configurable` again has `options()`, `getOption(name)`, and
`subscribeOptions(...)`, so you can walk (or observe) a tree by display names:

```ts
const velocity = moduleManager.getModule("Velocity");

// the mode selector, and the selected mode's options
const mode = velocity?.getOption("Mode");
const ticks = mode?.child?.getOption("Ticks");
if (ticks) ticks.value = 0;

// or observe everything under the module at once
const unsub = velocity?.subscribeOptions((option, path) => {
  console.log(path.map((p) => p.name).join("/"), "=", option.value);
});
```

For your **own** module none of this is needed — the schema hands you typed
handles for the whole tree (see [Options](/guides/options)).

`ModuleTriggerMode`:

```ts
enum ModuleTriggerMode {
  Toggle = "Toggle",
  WhileHeld = "While Held",
}
```
