---
id: how-it-works
title: How It Drives the Player
---

# How It Drives the Player

Baritone doesn't press anything the player could see. It hooks the same tick
events your modules use and writes into them: the input in
[`input_tick`](/api/input), the jump and the rotation in
[`movement_tick`](/api/movement). This page is what it does there, and what
that means for modules running next to it.

## Where it sits in a tick

| Order | Event | What Baritone does |
| --- | --- | --- |
| 1 | `input_tick` | Takes in the player: position, rotation, ground, effects, hunger, game mode, and the inventory when it changed. Then Baritone **ticks**: it decides this tick's moves, breaks and places. Then its keys, sneak and sprint go in as the tick's input. |
| 2 | `movement_tick` | Blocks the game's own jump while Baritone is moving the player, and applies Baritone's jump instead. Requests the rotation Baritone looks with. |
| 3 | `player_auth_input` | Notes the player's velocity for the next tick. |
| 4 | `post_tick` | Tells Baritone the rotation the packet carried. |

Baritone's `input_tick` and `movement_tick` listeners run **late**, after your
module's listeners. Whatever Baritone writes is what goes in.

:::danger[Baritone ticks inside `input_tick`]

`input_tick` blocks the game thread, and gives up after 200 ms (see
[`input_tick` is performance-critical](/api/input)). Calculating a path is
slow, so Baritone does that on threads of its own, and its tick only takes up
a small part of the budget. The rest is shared with your listeners. If the
budget runs out, the player's own input goes in for that tick and Baritone's
moves are lost.

[`path_event`](/baritone/state#path-events) listeners also run in this budget.

:::

## The keys

Baritone moves relative to **the direction it looks**, which is the rotation it
sends to the server. The camera stays where the player put it. So its
"forward" is usually not the camera's.

ProtoHax turns Baritone's keys onto the camera before they go in. When
Baritone faces the way the camera does, they go in as plain move keys. When it
faces elsewhere, they go in as a stick pointing the way Baritone wants to go.
Either way, the game moves the player where Baritone wants, and the server sees
Baritone walking straight along its own rotation.

Sprinting works the same way. Baritone holds the sprint key, and when the keys
had to be turned, ProtoHax also requests a
[`SprintIntent.Sprint`](/api/movement#sprint--sprintintent), so the client and the
server agree on the sprint.

| `getMovementInput()` | What goes in |
| --- | --- |
| an object | Baritone's keys, sneak and sprint. Your `input_tick` writes for these are overwritten. |
| `null` | The player's own input (or yours). Baritone may still hold the sprint key. |

## Jumping

While Baritone is moving the player, the game's own jumps are blocked: the jump
key and auto-jump. Baritone's paths don't expect them.

When Baritone wants to jump, ProtoHax does what holding the jump key would:

| Where the player is | What happens |
| --- | --- |
| On the ground | A jump. For a sprint jump, the boost goes along the direction Baritone faces, as the server works it out. |
| In water or lava | Swimming up. |
| On a ladder, vine or scaffolding | Climbing up. |

## The rotation

Baritone's rotation goes on
[`localPlayer.rotationScheduler`](/api/local-player#rotationscheduler) at
`SchedulerPriority.High`, for as long as it differs from the camera. It's
**server side only**: the camera never turns, and the player can look around
freely while Baritone walks.

That makes the rotation the one place where Baritone can lose to another
module. An aim at a higher priority, like a `Highest` one, wins the scheduler.
Baritone then breaks, places and moves expecting a rotation the server never
gets. Don't run an aim that outranks Baritone while it's pathing.

Baritone turns in whole mouse steps, at the game's default sensitivity of
`0.5`. To use another, set it through [`native`](#the-native-object):
`baritone.native.setOptions({ sensitivity: 0.8 })`.

## Breaking, placing and the inventory

| Baritone does | How |
| --- | --- |
| Break a block | Through the local player's [`breakingController`](/api/local-player#breakingcontroller). If the player is already breaking a block by hand, Baritone leaves that alone and waits. |
| Place a block, open a container | Through `localPlayer.interactBlock`. Clicking a block that does something (a chest, a door) uses it, unless the player is sneaking. A placed block shows on the client right away. |
| Pick a hotbar slot | `inventory.setHotbarSlot`. |
| Move items into the hotbar | Swaps between the main inventory and the hotbar, with `allowInventory` on. |

Baritone swings the arm the way the client does when it breaks or places, so
don't add your own swing.

## The world

Baritone keeps its own copy of the world around the player. ProtoHax keeps
it up to date:

- Chunks come from `session.levelState` as Baritone asks for them, within
  [`chunkRadius`](/baritone/settings#how-much-of-the-world-baritone-sees).
- When a chunk loads again, Baritone takes the new one on the next tick.
- Block updates are passed on as they arrive, on both layers. The second layer
  holds waterlogging, so Baritone knows which blocks are full of water.
- On a dimension change, Baritone starts over with the new dimension.

Upstream Baritone keeps a cache of every chunk it has seen, saved to disk,
and paths and searches through it. This port only remembers **which** chunks
it has seen, for `explore`, and not what was in them. Once a chunk is outside
`chunkRadius`, Baritone can't path through it or find blocks in it. That makes
the cache settings (`pathThroughCachedOnly`, `maxCachedWorldScanCount`,
`extendCacheOnThreshold`) of little use here.

## Unsupported

| Missing | What it means |
| --- | --- |
| Some window clicks | Clicks in the player's inventory work as on Java, with the cursor and the 2x2 crafting grid. Clicks in any other window, taking a craft's result, and creative clones are skipped, with a warning in the [client log](/guides/debugging). |
| Disconnecting | `disconnectOnArrival` only logs a warning. |
| Play area limits | Bedrock has no world border, but servers often fence players in. Baritone doesn't know where that edge is, and may path into it. [`setWorldBorder`](#the-native-object) can tell it. |
| Riding | Baritone doesn't steer mounts. |
| Block drops | Bedrock has no loot tables to read, so [`mine`'s quantity](/baritone/commands#minequantity-blocks) is never reached. |

Upstream's other processes (follow, build, elytra, and the rest) aren't
ported. Baritone does what's on [Goals & Commands](/baritone/commands).

## The `native` object

`baritone.native` is the native Baritone that `SessionBaritone` wraps. It has
all of the same commands, and a few calls `SessionBaritone` doesn't wrap:

| Member | Description |
| --- | --- |
| `setOptions(options)` | The client options Baritone reads: `sensitivity` (0 to 1, default `0.5`) and `auto_jump`. |
| `setWorldBorder(border)` | Keep Baritone working within a rectangle, as `{ min_x, max_x, min_z, max_z }`, such as a server's play area. `null` for none. Forgotten on a dimension change. |

It also has the entry points `SessionBaritone` calls for you every tick:
`onTick`, `onPlayerUpdate`, `updatePlayer`, `loadChunk`, `onBlockChange` and so
on. **Don't call these yourself.** Baritone would get each event twice, and
take your player state over the real one. `gameType` is in the same group:
`SessionBaritone` sets it from the player's game mode every tick.

`baritone.table` is the block state table `SessionBaritone` gave Baritone: a
`BaritoneStateTable`, with `idOf(blockState)` for a block's id there and
`air` for air's. You only need it to talk to `native` in block ids.
