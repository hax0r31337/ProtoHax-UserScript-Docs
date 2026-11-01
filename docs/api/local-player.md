---
id: local-player
title: The Local Player
sidebar_position: 3
---

# The Local Player

`session.entityState.localPlayer` is an `EntityLocalPlayer`: you. It extends
[`EntityPlayer`](/api/entities#entityplayer-adds) (and so `AbstractEntity`), so
it has all the usual entity and player state (`position`, `health`, `rotation`,
`uuid`, `gamemode`, …). On top of that it adds the actions and controllers
below.

```ts
const player = ctx.session.entityState.localPlayer;
ctx.on("movement_tick", (state) => state.jump());
```

:::info[Moving the player happens in `movement_tick`]

`setPosition`, `setMotion`, `addMotion`, `strafe` and `jump` are no longer on the
local player. They live on the `MovementState` passed to the
[`movement_tick`](/api/movement) event, which runs before the client moves. See
[Movement & the Movement Tick](/api/movement) and its
[migration table](/api/movement#migrating-from-the-old-local-player-verbs).

:::

## Identity & session state

| Member | Type | Description |
| --- | --- | --- |
| `xuid` | `string` | Your XUID. |
| `serverAddress` | `string` | Address of the connected server. |
| `gameVersion` | `string` | Client game version string. |
| `isInitialized` | `boolean` | Whether the client has spawned in this world. Reset by each `start_game`, then set just before [`local_player_initialized`](/guides/events-and-packets#game-events) fires. |
| `isGeyser` | `boolean` | Whether the server is a [Geyser](https://geysermc.org) proxy in front of a Java server. Reset on login. It turns `true` when the server announces Geyser's integrated resource pack, or sends a `geyseropt:` message, so on some servers it only turns `true` later (for example on the first attack cooldown update). |
| `tick` | `bigint` | The player's current tick counter. |

## Movement state

| Member | Type | Description |
| --- | --- | --- |
| `get lastInputTick` | `InputTickSnapshot \| null` | The last `input_tick`'s input as it went in, every listener and the Sprint module included. `null` before the first. From the end of `input_tick` on, it's this tick's. See [`lastInputTick`](/api/input#what-went-in--lastinputtick). |
| `get isMoving` | `boolean` | Whether `lastInputTick.move` asks to move. `false` when only coasting. |
| `sneaking` / `sprinting` / `swimming` / `gliding` / `crawling` | `boolean` | Pose and movement flags. |
| `verticalCollision` | `boolean` | Collided vertically last tick. |
| `horizontalCollision` | `boolean` | Collided horizontally last tick. |
| `prevServerSideYaw` | `number` | Server-side yaw on the previous tick. |
| `get predictedMotion` | `Vector3` | Predicted motion **ignoring collision**, i.e. what motion would be with no blocks in the way. |
| `get serverSideRotation` | `Vector2` | The rotation sent to the server and the one the game plays the tick on: the committed override, or your real rotation if nothing overrides it. It's committed at the end of `input_tick`, so during `input_tick` it's still the previous tick's. From `movement_tick` on it's this tick's. |
| `get travelYaw` | `number` | The world direction the move input heads, in degrees: facing plus the input's angle. Vanilla's sprint test compares it against the sent yaw. Taken from the live `input_tick` or `movement_tick` state if there is one, else from `lastInputTick`. |

`moveVector` is gone. Use `lastInputTick?.move` instead (see the
[migration table](/api/movement#migrating-from-the-movement-tick-intents)).

`position`, `rotation` and the on-ground state are refreshed from game memory at
the start of each tick ([`input_tick`](/api/input)), before any module decides on
it. `motion` is refreshed then too, and again at
[`movement_tick`](/api/movement) once this tick's jump is in it. None of them
come from the auth-input packet. They are a snapshot, though: writing through
`MovementState` doesn't update them, so read live values from the state object
instead. `rotation` is the camera's; the rotation the tick is played on is
`serverSideRotation`.

## Auth-input data

The auth-input packet stores its input flags as a list of string tags
(`InputData`), not as a flags object. The local player gives you a live view of
the packet currently being handled:

| Member | Type | Description |
| --- | --- | --- |
| `get inputData` | `readonly InputData[]` | Input data of the auth-input packet being handled. This is a live view, so copy it if you want to keep it. |
| `hasInputData(data)` | `boolean` | Whether the given tag is present. |
| `addInputData(data)` | `void` | Add a tag. Does nothing if it's already there. |
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
`"start_sprinting"`, `"missed_swing"`, `"vertical_collision"`, …), and your
editor autocompletes them. The values only mean something during the `tick`
event, while the packet is being handled.

:::note[Replaces `inputFlags`]

The old `inputFlags: InputFlag` object is gone.
`player.inputFlags.start_jumping` becomes `player.hasInputData("start_jumping")`,
and `player.inputFlags.missed_swing = true` becomes
`player.addInputData("missed_swing")`.

:::

## Action verbs

These queue actions for the current or next tick. Rotations are `Vector2`s:
build one with `new utils.Vector2(...)` (see [Utilities](/api/utilities)) or
reuse the player's own `serverSideRotation`.

| Method | Description |
| --- | --- |
| `swingItem(source?)` | Swing the arm once this tick. You can tag it with a source string. |
| `sendJumpFlagNextPacket()` | Make the next auth-input packet read as a jump, the way the client sends one. `MovementState.jump()` already does this for you. See [Jumping](#jumping). |
| `releaseJumpNextPacket()` | Make the next auth-input packet show the jump key released for one tick. See [Jumping](#jumping). |
| `click(rotation)` | Queue an interact/attack click rotation (`interact_rotation`) for the next auth-input packet. |
| `get sentInteractRotation` | The click rotation (`interact_rotation`) the server last received. |
| `missClick(rotation)` | Queue a deliberate miss-click. |
| `interactEntity(entity, swing, rotation, action, positionOverride?)` | Attack or interact with an entity. `action` is `"attack"` or `"interact"`. `rotation` only places the click position; it isn't queued as the click rotation. See below. |
| `interactBlock(position, face, swingSource?, consumeItem?, clickOffset?, hand?)` | Use or place against a block face. `clickOffset` is the point you clicked on the face, relative to the block; it's random if you leave it out. `hand` is the hand reported to the server: `"main_hand"` (the default) or `"off_hand"`. |
| `sendChatMessage(message)` | Send a chat message **to the server** as the player. |

```ts
import { EntityNetworkPlayer } from "@protohax/userscript";

ctx.on("tick", () => {
  const player = ctx.session.entityState.localPlayer;

  // a minimal killaura: hit the first attackable player without changing
  // the rotation already being sent to the server
  for (const e of ctx.session.entityState.entities.values()) {
    if (e instanceof EntityNetworkPlayer && e.canBeAttacked) {
      player.interactEntity(e, true, player.serverSideRotation, "attack");
      break;
    }
  }
});
```

:::caution[Click a packet ahead of the attack]

`interactEntity` no longer calls `click(rotation)` for you. An entity
transaction is checked against the click rotation the server **already has**
(`sentInteractRotation`), since the one `click` queues only rides the *next*
auth-input packet, after the transaction. Some anticheats (Boar's touch reach,
for example) check it. So `click` the rotation you'll attack with a packet
before calling `interactEntity`.

:::

## Attack cooldown (Java servers)

Behind a Java server (see `isGeyser`), attacks follow Java's 1.9+ cooldown:
an attack before the held item has recharged lands weaker. The local player
tracks Java's attack timer for you.

| Member | Type | Description |
| --- | --- | --- |
| `get ticksSinceAttack` | `number` | Ticks since the last attack or main-hand item type change. Java's `attackStrengthTicker`, which both reset. |
| `get javaAttackSpeed` | `number` | The held item's Java attack speed: its base speed, with Haste adding and Mining Fatigue taking 10% per level. |
| `get javaAttackCooldownTicks` | `number` | How many `ticksSinceAttack` an attack needs to land at full strength. |

```ts
const player = ctx.session.entityState.localPlayer;
const ready = !player.isGeyser || player.ticksSinceAttack >= player.javaAttackCooldownTicks;
```

## Jumping

A jump has two sides. Your client moves you up, and the server decides whether
it accepts the jump from the flags in your auth-input packet. The local player
keeps the two in step.

| Member | Type | Description |
| --- | --- | --- |
| `get serverJumpDelay` | `number` | The server's jump delay as of the last packet sent. |
| `get canServerJump` | `boolean` | Whether the server would let the next packet jump. `true` while `serverJumpDelay` is 1 or less. |
| `sendJumpFlagNextPacket()` | `void` | Make the next packet read as a jump. |
| `releaseJumpNextPacket()` | `void` | Make the next packet show the jump key released for one tick. |

### The server's jump delay

After a jump off the ground, the server won't take another from a **held** jump
key for 10 ticks. It can't be read from the server, so the local player models
it from the packets actually sent. For each packet, in the server's order:

1. The delay counts down by one, stopping at 0.
2. If jump is held, the delay is 0, you're on the ground and the packet fires a
   jump (`start_jumping`), the delay resets to 10.
3. If jump isn't held at all, the delay drops to 0.

Because the countdown happens before the check, a delay of 1 still jumps on the
next packet. That's why `canServerJump` is `serverJumpDelay <= 1`.

[`MovementState.jump()`](/api/movement#jumping) checks `canServerJump` before
jumping off the ground, so a forced jump never lands inside the server's delay.

### `sendJumpFlagNextPacket()`

Makes the next packet look like a jump the client sent itself:

- The jump key is held: `jump_down`, `jumping` and `jump_current_raw`.
- The jump fires: `start_jumping`. This is only added when `canServerJump` is
  `true`. Inside the server's jump delay, a real client can't fire a jump
  either, so only the held key is sent.
- The raw press edge (`jump_pressed_raw`) is added if the key wasn't held on the
  last packet sent.

`jumping` is what the server itself treats as "jump held", so a server that
simulates your movement jumps along with you.

### `releaseJumpNextPacket()`

Makes the next packet show the jump key released for one tick. It removes
`jump_down`, `jumping`, `jump_current_raw` and `jump_pressed_raw`, and adds the
raw release edge (`jump_released_raw`) if the key was held before. The server
zeroes its jump delay, just as if you let go of the key. Your client's own
delay isn't touched.

It's skipped when a jump is queued for the same packet, and in water or on
scaffolding (`auto_jumping_in_water`, `ascend_block`), where the server treats
jump as held anyway.

Together with [`MovementState.setJumpDelay`](/api/movement#the-jump-delay), this
lets you shorten the delay on both sides: lower your client's delay after a
jump, and send one release so the server's delay runs out on the same tick.

:::note[When the flags are applied]

Queued jump flags are applied to the packet right after the `tick` listeners
run. So a call from `movement_tick` or from `tick` both reach this tick's
packet.

:::

## Inventories

The local player owns three containers. The [Inventory](/api/inventory) page
covers them in full.

| Member | Type |
| --- | --- |
| `inventory` | [`PlayerInventory`](/api/inventory#playerinventory) |
| `inventoryArmor` | [`PlayerInventoryArmor`](/api/inventory#playerinventoryarmor) |
| `inventoryOffhand` | [`PlayerInventoryOffhand`](/api/inventory#playerinventoryoffhand) |

## `breakingController`

Controls block breaking. Type: `AbstractBreakingController`.

| Member | Type | Description |
| --- | --- | --- |
| `breaking` | `Vector3 \| null` | Position of the block being broken, or `null`. |
| `canInjectBreak()` | `boolean` | Whether you can inject a break right now. |
| `startBreak(position, face, range?, callback?)` | `void` | Start breaking a block. `callback(progress, tickProgress)` reports every tick. Pass `range: 0` to turn off auto-abort. |
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

The winning override is **committed once, at the end of each
[`input_tick`](/api/input#rotation--the-ticks-aim)**, after every listener has
run. The game then plays the whole tick on it (sprint, the sprint-jump boost
and travel, as a server simulating the packet does), and the auth-input packet
carries it. The camera keeps the real rotation. Because entries expire on
wall-clock timers, this commit is what ties one rotation to one tick. An aim
you request in an `input_tick` ends up on that same tick.

| Member | Type | Description |
| --- | --- | --- |
| `request(value, priority, provider, expiryMillis)` | `void` | Request a rotation override. The highest priority wins. `provider` identifies you; `expiryMillis` is how long the request lasts. |
| `cancel(provider)` | `void` | Cancel this provider's request. |
| `get current` | `T \| undefined` | The value currently winning. |
| `subscribe(listener)` | `() => void` | Watch the current value. Returns an unsubscribe function. |

`SchedulerPriority` is a string enum. You reach it through the
[`utils`](/api/utilities) namespace; it isn't a top-level export:

```ts
import { utils } from "@protohax/userscript";
// utils.SchedulerPriority.Lowest | Low | Medium | High | Highest
```

```ts
import { utils } from "@protohax/userscript";

const player = ctx.session.entityState.localPlayer;

// request from `input_tick` so the aim lands on this tick
ctx.on("input_tick", () => {
  player.rotationScheduler.request(
    new utils.Vector2(0, 90), // (pitch, yaw)
    utils.SchedulerPriority.High,
    ctx, // the requester identity — see below
    50,
  );
});
ctx.onDisable(() => player.rotationScheduler.cancel(ctx));
```

`provider` is compared by identity only, so any stable value works. `ctx` is the
usual choice. It is unique per module instance per session, like the `this` the
built-in modules pass, and it goes away with the session. Only use a separate
token (`const OTHER = {}`) when one module needs two independent requests at the
same time. Declare it *inside* setup so it isn't shared across sessions.

:::caution[Request the aim from `input_tick`]

The commit happens at the end of `input_tick`. `movement_tick` and `tick` both
fire after it, so a rotation requested from either only lands on the **next**
tick. This is why the built-in combat modules aim from `input_tick`. A request
with a long enough expiry still holds over the ticks that follow, so deciding
in `tick` works too, just a tick late.

:::
