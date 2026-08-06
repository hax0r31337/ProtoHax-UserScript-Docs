---
id: movement
title: Movement & the Movement Tick
sidebar_position: 4
---

# Movement & the Movement Tick

Everything that moves the local player goes through the **`movement_tick`**
event. It is the game's own movement tick, hooked in native from
`LocalPlayer::aiStep` and fired **before the client travels**, so position and
motion written from it are what the game actually moves with.

```ts
ctx.on("movement_tick", (state) => {
  state.strafe(ctx.options.speed.value, 1);
});
```

:::danger[`movement_tick` is performance-critical]

The listener runs **on the game thread, synchronously, with the thread
blocked**, and the runtime gives up on the whole hook after **20 ms**. Work done
here costs frames directly, and anything that finishes late has already missed
the tick it was computed for.

Keep the handler to reading a few fields and writing motion. **Defer heavy
calculations — pathfinding, raytracing, entity scans, block searches — to the
packet [`tick`](/guides/events-and-packets#game-events) event**, cache the
result, and have `movement_tick` only apply it. See
[Deferring heavy work](#deferring-heavy-work).

:::

## Why not the packet?

The old way to move the player was to rewrite the auth input packet after the
fact. That desynced the client from the server, so the client had to be snapped
back with `correct_player_move_prediction` every time.

Writing through `movement_tick` happens *before* travel and collision: the game
moves from the value you wrote and reports it in its own auth input packet.
There is nothing to correct afterwards, and nothing to keep in sync by hand.

## Where it sits in a tick

| Order | What happens |
| --- | --- |
| 1 | **`movement_tick`** fires. The local player refreshes `position`, `motion`, `rotation` and the on-ground flag from memory *before* any module listener runs. |
| 2 | Your `movement_tick` listeners run — read the state, write position/motion, request a sprint intent, schedule an aim. |
| 3 | The rotation override is **committed** (latched from `rotationScheduler`) and the sprint intent is resolved. |
| 4 | The game travels and resolves collision with whatever you wrote. |
| 5 | The resulting `player_auth_input` packet reaches the proxy — **`tick`** fires (then `post_tick`). |

So `movement_tick` is the *earliest* point in a tick, and `tick` is the point at
which that tick's outcome is on the wire. A rotation and a sprint intent decided
in the same `movement_tick` end up on the same packet.

### What is fresh and what is one tick old

`MovementState` reads game memory, so its fields describe **this** tick. Some of
the local player's fields have no memory source and still come off the last
packet, so during `movement_tick` they describe the **previous** tick:

| Fresh (on `state`) | One tick behind (on `localPlayer`) |
| --- | --- |
| `state.position`, `state.motion` | `localPlayer.inputData` |
| `state.rotation`, `state.onGround` | `localPlayer.moveVector`, `localPlayer.isMoving` |
| `state.moveInput`, `state.isMoving` | `localPlayer.verticalCollision` / `horizontalCollision` |
| `state.isJumping`, `state.sprinting` | `localPlayer.serverSideRotation` (the previous commit) |

`localPlayer.position` / `motion` / `rotation` are refreshed from this event
before your listener runs, so they agree with `state` — but they are a
**snapshot**. They do not follow writes you make; read the value back off
`state` if you need it live.

## `MovementState`

The object handed to `movement_tick`. Positions are in the same feet-relative
frame as `localPlayer.position`.

### Reading

| Member | Type | Description |
| --- | --- | --- |
| `session` | `GameSession` | The session this tick was dispatched to. |
| `get position` | `Vector3` | Position at the start of this tick. |
| `get motion` | `Vector3` | Velocity at the start of this tick. |
| `get previousPosition` | `Vector3` | Position at the start of the previous tick. |
| `get rotation` | `Vector2` | Real client rotation in degrees — `x` = pitch, `y` = yaw. **Not** what is being sent to the server, so motion derived from it is unaffected by an active aim override. |
| `get onGround` | `boolean` | Whether the player was on the ground going into this tick. The game's own `OnGroundFlagComponent`, not a guess from collision flags. One tick behind by construction — collision resolves after this event — which is the same age as the packet's `vertical_collision` it replaces. |
| `get moveInput` | `Vector2` | The raw move input for this tick — `x` = strafe, `y` = forward, in the player's own frame. This is the live input out of memory, unlike `localPlayer.moveVector`. |
| `get isMoving` | `boolean` | Whether the player is asking to move at all this tick. |
| `get isJumping` | `boolean` | Whether a jump off the ground runs this tick — the game's own decision, not the jump input. |
| `get sprinting` | `boolean` | The game's sprint flag going into this tick (not what a script asked for). |
| `get isSprintJumping` | `boolean` | `isJumping && sprinting` — the one tick where motion depends on yaw. |

Rotation is **read only** here: writing it would need the head yaw kept in sync,
so rotation spoofing stays on the packet side via
[`localPlayer.rotationScheduler`](/api/local-player#rotationscheduler).

### Writing

| Method | Description |
| --- | --- |
| `setPosition(position)` | Teleport for this tick. Travel and collision still run from the new position. |
| `setMotion(motion)` | Set velocity for this tick. Treated the way vanilla treats `lerpMotion` — gravity and friction still apply on top. |
| `addMotion(motion)` | Add to the current motion. |
| `strafe(speed?, strength?)` | Apply strafe motion in the movement direction. `speed` defaults to the current horizontal speed; `strength` (0–1, default 1) blends between current and new motion. |
| `jump(jumpVelocity?)` | Apply a jump. Defaults to `0.42` plus jump-boost, and queues the jump flag on the next packet. |
| `requestSprint(intent)` | Ask for a sprint state, see below. |
| `compensateSprintJump(sentYaw, sprinting?)` | Fix up a sprint jump under an aim override, see below. |

`setPosition` / `setMotion` / `addMotion` take any `IVector3` — a plain
`{ x, y, z }` is fine.

:::note[`strafe()` uses the packet-side input]

`state.strafe(...)` builds its direction from `localPlayer.moveVector` /
`localPlayer.isMoving`, which are the *previous* tick's input. If you want this
tick's live input, read `state.moveInput` and write the motion yourself with
`utils.computeStrafe(...)`.

:::

## Sprint — `SprintIntent`

Sprinting is not a boolean you set; you declare an **intent** and the strongest
one wins, so two modules disagreeing always resolve the same way regardless of
listener order.

```ts
import { SprintIntent } from "@protohax/userscript";

ctx.on("movement_tick", (state) => {
  state.requestSprint(SprintIntent.Sprint);
});
```

| Value | Meaning |
| --- | --- |
| `SprintIntent.AsIs` | Leave the game's own sprint logic alone. |
| `SprintIntent.Sprint` | Hold sprinting **on**. The game's "stop sprinting" edge is swallowed, so sprint survives rotation, low hunger and item use. |
| `SprintIntent.NotSprint` | Hold sprinting **off**. The game can never engage sprint. |

`NotSprint` beats `Sprint` beats `AsIs`. Prefer `requestSprint(...)` over
assigning `state.sprint` directly — a raw assignment can lower another module's
request.

Note that `state.sprinting` reports the game's flag *going into* this tick, not
what anyone requested during it.

## Sprint jumps under an aim override

A sprint jump is the only tick where the player's motion depends on their yaw:
`Mob::jumpFromGround` adds `(-sin(yaw), cos(yaw)) * 0.2` when the sprint flag is
set. With an aim override active, the client jumps along its real yaw while the
server recomputes the boost from the yaw in the packet — a position mismatch
nothing downstream can explain away.

`compensateSprintJump(sentYaw, sprinting?)` adds the difference between the two
boosts, so the total matches what the server calculated. It is a no-op unless
this tick is a sprint jump and the two yaws differ.

ProtoHax already calls it for you at the end of every movement tick, with the
rotation just committed from
[`rotationScheduler`](/api/local-player#rotationscheduler). You only need to
call it yourself if you build a rotation path the scheduler does not know
about.

## Deferring heavy work

The pattern: decide in `tick`, apply in `movement_tick`.

```ts
import { utils } from "@protohax/userscript";

(ctx) => {
  let target: { x: number; y: number; z: number } | null = null;

  // `tick` runs on the packet path — heavy work here does not stall the game.
  ctx.on("tick", () => {
    target = expensiveSearch(ctx.session); // raytrace, entity scan, pathfind…
  });

  // `movement_tick` only applies the cached decision.
  ctx.on("movement_tick", (state) => {
    if (!target) return;

    const dir = new utils.Vector3(
      target.x - state.position.x,
      0,
      target.z - state.position.z,
    ).normalize();

    state.setMotion(new utils.Vector3(dir.x * 0.3, state.motion.y, dir.z * 0.3));
  });
};
```

Rules of thumb for the handler:

- No allocation-heavy loops, no `JSON` work, no scanning the entity map or
  chunk data.
- Nothing asynchronous — a promise resolves long after the tick is gone.
- No `console.log` on every tick; logging is not free.
- Cache anything derived from options or world state and refresh it from `tick`.

## Examples

**Speed** — apply a flat horizontal speed while moving:

```ts
ctx.on("movement_tick", (state) => {
  if (state.isMoving) state.strafe(ctx.options.speed.value, 1);
});
```

**Air jump / long jump** — jump off the ground and keep momentum:

```ts
ctx.on("movement_tick", (state) => {
  if (state.onGround && state.isMoving) {
    state.jump();
    state.strafe(0.5, 1);
  }
});
```

**Velocity (anti-knockback)** — cancel incoming motion for a few ticks:

```ts
let ticksLeft = 0;

ctx.onPacket("set_entity_motion", (packet) => {
  if (packet.runtime_entity_id === ctx.session.entityState.localPlayer.runtimeId) {
    packet.isCancelled = true;
    ticksLeft = ctx.options.ticks.value;
  }
});

ctx.on("movement_tick", (state) => {
  if (ticksLeft > 0) {
    ticksLeft--;
    state.setMotion({ x: 0, y: state.motion.y, z: 0 });
  }
});
```

**Hold sprint off while using an item:**

```ts
import { SprintIntent } from "@protohax/userscript";

ctx.on("movement_tick", (state) => {
  if (usingItem) state.requestSprint(SprintIntent.NotSprint);
});
```

## Migrating from the old local-player verbs

`setPosition`, `setMotion`, `addMotion`, `strafe` and `jump` are **gone from
`localPlayer`** — they lived on the packet path and needed a client correction.
They are now on `MovementState`:

| Before | Now |
| --- | --- |
| `ctx.on("tick", () => player.strafe(s, 1))` | `ctx.on("movement_tick", (state) => state.strafe(s, 1))` |
| `player.jump()` | `state.jump()` |
| `player.setMotion(v)` / `addMotion(v)` | `state.setMotion(v)` / `state.addMotion(v)` |
| `player.setPosition(v, takeover)` | `state.setPosition(v)` — there is no takeover flag; the write *is* the movement. |

The `movementTakeover` argument has no successor: nothing has to be faked back
to the client anymore, because the client moved for real.
