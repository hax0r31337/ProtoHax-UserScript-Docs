---
id: world
title: World & Blocks
sidebar_position: 5
---

# World & Blocks

`session.levelState` is a `LevelStateTracker`: the client's model of the world.
Use it to read blocks and chunks, ray-trace, check collision, and look up block
states.

## `LevelStateTracker`

### Reading & writing blocks

| Member | Type | Description |
| --- | --- | --- |
| `getBlock(x, y, z, layer?)` | `BlockState` | Block state at a world position. Layer 0 by default. |
| `setBlock(x, y, z, layer, blockState)` | `void` | Set a block state **client-side only**. Nothing is sent to the server. |
| `getBlockEntity(x, y, z)` | `BlockEntity \| undefined` | Block entity at a world position, if any. |
| `provider` | `BlockStateProvider` | The block-state registry. Look blocks up by name. |

```ts
const block = ctx.session.levelState.getBlock(100, 64, 100);
console.log(block.name);              // "minecraft:stone"
console.log(block.states);            // { ... }
console.log(block.meta.isFullBlock);  // true
```

### Ray-tracing & collision

| Member | Type | Description |
| --- | --- | --- |
| `rayTrace(position, direction, maxDistance)` | `{ block, blockPosition, position, face } \| null` | Ray-trace against world blocks. Returns the hit, or `null`. |
| `checkCollision(position, motion)` | `{ verticalCollision, horizontalCollision }` | Collision flags for a player at `position` after applying `motion`. |
| `getCollidingBlocks(aabb, ignoreAtOrAbove?)` | `AABB[]` | World-space collision boxes that intersect the given AABB. Boxes whose bottom is at or above `ignoreAtOrAbove` are left out. |

```ts
const p = ctx.session.entityState.localPlayer;
const hit = ctx.session.levelState.rayTrace(p.eyePosition, /* dir */ p.motion, 5);
if (hit) console.log("looking at", hit.block.name, "face", hit.face);
```

### Chunks & dimension

