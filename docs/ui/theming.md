---
id: theming
title: Theming
---

# Theming

Every widget's content can read the client's theme and a few facts about the
screen as CSS custom properties. Use them with `var()`, in both flavors, so
your widget matches the rest of the client UI and follows its light and dark
themes:

```ts
html`
  <div style=${{
    background: "var(--surface-container)",
    color: "var(--on-surface)",
    border: "1px solid var(--outline-variant)",
  }}>
    ...
  </div>
`;
```

The variables are inherited as in CSS, and you can declare your own on any
element (`"--accent": "var(--tertiary)"`) for its subtree to use.

## Colors

The [Material 3 color roles](https://m3.material.io/styles/color/roles) of the
client's current scheme:

| Group | Variables |
| --- | --- |
| Primary | `--primary`, `--on-primary`, `--primary-container`, `--on-primary-container` |
| Secondary | `--secondary`, `--on-secondary`, `--secondary-container`, `--on-secondary-container` |
| Tertiary | `--tertiary`, `--on-tertiary`, `--tertiary-container`, `--on-tertiary-container` |
| Error | `--error`, `--on-error`, `--error-container`, `--on-error-container` |
| Surface | `--surface`, `--on-surface`, `--on-surface-variant` |
| Surface containers | `--surface-container-lowest`, `--surface-container-low`, `--surface-container`, `--surface-container-high`, `--surface-container-highest` |
| Outline | `--outline`, `--outline-variant` |
| Inverse | `--inverse-surface`, `--on-inverse-surface`, `--inverse-primary` |
| Other | `--shadow`, `--scrim` |

Each one is a color in `#RRGGBBAA` form. Pair a background role with its
`--on-` role for text on it: `--primary` with `--on-primary`, `--surface-container`
with `--on-surface`, and so on.

The default text color is `--on-surface`. Buttons default to
`--secondary-container` with `--on-secondary-container` text, and links to
`--primary`.

## Theme and screen

| Variable | Value |
| --- | --- |
| `--dark` | `1` in a dark theme, `0` in a light one. |
| `--hud-scale` | The scale the player gave a HUD widget. `1` on screens. See [Scaling](/ui/hud-placement#scaling). |
| `--safe-top`, `--safe-right`, `--safe-bottom`, `--safe-left` | The screen's insets for cutouts and system bars, in pixels (`24px`). |

On a screen, pad your content by the safe insets so nothing ends up under a
camera cutout:

```ts
html`
  <div style=${{
    width: "100%",
    height: "100%",
    paddingTop: "var(--safe-top)",
    paddingLeft: "var(--safe-left)",
    paddingRight: "var(--safe-right)",
    paddingBottom: "var(--safe-bottom)",
  }}>
    ...
  </div>
`;
```

## Text

The base font is the client's body text, 14px. In lite, `1rem` is that size,
and the [controls](/ui/lite#controls) are sized relative to it. In the web
flavor the page's body is `14px/1.43 Roboto, sans-serif`.

## Translucent colors

The color variables are opaque. For a see-through background, write the color
yourself, such as `rgb(0 0 0 / 40%)`. Lite has no `color-mix()`, so you can't
derive a translucent color from a variable there. In the web flavor,
`color-mix(in srgb, var(--surface) 80%, transparent)` works.
