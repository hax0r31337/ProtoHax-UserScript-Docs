---
id: commands
title: Goals & Commands
---

# Goals & Commands

You tell Baritone what to do in one of two ways:

- **Give it a goal** with `setGoalAndPath`. A goal is a place, or a rule for
  which places count, like "any block at y 64".
- **Start a process** with `mine`, `getToBlock`, `explore` or `farm`. A process
  picks its own goals as it goes.

Either way, Baritone runs until it gets there, it fails, or you cancel it.

## Goals

A goal is a plain object with a `type`. Coordinates are block coordinates, and
a position is where the player's **feet** end up.

| `type` | Fields | Reached when the player's feet are… |
| --- | --- | --- |
| `"block"` | `x`, `y`, `z` | in that block. |
| `"xz"` | `x`, `z` | in that column, at any height. |
| `"y_level"` | `y` | at that height, anywhere. |
| `"near"` | `x`, `y`, `z`, `range` | within `range` blocks of the block (a sphere). |
| `"two_blocks"` | `x`, `y`, `z` | in the block or the one below it, so the feet or the head is in the block. |
| `"get_to_block"` | `x`, `y`, `z` | next to the block, on any side, above or below. |
| `"run_away"` | `distance`, `from`, `maintain_y?` | at least `distance` blocks away from every position in `from`, measured on x and z only. With `maintain_y`, also at that height. |
| `"axis"` | none | on an axis (x = 0 or z = 0) or a diagonal (\|x\| = \|z\|), at height [`axisHeight`](/baritone/settings) (default 120). |
| `"strict_direction"` | `x`, `y`, `z`, `direction` | never. Baritone keeps going from the block in `direction` (`"north"`, `"south"`, `"east"` or `"west"`). |
| `"composite"` | `goals` | in any of `goals`. Baritone heads for whichever is closest. |
| `"inverted"` | `goal` | never. Baritone keeps getting farther from `goal`. |

```ts
// the surface at 0, 0, whatever its height
baritone.setGoalAndPath({ type: "xz", x: 0, z: 0 });

// within 3 blocks of a chest
baritone.setGoalAndPath({ type: "near", x: 120, y: 64, z: -40, range: 3 });

// 50 blocks away from two players, staying at y 64
baritone.setGoalAndPath({
  type: "run_away",
  distance: 50,
  maintain_y: 64,
  from: [[10, 64, 20], [14, 64, 18]],
});

// whichever of the two is closer
baritone.setGoalAndPath({
  type: "composite",
  goals: [
    { type: "block", x: 100, y: 70, z: 100 },
    { type: "block", x: -100, y: 70, z: -100 },
  ],
});
```

All the goal types are the `BaritoneGoal` union. It's global, so you can name
it without importing anything.