| Member | Type | Description |
| --- | --- | --- |
| `getChunk(chunkX, chunkZ)` | `Chunk \| undefined` | A loaded chunk, by chunk coordinates. |
| `getSubChunk(chunkX, chunkZ, subChunkY)` | `SubChunk \| undefined` | A subchunk. |
| `chunkStorage` | [`ChunkStorage`](#chunkstorage) | Loaded chunks, by chunk coordinates. |
| `chunkRadius` | `number \| null` | Server view distance in chunks, if known. |
| `get dimension` | `DimensionData` | Data for the current dimension. |
| `dimensionId` | `number` | Index of the current dimension. |
| `dimensionList` | `DimensionData[]` | Known dimensions. |
| `difficulty` | `number` | 0 = peaceful, 1 = easy, 2 = normal, 3 = hard. |
| `seed` | `bigint` | World seed. |

## `BlockState`

The resolved state of one block. Implements `PaletteItem`.

| Member | Type | Description |
| --- | --- | --- |
| `runtimeId` | `number` | Network runtime id of this block state. |
| `hash` | `number` | Identity hash of this block state. |
| `name` | `string` | Block identifier, e.g. `minecraft:stone`. |
| `get states` | `Record<string, any>` | Simplified block-state values, e.g. `{ facing_direction: 2 }`. |
| `nbtStates` | `Tags['compound']` | Raw NBT block-state compound. |
| `tags` | `Set<string>` | Block tags. |
| `meta` | `BlockMeta` | Derived block metadata ([below](#blockmeta)). |
| `get isAir` | `boolean` | Whether this is air. Goes by name, not collision: a torch or water has no collision box but isn't air. |

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

`levelState.provider`. Looks up any block state by identifier:

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

`Chunk` and `SubChunk` are type-only exports. Use `import type { Chunk,
SubChunk }` to name them. You can't use them with `instanceof`.

### `ChunkStorage`

`levelState.chunkStorage` holds every loaded chunk, looked up by chunk
coordinates. Before 0.5 it was a `Map<bigint, Chunk>` keyed by `chunk.key()`.

| Member | Type | Description |
| --- | --- | --- |
| `size` | `number` | Number of loaded chunks. |
| `get(x, z)` | `Chunk \| undefined` | The chunk at chunk coordinates, if loaded. |
| `has(x, z)` | `boolean` | Whether a chunk is loaded at chunk coordinates. |
| `values()` | `IterableIterator<Chunk>` | Every loaded chunk. You can delete while iterating. |
| `set(chunk)` | `void` | Store a chunk at its own coordinates, replacing any already there. |
| `delete(x, z)` | `boolean` | Remove a chunk. Returns whether there was one. |
| `clear()` | `void` | Remove every chunk. |

```ts
const chunks = ctx.session.levelState.chunkStorage;
console.log(chunks.size, "chunks loaded");

for (const chunk of chunks.values()) {
  console.log(chunk.x, chunk.z);
}
```

You'll mostly read from it. `set`, `delete` and `clear` only change the
tracker's own copy of the world.

### `Chunk`

| Member | Type | Description |
| --- | --- | --- |
| `x` / `z` | `number` | Chunk coordinates (block coordinate `>> 4`). |
| `provider` | `BlockStateProvider` | Resolves runtime ids in this chunk. |
| `subChunks` | `SubChunk[]` | Subchunks. Index 0 is the bottom (see `dimension.min_height`). |
| `blockEntities` | `BlockEntity[]` | Block entities tracked in this chunk. |
| `key()` | `bigint` | X and Z packed into one 64-bit key. |
| `getSubChunk(i)` | `SubChunk` | Subchunk at vertical index `i` (0 = bottom). |

### `SubChunk`

A 16×16×16 section. Block positions inside it are packed indices (0–4095).

| Member | Type | Description |
| --- | --- | --- |
| `provider` | `BlockStateProvider` | Resolves runtime ids. |
| `parent` | `Chunk` | The chunk this belongs to. |
| `defaultLayer` | `Palette<BlockState>` | Layer 0, the main block layer. |
| `extraLayers` | `Palette<BlockState>[]` | Extra layers (e.g. waterlogging). Index 0 here is layer 1. |
| `index(x, y, z)` | `number` | Pack local coordinates (0–15) into a block index. |
| `fromIndex(index)` | `{ x, y, z }` | Unpack a block index into local coordinates. |
| `getBlock(x, y, z, layer?)` | `BlockState` | Read a block at local coordinates. |
| `setBlock(x, y, z, layer, block)` | `void` | Write a block at local coordinates. |
| `hasBlock(block, layer?)` | `boolean` | Whether the block appears on the layer. |
| `getLayer(layer)` | `Palette<BlockState>` | The palette for a layer (0 = default). |

### `Palette<T>`

Stores one subchunk layer: the list of distinct entries, plus a lookup for each
position.

| Member | Type | Description |
| --- | --- | --- |
| `palette` | `T[]` | The distinct entries present (e.g. block states). |
| `get(index)` | `T` | Entry at a block index. |
| `set(index, value)` | `void` | Set the entry at a block index. |
| `has(item)` | `boolean` | Whether the entry is present. |
| `positions(item)` | `Generator<number>` | Every block index holding `item`. |

Finding all stone in a subchunk:

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

Subclass `AbstractBlockLocationTracker<T>` to keep a **live set of blocks** that
stays in sync as chunks load and unload and blocks change. The built-in Chest
ESP and Block ESP modules use the same class.

You implement three methods, and the base class handles the chunk and block
bookkeeping:

| Member | Type | Description |
| --- | --- | --- |
| `canTrackBlock(block)` | `boolean` | **You implement.** Return `true` for blocks you want tracked. |
| `onBlockAdded(entry)` | `void` | **You implement.** A tracked block appeared. |
| `onBlockRemoved(entry)` | `void` | **You implement.** A tracked block was removed. |
| `entries` | `Map<bigint, BlockEntry<T>>` | All tracked blocks, keyed by packed position. |
| `reset()` | `void` | Re-scan all loaded chunks. |
| `bindToSession(session)` | `void` | Attach, and scan the chunks already loaded. |
| `unbindFromSession()` | `void` | Detach and clear. |

`BlockEntry<T>` extends `IVector3` (`x`/`y`/`z`) and adds `block: BlockState`
and an optional `extra?: T`.

```ts
import {
  AbstractBlockLocationTracker,
  type BlockEntry,
  type BlockState,
} from "@protohax/userscript";

class DiamondOreTracker extends AbstractBlockLocationTracker<void> {
  canTrackBlock(block: BlockState): boolean {
    return block.name === "minecraft:diamond_ore";
  }
  onBlockAdded(entry: BlockEntry<void>) {
    console.log("diamond at", entry.x, entry.y, entry.z);
  }
  onBlockRemoved(entry: BlockEntry<void>) {
    console.log("gone", entry.x, entry.y, entry.z);
  }
}

defineModule(
  { name: "DiamondFinder" },
  {},
  (ctx) => {
    const tracker = new DiamondOreTracker();
    ctx.onEnable(() => tracker.bindToSession(ctx.session));
    ctx.onDisable(() => tracker.unbindFromSession());
  },
);
```

:::note[Client-side only]

`setBlock` and tracked state only exist on your client. They change what your
client sees, not the server's world.

:::
