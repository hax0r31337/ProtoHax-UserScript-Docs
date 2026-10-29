---
id: widgets
title: Widgets
---

# Widgets

## `createWidget(options)`

```ts
import { createWidget } from "@protohax/userscript";

const widget = createWidget({ style: "hud", interactive: true });
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `style` | `"hud" \| "screen"` | required | Where it goes. See [Two styles](/ui#two-styles). |
| `flavor` | `"lite" \| "web"` | `"lite"` | How it's drawn. See [Two flavors](/ui#two-flavors). |
| `visible` | `boolean` | `true` | Whether it's shown from the start. |
| `interactive` | `boolean` | `false` | `hud` only. Whether it takes touches. When it doesn't, they go through to the game. |
| `placement` | `Partial<HudPlacement>` or `HudPlacementConfigurable` | top left, scale 1 | `hud` only. Where it starts, or a placement kept in the module's options for it to follow. See [HUD Placement](/ui/hud-placement). |

An unknown `style` or `flavor` throws. Everything else is sent to the client and
returns straight away.

Inside a module's setup, use **`ctx.createWidget(options)`** instead. It takes
the same options and destroys the widget with the session. See
[Lifetime](#lifetime).

## Rendering into it

`widget.root` is the element you render into. It's a `div`.

```ts
import { h, render } from "preact";
import htm from "htm";

const html = htm.bind(h);

render(html`<${Panel} />`, widget.root);
```

Render again to update, or let component state do it, exactly as in a
browser. Changes made in one go are sent to the client together, once your code
yields.

How big the root is depends on the style:

- **`hud`**: as big as its content, unless you style a size on it.
- **`screen`**: the size of the screen. Lay your content out inside it.

:::tip[Screens are transparent]

A screen only draws what its content does. To dim the game behind it, give
your outer element a background, such as `rgb(0 0 0 / 50%)`.

:::

## `UiWidget`

### State

| Member | Type | Description |
| --- | --- | --- |
| `root` | [`UiElement`](/ui/dom#uielement) | The element to render into. |
| `document` | [`UiDocument`](/ui/dom#uidocument) | Creates this widget's nodes. It's `root.ownerDocument`. |
| `handle` | `number` | The id the client knows the widget by. Read only. |
| `style` | `"hud" \| "screen"` | Read only. |
| `flavor` | `"lite" \| "web"` | What it's drawn with. Read only. |
| `visible` | `boolean` | Whether it's shown. Set it to show or hide. |
| `interactive` | `boolean` | `hud` only: whether it takes touches. A screen always does. |
| `placement` | `HudPlacement` | `hud` only: where it is and its scale. See [HUD Placement](/ui/hud-placement). |
| `destroyed` | `boolean` | Whether `destroy()` has been called. Read only. |

Setting `visible`, `interactive` or `placement` is sent to the client right
away. Each one is only sent if it changed.

### Methods

| Method | Description |
| --- | --- |
| `show()` | Same as `visible = true`. |
| `hide()` | Same as `visible = false`. The content is kept, and showing it again is instant. |
| `onDismiss(callback)` | `screen` only. Runs when the player closed it with back (Esc on desktop). Returns a function that removes the callback. |
| `onMove(callback)` | `hud` only. Runs with the new `HudPlacement` when the player moved or scaled it in the HUD editor. Returns a function that removes the callback. |
| `onDestroy(callback)` | Runs as it's destroyed, before it's gone. Returns a function that removes the callback. |
| `destroy()` | Removes it from the client. The widget is useless afterwards. |

## Screens and `onDismiss`

When the player presses back on a screen (Esc on desktop), the client hides it
**on its own**, then tells your script. By the time your callback runs,
`widget.visible` is already `false`. Use the callback to bring your own state
in line, for example to turn off the module that opened it:

```ts
import { moduleManager } from "@protohax/userscript";

ctx.onEnable(() => widget.show());
ctx.onDisable(() => widget.hide());
widget.onDismiss(() => {
  const module = moduleManager.getModule("script:Settings");
  if (module) module.state.value = false;
});
```

Back closes the topmost screen first. A screen is drawn over the menu, so a
script can open one from a menu action.

## Lifetime

### `ctx.createWidget` — per session

A module's setup runs [once per session](/guides/getting-started/two-phases#phase-2--setupctx),
so it's the natural place for widgets that belong to the module. `ctx.createWidget`
destroys the widget when the session ends or the module is killed, **after**
`onDisable` has run, so your disable hook can still touch it.

```ts
(ctx) => {
  const widget = ctx.createWidget({ style: "hud", visible: false });
  render(html`<${Readout} session=${ctx.session} />`, widget.root);
  widget.onDestroy(() => render(null, widget.root));

  ctx.onEnable(() => widget.show());
  ctx.onDisable(() => widget.hide());
};
```

### `createWidget` — until you destroy it

A widget from the top-level `createWidget` stays until you call
`widget.destroy()`, across sessions. Use it for UI that doesn't belong to one
session, and keep the widget in a top-level variable:

```ts
let widget: UiWidget | undefined;

function openSettings() {
  widget ??= createWidget({ style: "screen", visible: false });
  render(html`<${Settings} />`, widget.root);
  widget.show();
}
```

### Unmount before destroying

Destroying a widget doesn't unmount what Preact rendered into it, so effect
cleanups and `componentWillUnmount` wouldn't run. Unmount in `onDestroy`:

```ts
widget.onDestroy(() => render(null, widget.root));
```

That covers both your own `destroy()` call and `ctx.createWidget`'s cleanup.

## Input

A widget only gets input when touches reach it:

- A **`hud`** widget needs `interactive: true`. Otherwise every touch goes
  through to the game, and your click handlers never run.
- In the **HUD editor**, a HUD widget's content takes no input at all. Touches
  move and scale the widget instead.
- A **`screen`** takes every touch, including the ones on empty areas, so
  nothing reaches the HUD below it.

What arrives depends on the flavor. Lite sends `click`, `contextmenu` (a long
press), `input` and `change`. Web sends any event type you listen to. See
[Lite input](/ui/lite#input) and [Web events](/ui/web#events).

Input is asynchronous: the client reports it after the fact. If you removed a
node in the meantime, its event is dropped.

## Updating every tick

Lite widgets are cheap to update, so a HUD readout can re-render on every
`tick`. Only what changed is sent: setting an attribute, a style property or a
text node's data to the value it already has sends nothing.

```ts
ctx.on("tick", () => {
  const pos = ctx.session.entityState.localPlayer.position;
  render(html`<span>${pos.x.toFixed(1)} ${pos.y.toFixed(1)} ${pos.z.toFixed(1)}</span>`, widget.root);
});
```

Keep the render out of `movement_tick` and `input_tick`. Those run on the game
thread, and the UI doesn't need it that soon.
