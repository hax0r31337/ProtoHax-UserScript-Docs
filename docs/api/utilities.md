---
id: utilities
title: Utilities & NBT
sidebar_position: 10
---

# Utilities & NBT

Two namespaces cover general-purpose helpers: `utils` for math, events,
scheduling and more, and `nbt` for reading NBT data.

## The `utils` namespace

`utils` is the host's own utility library, re-exported as a namespace. Import it
to get math types, hashing, streams, event emitters, and more:

```ts
import { utils } from "@protohax/userscript";

const pos = new utils.Vector3(100, 64, 100);
```

It includes the host's entire utility library, so it's large. These are the
parts most useful to scripts.

### Vectors & geometry

| Export | Description |
| --- | --- |
| `Vector3(x, y, z)` | Immutable 3D vector. `x`, `y` and `z` are readonly. |
| `Vector2(x, y)` | Immutable 2D vector. Rotations are `(pitch, yaw)`: pitch in `x`, yaw in `y`. |
| `AABB(min, max)` | Axis-aligned bounding box from two `Vector3`s. |

`IVector3` is the plain `{ x, y, z }` interface many APIs accept. Wherever an
`IVector3` is expected, you can pass an object literal.

### Math helpers

Common ones: `clamp`, `lerp`, `wrapDegrees`, `clampPitch`,
`getRotationFromVector`, `getLookDirection`, `blockPositionKey` /
`blockPositionFromKey`, `makeEntityAABB`, `computeStrafe`. To convert angles,
multiply by the constants `DEG_TO_RAD` / `RAD_TO_DEG`.

`blockPositionKey(x, y, z)` packs a block position into a `bigint`. For a map
of positions around one origin, such as a search area,
`relativeBlockKey(dx, dy, dz)` packs the offset from that origin into a plain
`number` instead, which is a faster map key. It returns `-1` when an offset is
more than 65536 blocks away.

### Scheduling

`Scheduler<T>` and `SchedulerPriority` live here. They're what
[`localPlayer.rotationScheduler`](/api/local-player#rotationscheduler) uses.

```ts
utils.SchedulerPriority.High; // "High"
```

### Events

`EventEmitter<Events>` is the same emitter the host uses, with `on`, `once`,
`off` and `emit`. Both `session.events` and `entity.entityEvents` are instances
of it.

`on(event, fn, context?, priority?)` takes an optional priority. Lower runs
first, and the default is 10. `utils.EventPriority` has named levels, from
`HIGHEST` (-1000) to `LOWEST` (1000). `once` listeners run after all the others.

There's no `"*"` catch-all event: you always listen to one event by name. To see
every packet, register a
[`PacketQueueChecker`](/api/packets#packetqueuechecker) instead.

### Pathfinding

`astar(start, goal, planner, world, options?)` runs an A* search over block
positions. It returns `{ found, path, iterations, cost }`, where `path` is the
list of block positions from start to goal. The planner decides which moves are
allowed and what they cost. `AirPlanner` is the built-in one: it flies through
air and searches `session.levelState`.

```ts
const player = ctx.session.entityState.localPlayer;
const start = player.position.floor();
const goal = start.add({ x: 20, y: 0, z: 0 });

const result = utils.astar(start, goal, new utils.AirPlanner(), ctx.session.levelState, {
  maxIterations: 5000,
});
if (result.found) {
  const waypoints = utils.simplifyPath(result.path, 1);
}
```

A search can be expensive, so run it from the `tick` event, not
`movement_tick`. See [Deferring heavy work](/api/movement#deferring-heavy-work).

To write your own planner, implement `AStarPlanner<TWorld>`: `neighbors`,
`heuristic` and `isGoal`. Two optional hooks let you cache world lookups for
the length of one search. `beginSearch(start, world)` runs before the search.
`endSearch()` runs after it, even if the search throws. `MinHeap<K>`, the
priority queue behind the search, is generic over its key type (`bigint` by
default).

### Per-session state

`sessionLocal(init)` creates a typed store keyed by session. The accessor it
returns gives back the same object for the same session wherever you call it. The
object is created with `init` on first access and dropped along with the
session. See
[Per-session state](/guides/getting-started/context#per-session-state).

```ts
const combat = utils.sessionLocal(() => ({ ticks: 0 }));
combat(ctx.session).ticks++;
```

### Misc

| Export | Description |
| --- | --- |
| `sendToast(message, icon)` | Show a toast on the client. `icon` is `"info"`, `"success"`, `"warning"` or `"error"`. |
| `UUID` | The UUID class (`parse`, `equals`, `toString`, static `ZERO`). |
| `xxh32String`, `fnv1aString` | String hashers. |
| `nanoid`, `generateRandomString` | Random id generation. |
| `ReadStream`, `WriteStream` | Binary IO streams. |
| `pushUnique(list, value, equals?)` | Append to an array unless an equal element is already in it. Returns whether the list changed. |
| `removeFrom(list, value, equals?)` | Remove the first equal element from an array. Returns whether the list changed. |

:::tip[Explore with autocomplete]

The whole utility tree is published, so the quickest way to see what's there is
to type `utils.` in your editor. Members starting with `_` are renamed at build
time, so you can't use them from a script.

:::

## NBT — the `nbt` namespace

The host bundles a **patched** copy of `prismarine-nbt` and re-exports it as
`nbt`. Use this rather than installing `prismarine-nbt` yourself. A separately
installed copy would be the unpatched build, with an incompatible `protodef`
instance.

```ts
import { nbt } from "@protohax/userscript";

// e.g. simplify an item's raw NBT compound
const held = ctx.session.entityState.localPlayer.inventory.hand;
if (held?.nbt) {
  const simplified = nbt.simplify(held.nbt.nbt);
}
```

Block states (`BlockState.nbtStates`) and item stacks (`ItemStack.nbt`) return
these NBT structures. `nbt.simplify(...)` turns a tag tree into plain JavaScript
values.
