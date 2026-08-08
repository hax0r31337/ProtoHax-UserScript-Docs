---
id: local-player
title: The Local Player
sidebar_position: 3
---

# The Local Player

`session.entityState.localPlayer` is an **`EntityLocalPlayer`** — you. It extends
[`EntityPlayer`](/api/entities#entityplayer-adds) (and thus `AbstractEntity`), so
it has all the entity/player state (`position`, `health`, `rotation`, `uuid`,
`gamemode`, …) **plus** the action verbs and controllers below.

```ts
const player = ctx.session.entityState.localPlayer;
ctx.on("movement_tick", (state) => state.jump());
```

:::info[Moving the player lives on `movement_tick`]

`setPosition`, `setMotion`, `addMotion`, `strafe` and `jump` are **no longer on
the local player**. They are on the `MovementState` handed to the
[`movement_tick`](/api/movement) event, which runs before the client travels —
see [Movement & the Movement Tick](/api/movement) and its
[migration table](/api/movement#migrating-from-the-old-local-player-verbs).

:::

## Identity & session state

| Member | Type | Description |
| --- | --- | --- |
| `xuid` | `string` | XUID of the local player. |
| `serverAddress` | `string` | Address of the connected server. |
| `gameVersion` | `string` | Client game version string. |
| `isInitialized` | `boolean` | Whether the local player has finished initializing. |
| `tick` | `bigint` | The player's current tick counter. |

## Movement state

| Member | Type | Description |
| --- | --- | --- |
| `moveVector` | `Vector2` | Raw strafe input vector, from the last auth-input packet. |
| `isMoving` | `boolean` | Movement keys pressed (false when only coasting on inertia). |
| `sneaking` / `sprinting` / `swimming` / `gliding` / `crawling` | `boolean` | Pose/movement flags. |
| `verticalCollision` | `boolean` | Collided vertically last tick. |
| `horizontalCollision` | `boolean` | Collided horizontally last tick. |
| `prevServerSideYaw` | `number` | Server-side yaw on the previous tick. |
| `get predictedMotion` | `Vector3` | Predicted motion **ignoring collision** (what motion would be with no blocks in the way). |
| `get serverSideRotation` | `Vector2` | Rotation currently sent to the server — the **committed** override, or the real rotation when nothing overrides it. During a `movement_tick` this is still the previous tick's commit; this tick's is not decided until every listener has run. |

`position`, `motion`, `rotation` and the on-ground state are refreshed from
game memory at the start of each [`movement_tick`](/api/movement), before any
module runs — not from the auth-input packet. They are a snapshot: writing
through `MovementState` does not update them, so read the live value back off
the state object.

## Auth-input data

The auth-input packet carries its input flags as a **list of string tags**
(`InputData`), not a flags object. The local player exposes a live view of the
packet being handled:

| Member | Signature | Description |
| --- | --- | --- |
| `get inputData` | `readonly InputData[]` | The input data of the auth-input packet being handled. A live view of the packet — copy it before holding on to it. |
| `hasInputData(data)` | `boolean` | Whether the given input tag is present. |
| `addInputData(data)` | `void` | Add a tag (no-op if already present). |
| `removeInputData(data)` | `void` | Remove a tag. |

```ts
ctx.on("tick", () => {
  const player = ctx.session.entityState.localPlayer;
  if (player.hasInputData("start_jumping")) {
    player.removeInputData("start_jumping");
  }
});
```

`InputData` is a string union of every input tag (`"start_jumping"`,
`"start_sprinting"`, `"missed_swing"`, `"vertical_collision"`, …) — your editor
autocompletes them. These values are meaningful during the `tick` event, while
the packet is being handled.

> **Replaces `inputFlags`.** The old `inputFlags: InputFlag` object is gone.
> `player.inputFlags.start_jumping` becomes `player.hasInputData("start_jumping")`,
> and `player.inputFlags.missed_swing = true` becomes
> `player.addInputData("missed_swing")`.

## Action verbs

These queue actions for the current/next tick. Rotations are `Vector2` — build
one with `new utils.Vector2(...)` (see [Utilities](/api/utilities)) or reuse the
player's own `serverSideRotation`.

| Method | Description |
| --- | --- |
| `swingItem(source?)` | Swing the arm once this tick (optionally tagged with a source string). |
| `sendJumpFlagNextPacket()` | Queue the `start_jumping` flag onto the next auth-input packet (used to keep a scripted jump plausible). `MovementState.jump()` already does this. |
| `click(rotation)` | Queue an interact/attack click at the given rotation. |
| `missClick(rotation)` | Queue a deliberate miss-click. |
| `interactEntity(entity, swing, rotation, action, positionOverride?)` | Attack or interact with an entity. `action` is `"attack"` or `"interact"`. |
| `interactBlock(position, face, swingSource?, consumeItem?)` | Use/place against a block face. |
| `sendChatMessage(message)` | Send a chat message **to the server** as the player. |

```ts
import { EntityNetworkPlayer } from "@protohax/userscript";

ctx.on("tick", () => {
  const player = ctx.session.entityState.localPlayer;

  // simple killaura-ish: attack the first attackable player,
  // keeping the rotation currently being sent to the server
  for (const e of ctx.session.entityState.entities.values()) {
    if (e instanceof EntityNetworkPlayer && e.canBeAttacked) {
      player.interactEntity(e, true, player.serverSideRotation, "attack");
      break;
    }
  }
});
```

## Inventories

The local player owns three containers (full detail on the
[Inventory](/api/inventory) page):

| Member | Type |
| --- | --- |
| `inventory` | [`PlayerInventory`](/api/inventory#playerinventory) |
| `inventoryArmor` | [`PlayerInventoryArmor`](/api/inventory#playerinventoryarmor) |
| `inventoryOffhand` | [`PlayerInventoryOffhand`](/api/inventory#playerinventoryoffhand) |

## `breakingController`

Controls block breaking. Type: `AbstractBreakingController`.

| Member | Signature | Description |
| --- | --- | --- |
| `breaking` | `Vector3 \| null` | Position of the block currently being broken, or `null`. |
| `canInjectBreak()` | `boolean` | Whether a break can currently be injected. |
| `startBreak(position, face, range?, callback?)` | `void` | Begin breaking a block. `callback(progress, tickProgress)` reports each tick; pass `range: 0` to disable auto-abort. |
| `abortBreak()` | `void` | Abort the current injected break. |
| `forceStopBreak()` | `void` | Finish the current break early, as if it completed normally. |

```ts
const bc = ctx.session.entityState.localPlayer.breakingController;
if (bc.canInjectBreak()) {
  // position is any IVector3 ({ x, y, z }); face is a block face index
  bc.startBreak({ x: 10, y: 64, z: 20 }, 1, 5, (progress) => {
    if (progress === null) console.log("break finished/aborted");
  });
}
```

## `rotationScheduler`

Schedules server-side rotation overrides (aim). Type: `Scheduler<Vector2>`.

The winning override is **committed once at the end of each
[`movement_tick`](/api/movement)**, and the auth-input packet is built from that
commit rather than from a fresh read. Entries expire on wall-clock timers, so
this is what binds a single rotation to a single tick: an aim requested during a
`movement_tick` and a [`SprintIntent`](/api/movement#sprint--sprintintent)
decided in the same pass end up on the same packet.

| Member | Signature | Description |
| --- | --- | --- |
| `request(value, priority, provider, expiryMillis)` | `void` | Request a rotation override. Highest priority wins; `provider` identifies the requester; `expiryMillis` is how long it lingers. |
| `cancel(provider)` | `void` | Cancel this provider's request. |
| `get current` | `T \| undefined` | The currently-winning value. |
| `subscribe(listener)` | `() => void` | Observe the current value; returns an unsubscribe fn. |

`SchedulerPriority` is a string enum. It is reached through the
[`utils`](/api/utilities) namespace (not a top-level export):

```ts
import { utils } from "@protohax/userscript";
// utils.SchedulerPriority.Lowest | Low | Medium | High | Highest
```

```ts
import { utils } from "@protohax/userscript";

const player = ctx.session.entityState.localPlayer;

// request from `movement_tick` so the aim lands on this tick's packet
ctx.on("movement_tick", () => {
  player.rotationScheduler.request(
    new utils.Vector2(0, 90), // (pitch, yaw)
    utils.SchedulerPriority.High,
    ctx, // the requester identity — see below
    50,
  );
});
ctx.onDisable(() => player.rotationScheduler.cancel(ctx));
```

`provider` is compared by identity only, so anything stable works. Passing
`ctx` is the usual choice: it is per module instance per session, matching the
`this` the built-in modules pass, and it dies with the session. Use a separate
token (`const OTHER = {}`, declared *inside* setup so it is not shared across
sessions) only when one module needs two independent concurrent requests.

:::caution[Request the aim from `movement_tick`, not `tick`]

The commit happens before the auth-input packet is built, and `tick` fires
*while* that packet is being handled — after the commit. A rotation requested
from a `tick` handler therefore first appears on the **next** tick's packet.
The built-in combat modules aim from `movement_tick` for this reason.

:::
