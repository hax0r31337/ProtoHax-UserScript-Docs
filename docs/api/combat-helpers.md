---
id: combat-helpers
title: Combat Helpers
sidebar_position: 9
---

# Combat Helpers

The built-in combat modules share some machinery: target selection, humanized
clicking, and rotation strategies. Your scripts can use it too, either as
**schema nodes** (which show the same options the built-in modules do) or as
importable values.

```ts
import { defineModule, targets } from "@protohax/userscript";

defineModule(
  { name: "MyAura" },
  {
    click:    { type: "click-scheduler" },
    target:   { type: "target", range: 3, maxRange: 10, wallRange: 2, hurtTime: true },
    rotation: { type: "rotation" },
  },
  (ctx) => { /* see the sections below */ },
);
```

## The Targets module

`targets()` returns the live **Targets** module. It holds the user's shared
target settings (entity kinds, anti-bot, team) that every combat module checks.
Use it so your module targets the same things the built-ins do.

| Member | Type | Description |
| --- | --- | --- |
| `isTarget(entity, attackIntent?)` | `boolean` | Whether `entity` is a valid target under the user's settings. Pass `attackIntent: false` to skip the team check (e.g. for highlighting). |
| `notifyTarget(entity)` | `void` | Report that you attacked `entity`. It becomes the *active target*, which drives TargetHud and the target events below. |
| `isActiveTarget(entity)` | `boolean` | Whether `entity` is currently the active target in its session. |

It's a regular module, so `getOption("Player")`, `options()` and
`subscribeOptions(...)` work on it too.

Three [game events](/guides/events-and-packets#game-events) follow the active
target: `target_active`, `target_inactive` and `target_killed`. Each passes the
`EntityNetworkPlayer`:

```ts
ctx.on("target_active", (entity) => console.log("fighting", entity.username));
```

## Target scanning

The `target` schema node adds the host's `TargetConfigurable`: the drawer with
range, wall range, scan range, hurt time and priority that every combat module
has. The fields you set on the node decide which sub-options appear:

```ts
target: { type: "target", range: 3, maxRange: 10, wallRange: 2, scanExtraRange: 3, hurtTime: true },
```

| Field | Meaning |
| --- | --- |
| `range` | Starting attack range. |
| `maxRange` | Maximum value of the range sliders. |
| `wallRange?` | Show the "Wall Range" option, starting at this value. Beyond this range, targets need line of sight. |
| `scanExtraRange?` | Show the "Scan Extra Range" option, with this as its maximum. This is an extra band of targets that are *seen but not attacked*. |
| `hurtTime?` | Show the "Hurt Time" filter. |

The handle is the `TargetConfigurable` itself. Its main method scans the
session, filters through the [Targets module](#the-targets-module), and sorts
by the configured priority:

```ts
const found = ctx.options.target.getTargets(targets(), ctx.session);
// TargetInfo[]: { entity, isScanExtra }. isScanExtra means "in the extra band, don't attack".
const best = found.find((t) => !t.isScanExtra);
```

Each option is also available as a handle:

- `range`, `wallRange`, `scanExtraRange`, `hurtTime`: each an `Option<number>`.
  The optional ones are `undefined` when not enabled.
- `priority`: a `TargetPriority` (`Distance`, `Health`, `Direction`, `Age`,
  `Hurt Time`).

## Clicker

The `click-scheduler` node adds the host's CPS clicker: a drawer with a CPS
range and a technique selector. The techniques (`Stabilized`, `Randomized`,
`Double Tap`, `Gaussian Distribution`) are the same humanized timing engines the
built-in modules use.

The handle is a `ClickSchedulerConfigurable`. Start a scheduler when the module
is enabled and dispose of it when disabled:

```ts
{
  click: { type: "click-scheduler" },
},
(ctx) => {
  let clicker: AbstractClickScheduler | undefined;

  ctx.onEnable(() => {
    clicker = ctx.options.click.getClickScheduler(() => attackTick(ctx));
  });
  ctx.onDisable(() => {
    clicker?.dispose();
    clicker = undefined;
  });
}
```

The callback runs once per (humanized) click for as long as the scheduler
exists. You can read the configured values as `ctx.options.click.cps` (a
`NumberRange`) and `ctx.options.click.technique` (a `ClickTechnique`).

A running scheduler reads its settings once, when it's created. To apply changes
mid-session, create a new one.

## Rotation

The `rotation` node adds the host's rotation strategy selector: `None`,
`Simple` or `Smart`. The default is `Smart`, which respects FOV settings and
picks rotations the server will accept.

The handle asks the *selected* strategy what to do about a `RotationFace`, a
pitch/yaw region usually built from the target's bounding box:

```ts
import { face3DToRotationFace, utils } from "@protohax/userscript";

(ctx) => {
  const player = () => ctx.session.entityState.localPlayer;

  ctx.on("tick", () => {
    const [best] = ctx.options.target.getTargets(targets(), ctx.session);
    if (!best || best.isScanExtra) {
      player().rotationScheduler.cancel(ctx);
      return;
    }

    const eye = player().eyePosition;
    const face = face3DToRotationFace(best.entity.aabb.getFaceFacing(eye), eye);
    const decision = ctx.options.rotation.getRotation(ctx.session, face);

    if (decision.type === "rotate") {
      // decision.rotation is the (pitch, yaw) Vector2 to aim at
      player().rotationScheduler.request(decision.rotation, utils.SchedulerPriority.High, ctx, 200);
    } else if (decision.type === "cancel") {
      // the face is already in view, so release the override
      player().rotationScheduler.cancel(ctx);
    }
    // "keep": the current rotation still covers the face, so leave it
  });

  ctx.onDisable(() => player().rotationScheduler.cancel(ctx));
}
```

The decision is a `RotationType` union:

| Decision | Meaning |
| --- | --- |
| `{ type: "cancel" }` | The face is already in the client's FOV. |
| `{ type: "keep" }` | The server-side FOV already covers it. |
| `{ type: "rotate", rotation, face }` | A new rotation is needed. |

Apply `rotate` decisions through
[`rotationScheduler`](/api/local-player#rotationscheduler).
`ctx.options.rotation.value` reads or sets the selected strategy by name.

Here, `ctx` is the requester identity. It's the script equivalent of the `this`
the built-in modules pass, and it's unique per module instance per session, so
it scopes the request correctly. Two things follow:

- One `ctx` holds one request. If your module needs two *independent* rotations
  at the same time, use a second token. Any object works (see
  [`rotationScheduler`](/api/local-player#rotationscheduler)).
- A [mode](/guides/options#modes) setup gets its own `ctx`, so its requests
  have a separate owner. Cancelling with the module-level `ctx` won't clear
  them.

## Raw nodes — the escape hatch

For host configurables that don't have their own node, the `raw` node adds a
pre-built object as-is. The handle keeps its exact type:

```ts
{
  // a Configurable, shown as a drawer named after the key (or `name`)
  extraTarget: { type: "raw", configurable: new TargetConfigurable({ range: 6, maxRange: 12 }) },

  // an Option instance, added as-is under its own display name
  something: { type: "raw", option: someFreshlyConstructedOption },
},
(ctx) => {
  ctx.options.extraTarget.getTargets(targets(), ctx.session); // typed as TargetConfigurable
}
```

The classes you can construct for this today are `TargetConfigurable`,
`ClickSchedulerConfigurable`, and the rotation strategies
(`RotationNoneConfigurable`, `RotationSimpleConfigurable`,
`RotationSmartConfigurable`).

:::caution

The object must be **newly constructed**. Don't embed options that already
belong to another module.

:::
