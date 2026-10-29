---
id: index
title: UI Widgets
slug: /ui
---

# UI Widgets

A **widget** is a piece of UI your script draws on the client: a HUD element
that sits over the game, or a full screen with buttons, sliders and text
fields. You build it with [Preact](https://preactjs.com/) (or plain DOM calls),
and the client draws it.

```ts
import { createWidget } from "@protohax/userscript";
import { h, render } from "preact";
import htm from "htm";

const html = htm.bind(h);

const widget = createWidget({ style: "hud" });
render(html`<div style=${{ color: "var(--primary)" }}>Hello</div>`, widget.root);
```

## How it works

Your script doesn't run in a browser, so there's no real DOM. Each widget
comes with a small **DOM shim** instead: a tree of elements, text nodes and
inline styles that's just enough for Preact to render into.

1. You render into `widget.root`. Preact builds the tree with the shim's
   `createElement`, `appendChild`, `setAttribute` and so on.
2. The shim records every change as an **op** and sends the batch to the client
   once your code yields. One message per widget per task, however many
   changes you made.
3. The client keeps a mirror of the tree and draws it.
4. Input goes the other way. A tap on a button reaches the client, which sends
   it back to your script as a `click` event on the matching node. Your
   `onClick` handler runs.

Nothing about the layout comes back, though. The script never learns how big
anything turned out on screen.

## Two styles

A widget's **style** decides where it goes. You pick it when you create the
widget and can't change it later.

| Style | What it is |
| --- | --- |
| `hud` | Drawn with the HUD, over the game. The player moves and scales it in the HUD editor, like a HUD module. Touches go through to the game unless it's `interactive`. |
| `screen` | Fills the screen over the game, and over the menu too. It takes every touch, and back (Esc on desktop) closes it. |

## Two flavors

A widget's **flavor** decides how the client draws it. This is also fixed at
creation.

| Flavor | Drawn by | Good for |
| --- | --- | --- |
| `lite` (default) | The client's own renderer. Supports a subset of HTML and CSS. | Most widgets: HUD readouts, settings screens, anything updated every tick. Cheap to create and to update. |
| `web` | A webview, one per widget. All of HTML and CSS. | Content that needs stylesheets, grid, animations, SVG or pointer details. Heavier to create and to keep. |

Start with `lite`. Switch to `web` only when you need something lite can't do.
See [Lite Flavor](/ui/lite) and [Web Flavor](/ui/web) for exactly what each
supports.

## Lifetime

| Created with | Destroyed |
| --- | --- |
| `createWidget(options)` | Only when you call `widget.destroy()`. It lives across sessions. |
| `ctx.createWidget(options)` | With the module's session: when the session ends or the module is killed, right after `onDisable`. |

When the client reloads your scripts, every widget the old run left behind is
cleared from the screen.

See [Widgets](/ui/widgets#lifetime) for when to use which.

## In this section

- [Preact & htm](/ui/setup): importing the copies the client ships, bundling,
  and JSX.
- [Widgets](/ui/widgets): `createWidget`, its options, and the `UiWidget`
  members.
- [HUD Placement](/ui/hud-placement): positioning HUD widgets, scaling them,
  and saving where the player put them.
- [Theming](/ui/theming): the color scheme, `--hud-scale` and the safe-area
  insets as CSS variables.
- [Lite Flavor](/ui/lite): the elements, controls and CSS the lite renderer
  supports, and how its layout differs from a browser.
- [Web Flavor](/ui/web): what the webview adds, and what it blocks.
- [Custom Widgets](/ui/custom-widgets): the client's own elements for the
  game, like `mc-text` for text with `§` formatting codes, in either flavor.
- [The DOM Shim](/ui/dom): the node, element, style and event API under
  Preact.
- [Examples](/ui/examples): a HUD readout, a settings screen, and a screen
  opened with a keybind.
