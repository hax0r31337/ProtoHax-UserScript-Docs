---
id: index
title: Baritone
slug: /baritone
---

# Baritone

Every session comes with a **pathfinder**: a port of
[Baritone](https://github.com/cabaletta/baritone) to Rust, built into the
client. Give it a goal and it walks the player there. It breaks blocks in the
way, bridges and pillars with throwaway blocks, swims, climbs and falls. It can
also mine, farm and explore for you.

```ts
const baritone = ctx.session.baritone;

baritone.setGoalAndPath({ type: "xz", x: 1000, z: -250 });
```

That's all you need to send the player 1000 blocks east. Baritone works out the
path, moves the player every tick, and draws the goal and the path in the
world while it does.

## `session.baritone`

`session.baritone` is a `SessionBaritone`. The session builds it the first time
you read the property, and from then on it runs every tick until the session
ends.

| Member | Type | Description |
| --- | --- | --- |
| `session.baritone` | [`SessionBaritone`](#what-you-get) | This session's Baritone. Built on first read, and again after it was [disposed](#lifetime). |
| `session.hasBaritone` | `boolean` | Whether Baritone is built and running. Reading it never builds one. |

Reading `session.baritone` **throws** when:

- the session hasn't received the start game packet yet. Baritone needs the
  session's block states, which come with it;
- the client's engine has no Baritone in it;
- the session is closed.

A module's setup function runs when the session opens, before the start game
packet. So don't read `ctx.session.baritone` in setup itself. Read it later, in
`onEnable`, a tick or a key handler, when you actually need it:

```ts
(ctx) => {
  ctx.onEnable(() => {
    ctx.session.baritone.setGoalAndPath({ type: "y_level", y: 64 });
  });
  ctx.onDisable(() => {
    if (ctx.session.hasBaritone) ctx.session.baritone.cancel();
  });
};
```

## What you get

| Page | What's on it |
| --- | --- |
| [Goals & Commands](/baritone/commands) | The goal types, pathing to them, cancelling, and the processes: `mine`, `getToBlock`, `explore`, `farm`. |
| [State & Events](/baritone/state) | Whether Baritone is pathing, the path itself, the active process, and the `path_event` event. |
| [Settings](/baritone/settings) | Baritone's settings (`allowBreak`, `allowParkour`, …) and how far around the player it keeps the world. |
| [How It Drives the Player](/baritone/how-it-works) | Where Baritone sits in the tick, what it does to the input, the jump and the rotation, and what's unsupported. |
| [Examples](/baritone/examples) | A "go to" module, a miner, and a status HUD. |

## One Baritone per session

There's **one** Baritone per session, and every script shares it. That's on
purpose: there's only one player to move. It also means:

- A goal set by one script **replaces** a goal set by another.
- Disabling your module doesn't stop Baritone. If your module started a path,
  stop it in `onDisable` with [`cancel()`](/baritone/commands#cancelling).
- [Settings](/baritone/settings) are shared by every session, not just every
  script. Changing one changes it everywhere.

## Lifetime

| Event | What happens |
| --- | --- |
| First read of `session.baritone` | Baritone is built. It takes the world from the session as the player comes near it. |
| Dimension change | Baritone forgets the world, and what it remembered of it, and takes the new dimension's on the next tick. |
| A new start game packet | Baritone takes the new block states and rebuilds its world. |
| `baritone.dispose()` | Baritone stops on the spot and lets go of the player. The next read of `session.baritone` builds a new one. |
| The session closes | Baritone is disposed. |

```ts
baritone.dispose();
baritone.isDisposed;          // true
ctx.session.hasBaritone;      // false
ctx.session.baritone;         // a new SessionBaritone
```

`dispose()` drops everything: the goal and the process go, and the new
Baritone has its own `events`, so
[`path_event`](/baritone/state#path-events) listeners on the old one never fire
again. You rarely need it. To just stop moving, use `cancel()`.

## Without a session at hand

`getBaritone()` returns `session.baritone` of the only open session. It's for
code that has no `ctx` to get a session from, like a widget created with the
global `createWidget`:

```ts
import { getBaritone } from "@protohax/userscript";

getBaritone().setGoalAndPath({ type: "block", x: 0, y: 70, z: 0 });
getBaritone().getSettings().allowParkour;
```

It throws if no session or more than one session is open. When you have the
session, `getBaritone(session)` is the same as `session.baritone`.

## Types

The goal, settings, path and player types (`BaritoneGoal`, `BaritoneSettings`,
`BaritonePath`, `BaritonePathEvent`, …) are **global**. You use them without
importing anything:

```ts
const home: BaritoneGoal = { type: "near", x: 120, y: 64, z: -40, range: 3 };
```

These names are exported from `@protohax/userscript`:

- **Values**: `getBaritone`, `SessionBaritone`, `BaritoneStateTable`,
  `blockStateTableOf`, `BLOCK_STATE_TABLE_VERSION`
- **Types**: `BaritoneEvents`
