---
id: session
title: The Session
sidebar_position: 1
---

# The Session

`ctx.session` is a **`GameSession`** — the live handle to one connection. It is
the root of the game model: entities, world, items, and the raw packet
connection all hang off it.

```ts
(ctx) => {
  const session = ctx.session;
  ctx.on("tick", () => {
    const player = session.entityState.localPlayer;
    // ...
  });
};
```

## `GameSession`

| Member | Type | Description |
| --- | --- | --- |
| `connection` | [`Connection`](/api/packets) | The MITM connection — inject and flow-control packets. |
| `events` | `EventEmitter<GameSessionEvents>` | The high-level game events (`ctx.on` wraps this). |
| `entityState` | [`EntityStateTracker`](/api/entities) | Entities, the player list, and the local player. |
| `itemState` | [`ItemStateTracker`](/api/inventory) | Inventories, containers, forms, and the item registry. |
| `levelState` | [`LevelStateTracker`](/api/world) | The world: blocks, chunks, raytrace, collision. |
| `sendChatMessage(message)` | `void` | Print a **client-side** chat line (not sent to the server). |

> **Tip — `session.sendChatMessage` vs. the player's.**
> `session.sendChatMessage(msg)` prints a local, client-only line. To actually
> send chat **to the server** as the player, use
> [`localPlayer.sendChatMessage(msg)`](/api/local-player).

## `session.events`

`ctx.on(event, cb)` is the normal way to subscribe — it binds to the module's
enabled state and tears down automatically. The underlying emitter is exposed as
`session.events` for the cases `ctx.on` doesn't cover, e.g. a **one-shot**
listener:

```ts
session.events.once("post_tick", () => {
  // runs on the next post_tick only
});
```

The event names and payloads are the [`GameSessionEvents`](/guides/events-and-packets#game-events)
map.

## The three trackers

`GameSession` exposes the game state as three trackers. Each has its own
reference page:

- **[`entityState`](/api/entities)** — `EntityStateTracker`: the entity map, the
  player list, and `localPlayer`.
- **[`levelState`](/api/world)** — `LevelStateTracker`: blocks, chunks,
  subchunks, ray-tracing, collision, and the block-state registry.
- **[`itemState`](/api/inventory)** — `ItemStateTracker`: the local inventories,
  open containers, forms, item movement, and the item registry.

And the raw network layer:

- **[`connection`](/api/packets)** — `Connection`: inject packets in either
  direction and gate/flush the packet queue.

## Reaching types

The classes reachable through the session graph (`Connection`, `ItemStack`, the
inventory classes, the trackers, `Scheduler`, …) are fully typed — your editor
resolves `session.entityState.localPlayer.inventory.hand?.definition.name` end to
end. You rarely need to *import* those type names; you reach them by property
access.

A handful of types **are** exported by name because you name them directly:

- Value exports (importable, usable with `instanceof` / `extends`):
  `GameSession`, `AbstractEntity`, `EntityPlayer`, `EntityNetworkPlayer`,
  `EntityCreature`, `EntityItem`, `EntityLocalPlayer`, `BlockState`, `Chunk`,
  `SubChunk`, `AbstractBlockLocationTracker`, `Option`, `ModuleCategory`,
  `ModuleMode`, `ModuleTriggerMode`, plus `defineModule`, `mode`,
  `moduleManager`, `utils`, `nbt`, and the
  [combat helpers](/api/combat-helpers) (`targets`, `TargetConfigurable`,
  `TargetPriority`, `ClickSchedulerConfigurable`, `ClickTechnique`, the
  rotation strategy classes, `face3DToRotationFace`, `ROTATION_CANCEL`,
  `ROTATION_KEEP`).
- Type-only exports: `GameSessionEvents`, `FullPacketEvents`, `ModuleContext`,
  `ModuleMeta`, `Color`, `NumberOptionProps`, `NumberRange`, `Configurable`,
  `BlockEntry`, the [option schema](/guides/options) types (`OptionsSchema`,
  `SchemaNode` and the per-kind node interfaces, `ModeSchema`) and their handle
  types (`OptionHandles`, `SchemaNodeHandle`, `ModesHandle`, `ModeHandle`,
  `GroupHandle`, `RotationHandle`), the combat helper types (`ModuleTargets`,
  `TargetConfigurableOptions`, `TargetInfo`, `AbstractClickScheduler`,
  `RotationConfigurable`, `RotationType` and its variants, `RotationFace`,
  `Face3D`), plus the deprecated legacy types (`ModuleOptions`, `ModuleBuild`,
  `Session`).

Math/vector types and many internal types are also available under the
[`utils`](/api/utilities) namespace.
