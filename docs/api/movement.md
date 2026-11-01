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

To change what the player *presses* instead (the move keys, the stick, the
sneak and sprint keys), or the rotation the tick is played on, use the earlier
[`input_tick`](/api/input) event. By the time `movement_tick` fires, the game
has already taken both.

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
| 1 | [`input_tick`](/api/input) fires. The local player refreshes `position`, `motion`, `rotation` and the on-ground flag from memory. Listeners can rewrite the move keys, stick, sneak and sprint keys, request a sprint state, and request this tick's aim through `rotationScheduler`. |
| 2 | The rotation override is **committed**, and the move is turned onto it. The tick's sprint is settled, and what went in is kept as [`localPlayer.lastInputTick`](/api/input#what-went-in--lastinputtick). |
| 3 | The game's sprint and sneak systems run on the final input and the committed rotation, and a jump fires if the game decides on one. |
| 4 | `movement_tick` fires. Before any module listener runs, the local player's `motion` is refreshed again, now with this tick's jump in it. |
| 5 | Your `movement_tick` listeners run: read the state, write position or motion, jump. Then any [`afterCommit`](#after-the-listeners--aftercommit) callbacks. |
| 6 | The game moves the player and resolves collision using whatever you wrote. |
| 7 | The resulting `player_auth_input` packet reaches the proxy. `tick` fires, then `post_tick`. |

So `input_tick` is the *earliest* point in a tick, `movement_tick` comes next,
and `tick` is when that tick's result is on the wire. Input and rotation are
decided in `input_tick` only: the game has taken them by the time
`movement_tick` fires. A jump or motion written in `movement_tick` ends up on
this tick's packet. An aim requested from `movement_tick` lands on the **next**
tick.

### What is fresh and what is one tick old

`MovementState` reads game memory, so its fields describe **this** tick. So do
the local player fields that `input_tick` settled. Others have no memory source
and still come from the last packet. During `movement_tick` those describe the
**previous** tick:

| Fresh | One tick behind (on `localPlayer`) |
| --- | --- |
| `state.position`, `state.motion`, `state.onGround` | `localPlayer.inputData` |
| `state.rotation`, `state.moveInput`, `state.isMoving` | `localPlayer.verticalCollision` / `horizontalCollision` |
| `state.isJumping`, `state.sprinting`, `state.jumpDelay` | |
| `localPlayer.lastInputTick`, `localPlayer.isMoving` | |
| `localPlayer.serverSideRotation` (this tick's commit) | |

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
| `get rotation` | `Vector2` | The rotation the game moves by this tick, in degrees (`x` = pitch, `y` = yaw). This is the one sent to the server: the aim committed at `input_tick` if there is one, else your real rotation. Under an aim, its yaw is unwrapped to within 180° of the real one, so it can read past ±180°. The camera's rotation is `localPlayer.rotation`. |
| `get onGround` | `boolean` | Whether you were on the ground going into this tick. Comes from the game's own `OnGroundFlagComponent`, not guessed from collision flags. It is always one tick behind, since collision resolves after this event. That's the same age as the packet's `vertical_collision`, which it replaces. |
| `get moveInput` | `Vector2` | This tick's move request (`x` = strafe, `y` = forward, relative to `rotation`), as the game's sprint logic tests it. Read live from memory. |
| `get isMoving` | `boolean` | Whether the player is trying to move at all this tick. |
| `get isJumping` | `boolean` | Whether the game fired a jump off the ground this tick. This is the game's decision, not the jump key. The jump is already applied, so `motion` includes it. Climbing scaffolding also reads as a jump. |
| `get didJump` | `boolean` | Whether a jump off the ground happened this tick: the game's own (`isJumping`) or one you forced with `jump()`. |
| `get sprinting` | `boolean` | The game's sprint flag, as this tick's sprint systems left it, including this tick's `input_tick` sprint request. This is the flag the sprint-jump boost goes by. |
| `get isSprintJumping` | `boolean` | `isJumping && sprinting`. The one kind of jump whose motion depends on yaw. The game boosted it along `rotation`, the sent yaw, just as the server does. |
| `get jumpDelay` | `number` | Ticks until a held jump can fire again. See [Jumping](#jumping). |

Rotation is **read-only** here. The tick's rotation is decided in
[`input_tick`](/api/input#rotation--the-ticks-aim) through
[`localPlayer.rotationScheduler`](/api/local-player#rotationscheduler).

#### Input the game took

What the game took from [`input_tick`](/api/input) this tick, and whether the
player or something else put it there, is
[`localPlayer.lastInputTick`](/api/input#what-went-in--lastinputtick). By
`movement_tick` it's this tick's.

`lastInputTick.move` is the raw input the game took. `moveInput` is the move
request the game's sprint logic works from, which the game builds from that
input later in the tick (scaled down while sneaking, for example).

### Writing

| Method | Description |
| --- | --- |
| `setPosition(position)` | Teleport for this tick. Movement and collision still run from the new position. |
| `setMotion(motion)` | Set velocity for this tick. Works like vanilla `lerpMotion`: gravity and friction still apply on top. |
| `addMotion(motion)` | Add to the current motion. |
| `strafe(speed?, strength?)` | Apply strafe motion in the direction you're moving. `speed` defaults to the current horizontal speed. `strength` (0–1, default 1) blends the current motion with the new one. |
| `jump(jumpVelocity?)` | Force a jump. Returns `false` if the server wouldn't accept it right now. See [Jumping](#jumping). |
| `setJumpDelay(ticks)` | Set the jump delay. See [Jumping](#jumping). |
| `takeOverSprintJump()` | Remove the game's sprint-jump boost so you can apply your own. See [below](#sprint-jumps). |
| `afterCommit(fn)` | Run `fn` after every listener. See [below](#after-the-listeners--aftercommit). |

`setPosition`, `setMotion` and `addMotion` accept any `IVector3`, so a plain
`{ x, y, z }` works.

`strafe()` takes its direction from this tick's `moveInput` and `isMoving`, so
it pairs with this tick's `rotation`. For full control, compute the motion
yourself with `utils.computeStrafe(...)`.

## Sprint and sneak

Sprint and sneak are input, so they're controlled from
[`input_tick`](/api/input) only. `MovementState` has no sprint or sneak
requests: by the time `movement_tick` fires, the game's sprint and sneak
systems have already run on this tick's input.

- Sneak: [`input.setSneak(held)`](/api/input#what-goes-in).
- Sprint: [`input.setSprintKey(held)`](/api/input#the-sprint-key), or a
  [`SprintIntent`](/api/input#sprint--sprintintent) through
  `input.requestSprint(intent)`.

`state.sprinting` reports the game's flag after this tick's sprint systems ran.

If you used the old `requestSprint` / `requestSneak` here, see
[Migrating from the movement-tick intents](#migrating-from-the-movement-tick-intents).

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

## Sprint jumps

A sprint jump is the only tick where your motion depends on your yaw.
`Mob::jumpFromGround` adds `(-sin(yaw), cos(yaw)) * 0.2` when the sprint flag is
set.

The game takes the whole tick on the rotation committed at `input_tick`, so it
boosts along the **sent** yaw (`state.rotation`), exactly as a server simulating
your packet does. Under an aim override there's nothing to correct.

### Applying your own boost

If you replace horizontal motion on a sprint jump, for example with `strafe()`,
the game's boost is lost. Call `takeOverSprintJump()` first. It removes the
game's boost (along `state.rotation`, already in `motion`), and only once per
tick. It returns `true` if this tick is a sprint jump, which means you now owe
the boost yourself. Add it along `state.rotation`, the yaw the server boosts
by:

```ts
import { utils } from "@protohax/userscript";

ctx.on("movement_tick", (state) => {
  const owesBoost = state.takeOverSprintJump();
  state.strafe(0.3, 1);

  if (owesBoost) {
    const yaw = state.rotation.y * utils.DEG_TO_RAD;
    state.addMotion({ x: -Math.sin(yaw) * 0.2, y: 0, z: Math.cos(yaw) * 0.2 });
  }
});
```

## After the listeners — `afterCommit`

`state.afterCommit(fn)` runs `fn(state)` after every `movement_tick` listener.
Motion you write there still lands on this tick. Use it when you need to see
what the other listeners wrote.

The rotation is committed at `input_tick` now, so `state.rotation` and
`localPlayer.serverSideRotation` are already this tick's inside a listener as
well as inside `afterCommit`.

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

**Keep sprint off while using an item:** release the sprint key from
`input_tick`, so it applies on the same tick. The `NotSprint` request also
stops a sprint that's already running.

```ts
import { SprintIntent } from "@protohax/userscript";

ctx.on("input_tick", (input) => {
  if (!usingItem) return;
  input.setSprintKey(false);
  input.requestSprint(SprintIntent.NotSprint);
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

## Migrating from the movement-tick intents

Sprint and sneak used to be requestable from `movement_tick` for the next tick,
and the aim was committed at the end of `movement_tick`, so aiming from there
landed on the same tick. All of them are decided in
[`input_tick`](/api/input) now. **An aim requested from `movement_tick` now
lands a tick late**, so move your `rotationScheduler.request(...)` calls to
`input_tick`:

| Before | Now |
| --- | --- |
| `state.requestSprint(intent)` in `movement_tick` | `input.setSprintKey(true)`, or `input.requestSprint(intent)` in `input_tick`. See [Sprint](/api/input#sprint--sprintintent). |
| `state.requestSneak(SneakIntent.Sneak)` / `NotSneak` | `input.setSneak(true)` / `setSneak(false)` in `input_tick`. `SneakIntent` is gone. |
| `state.compensateSprintJump(sentYaw)` | Removed. The game boosts a sprint jump along the sent yaw itself. |
| `takeOverSprintJump()` + boost from `afterCommit` via `serverSideRotation` | `takeOverSprintJump()` + boost along `state.rotation`, right in the listener. |
| `state.inputMove`, `inputSneak`, `isMoveOverridden`, `isSneakOverridden` | `localPlayer.lastInputTick.move`, `.sneak`, `.moveOverridden`, `.sneakOverridden`. `move` is relative to the aim when there is one. |
| `localPlayer.moveVector` | `localPlayer.lastInputTick?.move`. |
| `rotationScheduler.request(...)` from `movement_tick` | The same call from `input_tick`. From `movement_tick` it now lands a tick later. |
| `state.rotation` was the real rotation | `state.rotation` is the sent one. The camera's is `localPlayer.rotation`. |

`SprintIntent` is still a top-level export of `@protohax/userscript`.
