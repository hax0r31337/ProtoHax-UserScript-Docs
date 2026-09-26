---
id: input
title: Input & the Input Tick
sidebar_position: 4.5
---

# Input & the Input Tick

The `input_tick` event fires at the moment the game takes the player's input
for a tick. It hands you an `InputState` holding the move keys, the analog
stick and the sneak key. Whatever you write there becomes that tick's input, as
if the player had pressed it.

```ts
ctx.on("input_tick", (input) => {
  input.setSneak(true); // hold sneak for as long as the module is on
});
```

Because your write goes in exactly where the player's keys do, everything the
game derives from input follows it: the sneak slowdown, pose and edge clip,
starting a sprint, auto-jump, and the flags and vectors in the auth-input
packet. You don't have to patch anything afterwards.

Jumping isn't part of the input here. Use
[`MovementState.jump()`](/api/movement#writing) for that.

:::danger[`input_tick` is performance-critical]

Like [`movement_tick`](/api/movement), this listener runs **synchronously on the
game thread**, which is blocked until it returns. Keep it to reading a few
fields and writing input. Do heavy work in the packet `tick` event and cache the
result. See [Deferring heavy work](/api/movement#deferring-heavy-work).

If the hook hasn't answered after **200 ms**, or it throws, the runtime gives
up. The player's own input goes in, with only the last `SneakIntent` applied.

:::

## Where it sits in a tick

`input_tick` is the **first** event of a tick. It runs before the game's sprint
and sneak systems, and before `movement_tick`.

| Order | What happens |
| --- | --- |
| 1 | `input_tick` fires. Your listeners read and rewrite the input. |
| 2 | The built-in sprint logic settles the tick's sprint intent. Then the game's sprint and sneak systems run on the final input. |
| 3 | `movement_tick` fires, then the player travels. See [the Movement page](/api/movement#where-it-sits-in-a-tick). |
| 4 | The `player_auth_input` packet reaches the proxy. `tick` fires, then `post_tick`. |

So a sprint or sneak change you make in `input_tick` lands on **this** tick and
its packet. The same request made from `movement_tick` is a tick later, because
by then the game has already taken this tick's input.

`input_tick` fires once per tick for your own player, at the step where the game
applies input locks to the keys it's about to take. It only starts once the
local player has had its first `movement_tick`. The server's input locks still
apply on top of what you write, so an input the server has locked stays locked.

## `InputState`

The object passed to `input_tick`.

It arrives holding the player's own input, with any
[`SneakIntent`](/api/movement#sneak--sneakintent) from the last `movement_tick`
already applied. Otherwise, a tick that no listener touches is just the
player's input. Every listener, in every session, works on the same input, so
each one sees the writes made before it and can replace them.

### Reading the tick

| Member | Type | Description |
| --- | --- | --- |
| `session` | `GameSession` | The session this tick belongs to. |
| `get position` | `Vector3` | Where this tick starts, with the last tick's move applied. Feet-relative, like `localPlayer.position`. Read only. |
| `get rotation` | `Vector2` | Your real client rotation in degrees (`x` = pitch, `y` = yaw). The move input is relative to this one, not the rotation being sent. Read only. |
| `get onGround` | `boolean` | Whether you're on the ground going into this tick. It's the same value this tick's `MovementState.onGround` will read. Read only. |

The local player's own `position` and `rotation` are only refreshed at
`movement_tick`, so during `input_tick` they still hold the last tick's values.
Read them from the `InputState` instead.

### What the player pressed

These always show the player's own input, whatever any listener wrote.

| Member | Type | Description |
| --- | --- | --- |
| `get userAnalog` | `Vector2` | The player's analog stick. `x` is strafe (**+x is left**), `y` is forward. Zero when centred. |
| `get userKeys` | `number` | The player's direction keys, as [`MoveKey`](#movekey) bits. |
| `get userMove` | `Vector2` | The player's move, picked from `userAnalog` and `userKeys` the way the game picks it. |
| `get userSneak` | `boolean` | Whether the player holds sneak (or has it toggled on). |

### What goes in

These are the values the game will use. Read them, or overwrite them.

| Member | Type | Description |
| --- | --- | --- |
| `get analog` | `Vector2` | The stick that goes in. |
| `setAnalog(analog)` | `void` | Set the stick. Any direction, with a length up to 1 (the game clamps a longer one). `{ x: 0, y: 0 }` centres it, and the keys take over. A `NaN` or infinite part counts as 0. |
| `get keys` | `number` | The direction keys that go in, as `MoveKey` bits. |
| `setKeys(keys)` | `void` | Set the direction keys, as `MoveKey` bits. Bits past the eight keys are dropped. |
| `get move` | `Vector2` | The move the game will make from `analog` and `keys`, before sneaking slows it down. |
| `get isMoving` | `boolean` | Whether `move` asks to move at all. |
| `get sneak` | `boolean` | Whether the sneak key goes in held. |
| `setSneak(sneak)` | `void` | Hold or release the sneak key. |
| `get sprint` | `SprintIntent` | The sprint intent this tick goes with: the last `movement_tick`'s request, raised by any `requestSprint` here. |
| `requestSprint(intent)` | `void` | Ask for a sprint state for **this** tick. The strongest request wins, as described in [Sprint](/api/movement#sprint--sprintintent). |

`setAnalog` takes any `IVector2`, so a plain `{ x, y }` works.

### Stick or keys?

The game's move input has two parts: the analog stick and the direction keys.
It moves by the stick when the stick is off centre, and by the keys otherwise.
The packet reports both, with the keys as its direction flags.

So which one you fill in is up to you:

- A keyboard player sends keys and a centred stick. Overriding the keys looks
  the most like them.
- A controller or touch player sends the stick. If you only set keys while the
  stick is off centre, the stick still wins. Centre it with
  `setAnalog({ x: 0, y: 0 })` when you want your keys to count.

Both parts are relative to your **real** rotation (`input.rotation`), since
that's what the client travels by. If an aim override is active, the packet's
rotation fix turns them onto the sent yaw for you.

:::note[`move` isn't `MovementState.moveInput`]

`input.move` is the raw input, before sneaking slows it. It's
what `MovementState.inputMove` reports on the same tick.
`MovementState.moveInput` is a different value: the move request the game's
sprint logic builds from this input later in the tick.

:::

## `MoveKey`

The direction key bits. Combine them with `|`.

| Value | Bit | Key |
| --- | --- | --- |
| `MoveKey.UpLeft` | `1` | Touch d-pad diagonal. |
| `MoveKey.UpRight` | `2` | Touch d-pad diagonal. |
| `MoveKey.DownLeft` | `4` | Touch d-pad diagonal. |
| `MoveKey.DownRight` | `8` | Touch d-pad diagonal. |
| `MoveKey.Up` | `16` | Forward. |
| `MoveKey.Down` | `32` | Back. |
| `MoveKey.Left` | `64` | Strafe left. |
| `MoveKey.Right` | `128` | Strafe right. |

A keyboard only ever sends combinations of `Up`, `Down`, `Left` and `Right`.

Two helpers convert between keys and move vectors:

| Function | Returns | Description |
| --- | --- | --- |
| `moveFromKeys(keys)` | `Vector2` | The move vector the game makes from these keys: their directions summed and normalised. |
| `keysFromMove(move)` | `number` | The keyboard keys closest to a move vector, by the sign of each part: `Up`/`Down` from `y`, `Left`/`Right` from `x` (+x is left). |

`MoveKey`, `moveFromKeys` and `keysFromMove` are top-level exports:

```ts
import { MoveKey, moveFromKeys, keysFromMove } from "@protohax/userscript";
```

## Examples

**Auto-walk:** walk forward and sprint, but hand control back as soon as the
player touches a direction key or the stick.

```ts
import { MoveKey, SprintIntent } from "@protohax/userscript";

ctx.on("input_tick", (input) => {
  if (input.userMove.x !== 0 || input.userMove.y !== 0) return;

  input.setAnalog({ x: 0, y: 0 });
  input.setKeys(MoveKey.Up);
  input.requestSprint(SprintIntent.Sprint);
});
```

**Walk to a point:** turn a world direction into keys relative to where you're
looking. In a real module you'd pick `target` in `tick` and cache it.

```ts
import { keysFromMove, utils } from "@protohax/userscript";

const target = { x: 100, z: -40 };

ctx.on("input_tick", (input) => {
  const dx = target.x - input.position.x;
  const dz = target.z - input.position.z;
  if (dx * dx + dz * dz < 0.25) return; // close enough

  // player frame: forward is (-sin yaw, cos yaw), left is (cos yaw, sin yaw)
  const yaw = input.rotation.y * utils.DEG_TO_RAD;
  const forward = -dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const left = dx * Math.cos(yaw) + dz * Math.sin(yaw);

  input.setAnalog({ x: 0, y: 0 });
  input.setKeys(keysFromMove({ x: left, y: forward }));
});
```

For a smoother path, pass the normalised `{ x: left, y: forward }` vector to
`setAnalog` instead. The game then moves in exactly that direction, not just
the nearest of eight.

**Sneak at the edge of a block:** hold sneak while standing on the ground, so
the game's own edge clip keeps you from walking off. `nearEdge` stands in for
your own check.

```ts
ctx.on("input_tick", (input) => {
  if (input.onGround && nearEdge(input.position)) {
    input.setSneak(true);
  }
});
```

## Seeing the result in `movement_tick`

`MovementState` reports what the game took from this tick's input, and whether
something other than the player put it there. See
[Input the game took](/api/movement#input-the-game-took).

The local player also patches your override into the packet fields that are
read straight from the player's keys (`raw_move_vector` and the raw sneak
flags), so the packet agrees with the input the game used.
