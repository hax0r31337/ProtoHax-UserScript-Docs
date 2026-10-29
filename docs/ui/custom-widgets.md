---
id: custom-widgets
title: Custom Widgets
---

# Custom Widgets

Besides HTML, the client draws a few elements of its own, made for the game.
They work the same in both flavors: lite draws them natively, and the web
flavor's page defines them as custom elements. Render them like any other
element.

| Element | What it draws |
| --- | --- |
| [`mc-text`](#minecraft-text) | Text with Minecraft's `§` formatting codes. |

## Minecraft Text

Names, chat and scoreboard lines come with Minecraft's `§` formatting codes.
The `mc-text` element draws them as the game would:

```ts
html`<mc-text text=${player.name} />`;
html`<mc-text text="§aOnline §7(§f12§7)" />`;
```

Its `text` attribute is the formatted string. Change it like any other
attribute, and the element redraws.

### Codes

| Code | Effect |
| --- | --- |
| A color code, see [Colors](#colors) | Colors the text after it. |
| `§l` | Bold. |
| `§o` | Italic. |
| `§r` | Back to the element's own style: its inherited color, weight and style. |

As in Bedrock, a color code doesn't end bold or italic, only `§r` does.
Other codes, `§k` (obfuscated) included, are dropped without drawing
anything, and so is a `§` at the very end. Codes are case insensitive.

#### Colors

| Code | Color | Code | Color |
| --- | --- | --- | --- |
| `§0` | `#000000` | `§g` | `#DDD605` |
| `§1` | `#0000AA` | `§h` | `#E3D4D1` |
| `§2` | `#00AA00` | `§i` | `#CECACA` |
| `§3` | `#00AAAA` | `§j` | `#443A3B` |
| `§4` | `#AA0000` | `§m` | `#971607` |
| `§5` | `#AA00AA` | `§n` | `#B4684D` |
| `§6` | `#FFAA00` | `§p` | `#DEB12D` |
| `§7` | `#AAAAAA` | `§q` | `#11A036` |
| `§8` | `#555555` | `§s` | `#2CBAA8` |
| `§9` | `#5555FF` | `§t` | `#21497B` |
| `§a` | `#55FF55` | `§u` | `#9A5CC6` |
| `§b` | `#55FFFF` | `§v` | `#EB7214` |
| `§c` | `#FF5555` | `§w` | `#8BB3FF` |
| `§d` | `#FF55FF` | | |
| `§e` | `#FFFF55` | | |
| `§f` | `#FFFFFF` | | |

`§m` and `§n` are colors in Bedrock, not strikethrough and underline. Use
`text-decoration` on the element for those.

### Styling

`mc-text` is inline text, like a `span`. It flows in the paragraph around it,
and takes the text properties it inherits or is given: font size, weight and
family, line height, alignment, and the color that uncolored text (and text
after `§r`) is drawn in.

```ts
html`
  <div style=${{ fontSize: "calc(14px * var(--hud-scale))", color: "var(--on-surface)" }}>
    Target: <mc-text text=${target.name} />
  </div>
`;
```

- **White space** follows `white-space`, as for any text. Line breaks in the
  string collapse to spaces by default. Use `white-space: pre-line` to keep
  them.
- **Children aren't drawn.** Only the `text` attribute is. Put other content
  next to the element, not inside it.
- **Box styles work.** In lite, padding, a background, a border or a `click`
  listener make it an [inline block](/ui/lite#inline-elements), as they do a
  `span`.
- **In the web flavor**, the colored runs are drawn inside the element's
  shadow root, so your stylesheets can't select them. Style the `mc-text`
  itself, and the runs inherit from it.

## In JSX

htm needs nothing. With [JSX](/ui/setup#htm-or-jsx) in TypeScript, declare
the elements you use once so they type check:

```tsx
import { h, type HTMLAttributes } from "preact";

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "mc-text": HTMLAttributes<HTMLElement> & { text?: string };
    }
  }
}

const label = <mc-text text="§6Gold" />;
```
