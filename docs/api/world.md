---
id: world
title: World & Blocks
sidebar_position: 5
---

# World & Blocks

`session.levelState` is a **`LevelStateTracker`** — the world model: blocks,
chunks, ray-tracing, collision, and the block-state registry.

## `LevelStateTracker`

### Reading & writing blocks

| Member | Signature | Description |
| --- | --- | --- |
| `getBlock(x, y, z, layer?)` | `BlockState` | Block state at a world position (layer 0 by default). |
| `setBlock(x, y, z, layer, blockState)` | `void` | Set a block state **client-side only** (not sent to the server). |
| `getBlockEntity(x, y, z)` | `BlockEntity \| undefined` | Block entity at a world position, if any. |
| `provider` | `BlockStateProvider` | The block-state registry (look blocks up by name). |

```ts
const block = ctx.session.levelState.getBlock(100, 64, 100);
console.log(block.name);              // "minecraft:stone"
console.log(block.states);            // { ... }
console.log(block.meta.isFullBlock);  // true
```

### Ray-tracing & collision

| Member | Signature | Description |
| --- | --- | --- |
| `rayTrace(position, direction, maxDistance)` | `{ block, blockPosition, position, face } \| null` | Ray-trace against world blocks; returns the hit, or `null`. |
| `checkCollision(position, motion)` | `{ verticalCollision, horizontalCollision }` | Collision flags for a player at `position` after applying `motion`. |
| `getCollidingBlocks(aabb)` | `AABB[]` | World-space collision boxes intersecting the given AABB. |

```ts
const p = ctx.session.entityState.localPlayer;
const hit = ctx.session.levelState.rayTrace(p.eyePosition, /* dir */ p.motion, 5);
if (hit) console.log("looking at", hit.block.name, "face", hit.face);
```

### Chunks & dimension

| Member | Signature | Description |
| --- | --- | --- |
| `getChunk(chunkX, chunkZ)` | `Chunk \| undefined` | A loaded chunk by chunk coordinates. |
| `getSubChunk(chunkX, chunkZ, subChunkY)` | `SubChunk \| undefined` | A subchunk. |
| `chunkStorage` | `Map<bigint, Chunk>` | Loaded chunks, keyed by chunk key. |
| `chunkRadius` | `number \| null` | Server view distance in chunks, if known. |
| `get dimension` | `DimensionData` | The current dimension's data. |
| `dimensionId` | `number` | Current dimension index. |
| `dimensionList` | `DimensionData[]` | Known dimensions. |
| `difficulty` | `number` | 0 = peaceful, 1 = easy, 2 = normal, 3 = hard. |
| `seed` | `bigint` | World seed. |

## `BlockState`

The resolved state of a single block. Implements `PaletteItem`.

| Member | Type | Description |
| --- | --- | --- |
| `runtimeId` | `number` | Network runtime id of this block state. |
| `hash` | `number` | Identity hash of this block state. |
| `name` | `string` | Block identifier, e.g. `minecraft:stone`. |
| `get states` | `Record<string, any>` | Simplified block-state values, e.g. `{ facing_direction: 2 }`. |
| `nbtStates` | `Tags['compound']` | Raw NBT block-state compound. |
| `tags` | `Set<string>` | Block tags. |
| `meta` | `BlockMeta` | Derived block metadata (see below). |

### `BlockMeta`

| Member | Type |
| --- | --- |
| `hardness` | `number` |
| `friction` | `number` |
| `collisionShape` | `AABB[]` |
| `visualShape` | `AABB` |
| `mapColor` | `[number, number, number, number]` |
| `requiresCorrectToolForDrops` | `boolean` |
| `isFullBlock` | `boolean` |

### `BlockStateProvider`

`levelState.provider` — look up any block state by identifier:

```ts
const stone = ctx.session.levelState.provider.getBlock("minecraft:stone");
// BlockState | undefined
```

### `DimensionData`

| Member | Type | Description |
| --- | --- | --- |
| `handle` | `string` | Dimension identifier. |
| `min_height` | `number` | Lowest block Y. |
| `max_height` | `number` | Highest block Y. |

## Chunks: `Chunk`, `SubChunk`, `Palette`

`Chunk` and `SubChunk` are **value exports**, so you can name them and narrow
with `instanceof`.

### `Chunk`

