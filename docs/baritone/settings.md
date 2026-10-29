---
id: settings
title: Settings
---

# Settings

Baritone's settings are upstream Baritone's, under the same names:
`allowBreak`, `allowParkour`, `primaryTimeoutMS` and so on. If you've used
Baritone's `#set` command on Java, these are the same settings.

```ts
const baritone = ctx.session.baritone;

baritone.setSettings({ allowParkour: true, allowBreak: false });
baritone.getSettings().allowParkour; // true
```

| Method | Description |
| --- | --- |
| `getSettings()` | All the settings, as a `BaritoneSettings` object. A copy: changing it changes nothing. |
| `setSettings(changes)` | Change some of the settings. The ones you leave out keep their values. A list replaces the old list as a whole. |

`setSettings` ignores names it doesn't know. A value of the wrong type
(`allowBreak: "yes"`) throws a `TypeError`, and then none of the changes are
made.

:::warning[Settings are global]

The settings are shared by **every** Baritone: every script, and every session
the client has open. They're also not saved. They go back to the defaults when
the client restarts.

If your module changes a setting, put it back when the module is disabled:

```ts
let saved: Partial<BaritoneSettings> | null = null;

ctx.onEnable(() => {
  const b = ctx.session.baritone;
  const s = b.getSettings();
  saved = { allowBreak: s.allowBreak, allowPlace: s.allowPlace };
  b.setSettings({ allowBreak: false, allowPlace: false });
});
ctx.onDisable(() => {
  if (saved) ctx.session.baritone.setSettings(saved);
  saved = null;
});
```

:::

Changes apply from the next calculation on. A path that's already planned
keeps the settings it was planned with.

## How much of the world Baritone sees

Baritone only knows the chunks around the player. It takes them from the
client's world as the player gets near them, and drops them as the player
moves away.

| Member | Type | Default | Description |
| --- | --- | --- | --- |
| `chunkRadius` | `number` | `12` | How far around the player, in chunks, Baritone keeps the world. Chunks farther than this (plus a margin of one) are dropped. |
| `chunkRequestsPerTick` | `number` | `16` | How many chunks Baritone takes from the client's world per tick, at most. Nearest first. |

These two belong to one session's Baritone, unlike the settings.

A bigger radius lets Baritone plan farther ahead, but it can't see chunks the
client doesn't have. Going past the client's render distance does nothing.
Lower `chunkRequestsPerTick` if loading a lot of chunks at once, like after a
teleport, makes ticks stutter.

## All settings

Every setting starts at upstream's default. Where Bedrock differs, the default
is Bedrock's: block names, and `costHeuristic`, since sprinting costs less on
Bedrock.

Block and item lists hold Bedrock names, like `"minecraft:cobblestone"`.

### Breaking & placing

| Setting | Default | Description |
| --- | --- | --- |
| `allowBreak` | `true` | Break blocks. |
| `allowBreakAnyway` | `[]` | Blocks it may break even with `allowBreak` off. |
| `allowPlace` | `true` | Place blocks. |
| `allowPlaceInFluidsSource` | `true` | Place blocks into fluid sources. |
| `allowPlaceInFluidsFlow` | `true` | Place blocks into flowing fluid. |
| `acceptableThrowawayItems` | dirt, cobblestone, netherrack, stone | Blocks it may place to bridge, pillar and fill. |
| `blocksToAvoid` | trip wire | Blocks it paths around. |
| `blocksToDisallowBreaking` | `[]` | Blocks it never breaks. |
| `blocksToAvoidBreaking` | crafting table, furnace, lit furnace, chest, trapped chest | Blocks it breaks only if it has to. |
| `avoidBreakingMultiplier` | `0.1` | How much it avoids `blocksToAvoidBreaking`. Above 1 it prefers breaking them instead. |
| `avoidUpdatingFallingBlocks` | `true` | Never break a block next to unsupported sand or gravel. |
| `pauseMiningForFallingBlocks` | `true` | Wait for falling blocks to land before going on. |
| `strictLiquidCheck` | `false` | Never break a block next to a liquid. |
| `walkWhileBreaking` | `true` | Keep walking forward while breaking what's in the way. |
| `blockReachDistance` | `4.5` | How far it reaches to break and place. |
| `blockBreakSpeed` | `6` | Ticks between finishing a block and starting the next. Only for blocks that take more than a tick. |
| `rightClickSpeed` | `4` | Ticks between right clicks. |

### Movement

