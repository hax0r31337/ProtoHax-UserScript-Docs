---
id: options
title: Options
sidebar_position: 3
---

# Options

Options are the controls your module shows in the menu: toggles, sliders,
dropdowns, text fields, color pickers, and nested trees of them. You declare
them as a **schema** (the second argument to `defineModule`). The live handles
then show up, fully typed, on `ctx.options` in your
[setup function](/guides/getting-started/two-phases#phase-2--setupctx).

```ts
defineModule(
  { name: "Example" },
  {
    enabled: { type: "boolean", name: "Particles", def: true },
    count:   { type: "number", def: 8, min: 1, max: 64, step: 1 },
    mode:    { type: "enum", values: ["Spin", "Pulse", "Wave"] },
    color:   { type: "color", name: "Tint", def: [255, 0, 0, 255] },
  },
  (ctx) => {
    ctx.on("tick", () => {
      if (!ctx.options.enabled.value) return;
      render(ctx.options.count.value, ctx.options.mode.value, ctx.options.color.value);
    });
  },
);
```

## The schema — `OptionsSchema`

A schema is a plain object:

- **Keys** become the handle names on `ctx.options`, and the default display
  names in the menu.
- **Values** describe each option.

TypeScript infers everything from the object literal. Above,
`ctx.options.mode.value` is typed `"Spin" | "Pulse" | "Wave"` without any
`as const`.

### Node kinds

Every node has a `type` field that picks its kind:

| `type` | Handle | Fields |
| --- | --- | --- |
| `"boolean"` | `Option<boolean>` | `def?` (default `false`), [`child?`](#nested-options--child) |
| `"trigger"` | `Option<boolean>` | A button. `subscribe` to the handle to react to presses. |
| `"number"` | `Option<number>` | `def`, `min`, `max`, `step?`, `displayResolution?`, `child?` |
| `"number-range"` | `Option<NumberRange>` | Like `number`, but `def` is `{ min, max }` and the handle holds a pair. |
| `"string"` | `Option<string>` | `def?` (default `""`), `child?` |
| `"string-list"` | `Option<string[]>` | `def?` (default `[]`), `child?` |
| `"enum"` | `Option<union of values>` | `values`, `def?` (default `values[0]`) |
| `"multi-enum"` | `Option<Set<union of values>>` | `values`, `def?` (default empty), `child?` |
| `"color"` | `Option<Color>` | `def` as `[r, g, b, a]`, each channel 0–255; `child?` |
| `"keybind"` | `KeybindHandle` | A key the player picks. `def?` (default `0`, unbound), `listener?`, `child?`. See [Keybinds](#keybinds). |
| `"toggle-keybind"` | `ToggleKeybindHandle` | A key driving an on/off state. `def?`, `state?` (default `false`), `mode?` (default `"toggle"`), `listener?`, `child?`. See [Toggle keybinds](#toggle-keybinds). |
| `"comment"` | — | A text line, display only. The text is `name` (or the key). `icon?`: `"info"`, `"warning"`, `"error"`, `"suggestion"`, `"advanced"`. |
| `"group"` | [`GroupHandle`](#drawers--group) | `options`: a nested schema shown as a drawer. |
| `"modes"` | [`ModesHandle`](#modes) | `modes`, `def?`: choices with their own options and behavior. |
| `"click-scheduler"` | `ClickSchedulerConfigurable` | The host's CPS clicker. See [Combat Helpers](/api/combat-helpers#clicker). |
| `"rotation"` | `RotationHandle` | The host's rotation strategy selector. See [Combat Helpers](/api/combat-helpers#rotation). |
| `"target"` | `TargetConfigurable` | The host's target-selection drawer. See [Combat Helpers](/api/combat-helpers#target-scanning). |
| `"hud-placement"` | `HudPlacementConfigurable` | A HUD widget's position and scale, hidden from the menu and saved with the config. `def?`. See [HUD Placement](/ui/hud-placement#saving-the-placement--hud-placement). |
| `"raw"` | the object itself | Escape hatch: embed a pre-built host `Option` or `Configurable`. See [Combat Helpers](/api/combat-helpers#raw-nodes--the-escape-hatch). |

For `number` and `number-range`, `displayResolution` is how many decimal places
the UI shows. It defaults to the number of decimals in `step` (or 2 if `step`
isn't set), so you'll rarely need it.

### Keys, `name`, and saved config

Any node can take an optional `name` to override its display name:

```ts
attackRange: { type: "number", name: "Attack Range", def: 4, min: 1, max: 8 },
// menu shows "Attack Range"; code reads ctx.options.attackRange
```

The **display name** (`name`, or the key if `name` isn't set) is also what
saved config is keyed on. That means:

- Renaming a **key** while `name` is set is a safe refactor. Saved values are
  kept; only your `ctx.options.<key>` references change.
- Changing the **display name** (or the key when `name` isn't set) loses that
  option's saved value.

### Hidden options — the `#` prefix

If a display name starts with `#`, the option is **hidden from the menu** but
still works normally. You can read and write `.value`, `subscribe` to it, and it
is saved in the config like any other option:

```ts
{
  calibration: { type: "number", name: "#calibration", def: 0, min: -10, max: 10 },
}
```

Only use this for **internal values that should persist across client
launches**, like a calibration figure or a cached choice. It's not general
storage.

:::note

Hidden options persist through the config system, so values are only written
and restored when the user **saves or loads the config**. Think of it as "part
of the saved config, without a widget", not as a database. For state that only
needs to last one session, use
[per-session state](/guides/getting-started/context#per-session-state) instead.

:::

## Nested options — `child`

Every value-bearing node (`boolean`, `number`, `number-range`, `string`,
`string-list`, `multi-enum`, `color`, `keybind`, `toggle-keybind`) accepts a `child` schema. The nested
options appear under the parent in the menu, and the parent handle exposes them
as `.child`:

```ts
{
  rotate: { type: "boolean", def: true, child: {
    smoothing: { type: "number", def: 10, min: 1, max: 20, step: 1 },
  } },
},
(ctx) => {
  ctx.on("tick", () => {
    if (ctx.options.rotate.value) {
      applyRotation(ctx.options.rotate.child.smoothing.value);
    }
  });
}
```

`handle.child` gives you the typed handles (`child.smoothing`) **and** is a
[`Configurable`](#configurables), so `child.getOption("smoothing")`,
`child.options()`, and `child.subscribeOptions(...)` also work. Children can
nest as deep as you like.

:::note

Nesting is only visual and organizational. A child's value isn't gated on the
parent toggle. If the child should only apply while the parent is on, check the
parent's value yourself, as above.

:::

## Drawers — `group`

A `group` is a visual drawer around a nested schema. Its handle **is** the set
of child handles; it has no value of its own:

```ts
{
  visuals: { type: "group", options: {
    color: { type: "color", def: [255, 0, 0, 255] },
    width: { type: "number", def: 2, min: 1, max: 10, step: 1 },
  } },
},
(ctx) => {
  ctx.options.visuals.color.value; // Color
  ctx.options.visuals.width.value; // number
}
```

## Modes

Sometimes each choice in a dropdown needs **its own options and behavior**.
Think of a Velocity module with `Vanilla` and `Reversal` modes. For that,
declare a `modes` node instead of an `enum`.

Each mode can have an `options` schema and a `setup` function, both optional. A
mode *with* `setup` is **executable**:

- Its setup runs per session, just like the module's own.
- Its listeners and `onEnable`/`onDisable` hooks only fire while the module is
  enabled **and** that mode is selected.

Wrap modes in the `mode(options, setup)` helper so `ctx.options` is typed inside
the mode's setup. A plain `{ options, setup }` object also works, but untyped.

```ts
import { defineModule, mode } from "@protohax/userscript";

defineModule(
  { name: "Velocity" },
  {
    modus: { type: "modes", def: "Reversal", modes: {
      // no setup: just a choice (with or without its own options)
      Vanilla: {},

      // setup only: behavior without options
      Cancel: mode((ctx) => {
        ctx.onPacket("set_entity_motion", (packet) => { packet.isCancelled = true; });
      }),

      // options + setup: the full shape
      Reversal: mode({
        ticks: { type: "number", def: 2, min: 0, max: 5, step: 1 },
      }, (ctx) => {
        // ctx.options here are the MODE's options
        ctx.on("movement_tick", (state) => applyReversal(state, ctx.options.ticks.value));
        ctx.onEnable(() => { /* module on AND Reversal selected */ });
      }),
    } },
  },
  (ctx) => {
    // the module's own setup still runs, for module-wide logic
    ctx.onEnable(() => console.log("velocity on, mode:", ctx.options.modus.value));
  },
);
```

Switching modes while the module is enabled fires `onDisable` on the old mode
and `onEnable` on the new one. It's the same lifecycle as the module toggle,
just scoped to the selection.

Each setup (the module's and every mode's) is its own closure. To share
per-session state between them, use
[`utils.sessionLocal`](/guides/getting-started/context#per-session-state).

### `ModesHandle`

The handle for a `modes` node works with **keys**. Display-name overrides never
show up in code.

| Member | Type | Description |
| --- | --- | --- |
| `value` | union of mode keys | The selected mode's key. Assign to it to switch modes, as if changed in the UI. |
| `is(mode)` | `boolean` | Whether `mode` is currently selected. |
| `subscribe(listener, notifyFirst?)` | `() => void` | Watch for selection changes. Returns an unsubscribe function. |
| `modes` | record of [`Configurable`](#configurables) | Each mode's configurable, keyed like the schema, with its option handles. `modus.modes.Reversal.ticks.value` works from anywhere. |
| `option` | `Option<unknown>` | The raw host option behind the selector. |

## Keybinds

A `keybind` option lets the player pick a key, the same way they bind a key to
a module. Its `listener` is called each time the bind is pressed:

```ts
defineModule(
  { name: "Ping" },
  {
    bind: { type: "keybind", name: "Ping Key", listener: () => console.log("ping!") },
  },
  () => {},
);
```

The bind is pressed in two ways:

- **By its key**, when the key goes down outside the menu. Holding the key
  down doesn't press it again.
- **By its shortcut**, on Android. Next to the option in the menu there is a
  bookmark button, which puts a shortcut for it on the HUD, the same as a
  module's shortcut. Tapping the shortcut presses the bind, so it works
  without a keyboard.

The handle is a `KeybindHandle`, an `Option<number>` with two more members:

| Member | Type | Description |
| --- | --- | --- |
| `listener` | `(() => void) \| undefined` | Called on each press. Assign it to set or replace the listener from your code. |
| `press()` | `void` | Press the bind from your code, as its key or shortcut does. |

The listener belongs to the option, not to a session. It's called whether or
not the module is enabled, and there's only one per option. To react only while
the module is on, or to reach things from your setup like `ctx.session` or a
widget, set it in `onEnable` and clear it in `onDisable`:

```ts
(ctx) => {
  ctx.onEnable(() => {
    ctx.options.bind.listener = () => ctx.session.entityState.localPlayer.sendChatMessage("ping!");
  });
  ctx.onDisable(() => {
    ctx.options.bind.listener = undefined;
  });
}
```

The [`key` event](/guides/events-and-packets#key--keyboard-input) still
reports every key if you need more than presses, such as releases. Compare the
`keyId` it gives with the option's `value`. Unlike the listener, it never sees
the Android shortcut.

The value is a key id, a `number`: Flutter's
[`LogicalKeyboardKey.keyId`](https://api.flutter.dev/flutter/services/LogicalKeyboardKey-class.html),
the same id the `key` event reports. `0` means unbound. Compare ids, there's
no need to know what they are. If you want a default key, these are the
common ones:

| Key | Id |
| --- | --- |
| Letters `a`–`z` | Their lowercase character code: `a` is `0x61`, `z` is `0x7a`. |
| Digits `0`–`9` | Their character code: `0` is `0x30`, `9` is `0x39`. |
| Space | `0x20` |
| Enter, Tab, Backspace, Escape | `0x10000000d`, `0x100000009`, `0x100000008`, `0x10000001b` |
| Arrow down, left, right, up | `0x100000301`, `0x100000302`, `0x100000303`, `0x100000304` |
| F1–F12 | `0x100000801` to `0x10000080c` |
| Shift, Control, Alt, Meta | `0x2000001f2`, `0x2000001f0`, `0x2000001f4`, `0x2000001f6` |

Modifier keys are reported without a side: left and right Shift are both
Shift.

```ts
bind: { type: "keybind", def: 0x67 }, // G
```

:::note[Picking a key needs a keyboard]

The key picker is only shown on desktop, or on Android with keyboard input
turned on in the menu settings. Without it, Android still shows the option
with its shortcut button. The key the option holds is kept and saved with the
config either way.

:::

### Toggle keybinds

A `toggle-keybind` option is a keybind with an on/off `state`. The player picks
the key, and also picks its mode from a button next to it in the menu:

- `"toggle"`: each press flips the state, like a module in Toggle mode. The
  state is saved with the config, and the menu shows a switch for it.
- `"while-held"`: the state is on while the key, or the shortcut, is held down,
  and turns off when it's released. Switching to this mode turns the state off,
  and the state isn't saved.

The `listener` is called with the new state each time it changes, for whatever
reason: a press, a release, the switch, a config load or reset, or your own
code setting `state`.

```ts
defineModule(
  { name: "Zoom" },
  {
    zoom: {
      type: "toggle-keybind",
      name: "Zoom",
      def: 0x63, // C
      mode: "while-held",
      listener: (on) => console.log(on ? "zoom in" : "zoom out"),
    },
  },
  (ctx) => {
    ctx.on("tick", () => {
      if (!ctx.options.zoom.state) return;
      // zoomed in
    });
  },
);
```

`state?` is the initial state in `"toggle"` mode, and `mode?` is only the
default: the player can change it.

The handle is a `ToggleKeybindHandle`, an `Option<number>` holding the key id,
with:

| Member | Type | Description |
| --- | --- | --- |
| `state` | `boolean` | The current state. Set it to change it; the listener is called. |
| `mode` | `"toggle" \| "while-held"` | The mode the player picked. Set it to change it. |
| `listener` | `((state: boolean) => void) \| undefined` | Called with each new state. |
| `press()` | `void` | Press the bind: flips the state, or turns it on in `"while-held"` mode. |
| `release()` | `void` | Release the bind: turns the state off in `"while-held"` mode. |

The `subscribe` of the handle also fires on a change of `state` or `mode`, as
well as of the key. Like `keybind`'s, the listener belongs to the option and
runs whether or not the module is enabled.

## Reading & observing — `Option<T>`

Every scalar node's handle is a live `Option<T>`. Options belong to the module
definition, not the session, so the handles are shared across sessions:
`ctx.options` gives you the same objects every time.

| Member | Type | Description |
| --- | --- | --- |
| `value` | `T` | The current value. Read it, or **set it** to change the option as if edited in the UI. |
| `name` | `string` | Display name. |
| `defaultValue` | `T` | The value `reset()` restores. |
| `subscribe(listener, notifyFirst?)` | `() => void` | Watch for changes. Returns an unsubscribe function. Pass `notifyFirst: true` to also fire once right away. |
| `reset()` | `void` | Restore the default value. |
| `isDefault()` | `boolean` | Whether the current value is the default. |
| `child` | `Configurable \| undefined` | Nested options, if declared (typed from the schema on your own handles). |
| `getConfigurableValues()` | `Configurable[]` | Every child configurable reachable from this option. |
| `get type` | `string` | The option kind, e.g. `"boolean"`, `"number"`. |

### Reading

Read `option.value` inside a listener. It always matches what's in the menu
right now:

```ts
ctx.on("tick", () => {
  if (ctx.options.speed.value > 0) applySpeed(ctx.options.speed.value);
});
```

### Writing

Setting `option.value` applies the change and notifies subscribers, exactly as
if the user had moved the slider:

```ts
ctx.onEnable(() => { ctx.options.speed.value = 1.5; });
```

### Subscribing

To react the moment an option changes, instead of checking every tick:

```ts
(ctx) => {
  const color = ctx.options.color;
  const unsub = color.subscribe(() => rebuildPalette(color.value), true);
  ctx.onDisable(unsub);
};
```

:::tip[Subscriptions vs. `ctx.on`]

`option.subscribe` isn't tied to whether the module is enabled. It fires
whenever the value changes. If you only care while the module is on, either
unsubscribe in `onDisable` (as above) or just read `option.value` inside a
`ctx.on` listener.

:::

## Configurables

Nested handles (`child`, `group`, and each entry of `ModesHandle.modes`) are
`Configurable`s, the same type as a module's own option container:

| Member | Description |
| --- | --- |
| `options()` | Iterate over the configurable's options. |
| `getOption(name)` | Look up an option by its **display name**. |
| `subscribeOptions(callback)` | Watch every option in the subtree, including nested children and enum values. `callback` gets the option and its path. Returns an unsubscribe function. |

On your own module you won't need these, since the typed handles do the same
job. They're useful for walking **another module's** option tree through the
[`moduleManager`](/api/module-manager#nested-options).

## Definition-scoped wiring

In the schema form, `defineModule` **returns the handles record**.

Because setup runs per session, a `subscribe` inside it registers once *per
session*. For wiring that should happen only once, subscribe on the returned
handles instead:

```ts
const opts = defineModule({ /* meta */ }, { /* schema */ }, (ctx) => { /* ... */ });

opts.speed.subscribe(() => console.log("speed:", opts.speed.value)); // once, ever
```

:::note

For `ModuleMode.Atomic` modules, the returned record belongs only to the first
instance. Copies spawned later each get their own options.

:::

## The legacy builder

The original imperative form still works (and is typed), but it's deprecated:

```ts
defineModule(meta, (options) => {
  const speed = options.number("Speed", 1, { min: 0, max: 5, step: 0.1, displayResolution: 1 });
  return (ctx) => { /* close over `speed` */ };
});
```

`options` is a `ModuleOptions` with one method per scalar kind:

- `boolean(name, def?)`
- `number(name, def, props)`
- `string(name, def?)`
- `enum(name, values, def?)` (pass `as const` to get a literal union)
- `color(name, def)`

It can't declare nested children, groups, or modes, so prefer the schema.
