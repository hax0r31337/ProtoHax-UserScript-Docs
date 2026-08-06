---
id: options
title: Options
sidebar_position: 3
---

# Options

Options are the controls your module exposes in the menu — toggles, sliders,
dropdowns, text fields, color pickers, and whole nested trees of them. You
declare them as a **schema** (the second argument to `defineModule`); the live
handles arrive fully typed on `ctx.options` in your
[setup function](/guides/getting-started/two-phases#phase-2--setupctx).

```ts
defineModule(
  { name: "Example", category: ModuleCategory.Client },
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

A schema is a plain object: **keys** become the handle names on `ctx.options`
(and the default display names in the menu); **values** describe each option.
TypeScript infers everything from the literal — `ctx.options.mode.value` above
is typed `"Spin" | "Pulse" | "Wave"`, no `as const` needed.

### Node kinds

Every node has a `type` field selecting the kind:

| `type` | Handle | Fields |
| --- | --- | --- |
| `"boolean"` | `Option<boolean>` | `def?` (default `false`), [`child?`](#nested-options--child) |
| `"trigger"` | `Option<boolean>` | A button — `subscribe` the handle to react to presses. |
| `"number"` | `Option<number>` | `def`, `min`, `max`, `step?`, `displayResolution?`, `child?` |
| `"number-range"` | `Option<NumberRange>` | Like `number`, but `def` is `{ min, max }` and the handle holds a pair. |
| `"string"` | `Option<string>` | `def?` (default `""`), `child?` |
| `"string-list"` | `Option<string[]>` | `def?` (default `[]`), `child?` |
| `"enum"` | `Option<union of values>` | `values`, `def?` (default `values[0]`) |
| `"multi-enum"` | `Option<Set<union of values>>` | `values`, `def?` (default empty), `child?` |
| `"color"` | `Option<Color>` | `def` — `[r, g, b, a]`, each channel 0–255, `child?` |
| `"comment"` | — | A visual-only text line; the text is `name` (or the key). `icon?`: `"info"`, `"warning"`, `"error"`, `"suggestion"`, `"advanced"`. |
| `"group"` | [`GroupHandle`](#drawers--group) | `options` — a nested schema shown as a drawer. |
| `"modes"` | [`ModesHandle`](#modes) | `modes`, `def?` — choices with their own options and behavior. |
| `"click-scheduler"` | `ClickSchedulerConfigurable` | The host's CPS clicker. See [Combat Helpers](/api/combat-helpers#clicker). |
| `"rotation"` | `RotationHandle` | The host's rotation strategy selector. See [Combat Helpers](/api/combat-helpers#rotation). |
| `"target"` | `TargetConfigurable` | The host's target-selection drawer. See [Combat Helpers](/api/combat-helpers#target-scanning). |
| `"raw"` | the object itself | Escape hatch: embed a pre-constructed host `Option` or `Configurable`. See [Combat Helpers](/api/combat-helpers#raw-nodes--the-escape-hatch). |

For `number` and `number-range`, `displayResolution` is the number of decimal
places shown in the UI; it defaults to the decimals of `step` (or 2 when `step`
is unset), so you rarely write it.

### Keys, `name`, and saved config

Every node accepts an optional `name` that overrides the display name:

```ts
attackRange: { type: "number", name: "Attack Range", def: 4, min: 1, max: 8 },
// menu shows "Attack Range"; code reads ctx.options.attackRange
```

The **display name** (the `name` field, or the key when `name` is unset) is
also the option's *persistence identity* — saved config is keyed on it. That
gives a clean split:

- Renaming a **key** while `name` is set is a pure refactor — saved values
  survive, only your `ctx.options.<key>` references change.
- Changing the **display name** (or the key while `name` is unset) discards
  that option's saved value.

### Hidden options — the `#` prefix

A display name starting with `#` **hides the option from the menu** while
keeping it a fully working option — read/write `.value`, `subscribe`, and it
serializes into the config like any other:

```ts
{
  calibration: { type: "number", name: "#calibration", def: 0, min: -10, max: 10 },
}
```

Use this only for **internal values you want to persist across client
launches** — a calibration figure, a cached choice — not as general storage.
Persistence rides the config system: values are written and restored only when
the user **saves or loads the config**, so treat it as "part of the saved
config, without a widget", not as a database. For state that only needs to
live as long as a session, use
[per-session state](/guides/getting-started/context#per-session-state)
instead.

## Nested options — `child`

Every value-bearing node (`boolean`, `number`, `number-range`, `string`,
`string-list`, `multi-enum`, `color`) accepts a `child` schema. The nested
options appear under the parent in the menu, and the parent handle carries them
under `.child`:

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

`handle.child` is both the typed handles (`child.smoothing`) **and** a
[`Configurable`](#configurables) — so `child.getOption("smoothing")`,
`child.options()`, and `child.subscribeOptions(...)` work too. Children nest
arbitrarily deep.

Note the nesting is visual + organizational: a child option's value is not
gated on the parent toggle. Read the parent's value yourself (as above) if the
child should only apply while the parent is on.

## Drawers — `group`

A `group` is a purely visual drawer around a nested schema. Its handle **is**
the group of child handles (there is no value of its own):

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

When the choices of a dropdown carry **their own options and behavior** — think
of a Velocity module with `Vanilla` and `Reversal` modes — declare a `modes`
node instead of an `enum`. Each mode has an optional `options` schema and an
optional `setup` function; a mode *with* `setup` is **executable**: its setup
runs per session exactly like the module's own, and its listeners and
`onEnable`/`onDisable` hooks fire only while the module is enabled **and** that
mode is selected.

Use the `mode(options, setup)` helper so `ctx.options` is typed inside the
mode's setup (a plain `{ options, setup }` object also works, untyped):

```ts
import { defineModule, mode, ModuleCategory } from "@protohax/userscript";

defineModule(
  { name: "Velocity", category: ModuleCategory.Combat },
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
    // the module's own setup still runs for module-wide concerns
    ctx.onEnable(() => console.log("velocity on, mode:", ctx.options.modus.value));
  },
);
```

Switching modes while the module is enabled fires the outgoing mode's
`onDisable` and the incoming mode's `onEnable` — the same lifecycle as the
module toggle, scoped to the selection.

Each setup (the module's and every mode's) is its own closure. To share
per-session state between them, use
[`utils.sessionLocal`](/guides/getting-started/context#per-session-state).

### `ModesHandle`

The handle for a `modes` node speaks **keys** (display-name overrides never
leak into code):

| Member | Type | Description |
| --- | --- | --- |
| `value` | union of mode keys | The selected mode's key. Assign it to switch modes, as if changed in the UI. |
| `is(mode)` | `boolean` | Whether `mode` is currently selected. |
| `subscribe(listener, notifyFirst?)` | `() => void` | Observe selection changes; returns an unsubscribe fn. |
| `modes` | record of [`Configurable`](#configurables) | Each mode's configurable, keyed like the schema, carrying its option handles — `modus.modes.Reversal.ticks.value` works from anywhere. |
| `option` | `Option<unknown>` | The raw host option backing the selector. |

## Reading & observing — `Option<T>`

Every scalar node's handle is a live `Option<T>`. Because options belong to the
module definition (not the session), the handles are shared across sessions —
`ctx.options` hands you the same objects everywhere.

| Member | Type | Description |
| --- | --- | --- |
| `value` | `T` | The current value. Read it, or **set it** to change the option as if edited in the UI. |
| `name` | `string` | Display name. |
| `defaultValue` | `T` | The value `reset()` restores. |
| `subscribe(listener, notifyFirst?)` | `() => void` | Observe changes; returns an unsubscribe fn. Pass `notifyFirst: true` to fire once immediately. |
| `reset()` | `void` | Restore the default value. |
| `isDefault()` | `boolean` | Whether the current value is the default. |
| `child` | `Configurable \| undefined` | Nested options, when declared (typed via the schema on your own handles). |
| `getConfigurableValues()` | `Configurable[]` | Every child configurable reachable from this option. |
| `get type` | `string` | The option kind, e.g. `"boolean"`, `"number"`. |

### Reading

Read `option.value` inside a listener — it always reflects the current menu
state:

```ts
ctx.on("tick", () => {
  if (ctx.options.speed.value > 0) applySpeed(ctx.options.speed.value);
});
```

### Writing

Setting `option.value` applies the change and notifies subscribers, exactly as
if the user moved the slider:

```ts
ctx.onEnable(() => { ctx.options.speed.value = 1.5; });
```

### Subscribing

To react the moment an option changes (rather than polling each tick):

```ts
(ctx) => {
  const color = ctx.options.color;
  const unsub = color.subscribe(() => rebuildPalette(color.value), true);
  ctx.onDisable(unsub);
};
```

> **Tip — subscriptions vs. `ctx.on`.** `option.subscribe` is not tied to the
> module's enabled state — it fires whenever the value changes. If you only want
> to react while enabled, unsubscribe in `onDisable` (as above), or just read
> `option.value` inside a `ctx.on` listener.

## Configurables

Nested handles (`child`, `group`, each entry of `ModesHandle.modes`) are
`Configurable`s — the same type a module's own option container has:

| Member | Description |
| --- | --- |
| `options()` | Iterate the configurable's options. |
| `getOption(name)` | Look up an option by its **display name**. |
| `subscribeOptions(callback)` | Observe every option in the subtree (nested children and enum values included); `callback` receives the option and its path. Returns an unsubscribe fn. |

On your own module these are redundant with the typed handles; they matter when
traversing **another module's** option tree via the
[`moduleManager`](/api/module-manager#nested-options).

## Definition-scoped wiring

`defineModule` (schema form) **returns the handles record**. The setup function
runs per session, so a `subscribe` inside it registers once *per session*; for
one-time wiring, subscribe on the returned handles instead:

```ts
const opts = defineModule({ /* meta */ }, { /* schema */ }, (ctx) => { /* ... */ });

opts.speed.subscribe(() => console.log("speed:", opts.speed.value)); // once, ever
```

> For `ModuleMode.Atomic` modules the returned record belongs to the initially
> spawned instance only — copies spawned later each get their own options.

## The legacy builder

The original imperative form is still supported (and typed), but deprecated:

```ts
defineModule(meta, (options) => {
  const speed = options.number("Speed", 1, { min: 0, max: 5, step: 0.1, displayResolution: 1 });
  return (ctx) => { /* close over `speed` */ };
});
```

`options` is a `ModuleOptions` with one method per scalar kind —
`boolean(name, def?)`, `number(name, def, props)`, `string(name, def?)`,
`enum(name, values, def?)` (pass `as const` for a literal union),
`color(name, def)`. It cannot declare nested children, groups, or modes —
prefer the schema.
