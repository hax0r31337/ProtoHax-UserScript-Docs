---
id: events-and-packets
title: Events & Packets
sidebar_position: 4
---

# Events & Packets

Your module reacts to the game by subscribing through `ctx`, at one of two
levels:

- **[Game events](#game-events)** (`ctx.on`): high-level, decoded signals, like
  a tick passing, an entity spawning, or a block changing.
- **[Packets](#packets)** (`ctx.onPacket` / `ctx.onInjectedPacket`): the raw
  protocol, one handler per packet type.

All three only fire while the module is enabled, and they're torn down with the
session, so you never unsubscribe by hand. See
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
| `local_player_initialized` | `()` | The client finished loading into the world and spawned. Fires once after each `start_game`. |
| `teleport` | `()` | The local player was teleported. |
| `dimension_change` | `()` | The dimension changed. |
| `tick` | `()` | Each game tick, while its auth-input packet is being handled. |
| `post_tick` | `()` | Each game tick, after its auth-input packet was handled. |
| `input_tick` | `(state: InputState)` | The game takes the player's input for a tick, before `movement_tick`. **Performance-critical**, see below. |
| `movement_tick` | `(state: MovementState)` | The game's own movement tick, before the client travels. **Performance-critical**, see below. |
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
| `key` | `(keyId: number, type: KeyEventType)` | A key was pressed, held or released. See [below](#key--keyboard-input). |

`HotbarSlotEvent` is `{ from: number; to: number; isIncoming: boolean }`.

### `key` — keyboard input

`key` reports the keys the client UI sees:

- `keyId` is Flutter's `LogicalKeyboardKey.keyId`, the same number a
  [`keybind` option](/guides/options#keybinds) holds.
- `type` is `"down"` when the key is pressed, `"repeat"` while it's held and
  the key repeats, and `"up"` when it's released.

```ts
ctx.on("key", (keyId, type) => {
  if (type === "up" && keyId === ctx.options.bind.value) {
    // the bound key was released
  }
});
```

To just react to a bound key being pressed, give the keybind option a
[`listener`](/guides/options#keybinds) instead. It's also called by the
option's shortcut on Android, which `key` never sees.

A few things to know:

- **Presses aren't sent while the menu is open**, so typing in the menu
  doesn't trigger your binds. Releases still are, so you never see a key stuck
  down.
- **It fires on every open session.** Unlike most events, it isn't tied to
  one server's traffic.
- **Keys come without a side.** Left and right Shift are both Shift, and the
  same goes for Control, Alt and Meta.
- **Keys need a keyboard.** That's a desktop, or an Android device with a
  keyboard attached.

### `tick` vs. `post_tick`

- `tick` fires **while** the proxy handles the tick's `player_auth_input`
  packet, before it's sent on. Good for editing that packet's input flags.
- `post_tick` fires **after** every listener has handled it. Good for reading
  the resulting state.

For a one-off action on the next tick, `session.events.once("post_tick", fn)`
is handy. See [The Session](/api/session#sessionevents).

Both run on the **packet path**: they fire while the proxy handles the client's
`player_auth_input` packet, off the game thread. That's where expensive work
belongs.

### `movement_tick` — the game's own tick

`movement_tick` is a different beast. It's fired from native code inside the
client's movement tick, **before the player travels**. It gives you a
[`MovementState`](/api/movement) whose position and motion you can write, and
your changes apply in that same tick. Everything that moves the local player
goes through it.

```ts
ctx.on("movement_tick", (state) => {
  state.strafe(ctx.options.speed.value, 1);
});
```

:::danger[`movement_tick` is performance-critical]

The handler runs **synchronously on the game thread, which is blocked while it
runs**. Any time you spend here comes straight out of the client's frame
budget. If the hook hasn't answered after **200 ms**, the runtime gives up and
the tick goes ahead unmodified.

**Do heavy work in the packet `tick` event instead**: pathfinding, raytracing,
entity scans, block searches. Cache the result there, and have `movement_tick`
only apply it. Full pattern:
[Deferring heavy work](/api/movement#deferring-heavy-work).

:::

### `input_tick` — the player's input

`input_tick` fires just before `movement_tick`, at the moment the game takes
the player's input. It gives you an [`InputState`](/api/input) with the move
keys, the analog stick and the sneak key. What you write there is that tick's
input, as if the player had pressed it.

```ts
ctx.on("input_tick", (input) => {
  input.setSneak(true);
});
```

It runs on the game thread too, so the same performance rules apply.

### Order within a tick

1. `input_tick`: the game takes the input. Sprint and sneak changes made here
   apply on this tick.
2. The game's sprint and sneak systems run, then its own jump logic.
3. `movement_tick`: position, motion and jump writes apply on this tick. Sprint
   and sneak intents requested here apply on the next tick.
4. The client travels.
5. `tick`: the resulting auth-input packet is being handled.
6. `post_tick`: that packet has been handled.

So `input_tick` and `movement_tick` see the tick before it happens, and `tick`
sees what it produced. The
[Movement page](/api/movement#where-it-sits-in-a-tick) has the full sequence
and which fields are fresh at each step.

## Packets

- `ctx.onPacket(name, cb)` subscribes to a packet on the **real connection**,
  in either direction. `packet.isIncoming` tells you which way it's going.
- `ctx.onInjectedPacket(name, cb)` subscribes to a **locally-injected** one.

```ts
ctx.onPacket("add_player", (packet) => {
  console.log("add_player", packet);
});
```

`name` can be any key of `FullPacketEvents`. That's the full generated protocol
packet map, plus one extra event, `post_packet`, which fires after any packet is
processed. Your editor autocompletes every packet name and its payload.

There's no catch-all event: you subscribe to each packet by name. To see every
packet, register a [queue checker](/api/packets#packetqueuechecker).

Some packets come in several variants. `text`, for example, has one per message
`type`, and not every variant has a `message`. Check the variant first, and
TypeScript narrows the packet to that variant's fields.

### Mutating packets

Every packet handler gets the parsed packet with a small `PacketWrapper`
contract mixed in:

| Member | Description |
| --- | --- |
| `isIncoming` | Whether the packet came from the server. |
| `isCancelled` | Set to `true` to **drop** the packet (it won't be forwarded). |
| `markDirty()` | Call after **editing** the packet's fields so your change is re-encoded and forwarded. |

To **drop** a packet, set `isCancelled`:

```ts
ctx.onPacket("text", (packet) => {
  if (packet.type !== "chat") return;
  if (packet.message.includes("spam")) {
    packet.isCancelled = true;
  }
});
```

To **edit** a packet, change its fields, then call `markDirty()`:

```ts
ctx.onPacket("text", (packet) => {
  if (packet.type !== "chat") return;
  packet.message = packet.message.toUpperCase();
  packet.markDirty(); // without this, the original bytes are sent unchanged
});
```

:::warning[`markDirty()` is required for edits]

Changing a field on the packet object does nothing by itself. The connection
forwards the original bytes unless you call `markDirty()`, which tells it to
re-encode from your modified object. (Cancelling with `isCancelled` doesn't
need `markDirty()`.)

:::

To *send* packets instead of reacting to them, or to hold and flush the packet
queue, use [`session.connection`](/api/packets).

:::note[Injected vs. inbound]

`onPacket` sees packets travelling between the real client and server.
`onInjectedPacket` sees packets that your code (or another module's) injected
with [`connection.sendIncomingPacket` or
`sendOutgoingPacket`](/api/packets#sending-packets). Subscribe to whichever
matches the source you care about.

:::
