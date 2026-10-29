---
id: state
title: State & Events
---

# State & Events

What Baritone is doing right now, and the events it raises as it goes.

## Status

| Member | Type | Description |
| --- | --- | --- |
| `get goal` | `string \| null` | The goal being followed, printed the way Baritone prints it, e.g. `GoalXZ{x=1000,z=-250}`. `null` when there's none. |
| `get hasPath` | `boolean` | Whether there is a path being executed. |
| `get isPathing` | `boolean` | Whether there is a path being executed and Baritone isn't paused this tick. |
| `get activeProcess` | `string \| null` | The process in control, by Baritone's name for it. `null` when none is. |
| `get estimatedTicksToGoal` | `number \| null` | How many ticks to the goal, at the pace the player has kept since the path started. `null` when Baritone can't tell yet. |
| `isDisposed` | `boolean` | Whether [`dispose()`](/baritone#lifetime) ran. |

`goal` is meant for showing to the player, not for parsing. Keep your own copy
of a goal you set if you need its coordinates later.

`activeProcess` is a description too. It starts with the process, and the rest
says what it's doing:

| Process | Starts with |
| --- | --- |
| `setGoalAndPath` / `setGoal` | `Custom Goal ` and the goal |
| `mine` | `Mine ` and the blocks |
| `getToBlock` | `Get To ` and the block, or `Exploring randomly to find ` while it knows none |
| `explore` | `Exploring around ` |
| `farm` | `Farming` |
| backfilling (the `backfill` setting) | `Backfill` |

```ts
ctx.on("tick", () => {
  const b = ctx.session.baritone;
  if (b.isPathing) {
    const eta = b.estimatedTicksToGoal;
    console.log(b.activeProcess, eta === null ? "" : `${Math.round(eta / 20)}s`);
  }
});
```

## The path

`getPath()` returns the path being executed, or `null` when there's none.

```ts
interface BaritonePath {
  positions: [x: number, y: number, z: number][];
  /** index in `positions` of the movement being executed */
  position: number;
}
```

`positions` are the blocks the player's feet pass through, from where the
segment started to where it ends. A long trip is made of several segments,
so the last position isn't always the goal. Only the segment being executed is
returned, not the one Baritone is planning next.

```ts
const path = baritone.getPath();
if (path) {
  const left = path.positions.length - 1 - path.position;
  console.log(`${left} moves left in this segment`);
}
```

## What Baritone drew

Baritone draws its goal and paths in the world on its own. You don't need
to do anything.

| Shape | Color |
| --- | --- |
| The goal | green box |
| The path being executed, from 3 moves behind the player | red line |
| The next segment, once planned | magenta line |

## Path events

`baritone.events` is an emitter with one event, `path_event`. It fires as
Baritone's path changes state.

```ts
import type { SessionBaritone } from "@protohax/userscript";

(ctx) => {
  const onPathEvent = (event: BaritonePathEvent) => {
    if (event === "AT_GOAL") {
      ctx.session.sendChatMessage("§aArrived");
    } else if (event === "CALC_FAILED") {
      ctx.session.sendChatMessage("§cNo path");
    }
  };

  let baritone: SessionBaritone | null = null;

  ctx.onEnable(() => {
    baritone = ctx.session.baritone;
    baritone.events.on("path_event", onPathEvent);
  });
  ctx.onDisable(() => {
    baritone?.events.off("path_event", onPathEvent);
    baritone = null;
  });
};
```

`baritone.events` is not `ctx.on`. It doesn't follow your module's toggle or
its session, so take your listener off yourself, like above. Keep hold of the
instance you added it to: after a [`dispose()`](/baritone#lifetime),
`session.baritone` is a different one.

| Event | When |
| --- | --- |
| `CALC_STARTED` | Baritone started calculating a path from where the player is. |
| `CALC_FINISHED_NOW_EXECUTING` | It found one, and the player is following it. |
| `CALC_FAILED` | It found no path. |
| `NEXT_SEGMENT_CALC_STARTED` | While the player follows a path, Baritone started planning the next segment. |
| `NEXT_SEGMENT_CALC_FINISHED` | The next segment is planned. |
| `CONTINUING_ONTO_PLANNED_NEXT` | The player reached the end of a segment and went on to the next one. |
| `SPLICING_ONTO_NEXT_EARLY` | The next segment was joined onto the current one before its end. |
| `PATH_FINISHED_NEXT_STILL_CALCULATING` | The player reached the end of a segment, and the next isn't planned yet. The player waits. |
| `NEXT_CALC_FAILED` | Planning the next segment failed. |
| `DISCARD_NEXT` | The planned next segment was thrown away, because it no longer starts where the current one ends. |
| `AT_GOAL` | The player is in the goal. |
| `CANCELED` | The path was cancelled. |

An event arrives **after** the call into Baritone that raised it has
returned, so you can call back into Baritone from the listener: cancel, set a
new goal, start a process. Most events are raised by Baritone's tick, which
runs in [`input_tick`](/baritone/how-it-works#where-it-sits-in-a-tick), so keep
the listener short.

:::note[A process doesn't end with `AT_GOAL`]

A process like `mine` sets one goal after another. `AT_GOAL` fires at each of
them, and the process goes on. For a process, check `activeProcess` instead:
it goes back to `null` when the process is done.

:::

## Baritone's view of the player

| Method | Returns | Description |
| --- | --- | --- |
| `getPlayer()` | `Required<BaritonePlayer> \| null` | The player as Baritone has it, after this tick's changes: its rotation, selected slot, sprinting, and so on. `null` before Baritone has a player. |
| `getMovementInput()` | `BaritoneMovementInput \| null` | The keys Baritone holds this tick. `null` when Baritone isn't moving the player, so the player's own keys go in. |

```ts
interface BaritoneMovementInput {
  left_impulse: number;     // positive is left
  forward_impulse: number;  // positive is forward
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  shift: boolean;
  sprint: boolean;
}
```

The keys are relative to the direction Baritone faces, which isn't the
player's camera. See [How It Drives the Player](/baritone/how-it-works) for
what's done with them. `getMovementInput() !== null` is a cheap way to ask
"is Baritone in charge of the keys right now?".

These are mostly for debugging and HUDs. Data from Baritone uses its own field
names, which are `snake_case`.
