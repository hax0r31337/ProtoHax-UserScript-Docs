---
id: events-and-packets
title: Events & Packets
sidebar_position: 4
---

# Events & Packets

A module reacts by subscribing through `ctx`. There are two layers:

- **[Game events](#game-events)** (`ctx.on`) — high-level, decoded signals: a
  tick passed, an entity spawned, a block changed.
- **[Packets](#packets)** (`ctx.onPacket` / `ctx.onInjectedPacket`) — the raw
  protocol, one handler per packet type.

All three bind to the module's enabled state and tear down with the session — you
never unsubscribe by hand. See
[The Context](/guides/getting-started/context#listeners-only-fire-while-enabled).

## Game events

```ts
ctx.on("entity_spawn", (entity) => {
  console.log("spawned", entity.name);
});
```

The full `GameSessionEvents` map:

| Event | Payload | Fires when |
| --- | --- | --- |
| `open` | `(address: string)` | The session connected. |
| `close` | `()` | The session closed. |
| `local_player_initialized` | `()` | The local player finished initializing. |
| `teleport` | `()` | The local player was teleported. |
| `dimension_change` | `()` | The dimension changed. |
| `tick` | `()` | Each game tick (before processing). |
| `post_tick` | `()` | Each game tick (after processing). |
| `movement_tick` | `(state: MovementState)` | The game's own movement tick, before the client travels. **Performance-critical** — see below. |
| `entity_spawn` | `(entity: AbstractEntity)` | An entity appeared. |
| `entity_despawn` | `(entity: AbstractEntity)` | An entity was removed. |
| `chunk_load` | `(x, z, y, subchunk: SubChunk)` | A subchunk loaded. |
| `chunk_unload` | `(x, z)` | A chunk unloaded. |
| `block_update` | `(x, y, z, layer, block: BlockState)` | A block changed. |
| `start_break` | `(position: Vector3, face, isInjected)` | Block breaking began. |
| `progress_break` | `(breakingProgress, tickProgress)` | Break progress ticked. |
| `form_open` / `form_close` | `()` | A modal form opened/closed. |
| `container_open` / `container_close` | `()` | A container opened/closed. |
| `hotbar_slot` | `(event: HotbarSlotEvent)` | The held hotbar slot changed. |
| `target_active` | `(entity: EntityNetworkPlayer)` | A combat target became active. |
| `target_inactive` | `(entity: EntityNetworkPlayer)` | A combat target became inactive. |
| `target_killed` | `(entity: EntityNetworkPlayer)` | A combat target was killed. |
| `player_list_add` | `(entry: PlayerListEntry)` | A player joined the tab list. |
| `player_list_remove` | `(entry: PlayerListEntry)` | A player left the tab list. |

`HotbarSlotEvent` is `{ from: number; to: number; isIncoming: boolean }`.

### `tick` vs. `post_tick`

`tick` fires before the client processes the tick (good for injecting input);
`post_tick` fires after (good for reading the resulting state). For a one-shot
next-tick action, `session.events.once("post_tick", fn)` is handy — see
[The Session](/api/session#sessionevents).

Both run on the **packet path**: they fire while the client's `player_auth_input`
packet is being handled by the proxy, off the game thread. That is where any
expensive work belongs.

### `movement_tick` — the game's own tick

`movement_tick` is a different thing entirely: it is fired from native inside the
client's movement tick, **before the player travels**, and it hands you a
[`MovementState`](/api/movement) whose position and motion are writable and land
in that same tick. Everything that moves the local player goes through it.

```ts
ctx.on("movement_tick", (state) => {
  state.strafe(ctx.options.speed.value, 1);
});
```

:::danger[`movement_tick` is performance-critical]

The handler runs **synchronously on the game thread, with the thread blocked**,
and the runtime abandons the hook after **20 ms**. Time spent here is taken
straight out of the client's frame budget, and a result produced late has
already missed the tick it was for.

**Defer heavy calculations to the packet `tick` event** — pathfinding,
raytracing, entity scans, block searches — cache the outcome, and let
`movement_tick` do nothing but apply it. Full pattern:
[Deferring heavy work](/api/movement#deferring-heavy-work).

:::

Ordering within one tick: `movement_tick` → the client travels → `tick` (the
resulting auth-input packet) → `post_tick`. So `movement_tick` sees the tick
before it happens, and `tick` sees what it produced. The
[Movement page](/api/movement#where-it-sits-in-a-tick) has the full sequence and
which fields are fresh in which.

## Packets

`ctx.onPacket(name, cb)` subscribes to an **inbound** packet;
`ctx.onInjectedPacket(name, cb)` subscribes to a **locally-injected** one.

```ts
ctx.onPacket("add_player", (packet) => {
  console.log("add_player", packet);
});
```

`name` is any key of `FullPacketEvents` — the full generated protocol packet map
plus one extra event, `post_packet` (fires after any packet is processed). Your
editor autocompletes every packet name and its payload shape.

### Mutating packets

Every packet handler receives the parsed packet with a small wrapper contract
(`PacketWrapper`) mixed into the payload:

| Member | Description |
| --- | --- |
| `isIncoming` | Whether the packet came from the server. |
| `isCancelled` | Set to `true` to **drop** the packet (it won't be forwarded). |
| `markDirty()` | Call after **editing** the packet's fields so your change is re-encoded and forwarded. |

**Dropping** a packet — set `isCancelled`:

```ts
ctx.onPacket("text", (packet) => {
  if (packet.message.includes("spam")) {
    packet.isCancelled = true;
  }
});
```

**Editing** a packet — mutate its fields, then call `markDirty()`:

```ts
ctx.onPacket("text", (packet) => {
  packet.message = packet.message.toUpperCase();
  packet.markDirty(); // without this, the original bytes are sent unchanged
});
```

> **⚠ `markDirty()` is required for edits.** Changing a field on the packet
> object does nothing on its own — the connection forwards the original bytes
> unless you call `markDirty()`, which tells it to re-encode from your modified
> object. (Cancelling with `isCancelled` needs no `markDirty()`.)

To *send* packets (rather than react to them), and to hold/flush the packet
queue, use [`session.connection`](/api/packets).

> **Note — injected vs. inbound.** `onPacket` sees packets arriving from the
> server. `onInjectedPacket` sees packets your (or another module's) code
> injected via [`connection.sendIncomingPacket`](/api/packets#sending-packets).
> Subscribe to the one matching the source you care about.
