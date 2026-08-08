---
id: combat-helpers
title: Combat Helpers
sidebar_position: 9
---

# Combat Helpers

The machinery the built-in combat modules share — target selection, humanized
clicking, and rotation strategies — is available to scripts, both as **schema
nodes** (they render the same options the built-in modules show) and as
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

`targets()` returns the live **Targets** singleton — the user's shared
target-selection settings (entity kinds, anti-bot, team) that every combat
module consults. Use it so your module targets the same things the built-ins
do.

| Member | Description |
| --- | --- |
| `isTarget(entity, attackIntent?)` | Whether `entity` is a valid target under the user's settings. Pass `attackIntent: false` to skip the team check (e.g. for highlighting). |
| `notifyTarget(entity)` | Report that you attacked `entity` — it becomes the *active target* (drives TargetHud and the target events below). |
| `isActiveTarget(entity)` | Whether `entity` is currently tracked as active in its session. |

It is a regular module, so `getOption("Player")`, `options()` and
`subscribeOptions(...)` work on it too.

Three [game events](/guides/events-and-packets#game-events) follow the active
target lifecycle: `target_active`, `target_inactive`, and `target_killed`, each
carrying the `EntityNetworkPlayer`:

```ts
ctx.on("target_active", (entity) => console.log("fighting", entity.username));
```

## Target scanning

The `target` schema node embeds the host's `TargetConfigurable` — the
range / wall range / scan range / hurt time / priority drawer every combat
module has. The node's fields decide which sub-options exist at all:

```ts
target: { type: "target", range: 3, maxRange: 10, wallRange: 2, scanExtraRange: 3, hurtTime: true },
```

| Field | Meaning |
| --- | --- |
| `range` | Initial attack range. |
| `maxRange` | Upper bound of the range sliders. |
| `wallRange?` | Show the "Wall Range" option (line-of-sight check beyond it), starting at this value. |
| `scanExtraRange?` | Show the "Scan Extra Range" option with this upper bound — extra band of *seen but not attacked* targets. |
| `hurtTime?` | Show the "Hurt Time" filter. |

The handle is the `TargetConfigurable` itself. Its main method scans the
session, filtered through the [Targets module](#the-targets-module) and sorted
by the configured priority:

```ts
const found = ctx.options.target.getTargets(targets(), ctx.session);
// TargetInfo[]: { entity, isScanExtra } — isScanExtra = in the extra band, don't attack
const best = found.find((t) => !t.isScanExtra);
```

The individual options are exposed as handles too — `range`, `wallRange`,
`scanExtraRange`, `hurtTime` (each `Option<number>`, the optional ones
`undefined` when not enabled) and the `priority` value (a `TargetPriority`:
`Distance`, `Health`, `Direction`, `Age`, `Hurt Time`).

## Clicker

The `click-scheduler` node embeds the host's CPS clicker — a drawer with a CPS
range and a technique selector (`Stabilized`, `Randomized`, `Double Tap`,
`Gaussian Distribution` — the same humanized timing engines the built-in
modules use).

The handle is a `ClickSchedulerConfigurable`. Start a scheduler on enable,
dispose it on disable:

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

The callback fires once per (humanized) click for as long as the scheduler
lives. The configured values are readable as `ctx.options.click.cps`
(a `NumberRange`) and `ctx.options.click.technique` (a `ClickTechnique`) —
note a running scheduler samples its settings at creation, so recreate it if
you want changes applied mid-session.

## Rotation

The `rotation` node embeds the host's rotation strategy selector —
`None` / `Simple` / `Smart` (default `Smart`, which respects FOV settings and
picks server-legal rotations).

The handle asks the *selected* strategy for a decision toward a
`RotationFace` — a pitch/yaw region, usually derived from the target's
bounding box:

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
      // a new rotation is needed — decision.rotation is the (pitch, yaw) Vector2
      player().rotationScheduler.request(decision.rotation, utils.SchedulerPriority.High, ctx, 200);
    } else if (decision.type === "cancel") {
      // the face is already in view — release the override
      player().rotationScheduler.cancel(ctx);
    }
    // "keep": the current rotation still satisfies the face — leave it standing
  });

  ctx.onDisable(() => player().rotationScheduler.cancel(ctx));
}
```

`ctx` is the requester identity here — it is the script-side equivalent of the
`this` the built-in modules pass, and it is per module instance per session, so
it scopes the request exactly right. Two things follow from that: one `ctx`
holds one request, so a module wanting two *independent* concurrent rotations
needs a second token (any object works — see
[`rotationScheduler`](/api/local-player#rotationscheduler)); and a
[mode](/guides/options#modes) setup receives its own `ctx`, so its requests are
a separate owner — cancelling with the module-level `ctx` will not clear them.

The decision is a `RotationType` union: `{ type: "cancel" }` (already in the
client's FOV), `{ type: "keep" }` (serverside FOV covers it), or
`{ type: "rotate", rotation, face }`. Apply `rotate` decisions through
[`rotationScheduler`](/api/local-player#rotationscheduler); `ctx.options.rotation.value`
reads or sets the selected strategy by name.

## Raw nodes — the escape hatch

For host configurables without a curated node, the `raw` node embeds a
pre-constructed object as-is, and the handle preserves its exact type:

```ts
{
  // a Configurable, shown as a drawer named after the key (or `name`)
  extraTarget: { type: "raw", configurable: new TargetConfigurable({ range: 6, maxRange: 12 }) },

  // an Option instance, added verbatim (its own display name is used)
  something: { type: "raw", option: someFreshlyConstructedOption },
},
(ctx) => {
  ctx.options.extraTarget.getTargets(targets(), ctx.session); // typed as TargetConfigurable
}
```

The constructible classes exported for this today: `TargetConfigurable`,
`ClickSchedulerConfigurable`, and the rotation strategies
(`RotationNoneConfigurable` / `RotationSimpleConfigurable` /
`RotationSmartConfigurable`). The object must be **freshly constructed** — do
not embed options that already belong to another module.
