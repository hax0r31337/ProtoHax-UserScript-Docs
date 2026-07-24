---
id: context
title: The Context
---

# The Context (`ctx`)

`ctx` is how a module observes and reacts. A fresh one is handed to your
[setup function](/guides/getting-started/two-phases#phase-2--setupctx) for each
session. Its members:

| Member | Purpose |
| --- | --- |
| `ctx.session` | The live [`GameSession`](/api/session) — entities, world, items, connection. |
| `ctx.options` | The live [option handles](/guides/options), typed from the schema. |
| `ctx.on(event, cb)` | Subscribe to a [game event](/guides/events-and-packets#game-events). |
| `ctx.onPacket(name, cb)` | Subscribe to an inbound [packet](/guides/events-and-packets#packets). |
| `ctx.onInjectedPacket(name, cb)` | Subscribe to a locally-injected packet. |
| `ctx.onEnable(cb)` | Run `cb` each time the module becomes enabled. |
| `ctx.onDisable(cb)` | Run `cb` each time the module becomes disabled. |

## Listeners only fire while enabled

A listener wired through `ctx.on` / `ctx.onPacket` / `ctx.onInjectedPacket`
**only fires while the module is toggled on**. You do not need to guard event
handlers with an "am I enabled?" check — being disabled silences them.

`onEnable` / `onDisable` fire on the *transitions*, which is where you put
setup/teardown that must happen each time the user flips the toggle (resetting
state, sending a one-shot packet, etc.).

```ts
(ctx) => {
  const player = ctx.session.entityState.localPlayer;

  ctx.onEnable(() => console.log("turned on"));
  ctx.onDisable(() => console.log("turned off"));

  // Fires every tick, but only while enabled.
  ctx.on("tick", () => player.jump());
};
```

Inside an [executable mode](/guides/options#modes)'s setup, the same rules
apply with one addition: its listeners and hooks are also gated on that mode
being selected.

## Per-session state

The setup function runs fresh for each session, so a plain variable inside it
**is** per-session state — this is the default, and it needs no machinery:

```ts
(ctx) => {
  let ticks = 0; // one per session, by construction
  ctx.on("tick", () => { ticks++; });
};
```

What a closure can't do is span *several* setup functions — say, a module's own
setup and its [modes](/guides/options#modes)' setups, which each get their own
closure. For that, `utils.sessionLocal` creates a typed store keyed by the
session; every setup that calls it with `ctx.session` sees the same object:

```ts
import { utils } from "@protohax/userscript";

const combat = utils.sessionLocal(() => ({ ticks: 0, target: null as string | null }));

// in the module's setup AND any mode's setup:
(ctx) => {
  ctx.on("tick", () => { combat(ctx.session).ticks++; });
};
```

Values are dropped automatically when the session goes away. Two things to
keep in mind:

- It is per-**session**, not per-enable — state survives the module being
  toggled off and on. Reset it in `ctx.onEnable` if it shouldn't.
- Do **not** reach for a module-scope `let` instead: that one variable would be
  shared by *every* session (and every copy of an Atomic module) at once.

## Errors are contained

If your setup function throws, or a lifecycle hook throws, the error is logged
and **does not break the session for other modules**. A broken script degrades
gracefully rather than taking the client down. See
[Debugging](/guides/debugging) for where those logs end up on each platform.
