---
id: packets
title: Packets & Connection
sidebar_position: 7
---

# Packets & Connection

`session.connection` is a **`Connection`** — the man-in-the-middle link between
the client and the server. Through it you inject packets in either direction and
gate/flush the packet queue.

To *listen* for packets, use [`ctx.onPacket` / `ctx.onInjectedPacket`](/guides/events-and-packets#packets).
This page is about *sending* and *flow-controlling* them.

## `Connection`

| Member | Signature | Description |
| --- | --- | --- |
| `sendOutgoingPacket(type, data)` | `void` | Inject a packet toward the **server** (client → server). |
| `sendIncomingPacket(type, data)` | `void` | Inject a packet toward the **client** (server → client). |
| `addPacketQueueChecker(checker)` | `void` | Register a checker that can hold matching packets in the queue. |
| `removePacketQueueChecker(checker)` | `void` | Remove a previously registered checker. |
| `flushHeld(isIncoming, filter?)` | `void` | Drain (some of) the held queue for a direction. |
| `actualProtocolVersion` | `number` | The protocol version negotiated with the server. |

## Sending packets

`type` is any packet name from the [`PacketEvents`](/guides/events-and-packets#packets)
map; `data` is that packet's payload (minus the wrapper fields, typed as
`PacketData<T>`). Your editor autocompletes both.

```ts
// tell the server we sent a chat message
ctx.session.connection.sendOutgoingPacket("text", {
  type: "chat",
  needs_translation: false,
  source_name: "",
  message: "hello",
  xuid: "",
  platform_chat_id: "",
  filtered_message: "",
});

// make the CLIENT think it received a packet
ctx.session.connection.sendIncomingPacket("set_time", { time: 6000 });
```

The exact field set for each packet is defined by the vendored protocol
definitions — lean on autocomplete/type errors to fill in the payload.

## Packet shapes move with the client

The protocol definitions are regenerated against the client version the host
targets, so payload shapes are **not** stable across releases — this is a large
part of why the [API is 0.x](/#the-protohaxuserscript-package). Recent changes
worth knowing about:

| Change | What it means for a script |
| --- | --- |
| `player_auth_input.input_data` is now `InputData[]` (a list of string tags) instead of a flags object | `packet.input_data.start_jumping` → `packet.input_data?.includes("start_jumping")`, or use the [local player's helpers](/api/local-player#auth-input-data). The field can be `undefined`. |
| Optional fields carry an explicit `*_presence` boolean | When **injecting** a packet with an optional block (`transaction`, `item_stack_request`, `block_action`, …), set both the `_presence` flag and the value. |
| The old `Item` network type is gone; `ItemV4` is the single item shape | Anything hand-building an item payload uses the `ItemV4` fields. |
| `move_entity_delta` flattened: `flags` is gone, `on_ground` and the `force_*` flags are top-level, and the coordinate fields are `number \| undefined` | Read `packet.on_ground` / `packet.x` directly instead of going through `packet.flags`. |
| Optional fields are typed `T \| undefined` rather than `field?: T` | Injected payloads must list them explicitly, even as `undefined`. |

When a packet's shape changes under you, the type error points at the field —
lean on it rather than on the old field names.

## Holding & flushing packets (the queue)

A **queue checker** can hold packets in a per-direction queue instead of letting
them pass. This is how features like "blink" (freeze outgoing movement, then
release) are built.

```ts
import type { PacketQueueChecker } from "@protohax/userscript";

const blink: PacketQueueChecker = {
  // return true to HOLD the packet in the queue
  shouldQueue(name, body, isIncoming, isInjected) {
    return !isIncoming && name === "player_auth_input";
  },
};

defineModule(
  { name: "Blink" },
  {},
  (ctx) => {
    ctx.onEnable(() => ctx.session.connection.addPacketQueueChecker(blink));
    ctx.onDisable(() => {
      ctx.session.connection.removePacketQueueChecker(blink);
      // release everything we held, in FIFO order
      ctx.session.connection.flushHeld(false);
    });
  },
);
```

### `PacketQueueChecker`

```ts
interface PacketQueueChecker {
  shouldQueue(
    name: string,
    body: any,
    isIncoming: boolean,
    isInjected: boolean,
  ): boolean; // true = hold in the per-direction queue
}
```

Called per packet — before event dispatch for incoming, after dispatch for
outgoing.

### `flushHeld(isIncoming, filter?)`

Drain the held queue for one direction. Without a `filter`, **all** held packets
are released in FIFO order. With a `filter`, each `HeldPacket`'s fate is decided
individually.

`flushHeld` does **not** re-run the gate — released packets go through
regardless of current checker state.

```ts
import { FlushAction } from "@protohax/userscript";

// selectively release: drop movement, release everything else
ctx.session.connection.flushHeld(false, (held) => {
  if (held.name === "player_auth_input") return FlushAction.Drop;
  return FlushAction.Release;
});
```

The filter returns a `FlushAction`:

| Value | Meaning |
| --- | --- |
| `FlushAction.Release` | Remove from queue, dispatch through events, then send. |
| `FlushAction.Drop` | Remove from queue without sending (silently discarded). |
| `FlushAction.Keep` | Leave in queue, continue iterating. |

### `HeldPacket`

| Member | Type |
| --- | --- |
| `name` | `string` |
| `raw` | `Uint8Array` |
| `parsed` | `any` |
| `isIncoming` | `boolean` |
| `isInjected` | `boolean` |
| `timestamp` | `number` |