| Setting | Default | Description |
| --- | --- | --- |
| `allowSprint` | `true` | Sprint. |
| `sprintAscends` | `true` | Sprint and jump a block early when going up. |
| `sprintInWater` | `true` | Keep sprinting in water. |
| `allowParkour` | `false` | Jump gaps. Unreliable around corners. |
| `allowParkourPlace` | `false` | Place a block to land on while jumping a gap. |
| `allowParkourAscend` | `true` | Jump gaps upward. Only with `allowParkour`. |
| `allowDiagonalDescend` | `false` | Go down diagonally. Riskier, and unsafe in the nether. |
| `allowDiagonalAscend` | `false` | Go up diagonally. |
| `allowOvershootDiagonalDescend` | `true` | Sprint through a descend followed by a diagonal. |
| `allowDownward` | `true` | Mine the block under its feet. Off makes it dig staircases instead of shafts. |
| `allowVines` | `false` | Extra vine moves. Rarely useful, and can get it stuck. |
| `allowWalkOnBottomSlab` | `true` | Walk on bottom slabs. Off is more reliable. |
| `allowWalkOnMagmaBlocks` | `false` | Sneak across magma blocks. |
| `allowJumpAtBuildLimit` | `false` | Parkour while standing at the build limit. |
| `overshootTraverse` | `true` | Count a move as done if it overshoots by a block. |
| `maxFallHeightNoWater` | `3` | The farthest it falls onto solid ground. |
| `maxFallHeightBucket` | `20` | The farthest it falls with a water bucket. |
| `allowWaterBucketFall` | `true` | Fall farther, placing water to land in and picking it back up. Needs a water bucket in the hotbar, and an empty one to pick the water up. Never in the Nether. |
| `assumeWalkOnWater` | `false` | Path over water as if it were solid, for when another module (Jesus) handles it. |
| `assumeWalkOnLava` | `false` | The same, for lava. |
| `assumeStep` | `false` | Don't jump to go up a block, for when another module (Step) handles it. |
| `assumeSafeWalk` | `false` | Don't sneak when placing behind itself, for when another module (Safe Walk) handles it. |
| `enterPortal` | `true` | Walk into a nether portal it paths to, instead of stopping beside it. |

### Costs & avoidance

| Setting | Default | Description |
| --- | --- | --- |
| `blockPlacementPenalty` | `20` | Extra cost of placing a block, to save throwaway blocks. Lower to place more. |
| `blockBreakAdditionalPenalty` | `2` | Extra cost of breaking a block, as a tie-breaker. |
| `jumpPenalty` | `2` | Extra cost of jumping, since it uses hunger. |
| `walkOnWaterOnePenalty` | `3` | Extra cost of walking on water. |
| `considerPotionEffects` | `true` | Account for Haste and Mining Fatigue in break costs. |
| `costHeuristic` | `3.492` | The A* heuristic. Higher finds a path faster but a worse one. Don't go below the default. |
| `backtrackCostFavoringCoefficient` | `0.5` | Favor going back along the previous path. `1` turns it off. |
| `avoidance` | `false` | Turns on the four settings below. Costs some time before each path. |
| `mobAvoidanceCoefficient` | `1.5` | How much to avoid mobs. Below 1 seeks them out. |
| `mobAvoidanceRadius` | `8` | How far to keep from mobs. |
| `mobSpawnerAvoidanceCoefficient` | `2` | How much to avoid spawners. |
| `mobSpawnerAvoidanceRadius` | `16` | How far to keep from spawners. |

### Inventory & tools

| Setting | Default | Description |
| --- | --- | --- |
| `autoTool` | `true` | Switch to the best tool for each block. |
| `assumeExternalAutoTool` | `false` | Plan as if the best tool is used, but leave switching to another module. |
| `preferSilkTouch` | `false` | Prefer Silk Touch tools, when just as fast. |
| `useSwordToMine` | `true` | Allow swords as mining tools. |
| `itemSaver` | `false` | Stop using a tool just before it breaks. |
| `itemSaverThreshold` | `10` | The durability `itemSaver` leaves. |
| `allowInventory` | `false` | Move items from the inventory into the hotbar when it needs them. |
| `ticksBetweenInventoryMoves` | `1` | Ticks between those moves. |
| `inventoryMoveOnlyIfStationary` | `false` | Stand still while moving items. |

### Mining

| Setting | Default | Description |
| --- | --- | --- |
| `legitMine` | `false` | Only mine ores it can see, with no x-ray. It always explores then. |
| `legitMineYLevel` | `-59` | The height to strip mine at with `legitMine`. |
| `legitMineIncludeDiagonals` | `false` | With `legitMine`, also "see" ores touching found ones diagonally. |
| `minYLevelWhileMining` | `0` | The lowest height to mine at. `0` for none. |
| `maxYLevelWhileMining` | `2031` | The highest height to mine at. |
| `allowOnlyExposedOres` | `false` | Only mine ores touching air, against anti-xray. |
| `allowOnlyExposedOresDistance` | `1` | How far around an ore to look for air. Keep it low. |
| `exploreForBlocks` | `true` | Explore when it knows of no matching blocks, instead of giving up. |
| `mineGoalUpdateInterval` | `5` | Ticks between rescans for blocks. `0` turns it off. |
| `mineMaxOreLocationsCount` | `64` | The most block locations it keeps. |
| `maxCachedWorldScanCount` | `10` | Stop searching what it remembers after this many blocks. |
| `extendCacheOnThreshold` | `false` | Also scan the loaded world when that search finds few. |
| `forceInternalMining` | `true` | Mine two blocks of a vein at once where it can. |
| `internalMiningAirException` | `true` | Only with `forceInternalMining`: skip it when the block next to the goal is air. |
| `mineScanDroppedItems` | `true` | Also go for dropped items of the blocks it mines. |
| `mineDropLoiterDurationMSThanksLouca` | `250` | Milliseconds to wait for a drop after mining a block. |
| `cancelOnGoalInvalidation` | `true` | Stop as soon as the goal block is gone, instead of walking into its spot. |
| `blacklistClosestOnFailure` | `true` | When there's no path to the nearest block, skip it and try the next. |

