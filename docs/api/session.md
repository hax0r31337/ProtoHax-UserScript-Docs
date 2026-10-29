---
id: session
title: The Session
sidebar_position: 1
---

# The Session

`ctx.session` is a `GameSession`: your live handle to one connection. Everything
else hangs off it — entities, the world, items, and the raw packet connection.

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
| `connection` | [`Connection`](/api/packets) | The MITM connection. Inject and flow-control packets. |
| `events` | `EventEmitter<GameSessionEvents>` | The high-level game events, including the [`input_tick`](/api/input) and [`movement_tick`](/api/movement) hooks. `ctx.on` wraps this. |
| `entityState` | [`EntityStateTracker`](/api/entities) | Entities, the player list, and the local player. |
| `itemState` | [`ItemStateTracker`](/api/inventory) | Inventories, containers, forms, and the item registry. |
| `levelState` | [`LevelStateTracker`](/api/world) | The world: blocks, chunks, raytrace, collision. |
| `baritone` | [`SessionBaritone`](/baritone) | The session's pathfinder. Built on first read; throws before the start game packet. |
| `hasBaritone` | `boolean` | Whether `baritone` is built and running. Reading it never builds one. |
| `sendChatMessage(message)` | `void` | Print a chat line on **your client only**. It is not sent to the server. |

:::tip[Two different `sendChatMessage`s]

`session.sendChatMessage(msg)` prints a local line only you can see. To send chat
**to the server** as the player, use
[`localPlayer.sendChatMessage(msg)`](/api/local-player).

:::

## `session.events`

You normally subscribe with `ctx.on(event, cb)`. It follows the module's enabled
state and cleans up for you. For anything `ctx.on` doesn't cover, such as a
one-shot listener, use the underlying emitter directly:

```ts
session.events.once("post_tick", () => {
  // runs on the next post_tick only
});
```

Event names and payloads are listed in the
[`GameSessionEvents`](/guides/events-and-packets#game-events) map.

## The three trackers

The game state lives in three trackers, each with its own page:

- **[`entityState`](/api/entities)** (`EntityStateTracker`): the entity map, the
  player list, and `localPlayer`.
- **[`levelState`](/api/world)** (`LevelStateTracker`): blocks, chunks,
  subchunks, ray-tracing, collision, and the block-state registry.
- **[`itemState`](/api/inventory)** (`ItemStateTracker`): your inventories, open
  containers, forms, item movement, and the item registry.

Plus the raw network layer:

- **[`connection`](/api/packets)** (`Connection`): inject packets in either
  direction and gate or flush the packet queue.

## Reaching types

Everything reachable from the session (`Connection`, `ItemStack`, the inventory
classes, the trackers, `Scheduler`, …) is fully typed. Your editor resolves
`session.entityState.localPlayer.inventory.hand?.definition.name` end to end, so
you rarely need to import these types. You reach them through properties.

Some types **are** exported by name, because you need to name them directly.

**Value exports** (importable, usable with `instanceof` / `extends`):

- `AbstractEntity`, `EntityPlayer`, `EntityNetworkPlayer`, `EntityCreature`,
  `EntityItem`, `EntityLocalPlayer`
- `AbstractBlockLocationTracker`
- `ModuleCategory`, `ModuleMode`, `ModuleTriggerMode`, `FlushAction`,
  [`PacketFreezer`](/api/packets#freezing-packets--packetfreezer),
  `FreezePacket`, `ForceFlushCondition`
- [`SprintIntent`](/api/movement#sprint--sprintintent),
  [`SneakIntent`](/api/movement#sneak--sneakintent)
- [`MoveKey`](/api/input#movekey), `moveFromKeys`, `keysFromMove`
- `defineModule`, `mode`, `moduleManager`, `utils`, `nbt`
- The [combat helpers](/api/combat-helpers): `targets`, `TargetConfigurable`,
  `TargetPriority`, `ClickSchedulerConfigurable`, `ClickTechnique`, the rotation
  strategy classes, `face3DToRotationFace`, `ROTATION_CANCEL`, `ROTATION_KEEP`
- [`registerAudio`](/api/audio)
- [Baritone](/baritone#types): `getBaritone`, `SessionBaritone`,
  `BaritoneStateTable`, `blockStateTableOf`, `BLOCK_STATE_TABLE_VERSION`

**Type-only exports.** Import these with `import type`. They don't exist at
runtime, so `instanceof` doesn't work on them:

- `GameSession`, `GameSessionEvents`, `FullPacketEvents`, `ModuleContext`,
  `ModuleMeta`, `Option`, `Color`, `NumberOptionProps`, `NumberRange`,
  `KeybindListener`, `ToggleKeybindListener`, `ToggleKeybindMode`,
  `Configurable`
- `BlockState`, `Chunk`, `SubChunk`, `BlockEntry`
- [`MovementState`](/api/movement), [`InputState`](/api/input),
  [`AudioClip`](/api/audio#audioclip)
- `Connection`, `PacketQueueChecker`, `HeldPacket`, `PacketFreezerSettings`, and `packets`, the
  namespace of every packet payload type
- The [option schema](/guides/options) types (`OptionsSchema`, `SchemaNode` and
  the per-kind node interfaces, `ModeSchema`) and their handle types
  (`OptionHandles`, `SchemaNodeHandle`, `ModesHandle`, `ModeHandle`,
  `GroupHandle`, `RotationHandle`, `KeybindHandle`, `ToggleKeybindHandle`)
- The combat helper types: `ModuleTargets`, `TargetConfigurableOptions`,
  `TargetInfo`, `AbstractClickScheduler`, `RotationConfigurable`, `RotationType`
  and its variants, `RotationFace`, `Face3D`
- `BaritoneEvents`. The other Baritone types (`BaritoneGoal`,
  `BaritoneSettings`, …) are [global](/baritone#types) and need no import.
- Deprecated legacy types: `ModuleOptions`, `ModuleBuild`, `Session`

Math and vector types, and many internal types, are also available under the
[`utils`](/api/utilities) namespace.
