---
id: context
title: The Context
---

# The Context (`ctx`)

`ctx` is how your module watches the game and reacts to it. Your
[setup function](/guides/getting-started/two-phases#phase-2--setupctx) gets a
fresh one for each session. Here's what's on it:

| Member | Purpose |
| --- | --- |
| `ctx.session` | The live [`GameSession`](/api/session): entities, world, items, connection. |
| `ctx.options` | The live [option handles](/guides/options), typed from the schema. |
| `ctx.on(event, cb)` | Subscribe to a [game event](/guides/events-and-packets#game-events). |
| `ctx.onPacket(name, cb)` | Subscribe to a [packet](/guides/events-and-packets#packets) on the real connection, in either direction. |
| `ctx.onInjectedPacket(name, cb)` | Subscribe to a locally-injected packet. |
| `ctx.onEnable(cb)` | Run `cb` each time the module is enabled. |
| `ctx.onDisable(cb)` | Run `cb` each time the module is disabled. |

## Listeners only fire while enabled

Listeners added with `ctx.on`, `ctx.onPacket`, or `ctx.onInjectedPacket`
**only fire while the module is toggled on**. You don't need an "am I enabled?"
check in your handlers; disabling the module silences them.

`onEnable` and `onDisable` fire on the *switch* itself. Use them for anything
that should happen each time the user flips the toggle, like resetting state or
sending a one-off packet.

```ts
(ctx) => {
  ctx.onEnable(() => console.log("turned on"));
  ctx.onDisable(() => console.log("turned off"));

  // Every movement tick, but only while enabled.
  ctx.on("movement_tick", (state) => state.jump());
};
```

The same rules apply inside an [executable mode](/guides/options#modes)'s
setup, with one addition: its listeners and hooks also only fire while that
mode is selected.

## Per-session state

Setup runs fresh for each session, so a plain variable inside it already **is**
per-session state. That's the default, and it needs nothing extra:

```ts
(ctx) => {
  let ticks = 0; // one per session
  ctx.on("tick", () => { ticks++; });
};
```

What a closure can't do is share state across *several* setup functions. For
example, a module's own setup and its [modes](/guides/options#modes)' setups
each get their own closure.

For that, use `utils.sessionLocal`. It creates a typed store keyed by session;
every setup that calls it with `ctx.session` gets the same object:

```ts
import { utils } from "@protohax/userscript";

const combat = utils.sessionLocal(() => ({ ticks: 0, target: null as string | null }));

// in the module's setup AND any mode's setup:
(ctx) => {
  ctx.on("tick", () => { combat(ctx.session).ticks++; });
};
```

Values are dropped automatically when the session ends. Keep in mind:

- It's per-**session**, not per-enable. State survives the module being toggled
  off and on again. Reset it in `ctx.onEnable` if that's not what you want.
- **Don't** use a module-level `let` instead. That single variable would be
  shared by *every* session (and every copy of an Atomic module) at once.

## Errors are contained

If your setup function or a lifecycle hook throws, the error is logged and
**doesn't break the session for other modules**. A broken script fails
gracefully instead of taking the client down. See
[Debugging](/guides/debugging) for where the logs go on each platform.