### Exploring & farming

| Setting | Default | Description |
| --- | --- | --- |
| `exploreMaintainY` | `64` | The height to stay at while exploring. `-1` for none. |
| `worldExploringChunkOffset` | `0` | Aim this many chunks beyond the nearest unseen one. |
| `exploreChunkSetMinimumSize` | `10` | How many unseen chunks to aim for at once. |
| `disableCompletionCheck` | `false` | Skip checking whether there's anything left to explore. |
| `replantCrops` | `true` | Replant crops when farming, and leave cactus and sugar cane to regrow. |
| `replantNetherWart` | `false` | Also replant nether wart. Only with `replantCrops`. |
| `farmMaxScanSize` | `256` | The most crops it looks for at once. |
| `farmUsingSelection` | `false` | Only farm inside a selection. There's no way to make one here, so leave it off. |

### Path calculation

| Setting | Default | Description |
| --- | --- | --- |
| `primaryTimeoutMS` | `500` | Stop calculating after this long, if a path was found. |
| `failureTimeoutMS` | `2000` | Stop calculating after this long, path or not. |
| `planAheadPrimaryTimeoutMS` | `4000` | `primaryTimeoutMS`, for planning the next segment. |
| `planAheadFailureTimeoutMS` | `5000` | `failureTimeoutMS`, for planning the next segment. |
| `planningTickLookahead` | `150` | Start planning the next segment when this many ticks of the current one are left. |
| `splicePath` | `true` | Join a next segment onto the current one. |
| `pathingMaxChunkBorderFetch` | `50` | How many times a calculation may reach past known chunks before it stops there. |
| `cutoffAtLoadBoundary` | `false` | Cut a path off where the loaded chunks end. |
| `pathCutoffFactor` | `0.9` | Keep this much of each path and drop the rest. `0.9` drops the last 10%. |
| `pathCutoffMinimumLength` | `30` | Only cut paths of at least this many moves. |
| `simplifyUnloadedYCoord` | `true` | Treat a `block` goal in unseen chunks as an `xz` goal until close. |
| `maxCostIncrease` | `10` | Plan again if a move got this much costlier since it was planned. |
| `costVerificationLookahead` | `5` | Stop this many moves short of something that became impassable. |
| `movementTimeoutTicks` | `100` | Give up on a move that takes this many ticks longer than expected. |
| `maxPathHistoryLength` | `300` | Forget the oldest moves past this many. |
| `pathHistoryCutoffAmount` | `50` | How many moves to forget at once. |
| `minimumImprovementRepropagation` | `true` | Ignore cost improvements under 0.01 ticks. |
| `pathingMapDefaultSize` | `1024` | Initial size of the calculation's node map. |
| `pathingMapLoadFactor` | `0.75` | Load factor of that map. |
| `pathThroughCachedOnly` | `false` | Only path through what it remembers. Don't. |
| `slowPath` | `false` | Calculate slowly, for debugging. |
| `slowPathTimeDelayMS` | `100` | Milliseconds per node with `slowPath`. |
| `slowPathTimeoutMS` | `40000` | The timeout with `slowPath`. |

### Looking

| Setting | Default | Description |
| --- | --- | --- |
| `randomLooking` | `0.01` | Degrees of random jitter on yaw and pitch, every tick. `0` turns it off. |
| `randomLooking113` | `2` | More random jitter, on yaw only. `0` turns it off. |
| `remainWithExistingLookDirection` | `true` | Keep the direction it already faces when it can. |

### Arrival & everything else

| Setting | Default | Description |
| --- | --- | --- |
| `rightClickContainerOnArrival` | `true` | Open a container it was sent to with `getToBlock`. |
| `axisHeight` | `120` | The height of the [`axis`](/baritone/commands#goals) goal. |
| `backfill` | `false` | Fill in the blocks it broke behind it. |
| `chatDebug` | `false` | Baritone's messages go to the client log, not chat. This adds its debug messages. |
| `censorCoordinates` | `false` | Hide coordinates when printing goals, including [`goal`](/baritone/state#status). |
| `disconnectOnArrival` | `false` | Disconnect on arrival. Here it only logs a warning. |
| `desktopNotifications` | `false` | Here these go to the client log as warnings and errors. |
| `notificationOnPathComplete` | `true` | Only with `desktopNotifications`. |
| `notificationOnFarmFail` | `true` | Only with `desktopNotifications`. |
| `notificationOnExploreFinished` | `true` | Only with `desktopNotifications`. |
| `notificationOnMineFail` | `true` | Only with `desktopNotifications`. |
| `followOffsetDistance`, `followOffsetDirection`, `followRadius`, `followTargetMaxDistance` | | No effect. There's no follow command. |
