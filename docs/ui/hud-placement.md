---
id: hud-placement
title: HUD Placement
---

# HUD Placement

A `hud` widget is placed the way HUD modules are. The player can drag it and
pinch it in the HUD editor, and the widget can save where they put it with the
module's config.

## `HudPlacement`

| Field | Type | Description |
| --- | --- | --- |
| `alignment` | `HudAlignment` | The corner, edge or center the widget is anchored to. |
| `x` | `number` | Distance from the anchored left or right edge, as a fraction of the screen width. Unused when the alignment is centered horizontally. |
| `y` | `number` | Distance from the anchored top or bottom edge, as a fraction of the screen height. Unused when the alignment is centered vertically. |
| `scale` | `number` | The size the player picked. **Not applied for you**, see [Scaling](#scaling). |

`HudAlignment` is one of:

```ts
"Top Left"    | "Top Center"    | "Top Right"
"Center Left" | "Center"        | "Center Right"
"Bottom Left" | "Bottom Center" | "Bottom Right"
```

So `{ alignment: "Bottom Right", x: 0.02, y: 0.05 }` puts the widget's bottom
right corner 2% of the screen width from the right edge and 5% of the height
from the bottom. Because the distances are fractions, the widget keeps its
place when the screen size changes.

The default placement is `{ alignment: "Top Left", x: 0, y: 0, scale: 1 }`.

## Placing a widget

Pass a placement when you create the widget. Fields you leave out keep their
default:

```ts
const widget = createWidget({
  style: "hud",
  placement: { alignment: "Top Right", x: 0.01, y: 0.1 },
});
```

Read `widget.placement` to see where it is now, including after the player
moved it. It's a copy, so set the property to move the widget. Fields you
leave out keep their current value:

```ts
widget.placement = { y: 0.2 };
```

An unknown alignment, or a scale that isn't above zero, throws.

## Scaling

The scale isn't applied to the widget for you. Instead, the content reads it
as the `--hud-scale` CSS variable and sizes itself by it. Scale the font size,
and size everything else in `em`, so the whole widget follows:

```ts
html`
  <div style=${{
    fontSize: "calc(13px * var(--hud-scale))",
    padding: "0.4em 0.6em",
    borderRadius: "0.5em",
    background: "rgb(0 0 0 / 40%)",
  }}>
    ${text}
  </div>
`;
```

In the lite flavor, [controls](/ui/lite#controls) also scale with their font
size, so a button inside that `div` grows with it too.

`--hud-scale` is `1` on screens.

## In the HUD editor

While the HUD editor is open, every HUD widget gets the editor's outline and
can be:

- **dragged** with one finger, snapping to the nearest alignment when let go;
- **pinched** to change its scale, between `0.25` and `4`.

Its content takes no input while the editor is open. When the player lets go,
the widget's `placement` is updated and your `onMove` callbacks run with it:

```ts
widget.onMove((placement) => {
  console.log("moved to", placement.alignment, placement.x, placement.y);
});
```

A placement you set from code doesn't trigger `onMove`. It's only for the
player's moves.

## Saving the placement — `hud-placement`

A plain placement is forgotten when the widget goes away. To keep it in the
module's config, like a HUD module's position, declare a `hud-placement` option
and hand its handle to the widget:

```ts
import { defineModule } from "@protohax/userscript";

defineModule(
  { name: "Coordinates" },
  {
    placement: {
      type: "hud-placement",
      def: { alignment: "Top Right", x: 0.02, y: 0.02 },
    },
  },
  (ctx) => {
    const widget = ctx.createWidget({
      style: "hud",
      placement: ctx.options.placement,
    });
    // ...
  },
);
```

The widget now follows the option:

- It starts where the config says.
- When the player moves it in the HUD editor, the new placement is written into
  the option, and saved with the rest of the config.
- When the option changes, from a config load or from your code, the widget
  moves.

The option is **hidden from the menu**, like a HUD module's position. `def` is
what it resets to, and fields you leave out default to top left at scale 1.

### `HudPlacementConfigurable`

The handle of a `hud-placement` node is a `HudPlacementConfigurable`:

| Member | Type | Description |
| --- | --- | --- |
| `placement` | `HudPlacement` | The placement it holds, as a copy. Set it to move every widget following it. Fields you leave out keep their value. |
| `alignment` | `Option<HudAlignment>` | The option each field is kept in. |
| `x`, `y` | `Option<number>` | Clamped to `0`–`1`. |
| `scale` | `Option<number>` | Clamped to `0.25`–`4`. |
| `subscribe(callback)` | `() => void` | Runs when the placement changed, from a config load or a set. Returns an unsubscribe function. |

Setting `placement` clamps the ratios and the scale to those ranges. A widget's
own `widget.placement` setter writes through to the configurable when it
follows one.

:::note[One placement per widget]

A configurable holds one placement. If two widgets follow the same one, moving
either moves both. Give each widget its own `hud-placement` option.

:::

### Without a schema

`HudPlacementConfigurable` is exported too, so you can create one yourself and
embed it with a [`raw` node](/api/combat-helpers#raw-nodes--the-escape-hatch).
Name it with a leading `#` so its drawer is hidden:

```ts
import { HudPlacementConfigurable } from "@protohax/userscript";

const placement = new HudPlacementConfigurable({ alignment: "Bottom Left" });

defineModule(
  { name: "Clock" },
  { clock: { type: "raw", name: "#clock", configurable: placement } },
  (ctx) => {
    ctx.createWidget({ style: "hud", placement });
  },
);
```
