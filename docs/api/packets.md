---
id: packets
title: Packets & Connection
sidebar_position: 7
---

# Packets & Connection

`session.connection` is a `Connection`: the man-in-the-middle link between the
client and the server. Use it to inject packets in either direction and to hold
or release queued packets.

This page covers *sending* packets and *controlling their flow*. To *listen* for
packets, use
[`ctx.onPacket` / `ctx.onInjectedPacket`](/guides/events-and-packets#packets).

## `Connection`

| Member | Type | Description |
| --- | --- | --- |
| `sendOutgoingPacket(type, data)` | `void` | Inject a packet toward the **server** (client → server). |
| `sendIncomingPacket(type, data)` | `void` | Inject a packet toward the **client** (server → client). |
| `addPacketQueueChecker(checker)` | `void` | Register a checker that can hold matching packets in the queue. |
| `removePacketQueueChecker(checker)` | `void` | Remove a registered checker. |
| `flushHeld(isIncoming, filter?)` | `void` | Release some or all held packets for one direction. To hold incoming packets by kind for a delay, use a [`PacketFreezer`](#freezing-packets--packetfreezer). |
| `actualProtocolVersion` | `number` | The protocol version agreed with the server. |

## Sending packets

`type` is any packet name from the
[`PacketEvents`](/guides/events-and-packets#packets) map. `data` is that
packet's payload without the wrapper fields, typed as `PacketData<T>`. Your
editor autocompletes both.

Some packets come in several variants. `text`, for example, has one variant per
message `type`. `PacketData<T>` keeps the variants apart, so the `type` you pick
decides which other fields are required.

```ts
// send a chat message to the server
// (localPlayer.sendChatMessage does this for you)
const { localPlayer } = ctx.session.entityState;
ctx.session.connection.sendOutgoingPacket("text", {
  type: "chat",
  category: "authored", // chat, whisper and announcement carry an author
  needs_translation: false,
  source_name: localPlayer.username,
  message: "hello",
  xuid: localPlayer.xuid,
  platform_chat_id: "",
  has_filtered_message: false,
});

// make the CLIENT think it received a packet
ctx.session.connection.sendIncomingPacket("set_time", { time: 6000 });
```

The fields of each packet come from the bundled protocol definitions. Let
autocomplete and type errors guide you when filling in a payload.

## Packet shapes move with the client

The protocol definitions are regenerated for each client version the host
targets, so packet shapes are **not** stable between releases. This is a big
part of why the [API is 0.x](/#the-protohaxuserscript-package). Recent changes
worth knowing:

| Change | What it means for your script |
| --- | --- |
| `player_auth_input.input_data` is now `InputData[]` (a list of string tags), not a flags object | `packet.input_data.start_jumping` becomes `packet.input_data.includes("start_jumping")`, or use the [local player's helpers](/api/local-player#auth-input-data). The list is always there. |
| The `*_presence` booleans are gone. An optional field is present when it's set | Check the field itself (`if (packet.transaction)`), not `transaction_presence`. When **injecting**, set the field to send it and leave it out to omit it. |
| Optional fields are typed `field?: T` instead of `T \| undefined` | You can leave them out of injected payloads. |
| Packets with variants list their shared fields once: `Shared & (VariantA \| VariantB \| …)` | Check the discriminant first (`packet.type === "chat"`), then read that variant's fields, such as `message`. |
| The old `Item` network type is gone. `ItemV4` is the only item shape | Build item payloads with the `ItemV4` fields. |
| `move_entity_delta` is flattened: `flags` is gone, `on_ground` and the `force_*` flags are top-level, and the coordinate fields are optional | Read `packet.on_ground` / `packet.x` directly instead of through `packet.flags`. |

When a packet's shape changes, the type error points at the field. Trust it over
the old field names.

## Holding & flushing packets (the queue)

A **queue checker** can hold packets in a per-direction queue instead of letting
them through. This is how features like "blink" are built: freeze outgoing
movement, then release it later.

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

Every checker is called for every packet, in both directions and including
injected ones, even when another checker already chose to hold it. Incoming
packets are checked before event dispatch; outgoing packets after it. You can
still edit `body` there and call `body.markDirty()`.

That makes a checker the way to see **every** packet: there's no catch-all
packet event. It has a cost, though. Normally a packet with no listeners is
forwarded without being decoded. While any checker is registered,
every packet gets decoded. So register a checker only while you need it, as in
the blink example above.

### `flushHeld(isIncoming, filter?)`

Releases held packets for one direction. Without a `filter`, **all** held
packets are released in FIFO order. With a `filter`, you decide what happens to
each `HeldPacket`.

`flushHeld` does **not** run the checkers again. Released packets go through
even if a checker would hold them now.

```ts
import { FlushAction } from "@protohax/userscript";

// drop movement, release everything else
ctx.session.connection.flushHeld(false, (held) => {
  if (held.name === "player_auth_input") return FlushAction.Drop;
  return FlushAction.Release;
});
```

The filter returns a `FlushAction`:

| Value | Meaning |
| --- | --- |
| `FlushAction.Release` | Remove from the queue, dispatch through events, then send. |
| `FlushAction.Drop` | Remove from the queue and discard without sending. |
| `FlushAction.Keep` | Leave in the queue and move on to the next packet. |

### `HeldPacket`

| Member | Type |
| --- | --- |
| `name` | `string` |
| `raw` | `Uint8Array` |
| `parsed` | `any` |
| `isIncoming` | `boolean` |
| `isInjected` | `boolean` |
| `timestamp` | `number` |

## Freezing packets — `PacketFreezer`

A `PacketFreezer` freezes incoming packets by kind, the way the built-in
Knockback Delay and Timer Balance modules do: it holds each packet of the kinds
you pick for `delay()` milliseconds, lets them out in the order they came, and
flushes them all when the server moves the player. It registers its own
[queue checker](#packetqueuechecker), so you don't write one.

```ts
import { defineModule, ForceFlushCondition, FreezePacket, PacketFreezer } from "@protohax/userscript";

defineModule(
  { name: "Freeze" },
  {
    delay: { type: "number", name: "Delay (ms)", def: 500, min: 0, max: 5000, step: 50, displayResolution: 0 },
    freeze: { type: "multi-enum", name: "Freeze", values: Object.values(FreezePacket), def: [FreezePacket.NetworkLatency] },
    forceFlush: { type: "multi-enum", name: "Force Flush", values: Object.values(ForceFlushCondition) },
  },
  (ctx) => {
    // every setting is read again when it's used, so they can follow options
    const freezer = new PacketFreezer({
      freeze: () => ctx.options.freeze.value,
      forceFlush: () => ctx.options.forceFlush.value,
      delay: () => ctx.options.delay.value,
    });

    let unsubscribe = () => {};
    ctx.onEnable(() => {
      freezer.start(ctx.session);
      // a shorter delay lets the packets out sooner
      unsubscribe = ctx.options.delay.subscribe(() => freezer.releaseDue());
    });
    ctx.onDisable(() => {
      unsubscribe();
      freezer.stop();
    });
  },
);
```

### What it freezes — `FreezePacket`

| Kind | Packets |
| --- | --- |
| `FreezePacket.Knockback` | `set_entity_motion` for the local player: its knockback |
| `FreezePacket.PotionEffect` | `mob_effect` |
| `FreezePacket.EntityState` | `set_entity_motion` for other entities, `move_entity`, `move_entity_delta`, `move_player`, and `update_attributes` changing the local player's movement speed (on land, under water or in lava) or knockback resistance |
| `FreezePacket.BlockUpdate` | `update_block`, `update_block_synced`, `block_event` |
| `FreezePacket.NetworkLatency` | `network_stack_latency`, the server's transactions |

Freezing transactions holds back the client's answers to them, which is what
anticheats time the client against. Freeze the kinds whose order against the
transactions you need to keep, too.

### When it flushes

Everything held is released at once, and `onForceFlush` is called, when:

- the server moves the local player (`move_player`), respawns it, or corrects
  its movement (`correct_player_move_prediction`),
- the dimension changes,
- a condition picked in `forceFlush()` happens: `ForceFlushCondition.ContainerOpen`
  when a container opens.

### Settings — `PacketFreezerSettings`

| Setting | Description |
| --- | --- |
| `freeze()` | The kinds frozen, a set of `FreezePacket`. |
| `forceFlush()` | The extra conditions that flush everything, a set of `ForceFlushCondition`. |
| `delay()` | How long each packet is held, in ms. `Infinity` holds until `flush()`. `0` or less freezes nothing new, but a packet that comes behind ones still held is held too, to keep the order. |
| `filter?(name, body)` | Decides a packet before the kinds: `true` holds it whatever the kinds and the delay, `false` lets it through, `undefined` leaves it to them. Knockback Delay holds the player's knockback this way. |
| `onForceFlush?()` | Called after a force flush. |

Each one is called again whenever it's needed, so return the live value: an
option's, or your own state's.

### `PacketFreezer`

| Member | Type | Description |
| --- | --- | --- |
| `new PacketFreezer(settings)` | | A freezer, not started yet. |
| `start(session)` | `void` | Start freezing the incoming packets of `session`. |
| `stop()` | `void` | Release everything held and stop. |
| `releaseDue()` | `void` | Release the packets that have waited `delay()` ms, and schedule the next release. |
| `flush()` | `void` | Release everything held now. |
| `size` | `number` | How many packets are held. |

- **Only its packets.** Releases go through
  [`flushHeld`](#flushheldisincoming-filter) with a filter that keeps the
  packets other checkers hold. A packet someone else already released is
  skipped.
- **The delay can change.** `delay()` is read again at every release. A longer
  delay is picked up without any work. When it gets shorter, call
  `releaseDue()`: the release already scheduled isn't moved earlier on its own.
- **Holding until you say so.** Return `Infinity` from `delay()` to hold until
  `flush()`. Switch back to a finite delay and call `releaseDue()` to let the
  freezer time the packets again.
