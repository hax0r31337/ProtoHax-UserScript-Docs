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
ctx.on("tick", () => player.jump());
```

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
| `moveVector` | `Vector2` | Raw strafe input vector. |
| `isMoving` | `boolean` | Movement keys pressed (false when only coasting on inertia). |
| `sneaking` / `sprinting` / `swimming` / `gliding` / `crawling` | `boolean` | Pose/movement flags. |
| `verticalCollision` | `boolean` | Collided vertically last tick. |
| `horizontalCollision` | `boolean` | Collided horizontally last tick. |
| `prevServerSideYaw` | `number` | Server-side yaw on the previous tick. |
| `inputFlags` | `InputFlag` | **Mutable** auth-input flags for the current tick (e.g. `start_jumping`). |
| `get predictedMotion` | `Vector3` | Predicted motion **ignoring collision** (what motion would be with no blocks in the way). |
| `get serverSideRotation` | `Vector2` | Rotation currently sent to the server (scheduled override or actual). |

## Action verbs

These queue actions for the current/next tick. Rotations are `Vector2` — build
one with `new utils.Vector2(...)` (see [Utilities](/api/utilities)) or reuse the
player's own `serverSideRotation`.

| Method | Description |
| --- | --- |
| `setPosition(position, movementTakeover?)` | Set the player's position (optionally take over movement). |
| `setMotion(motion)` | Set the player's motion. |
| `addMotion(motion)` | Add to the current motion. |
| `strafe(speed?, strength?)` | Apply strafe motion in the movement direction. `speed` defaults to current horizontal speed; `strength` (0–1, default 1) blends between current and new motion. |
| `jump()` | Apply a jump (accounts for jump-boost). |
| `swingItem(source?)` | Swing the arm once this tick (optionally tagged with a source string). |
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
const OWNER = {}; // stable identity for this module's request

ctx.on("tick", () => {
  player.rotationScheduler.request(
    new utils.Vector2(90, 0), // (yaw, pitch)
    utils.SchedulerPriority.High,
    OWNER,
    50,
  );
});
ctx.onDisable(() => player.rotationScheduler.cancel(OWNER));
```
