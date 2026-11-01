---
id: input
title: Input & the Input Tick
sidebar_position: 4.5
---

# Input & the Input Tick

The `input_tick` event fires at the moment the game takes the player's input
for a tick. It hands you an `InputState` holding the move keys, the analog
stick, and the sneak and sprint keys. Whatever you write there becomes that
tick's input, as if the player had pressed it. It's also where the tick's
rotation is decided (see [Rotation](#rotation--the-ticks-aim)).

This is the **only** place a script controls input. `movement_tick` runs after
the game has taken it, and can only read what went in.

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
up. The player's own input goes in, and the tick goes out on the real rotation.

:::

## Where it sits in a tick

`input_tick` is the **first** event of a tick. It runs before the game's sprint
and sneak systems, and before `movement_tick`.

| Order | What happens |
| --- | --- |
| 1 | `input_tick` fires. Your listeners read and rewrite the input, and request the tick's aim through `rotationScheduler`. |
| 2 | The aim standing in `rotationScheduler` is committed, and the move is turned onto it. The built-in Sprint module settles the sprint. What went in is kept as [`localPlayer.lastInputTick`](#what-went-in--lastinputtick). |
| 3 | The game's sprint and sneak systems run on the final input and rotation. |
| 4 | `movement_tick` fires, then the player travels. See [the Movement page](/api/movement#where-it-sits-in-a-tick). |
| 5 | The `player_auth_input` packet reaches the proxy. `tick` fires, then `post_tick`. |

So everything you write in `input_tick` lands on **this** tick and its packet.
By `movement_tick` the game has already taken this tick's input and rotation.

`input_tick` fires once per tick for your own player, at the step where the game
applies input locks to the keys it's about to take. It only starts once the
local player has had its first `movement_tick`. The server's input locks still
apply on top of what you write, so an input the server has locked stays locked.

## `InputState`

The object passed to `input_tick`.

It arrives holding the player's own input, so a tick that no listener touches
is just the player's input. Every listener, in every session, works on the same
input, so each one sees the writes made before it and can replace them.

### Reading the tick

| Member | Type | Description |
| --- | --- | --- |
| `session` | `GameSession` | The session this tick belongs to. |
| `get position` | `Vector3` | Where this tick starts, with the last tick's move applied. Feet-relative, like `localPlayer.position`. Read only. |
| `get rotation` | `Vector2` | Your real client rotation (the camera's) in degrees (`x` = pitch, `y` = yaw). The move input you read and write here is relative to this one. The aim is only applied after every listener has run. Read only. |
| `get onGround` | `boolean` | Whether you're on the ground going into this tick. It's the same value this tick's `MovementState.onGround` will read. Read only. |
| `get motion` | `Vector3` | Velocity going into this tick, including knockback received since the last one. This tick's jump hasn't happened yet. Read only. |

The local player's `position`, `rotation`, `motion` and on-ground state are
refreshed from these at the start of `input_tick`, so they agree. Its
`serverSideRotation` is still the **previous** tick's commit here, since this
tick's aim isn't committed until every listener has run.

### What the player pressed

These always show the player's own input, whatever any listener wrote.

| Member | Type | Description |
| --- | --- | --- |
| `get userAnalog` | `Vector2` | The player's analog stick. `x` is strafe (**+x is left**), `y` is forward. Zero when centred. |
| `get userKeys` | `number` | The player's direction keys, as [`MoveKey`](#movekey) bits. |
| `get userMove` | `Vector2` | The player's move, picked from `userAnalog` and `userKeys` the way the game picks it. |
| `get userSneak` | `boolean` | Whether the player holds sneak (or has it toggled on). |
| `get userSprintKey` | `boolean` | Whether the player holds the sprint key. |

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
| `get sprintKey` | `boolean` | Whether the sprint key goes in held. |
| `setSprintKey(held)` | `void` | Hold or release the sprint key. See [The sprint key](#the-sprint-key). |
| `get sprint` | `SprintIntent` | The sprint intent this tick goes with, as raised by `requestSprint` so far. |
| `requestSprint(intent)` | `void` | Force a sprint state for **this** tick. The strongest request wins. See [`SprintIntent`](#sprint--sprintintent). |
| `snapshot()` | `InputTickSnapshot` | What goes in so far, copied out. See [`lastInputTick`](#what-went-in--lastinputtick). |

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

Both parts are relative to your **real** rotation (`input.rotation`), the
camera's. If an aim override is committed, ProtoHax turns the move onto the aim
after every listener has run, so the player still travels the way you (or the
player) steered. See [Rotation](#rotation--the-ticks-aim).

:::note[`move` isn't `MovementState.moveInput`]

`input.move` is the raw input, before sneaking slows it. With no aim override,
it's what `lastInputTick.move` reports for the tick. `MovementState.moveInput`
is a different value: the move request the game's sprint logic builds from this
input later in the tick.

:::

## Rotation — the tick's aim

`input_tick` is also where the tick's rotation is decided. Request it through
[`localPlayer.rotationScheduler`](/api/local-player#rotationscheduler) from a
listener. Once every listener is done, the override standing in the scheduler
is **committed** (it becomes `localPlayer.serverSideRotation`), and the game
takes the whole tick on it: sprint, the sprint-jump boost and travel, just as a
server simulating your packet does. The camera keeps the real rotation.

The move is turned onto the aim, so the player still travels where they steer.
Only the stick can carry an arbitrary angle, so under an aim the keys go in as
the stick. For a keyboard player, the packet still reports no stick, just as
the keys would.

- Listeners still see the real frame: `input.rotation` and `input.move` are the
  camera's. Write the move relative to `input.rotation`.
- During `input_tick`, `serverSideRotation` is still the previous tick's
  commit. From `movement_tick` on it's this tick's.
- An aim requested from `movement_tick` or `tick` only lands on the **next**
  tick.
- The aim's pitch is clamped, and its yaw is unwrapped to within 180° of the
  real yaw, so the game's yaw never jumps a full turn.

## Sprint — `SprintIntent`

There are two ways to sprint, and they differ in what the server thinks of
them.

### The sprint key

`setSprintKey(true)` holds the sprint key, as if the player pressed it. The
game then starts a sprint by its own rules (forward input, hunger, blindness,
…), and an authoritative server makes the same call from the packet. **This is
the way to start a sprint.** Released, a key-started sprint ends on touch input
only.

Because the game takes the tick on the committed aim, its sprint rules test
your move against the **sent** yaw, as the server's do. A sprint that would
head more than 45° away from the yaw being sent just doesn't start, on either
side.

### `SprintIntent`

`requestSprint(intent)` forces the sprint action bits instead. The strongest
request wins, so if two modules disagree, the result is the same no matter
which listener ran first.

| Value | Meaning |
| --- | --- |
| `SprintIntent.AsIs` | Leave the game's own sprint logic alone. |
| `SprintIntent.Sprint` | Keep sprinting **on**. The game's "stop sprinting" signal is ignored, so sprint survives rotation, low hunger and item use. |
| `SprintIntent.NotSprint` | Keep sprinting **off**. The game can never start sprinting. |

`NotSprint` beats `Sprint`, which beats `AsIs`.

:::caution[A forced sprint can disagree with the server]

An authoritative server works the sprint out from the input itself, and
corrects the client whenever the two differ. Only force a sprint state that
matches what the server will decide anyway. To start a sprint, hold the key.
To keep one from starting, release the key (`setSprintKey(false)`), and add
`NotSprint` only to stop one that's already running.

:::

`SprintIntent` is a top-level export:

```ts
import { SprintIntent } from "@protohax/userscript";
```

## What went in — `lastInputTick`

Once every listener and the Sprint module are done, the tick's input is kept as
`localPlayer.lastInputTick`, an `InputTickSnapshot`. Unlike the `InputState`,
which only lives during the tick, it stays readable afterwards, so
`movement_tick`, `tick` and the packet can see what was taken. It's `null`
before the first input tick.

| Member | Type | Description |
| --- | --- | --- |
| `rotation` | `Vector2` | The real (camera) rotation going into the tick. |
| `aim` | `Vector2 \| null` | The rotation the game took the tick on and the packet carries, when a `rotationScheduler` override was committed. Pitch clamped, yaw unwrapped to within 180° of `rotation`. `null` when the tick went out on the real rotation. |
| `move` | `Vector2` | The move the game took (`x` = strafe, **+x is left**; `y` = forward), before sneaking slows it. Relative to `aim` when there is one, else to `rotation`. |
| `stickFromKeys` | `boolean` | Whether the keys went in as the stick, to carry a move turned onto `aim`. |
| `sneak` | `boolean` | Whether the sneak key went in held. |
| `sprintKey` | `boolean` | Whether the sprint key went in held. |
| `sprint` | `SprintIntent` | The sprint intent the tick went with. |
| `moveOverridden` | `boolean` | Whether the stick or keys differ from the player's own. |
| `sneakOverridden` | `boolean` | Whether the sneak key differs from the player's own. |
| `sprintKeyOverridden` | `boolean` | Whether the sprint key differs from the player's own. |

Writing back the value the player already had doesn't count as an override.

`InputTickSnapshot` is a type-only export. `input.snapshot()` builds the same
object from what goes in **so far**, if a listener needs one mid-tick.

`localPlayer.isMoving` reads `lastInputTick.move`, so it's this tick's from the
end of `input_tick` on.

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
import { MoveKey } from "@protohax/userscript";

ctx.on("input_tick", (input) => {
  if (input.userMove.x !== 0 || input.userMove.y !== 0) return;

  input.setAnalog({ x: 0, y: 0 });
  input.setKeys(MoveKey.Up);
  input.setSprintKey(true);
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

## Moving independently of the camera

`input_tick` lets a script do the walking, as a pathfinder like Baritone does,
while the player keeps looking wherever they like. Three parts, each with its own
job:

| Part | Where it's set | What it does |
| --- | --- | --- |
| The input | `setAnalog` / `setKeys` | Where the client travels. It's relative to the **real** rotation, so turn the world direction by `input.rotation`. |
| The sent rotation | [`rotationScheduler`](/api/local-player#rotationscheduler) | What the server sees you facing. The game takes the tick on it, and the input is turned onto it, so the client and the server see the same move. |
| Sprint | `setSprintKey` | Whether you sprint. The game and the server both decide it from the move against the sent yaw, so it starts when you travel within 45° of it. |

The camera isn't part of it. You never write the real rotation, so the player
can look around freely while the script walks.

Request the aim from `input_tick` as well. It's committed once every listener
has run, so an aim requested here is the one this tick is played and sent on.
An aim requested from `movement_tick` only lands on the next tick.

```ts
import { utils } from "@protohax/userscript";

(ctx) => {
  const player = ctx.session.entityState.localPlayer;
  let waypoint: { x: number; z: number } | null = null;

  // the heavy part stays off the game thread
  ctx.on("tick", () => {
    waypoint = nextWaypoint(ctx.session); // your pathfinder
  });

  ctx.on("input_tick", (input) => {
    if (!waypoint) return;

    const dx = waypoint.x - input.position.x;
    const dz = waypoint.z - input.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.2) return;

    // world direction -> the frame of the real (camera) yaw
    const yaw = input.rotation.y * utils.DEG_TO_RAD;
    const forward = (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) / distance;
    const left = (dx * Math.cos(yaw) + dz * Math.sin(yaw)) / distance;

    input.setAnalog({ x: left, y: forward });
    input.setKeys(0);

    // face the travel direction for the server, so the sprint starts
    const travelYaw = Math.atan2(-dx, dz) * utils.RAD_TO_DEG;
    player.rotationScheduler.request(
      new utils.Vector2(input.rotation.x, travelYaw),
      utils.SchedulerPriority.Medium,
      ctx,
      100,
    );
    input.setSprintKey(true);
  });

  ctx.onDisable(() => player.rotationScheduler.cancel(ctx));
};
```

A few things to keep in mind:

- **Jumping** isn't part of the input. Jump from `movement_tick` with
  [`state.jump()`](/api/movement#jumping), for example when `state.onGround`
  and the next waypoint is a block higher.
- **Sneak** goes through `setSneak` like the move does. It also slows the move
  down to 30%, and the game's edge clip keeps you from walking off a block.
- **The player's input** is still readable through `userMove` and `userSneak`.
  Check it to hand control back when the player takes over, as the auto-walk
  example does.
- **A higher-priority aim**, such as Kill Aura's, wins the `rotationScheduler`.
  The tick is then played on that yaw. Your move is still turned onto it, so
  you travel where you steer, but a sprint away from it doesn't start, just as
  on the server.
- **The stick gives any direction**, the keys only eight. See
  [Stick or keys?](#stick-or-keys) for how each one looks in the packet.

## Seeing the result later

[`localPlayer.lastInputTick`](#what-went-in--lastinputtick) reports what the
game took from this tick's input, and whether something other than the player
put it there. It's this tick's from the end of `input_tick` on, so
`movement_tick` and `tick` read it.

The local player also patches your override into the packet fields that are
read straight from the player's keys (`raw_move_vector` and the raw sneak
flags), so the packet agrees with the input the game used.
