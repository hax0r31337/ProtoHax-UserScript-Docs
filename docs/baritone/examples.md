---
id: examples
title: Examples
---

# Examples

## Go to coordinates

Enable the module and the player walks to the coordinates in its options. It
turns itself off on arrival, and disabling it stops Baritone.

```ts
import { defineModule, moduleManager } from "@protohax/userscript";
import type { SessionBaritone } from "@protohax/userscript";

defineModule(
  { name: "Go To" },
  {
    target: { type: "string", name: "Target (x y z or x z)", def: "0 64 0" },
  },
  (ctx) => {
    let baritone: SessionBaritone | null = null;

    const turnOff = () => {
      const module = moduleManager.getModule("script:Go To");
      if (module) module.state.value = false;
    };

    const onPathEvent = (event: BaritonePathEvent) => {
      if (event === "AT_GOAL") {
        ctx.session.sendChatMessage("§aArrived");
        turnOff();
      } else if (event === "CALC_FAILED") {
        ctx.session.sendChatMessage("§cNo path to the target");
        turnOff();
      }
    };

    function parseGoal(text: string): BaritoneGoal | null {
      const n = text.trim().split(/\s+/).map(Number);
      if (n.some(Number.isNaN)) return null;
      if (n.length === 3) return { type: "block", x: n[0], y: n[1], z: n[2] };
      if (n.length === 2) return { type: "xz", x: n[0], z: n[1] };
      return null;
    }

    ctx.onEnable(() => {
      const goal = parseGoal(ctx.options.target.value);
      if (!goal) {
        ctx.session.sendChatMessage("§cTarget is x y z, or x z");
        turnOff();
        return;
      }

      baritone = ctx.session.baritone;
      baritone.events.on("path_event", onPathEvent);
      baritone.setGoalAndPath(goal);
    });

    ctx.onDisable(() => {
      if (!baritone) return;
      baritone.events.off("path_event", onPathEvent);
      if (!baritone.isDisposed) baritone.cancel();
      baritone = null;
    });
  },
);
```

- `session.baritone` is read in `onEnable`, not in setup. Setup runs before
  the start game packet, when it would throw.
- The `path_event` listener is taken off the same instance it was added to.
- A `CALC_FAILED` turns the module off too, so it doesn't stay on with nowhere
  to go.

## Mine until you have enough

[`mine`'s quantity](/baritone/commands#minequantity-blocks) is never reached on
Bedrock, so this counts the items itself and stops Baritone when there are
enough.

```ts
import { defineModule, moduleManager } from "@protohax/userscript";

defineModule(
  { name: "Miner" },
  {
    blocks: {
      type: "string-list",
      name: "Blocks",
      def: ["minecraft:iron_ore", "minecraft:deepslate_iron_ore"],
    },
    item: { type: "string", name: "Count Item", def: "minecraft:raw_iron" },
    amount: { type: "number", name: "Amount", def: 64, min: 1, max: 576, step: 1 },
  },
  (ctx) => {
    const player = ctx.session.entityState.localPlayer;
    let started = false;

    const turnOff = () => {
      const module = moduleManager.getModule("script:Miner");
      if (module) module.state.value = false;
    };

    const count = (name: string) => {
      let total = 0;
      for (const stack of player.inventory.content) {
        if (stack?.definition.name === name) total += stack.amount;
      }
      return total;
    };

    const start = () => {
      try {
        ctx.session.baritone.mine(0, ctx.options.blocks.value);
        started = true;
      } catch (error) {
        if (error instanceof TypeError) {
          // a selector Baritone can't read
          ctx.session.sendChatMessage(`§c${error.message}`);
          turnOff();
        }
        // otherwise Baritone has no world yet: try again next tick
      }
    };

    ctx.onEnable(() => {
      started = false;
    });

    ctx.on("tick", () => {
      if (count(ctx.options.item.value) >= ctx.options.amount.value) {
        ctx.session.sendChatMessage("§aDone mining");
        turnOff();
      } else if (!started) {
        start();
      }
    });

    ctx.onDisable(() => {
      if (ctx.session.hasBaritone) ctx.session.baritone.cancel();
    });
  },
);
```

- Mining starts from `tick`, not `onEnable`, and is retried until it works.
  `mine` throws while Baritone has no world, and Baritone only builds its world
  on its first tick after `session.baritone` is first read.
- A bad selector is a `TypeError`, so it's told apart from the "no world yet"
  error and turns the module off.
- Ore drops are other items (iron ore drops raw iron), which is why the item to
  count is an option of its own.

## A status HUD

A HUD line with what Baritone is doing and how long it has left. It reads
`hasBaritone` first, so it never builds a Baritone just to show that there's
nothing to show.

```ts
import { defineModule } from "@protohax/userscript";
import { h, render } from "preact";
import htm from "htm";

const html = htm.bind(h);

defineModule(
  { name: "Baritone Status" },
  {
    placement: {
      type: "hud-placement",
      def: { alignment: "Top Left", x: 0.01, y: 0.4 },
    },
  },
  (ctx) => {
    const widget = ctx.createWidget({
      style: "hud",
      visible: false,
      placement: ctx.options.placement,
    });
    widget.onDestroy(() => render(null, widget.root));

    ctx.onEnable(() => widget.show());
    ctx.onDisable(() => widget.hide());

    ctx.on("tick", () => {
      const session = ctx.session;
      const baritone = session.hasBaritone ? session.baritone : null;
      const process = baritone?.activeProcess ?? null;

      if (!process) {
        render(null, widget.root);
        return;
      }

      const eta = baritone!.estimatedTicksToGoal;
      const seconds = eta === null ? null : Math.round(eta / 20);

      render(html`
        <div style=${{
          fontSize: "calc(12px * var(--hud-scale))",
          padding: "0.3em 0.6em",
          borderRadius: "0.5em",
          background: "rgb(0 0 0 / 45%)",
          color: "white",
          maxWidth: "24em",
        }}>
          <b style=${{ color: "var(--primary)" }}>Baritone</b>
          ${" "}${process}
          ${seconds !== null && html`<div style=${{ opacity: 0.7 }}>${seconds}s left</div>`}
        </div>
      `, widget.root);
    });
  },
);
```

See [UI Widgets](/ui) for `createWidget` and the HUD placement option.
