---
id: module-manager
title: Module Manager
sidebar_position: 8
---

# Module Manager

`moduleManager` is the live registry of every module, both built-in and
scripted. It's a top-level export and the same object the client itself uses, so
your script can inspect other modules and watch their state.

```ts
import { moduleManager } from "@protohax/userscript";
```

You don't need it for your *own* module: read your options directly and use
`ctx`. Use it when your module needs to **work with another module**, e.g. read
its enabled state or options, or react when they change.

## `ModuleManager`

| Member | Type | Description |
| --- | --- | --- |
| `getModule(id)` | `ModuleDefinition \| undefined` | Look up a live module instance by id. |
| `getModules()` | `MapIterator<ModuleDefinition>` | Iterate over all live module instances. |
| `listenChanges(id, callback)` | `() => void` | Call `callback` whenever module `id` spawns or one of its options changes. Returns an unsubscribe function. |
| `events` | `EventEmitter<ModuleEvents>` | Lifecycle and configuration events. |

### `ModuleEvents`

| Event | Payload |
| --- | --- |
| `spawn` | `(module: ModuleDefinition)` |
| `kill` | `(module: ModuleDefinition)` |
| `option_update` | `(module, option, path)` |
| `config_loaded` | `()` |

## `ModuleDefinition`

What `getModule` and `getModules` return:

| Member | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique id. For a built-in's primary instance, this is its name. For a script module, it's [`script:<name>`](/guides/modules#module-ids). |
| `alias` | `string` | Display alias set by the user. |
| `triggerMode` | `ModuleTriggerMode` | `Toggle` or `WhileHeld`. |
| `state` | `Option<boolean>` | Enabled state, as an option. Read or set `.value`; use `.subscribe` to watch it. |
| `get moduleInfo` | `ModuleInfo` | Static identity: `{ name, category, mode }`. `category` is a [`ModuleCategory`](/guides/modules#the-script-category), and is always `Script` for modules registered by a userscript. |
| `get isPrimary` | `boolean` | Whether this is the instance created at registration, which the user can't remove. `false` for clones of an `Atomic` module. |
| `options()` | `MapIterator<Option<any>>` | Iterate over the module's options. |
| `getOption(name)` | `Option<any> \| undefined` | Look up one option by its display name (as shown in the menu). |
| `subscribeOptions(callback)` | `() => void` | Watch every option in the module's tree, including nested children and enum values. `callback` receives `(option, path)`. Returns an unsubscribe function. |

```ts
import { moduleManager } from "@protohax/userscript";

// is the built-in "Kill Aura" module enabled right now?
// Built-in ids are display names, spaces included; script modules are
// namespaced, e.g. "script:My Module".
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

Use `getOption(name)` to get one option by its menu display name, or `options()`
to iterate over all of them. Each returned
[`Option<T>`](/guides/options#reading--observing--optiont) works just like your
own: read `.value`, set `.value` (as if the user changed it in the menu), or call
`.subscribe(...)` to watch it.

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

:::note[Values are untyped]

`getOption` and `options` return `Option<any>`, because another module's options
aren't known at compile time. That makes `.value` an `any`. Cast or check it
where you use it if you need a specific type.

:::

### Nested options

An option can hold a whole subtree: nested `child` options, drawers, and mode
configurables. Two members on `Option` let you reach them:

| Member | Type | Description |
| --- | --- | --- |
| `child` | `Configurable \| undefined` | The option's nested configurable. For an enum or mode selector, this follows the **selected** value's configurable. |
| `getConfigurableValues()` | `Configurable[]` | Every child configurable the option can reach. For a selector, one per choice. |

Each `Configurable` also has `options()`, `getOption(name)` and
`subscribeOptions(...)`, so you can walk or watch a whole tree by display name:

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

You don't need any of this for your **own** module. The schema already gives you
typed handles for the whole tree (see [Options](/guides/options)).

### `ModuleTriggerMode`

```ts
enum ModuleTriggerMode {
  Toggle = "Toggle",
  WhileHeld = "While Held",
}
```
