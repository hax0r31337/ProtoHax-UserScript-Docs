---
id: examples
title: Examples
---

# Examples

Both examples use the lite flavor, so they work on every platform. They
assume the [Preact and htm setup](/ui/setup).

## A coordinates HUD

A HUD readout that the player can move and scale, with its placement saved in
the module's config.

```ts
import { defineModule } from "@protohax/userscript";
import { h, render } from "preact";
import htm from "htm";

const html = htm.bind(h);

defineModule(
  { name: "Coordinates" },
  {
    placement: {
      type: "hud-placement",
      def: { alignment: "Top Left", x: 0.01, y: 0.3 },
    },
    decimals: { type: "number", def: 1, min: 0, max: 3, step: 1 },
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

    const player = ctx.session.entityState.localPlayer;

    ctx.on("tick", () => {
      const d = ctx.options.decimals.value;
      const { x, y, z } = player.position;

      render(html`
        <div style=${{
          // everything else is in em, so it all follows the HUD scale
          fontSize: "calc(13px * var(--hud-scale))",
          padding: "0.3em 0.6em",
          borderRadius: "0.5em",
          background: "rgb(0 0 0 / 45%)",
          color: "white",
          whiteSpace: "nowrap",
        }}>
          <b style=${{ color: "var(--primary)" }}>XYZ</b>
          ${" "}${x.toFixed(d)} ${y.toFixed(d)} ${z.toFixed(d)}
        </div>
      `, widget.root);
    });
  },
);
```

- The widget is created hidden and follows the module's toggle.
- Re-rendering every `tick` is fine: only the text that changed is sent.
- `ctx.createWidget` destroys it with the session, and `onDestroy` unmounts
  Preact first.

## A quick panel on a keybind

A screen with a switch for each of a few modules, opened and closed with a key
the player picks.

```ts
import { defineModule, moduleManager } from "@protohax/userscript";
import { h, render } from "preact";
import { useEffect, useState } from "preact/compat";
import htm from "htm";

const html = htm.bind(h);

const MODULES = ["Kill Aura", "Velocity", "Sprint", "Scaffold"];

function ModuleSwitch({ id }: { id: string }) {
  const state = moduleManager.getModule(id)?.state;
  const [on, setOn] = useState(state?.value ?? false);

  // follow toggles made elsewhere: the menu, a keybind, another script
  useEffect(() => {
    if (!state) return;
    return state.subscribe(() => setOn(state.value));
  }, [state]);

  if (!state) return null;

  return html`
    <label style=${{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span>${id}</span>
      <input
        type="checkbox"
        role="switch"
        checked=${on}
        onChange=${(e: Event) => {
          state.value = (e.currentTarget as HTMLInputElement).checked;
        }}
      />
    </label>
  `;
}

function Panel({ onClose }: { onClose: () => void }) {
  return html`
    <div style=${{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgb(0 0 0 / 50%)",
    }}>
      <div style=${{
        width: "320px",
        padding: "16px",
        borderRadius: "16px",
        background: "var(--surface-container-high)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}>
        <h3 style=${{ margin: "0 0 4px" }}>Quick Panel</h3>
        ${MODULES.map((id) => html`<${ModuleSwitch} key=${id} id=${id} />`)}
        <button onClick=${onClose}>Close</button>
      </div>
    </div>
  `;
}

defineModule(
  { name: "Quick Panel" },
  {
    key: { type: "keybind", name: "Open Key" },
  },
  (ctx) => {
    const widget = ctx.createWidget({ style: "screen", visible: false });
    const close = () => widget.hide();

    render(html`<${Panel} onClose=${close} />`, widget.root);
    widget.onDestroy(() => render(null, widget.root));

    ctx.onEnable(() => {
      ctx.options.key.listener = () => {
        widget.visible = !widget.visible;
      };
    });

    ctx.onDisable(() => {
      ctx.options.key.listener = undefined;
      close();
    });
  },
);
```

- The panel is rendered once. Each switch keeps its own state and updates
  itself when the module it shows is toggled.
- Back (Esc on desktop) hides the screen without any code: the client does it.
- The key's listener is set only while the module is enabled, so turning
  Quick Panel off also turns off its key.
- The width of the card is set, so its rows stretch across it and
  `justify-content: space-between` pushes each switch to the right. See
  [how lite layout differs](/ui/lite#how-the-layout-differs-from-a-browser).

On Android without a keyboard, the player opens the panel with the option's
shortcut instead: the bookmark button next to "Open Key" in the menu puts it on
the HUD. See [Keybinds](/guides/options#keybinds).
