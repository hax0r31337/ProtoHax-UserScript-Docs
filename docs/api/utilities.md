---
id: utilities
title: Utilities & NBT
sidebar_position: 8
---

# Utilities & NBT

## The `utils` namespace

`utils` is the host's own utility library, re-exported wholesale as a namespace.
Import it and reach for math types, hashing, streams, event emitters, and more:

```ts
import { utils } from "@protohax/userscript";

const pos = new utils.Vector3(100, 64, 100);
```

The namespace mirrors the host's whole utility library, so it's broad. The most
useful pieces for a script:

### Vectors & geometry

| Export | Description |
| --- | --- |
| `Vector3(x, y, z)` | Immutable 3D vector. Fields `x`, `y`, `z` are readonly. |
| `Vector2(x, y)` | Immutable 2D vector (used for rotations). |
| `AABB(min, max)` | Axis-aligned bounding box from two `Vector3`s. |

`IVector3` is the plain `{ x, y, z }` interface many APIs accept — you can pass a
bare object literal where an `IVector3` is expected.

### Math helpers

Common ones: `clamp`, `lerp`, `degToRad`, `radToDeg`, `wrapDegrees`,
`clampPitch`, `getRotationFromVector`, `getLookDirection`, `blockPositionKey` /
`blockPositionFromKey`, `makeEntityAABB`, `computeStrafe`.

### Scheduling

`Scheduler<T>` and `SchedulerPriority` (used by
[`localPlayer.rotationScheduler`](/api/local-player#rotationscheduler)) live
here:

```ts
utils.SchedulerPriority.High; // "High"
```

### Events

`EventEmitter<Events>` — the same emitter the host uses. `on`, `once`, `off`,
`emit`. This is what `session.events` and `entity.entityEvents` are.

### Per-session state

`sessionLocal(init)` creates a typed store keyed by the session — the returned
accessor hands back the same object for the same session everywhere, creating
it with `init` on first access and dropping it with the session. See
[Per-session state](/guides/getting-started/context#per-session-state).

```ts
const combat = utils.sessionLocal(() => ({ ticks: 0 }));
combat(ctx.session).ticks++;
```

### Misc

| Export | Description |
| --- | --- |
| `sendToast(message, kind?)` | Show a client toast. |
| `UUID` | The UUID class (`parse`, `equals`, `toString`, static `ZERO`). |
| `xxh32String`, `fnv1aString` | String hashers. |
| `nanoid`, `generateRandomString` | Random id generation. |
| `ReadStream`, `WriteStream` | Binary IO streams. |

> **Tip — explore with autocomplete.** Because the whole utility tree is
> published, the fastest way to see what's available is to type `utils.` in your
> editor. Members prefixed with `_` are mangled at build time and aren't
> addressable from a script.

## NBT — the `nbt` namespace

The host bundles a **patched** copy of `prismarine-nbt` and re-exports it as
`nbt`. Use it instead of installing `prismarine-nbt` yourself — a separately
installed copy would be the unpatched build and would carry an incompatible
`protodef` instance.

```ts
import { nbt } from "@protohax/userscript";

// e.g. simplify an item's raw NBT compound
const held = ctx.session.entityState.localPlayer.inventory.hand;
if (held?.nbt) {
  const simplified = nbt.simplify(held.nbt.nbt);
}
```

Block states (`BlockState.nbtStates`) and item stacks (`ItemStack.nbt`) hand back
these NBT structures; `nbt.simplify(...)` turns a tag tree into plain JS values.