`strict_direction` and `inverted` never end on their own. Baritone keeps
pathing until you [cancel](#cancelling) it.

:::tip[Far goals]

Baritone only knows the world [near the player](/baritone/settings#how-much-of-the-world-baritone-sees).
For a goal far outside it, Baritone paths to the edge of what it knows, then
plans the next stretch as it gets there. A `block` goal in a part of the world
Baritone hasn't seen counts as an `xz` goal until the player gets close, since
the height doesn't matter yet (the `simplifyUnloadedYCoord` setting).

:::

## Pathing to a goal

| Method | Description |
| --- | --- |
| `setGoalAndPath(goal)` | Set the goal and start pathing to it. This is the one you usually want. |
| `setGoal(goal)` | Set the goal without moving. It's drawn in the world, and `path()` starts pathing to it later. |
| `path()` | Path to the goal set with `setGoal`. |

Pass `null` to either setter to clear the goal.

Only one goal is followed at a time. If a [process](#processes) like `mine` is
running, `cancel()` it before you set a goal of your own.

```ts
// mark it now, go later
baritone.setGoal({ type: "block", x: 0, y: 64, z: 0 });
// ...
baritone.path();
```

## Cancelling

| Method | Returns | Description |
| --- | --- | --- |
| `cancel()` | `boolean` | Stop every process, and the path if that's safe right now. Returns whether the path stopped. |
| `forceCancel()` | `void` | Stop everything right now, even mid-jump or mid-bridge, and drop any path still being calculated. |

`cancel()` is the polite one. If the player is in the middle of a move that
isn't safe to stop (a jump, a fall, a bridge), it returns `false`, and
Baritone stops at the first safe moment instead. `forceCancel()` lets go of the
player on the spot, which may well drop them off the edge they were bridging.

Both drop the goal along with the process. It disappears from the world on
the next tick.

```ts
ctx.onDisable(() => {
  if (ctx.session.hasBaritone) ctx.session.baritone.cancel();
});
```

## Processes

A process decides goals for Baritone as it goes. To switch from one to
another, or from a goal to a process, `cancel()` the old one first.

| Method | Description |
| --- | --- |
| `mine(quantity, blocks)` | Find and mine blocks matching the [selectors](#block-selectors) in `blocks`. |
| `getToBlock(block)` | Go to the nearest block matching the selector. |
| `explore(x, z)` | Explore outward from block `x`, `z`, into chunks Baritone hasn't seen yet. |
| `farm(range, center?)` | Harvest and replant crops within `range` blocks of `center`. |

### `mine(quantity, blocks)`

```ts
baritone.mine(0, ["minecraft:diamond_ore", "minecraft:deepslate_diamond_ore"]);
```

Baritone looks for the blocks in the chunks it has, paths to the nearest one,
and mines it. If it knows of none, it explores until it finds some
(`exploreForBlocks`). It throws if Baritone has no world yet, which is the case
until its first tick, and a `TypeError` for a selector it can't read.

:::warning[`quantity` is never reached]

On Java, Baritone stops once `quantity` of the blocks' drops are in the
inventory. Bedrock has no loot tables for it to read, so it doesn't know what a
block drops, and it never counts any. Any `quantity` mines forever, like `0`.
Count the items yourself and `cancel()` when you have enough.

:::

The settings that matter most here are `legitMine` (only mine ores it can see,
no x-ray), `minYLevelWhileMining` and `maxYLevelWhileMining`, and
`allowOnlyExposedOres`. See [Settings](/baritone/settings#mining).

### `getToBlock(block)`

```ts
baritone.getToBlock("minecraft:crafting_table");
```

Paths to the nearest block matching the selector, and stops next to it. If
it's a container, like a chest, Baritone opens it on arrival
(`rightClickContainerOnArrival`). It throws without a world, like `mine`.

### `explore(x, z)`

```ts
const p = ctx.session.entityState.localPlayer.position;
baritone.explore(Math.floor(p.x), Math.floor(p.z));
```

Walks to the nearest chunks around `x`, `z` that Baritone hasn't seen yet,
growing outward, until you cancel it. `exploreMaintainY` (default 64) is the
height it tries to stay at, `-1` for none.

### `farm(range, center?)`

```ts
baritone.farm(16);                  // 16 blocks around the player's feet
baritone.farm(0, [100, 64, -30]);   // any distance, measured from 100, 64, -30
```

Harvests ripe crops within `range` blocks of `center`, `0` for any distance.
`center` is `[x, y, z]`, the player's feet by default. With `replantCrops`
(default on) it replants what it harvests. With bone meal on hand, it also
uses it on crops that can still grow.

## Block selectors

`mine` and `getToBlock` take blocks as **selectors**: a block name, optionally
followed by state values in brackets.

| Selector | Matches |
| --- | --- |
| `"minecraft:stone"` | every state of stone |
| `"stone"` | the same; the namespace defaults to `minecraft:` |
| `"minecraft:oak_log[pillar_axis=y]"` | upright oak logs only |
| `"minecraft:wheat[growth=7]"` | fully grown wheat |

Names and state values are **Bedrock's**, not Java's. Java's
`oak_log[axis=y]` is `oak_log[pillar_axis=y]` here, and a boolean state is `0`
or `1`. A selector with a name or a state Bedrock doesn't have throws a
`TypeError` with a message saying what's wrong with it.

The block lists in [settings](/baritone/settings), like `blocksToAvoid` and
`acceptableThrowawayItems`, hold Bedrock names too.