| Member | Signature | Description |
| --- | --- | --- |
| `x` / `z` | `number` | Chunk coordinates (block coord `>> 4`). |
| `provider` | `BlockStateProvider` | Resolves runtime IDs in this chunk. |
| `subChunks` | `SubChunk[]` | Subchunks, index 0 = bottom (see `dimension.min_height`). |
| `blockEntities` | `BlockEntity[]` | Block entities tracked in this chunk. |
| `key()` | `bigint` | 64-bit storage key (packed X/Z). |
| `getSubChunk(i)` | `SubChunk` | Subchunk at vertical index `i` (0 = bottom). |

### `SubChunk`

A 16×16×16 section. Block positions inside are packed indices (0–4095).

| Member | Signature | Description |
| --- | --- | --- |
| `provider` | `BlockStateProvider` | Resolves runtime IDs. |
| `parent` | `Chunk` | The owning chunk. |
| `defaultLayer` | `Palette<BlockState>` | Layer 0 (primary block layer). |
| `extraLayers` | `Palette<BlockState>[]` | Extra layers (e.g. waterlogging); index 0 = layer 1. |
| `index(x, y, z)` | `number` | Pack local coords (0–15) into a block index. |
| `fromIndex(index)` | `{ x, y, z }` | Unpack a block index into local coords. |
| `getBlock(x, y, z, layer?)` | `BlockState` | Read a block at local coords. |
| `setBlock(x, y, z, layer, block)` | `void` | Write a block at local coords. |
| `hasBlock(block, layer?)` | `boolean` | Whether the block appears on the layer. |
| `getLayer(layer)` | `Palette<BlockState>` | The palette for a layer (0 = default). |

### `Palette<T>`

Backs a subchunk layer — the distinct entries plus per-position lookup.

| Member | Signature | Description |
| --- | --- | --- |
| `palette` | `T[]` | The distinct entries present (e.g. block states). |
| `get(index)` | `T` | Entry at a block index. |
| `set(index, value)` | `void` | Set the entry at a block index. |
| `has(item)` | `boolean` | Whether the entry is present. |
| `positions(item)` | `Generator<number>` | Iterate every block index holding `item`. |

Iterating all stone in a subchunk:

```ts
const sub = ctx.session.levelState.getSubChunk(0, 0, 4);
if (sub) {
  for (const block of sub.defaultLayer.palette) {
    if (block.name === "minecraft:stone") {
      for (const idx of sub.defaultLayer.positions(block)) {
        const { x, y, z } = sub.fromIndex(idx); // local 0-15
      }
    }
  }
}
```

## Tracking blocks: `AbstractBlockLocationTracker`

To maintain a **live set of blocks in the world** — kept in sync as chunks load,
unload, and blocks update — subclass `AbstractBlockLocationTracker<T>`. This is
the same primitive the built-in Chest ESP / Block ESP modules use.

You implement three methods; the base handles the chunk/block bookkeeping:

| Member | Signature | Description |
| --- | --- | --- |
| `canTrackBlock(block)` | `boolean` | **You implement.** Return true for blocks to track. |
| `onBlockAdded(entry)` | `void` | **You implement.** A tracked block appeared. |
| `onBlockRemoved(entry)` | `void` | **You implement.** A tracked block was removed. |
| `entries` | `Map<bigint, BlockEntry<T>>` | All currently tracked blocks, keyed by packed position. |
| `reset()` | `void` | Re-scan all loaded chunks. |
| `bindToSession(session)` | `void` | Attach and scan already-loaded chunks. |
| `unbindFromSession()` | `void` | Detach and clear. |

`BlockEntry<T>` extends `IVector3` (`x`/`y`/`z`) and adds `block: BlockState`
and an optional `extra?: T`.

```ts
import { AbstractBlockLocationTracker, type BlockState } from "@protohax/userscript";

class DiamondOreTracker extends AbstractBlockLocationTracker<void> {
  canTrackBlock(block: BlockState): boolean {
    return block.name === "minecraft:diamond_ore";
  }
  onBlockAdded(entry) {
    console.log("diamond at", entry.x, entry.y, entry.z);
  }
  onBlockRemoved(entry) {
    console.log("gone", entry.x, entry.y, entry.z);
  }
}

defineModule(
  { name: "DiamondFinder", category: ModuleCategory.Utility },
  {},
  (ctx) => {
    const tracker = new DiamondOreTracker();
    ctx.onEnable(() => tracker.bindToSession(ctx.session));
    ctx.onDisable(() => tracker.unbindFromSession());
  },
);
```

> **Note — client-side only.** `setBlock` and tracked state are local to your
> client. They change what your client sees; they do not modify the server's
> world.
