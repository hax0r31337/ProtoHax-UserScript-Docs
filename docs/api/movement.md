---
id: movement
title: Movement & the Movement Tick
sidebar_position: 4
---

# Movement & the Movement Tick

Anything that moves the local player goes through the `movement_tick` event.
This is the game's own movement tick, hooked natively from
`LocalPlayer::aiStep`. It fires **before the client moves**, so the position and
motion you write here are what the game actually moves with.

To change what the player *presses* instead (the move keys, the stick or the
sneak key), use the earlier [`input_tick`](/api/input) event.

```ts
ctx.on("movement_tick", (state) => {
  state.strafe(ctx.options.speed.value, 1);
});
```

:::danger[`movement_tick` is performance-critical]

Your listener runs **synchronously on the game thread**, which is blocked until
it returns. Any work here costs frames directly. If the hook hasn't answered
after **200 ms**, the runtime gives up and the tick goes ahead unmodified, as if
no listener had run.

Keep the handler to reading a few fields and writing motion. **Do heavy work
(pathfinding, raytracing, entity scans, block searches) in the packet
[`tick`](/guides/events-and-packets#game-events) event**, cache the result, and
only apply it in `movement_tick`. See [Deferring heavy work](#deferring-heavy-work).

:::

## Why not the packet?

The old approach rewrote the auth-input packet after the fact. That desynced
the client from the server, so the client had to be snapped back with
`correct_player_move_prediction` every time.

`movement_tick` runs *before* movement and collision. The game moves using the
value you wrote and reports it in its own auth-input packet. There is nothing to
correct afterwards and nothing to keep in sync by hand.

## Where it sits in a tick

| Order | What happens |
| --- | --- |
| 1 | [`input_tick`](/api/input) fires. Listeners can rewrite the move keys, stick and sneak key, and request a sprint state for this tick. |
| 2 | The tick's sprint intent is settled. The game's sprint and sneak systems run on the final input, and a jump fires if the game decides on one. |
| 3 | `movement_tick` fires. Before any module listener runs, the local player refreshes `position`, `motion`, `rotation` and the on-ground flag from memory. |
| 4 | Your `movement_tick` listeners run: read the state, write position or motion, jump, schedule an aim, request a sprint or sneak intent for the next tick. |
| 5 | The rotation override is **committed** (taken from `rotationScheduler`). Then the sprint-jump correction runs, then any [`afterCommit`](#after-the-commit--aftercommit) callbacks. |
| 6 | The game moves the player and resolves collision using whatever you wrote. |
| 7 | The resulting `player_auth_input` packet reaches the proxy. `tick` fires, then `post_tick`. |

So `input_tick` is the *earliest* point in a tick, `movement_tick` comes next,
and `tick` is when that tick's result is on the wire. An aim and a jump decided
in `movement_tick` end up on this tick's packet. A sprint or sneak intent
requested from `movement_tick` is a tick later, because this tick's input was
already taken. Request those from `input_tick` to have them land on this tick.

### What is fresh and what is one tick old

`MovementState` reads game memory, so its fields describe **this** tick. Some
local player fields have no memory source and still come from the last packet.
During `movement_tick` those describe the **previous** tick:

| Fresh (on `state`) | One tick behind (on `localPlayer`) |
| --- | --- |
| `state.position`, `state.motion` | `localPlayer.inputData` |
| `state.rotation`, `state.onGround`, `state.inputSneak` | `localPlayer.moveVector`, `localPlayer.isMoving` |
| `state.moveInput`, `state.inputMove`, `state.isMoving` | `localPlayer.verticalCollision` / `horizontalCollision` |
| `state.isJumping`, `state.sprinting`, `state.jumpDelay` | `localPlayer.serverSideRotation` (the previous commit) |

`localPlayer.position` / `motion` / `rotation` are refreshed before your
listener runs, so they match `state`. But they are a **snapshot** and don't
follow your writes. Read from `state` if you need the live value.

## `MovementState`

The object passed to `movement_tick`. Positions use the same feet-relative frame
as `localPlayer.position`.

### Reading

| Member | Type | Description |
| --- | --- | --- |
| `session` | `GameSession` | The session this tick belongs to. |
| `get position` | `Vector3` | Position at the start of this tick. |
| `get motion` | `Vector3` | Velocity at the start of this tick. |
| `get previousPosition` | `Vector3` | The game's own "previous position". The game resets it to the current position at the top of every tick, before `movement_tick`, so here it usually reads the same as `position`. Keep your own copy if you need last tick's position. |
| `get rotation` | `Vector2` | Your real client rotation in degrees (`x` = pitch, `y` = yaw). This is **not** what's sent to the server, so motion based on it ignores any active aim override. |
| `get onGround` | `boolean` | Whether you were on the ground going into this tick. Comes from the game's own `OnGroundFlagComponent`, not guessed from collision flags. It is always one tick behind, since collision resolves after this event. That's the same age as the packet's `vertical_collision`, which it replaces. |
| `get moveInput` | `Vector2` | This tick's move request (`x` = strafe, `y` = forward, relative to the player), as the game's sprint logic tests it. Read live from memory, unlike `localPlayer.moveVector`. |
| `get isMoving` | `boolean` | Whether the player is trying to move at all this tick. |
| `get isJumping` | `boolean` | Whether the game fired a jump off the ground this tick. This is the game's decision, not the jump key. The jump is already applied, so `motion` includes it. Climbing scaffolding also reads as a jump. |
| `get didJump` | `boolean` | Whether a jump off the ground happened this tick: the game's own (`isJumping`) or one you forced with `jump()`. |
| `get sprinting` | `boolean` | The game's sprint flag, as this tick's sprint systems left it. It includes a sprint request from this tick's `input_tick`, but not one from `movement_tick`, which applies next tick. This is the flag the sprint-jump boost goes by. |
| `get isSprintJumping` | `boolean` | `isJumping && sprinting`. The one kind of jump whose motion depends on yaw. |
| `get jumpDelay` | `number` | Ticks until a held jump can fire again. See [Jumping](#jumping). |

Rotation is **read-only** here. Writing it would require keeping head yaw in
sync, so rotation spoofing stays on the packet side through
[`localPlayer.rotationScheduler`](/api/local-player#rotationscheduler).

#### Input the game took

These tell you what the game took from [`input_tick`](/api/input) this tick,
and whether the player or something else put it there.

| Member | Type | Description |
| --- | --- | --- |
| `get inputMove` | `Vector2` | This tick's move input as the game took it, before sneaking slows it (`x` = strafe, **+x is left**; `y` = forward). It's the stick if off centre, else the unit vector of the direction keys. Zero on a tick where the input hook didn't run. |
| `get inputSneak` | `boolean` | Whether the game took the sneak key as held this tick. |
| `get isMoveOverridden` | `boolean` | Whether an `input_tick` listener changed the stick or the direction keys from the player's own. Writing back the value the player already had doesn't count. |
| `get isSneakOverridden` | `boolean` | Whether the sneak key that went in differs from the player's own, because of a [`SneakIntent`](#sneak--sneakintent) or an `input_tick` listener. For example, `SneakIntent.Sneak` while the player already holds sneak doesn't count. |

`inputMove` is the raw input the game took. `moveInput` is the move request the
game's sprint logic works from, which the game builds from that input later in
the tick.

### Writing

| Method | Description |
| --- | --- |
| `setPosition(position)` | Teleport for this tick. Movement and collision still run from the new position. |
| `setMotion(motion)` | Set velocity for this tick. Works like vanilla `lerpMotion`: gravity and friction still apply on top. |
| `addMotion(motion)` | Add to the current motion. |
| `strafe(speed?, strength?)` | Apply strafe motion in the direction you're moving. `speed` defaults to the current horizontal speed. `strength` (0–1, default 1) blends the current motion with the new one. |
| `jump(jumpVelocity?)` | Force a jump. Returns `false` if the server wouldn't accept it right now. See [Jumping](#jumping). |
| `setJumpDelay(ticks)` | Set the jump delay. See [Jumping](#jumping). |
| `requestSprint(intent)` | Ask for a sprint state **next tick**. See [below](#sprint--sprintintent). |
| `requestSneak(intent)` | Hold or release the sneak key **next tick**. See [below](#sneak--sneakintent). |
| `compensateSprintJump(sentYaw, sprinting?)` | Correct a sprint jump under an aim override. See [below](#sprint-jumps-under-an-aim-override). |
| `takeOverSprintJump()` | Remove the game's sprint-jump boost so you can apply your own. See [below](#sprint-jumps-under-an-aim-override). |
| `afterCommit(fn)` | Run `fn` after every listener and the rotation commit. See [below](#after-the-commit--aftercommit). |

`setPosition`, `setMotion` and `addMotion` accept any `IVector3`, so a plain
`{ x, y, z }` works.

`strafe()` takes its direction from this tick's `moveInput` and `isMoving`, so
it pairs with this tick's `rotation`. For full control, compute the motion
yourself with `utils.computeStrafe(...)`.

## Sprint — `SprintIntent`

You don't set sprinting directly. Instead you request an **intent**, and the
strongest request wins. If two modules disagree, the result is the same no
matter which listener ran first.

```ts
import { SprintIntent } from "@protohax/userscript";

ctx.on("movement_tick", (state) => {
  state.requestSprint(SprintIntent.Sprint);
});
```

| Value | Meaning |
| --- | --- |
| `SprintIntent.AsIs` | Leave the game's own sprint logic alone. |
| `SprintIntent.Sprint` | Keep sprinting **on**. The game's "stop sprinting" signal is ignored, so sprint survives rotation, low hunger and item use. |
| `SprintIntent.NotSprint` | Keep sprinting **off**. The game can never start sprinting. |

`NotSprint` beats `Sprint`, which beats `AsIs`. Use `requestSprint(...)` rather
than assigning `state.sprint` directly, since a direct assignment can lower
another module's request.

### When it takes effect

The game's sprint systems run **before** `movement_tick`. So a request from
`movement_tick` applies on the **next** tick. It's carried into the next
[`input_tick`](/api/input), where listeners can only raise it.

To change sprint on **this** tick, and so on this tick's packet, request it from
`input_tick` instead:

```ts
import { SprintIntent } from "@protohax/userscript";

ctx.on("input_tick", (input) => {
  input.requestSprint(SprintIntent.Sprint);
});
```

The same precedence applies there, and the last `movement_tick`'s request
counts too.

`state.sprinting` reports the game's flag after this tick's sprint systems ran.
It already reflects a request from this tick's `input_tick`, but not one made
during `movement_tick`.

### The facing check

Vanilla only sprints while you move roughly forward. With an aim override, the
direction you travel and the yaw the server sees can disagree, and a sprint
the server sees going sideways or backwards is an obvious tell.

So once every `input_tick` listener has run, ProtoHax compares the direction
of this tick's input (`input.move` turned by your real yaw) against the yaw
being sent. If they are more than **45°** apart, it requests
`SprintIntent.NotSprint`. The yaw being sent is `rotationScheduler.current`, or
your real yaw when nothing overrides it.

- The check runs **even with the Sprint module off**, since a sprint the player
  started looks just as wrong.
- With the Sprint module on, it only runs when **Required Input** is `Forward`.
  The other input modes ask for sprinting in any direction, so they skip it.
- It doesn't run on a tick with no move input.

`NotSprint` beats `Sprint`, so your own `requestSprint(SprintIntent.Sprint)`
loses to it. To sprint in a direction the camera isn't facing, send a yaw along
the travel direction through
[`rotationScheduler`](/api/local-player#rotationscheduler). See
[Moving independently of the camera](/api/input#moving-independently-of-the-camera).

## Sneak — `SneakIntent`

Sneaking works like sprinting. You request an **intent** for the sneak key, and
the strongest request wins.

```ts
import { SneakIntent } from "@protohax/userscript";

ctx.on("movement_tick", (state) => {
  if (state.onGround) state.requestSneak(SneakIntent.Sneak);
});
```

| Value | Meaning |
| --- | --- |
| `SneakIntent.AsIs` | Leave the sneak key to the player. |
| `SneakIntent.Sneak` | Hold the sneak key, as if the player pressed it. |
| `SneakIntent.NotSneak` | Release the sneak key, whatever the player holds. |

`NotSneak` beats `Sneak`, which beats `AsIs`. As with sprint, prefer
`requestSneak(...)` over assigning `state.sneak` directly.

The game took this tick's input before `movement_tick`, so a sneak intent
applies on the **next** tick. It's applied to the next `input_tick`'s state
before its listeners run, so an `input_tick` listener still has the last word.
To sneak on **this** tick, call [`setSneak`](/api/input#what-goes-in) from
`input_tick`.

## Jumping

`state.jump(jumpVelocity?)` forces a jump. `jumpVelocity` defaults to `0.42`,
plus `0.1` per level of Jump Boost. It sets your vertical motion for this tick,
and the jump flags go out with this tick's packet (see
[`sendJumpFlagNextPacket`](/api/local-player#action-verbs)).

It returns whether the jump was applied:

- **On the ground**, it only jumps when the server would accept a jump, which is
  outside the server's jump delay
  ([`localPlayer.canServerJump`](/api/local-player#jumping)). Otherwise it
  returns `false` and does nothing. When it does jump, it resets your own jump
  delay to 10, the same way the server resets its own, and `didJump` reads
  `true`.
- **In the air**, the server takes no jump anyway, so neither check applies. It
  always jumps and returns `true`.

If the game already jumped this tick (`state.isJumping`), there's no need to
force another. Check `state.didJump` to see whether either kind of jump
happened.

### The jump delay

After a jump off the ground, the game waits before a **held** jump key can fire
again. `state.jumpDelay` is that counter: 10 on the tick a ground jump fires,
then counting down. A held jump fires once it reaches 0.

`state.setJumpDelay(ticks)` sets it. The game only jumps at exactly 0, so the
runtime rounds your value toward zero to a whole number and clamps it at 0 (a
negative delay would never jump again). `NaN` becomes 0.

The server keeps its own delay. It only drops early when the server sees the
jump key released for a tick. Lowering only your own delay makes you jump before
the server allows it. The local player tracks the server's side for you, see
[Jumping](/api/local-player#jumping).

## Sprint jumps under an aim override

A sprint jump is the only tick where your motion depends on your yaw.
`Mob::jumpFromGround` adds `(-sin(yaw), cos(yaw)) * 0.2` when the sprint flag is
set. With an aim override active, the client jumps along its real yaw, but the
server calculates the boost from the yaw in the packet. The positions then
disagree, and nothing later in the tick can explain the difference.

`compensateSprintJump(sentYaw, sprinting?)` adds the difference between the two
boosts, so your total motion matches what the server calculated. It does nothing
unless this tick is a sprint jump and the two yaws differ.

ProtoHax already calls it for you at the end of every movement tick, using the
rotation just committed from
[`rotationScheduler`](/api/local-player#rotationscheduler). You only need to
call it yourself if you send rotations through some path the scheduler doesn't
know about.

### Applying your own boost

If you replace horizontal motion on a sprint jump, for example with `strafe()`,
the game's boost is lost and the correction above only adds the yaw difference.
Call `takeOverSprintJump()` first instead. It removes the game's boost (along
your real yaw) and turns the automatic correction off for this tick. It returns
`true` if this tick is a sprint jump, which means you now owe the boost
yourself. Add it along the sent yaw from [`afterCommit`](#after-the-commit--aftercommit).

```ts
import { utils } from "@protohax/userscript";

ctx.on("movement_tick", (state) => {
  const owesBoost = state.takeOverSprintJump();
  state.strafe(0.3, 1);

  if (owesBoost) {
    state.afterCommit((s) => {
      const yaw = s.session.entityState.localPlayer.serverSideRotation.y * utils.DEG_TO_RAD;
      s.addMotion({ x: -Math.sin(yaw) * 0.2, y: 0, z: Math.cos(yaw) * 0.2 });
    });
  }
});
```

## After the commit — `afterCommit`

`state.afterCommit(fn)` runs `fn(state)` once this tick is decided: after every
`movement_tick` listener, the rotation commit and the sprint-jump correction.
Motion you write there still lands on this tick.

Use it for anything aimed along the **sent** rotation. Inside a listener,
`localPlayer.serverSideRotation` is still the previous tick's commit.

`requestSprint` and `requestSneak` still work from inside `afterCommit`. Like a
request from the listener itself, they apply on the next tick.

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

Rules of thumb for the `movement_tick` handler:

- No allocation-heavy loops, no `JSON` work, no scanning the entity map or chunk
  data.
- Nothing asynchronous. A promise resolves long after the tick is gone.
- No `console.log` every tick. Logging isn't free.
- Cache anything derived from options or world state, and refresh it from
  `tick`.

## Examples

**Speed:** apply a flat horizontal speed while moving.

```ts
ctx.on("movement_tick", (state) => {
  if (state.isMoving) state.strafe(ctx.options.speed.value, 1);
});
```

**Air jump / long jump:** jump off the ground and keep momentum. `jump()`
returns `false` inside the server's jump delay, so only boost when it jumped.

```ts
ctx.on("movement_tick", (state) => {
  if (state.onGround && state.isMoving && (state.isJumping || state.jump())) {
    state.strafe(0.5, 1);
  }
});
```

**Force sneak:** hold sneak on this tick through `input_tick`. See
[Input & the Input Tick](/api/input) for more.

```ts
ctx.on("input_tick", (input) => {
  if (input.onGround) input.setSneak(true);
});
```

**Velocity (anti-knockback):** cancel incoming motion for a few ticks.

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

**Keep sprint off while using an item:** request it from `input_tick`, so it
applies on the same tick.

```ts
import { SprintIntent } from "@protohax/userscript";

ctx.on("input_tick", (input) => {
  if (usingItem) input.requestSprint(SprintIntent.NotSprint);
});
```

## Migrating from the old local-player verbs

`setPosition`, `setMotion`, `addMotion`, `strafe` and `jump` have been removed
from `localPlayer`. They worked on the packet path and needed a client
correction. They now live on `MovementState`:

| Before | Now |
| --- | --- |
| `ctx.on("tick", () => player.strafe(s, 1))` | `ctx.on("movement_tick", (state) => state.strafe(s, 1))` |
| `player.jump()` | `state.jump()` |
| `player.setMotion(v)` / `addMotion(v)` | `state.setMotion(v)` / `state.addMotion(v)` |
| `player.setPosition(v, takeover)` | `state.setPosition(v)`. There is no takeover flag: the write *is* the movement. |

The `movementTakeover` argument has no replacement. Nothing needs to be faked
back to the client anymore, because the client really moved.
