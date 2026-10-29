---
id: lite
title: Lite Flavor
---

# Lite Flavor

The default flavor. The client draws the widget with its own renderer, which
understands a subset of HTML and CSS: block and flex layout, boxes, text, and a
set of native controls. It's cheap, so it suits HUD widgets that update every
tick, and it works on every platform.

Anything lite doesn't understand is ignored. An unsupported property or value
does nothing, and an unsupported element is drawn as a plain container.

:::note[Inline styles only]

Lite has no stylesheets. `class` attributes and `<style>` elements are ignored.
Style elements with the `style` prop, and share styles with plain objects or
components:

```ts
const card = { padding: "8px", borderRadius: "12px", background: "var(--surface-container)" };

html`<div style=${{ ...card, gap: "4px" }}>...</div>`;
```

:::

## Elements

| Elements | How they're drawn |
| --- | --- |
| `div`, `p`, `section`, `header`, `footer`, `nav`, `main`, `article`, `aside`, `ul`, `ol`, `li`, `h1`–`h6`, `pre`, `blockquote`, `form`, `fieldset`, `table`, `tr`, `td`, ... | Block: stacked in a column. Table elements are plain blocks too, there's no table layout. |
| `span`, `b`, `strong`, `i`, `em`, `u`, `s`, `del`, `ins`, `small`, `code`, `kbd`, `mark`, `a`, `label`, `sub`, `sup`, ... | Inline text, flowing in the paragraph around it. |
| `button` | A Material button. See [Controls](#controls). |
| `input`, `textarea`, `select`/`option`, `progress` | Native controls. See [Controls](#controls). |
| `img` | An image. See [Images](#images). |
| `mc-text` | Inline text with Minecraft `§` codes, from its `text` attribute. See [Custom Widgets](/ui/custom-widgets#minecraft-text). |
| `hr`, `br` | A divider line, and a line break. |
| `svg`, `canvas`, `video`, `iframe`, `math`, `script`, `style`, `template` | Not drawn. |

Every other tag is inline unless you give it a `display`.

The usual browser defaults apply: headings are bold and larger, `b` and
`strong` are bold, `i` and `em` italic, `u` underlined, `s` and `del` struck
through, `code`, `kbd` and `pre` monospace, `mark` highlighted, `a` colored
`--primary` and underlined. Lists have no bullets or numbers.

The `hidden` attribute and `display: none` hide an element.

### Inline elements

An inline element that's only styled text (color, font, decoration) flows as
part of the paragraph. Give it a box property (padding, margin, border,
background, a size, opacity, overflow, position) or a `click` listener, and
it becomes an inline block instead: a box placed in the line, like
`display: inline-block`.

`display: inline-block` and `inline-flex` work as in CSS.

## Controls

| Element | Drawn as | Attributes |
| --- | --- | --- |
| `button` | A filled tonal button with a ripple. | `disabled` |
| `input` (`text`, `password`, `number`, `email`, `url`, `tel`) | A text field. `type` picks the on-screen keyboard and hides a password. | `value`, `placeholder`, `maxlength`, `readonly`, `disabled` |
| `textarea` | A multi-line text field. | `value` (or its text), `rows` (default 3), `placeholder`, `maxlength`, `readonly`, `disabled` |
| `input type="checkbox"` | A checkbox, or a **switch** with `role="switch"`. | `checked`, `disabled` |
| `input type="radio"` | A radio button. Radios sharing a `name` are one group. | `name`, `checked`, `disabled` |
| `input type="range"` | A slider. | `min` (0), `max` (100), `step` (1), `value`, `disabled` |
| `input type="hidden"` | Nothing. | |
| `select` with `option`s | A dropdown that opens a picker dialog. | `value` on the `select`; `value` and `disabled` on each `option` |
| `progress` | A linear progress bar. Without `value`, it's indeterminate. | `value`, `max` (1) |

**Accent color.** `accent-color` colors checkboxes, switches, radios, sliders
and progress bars.

**Size.** Controls scale with their font size, relative to the base 14px.
Inside text sized by `--hud-scale`, they grow and shrink with the widget. A
text field, slider or progress bar has a fixed width (180, 200 and 160 pixels
at the base size), unless its container has a known width, in which case it
fills it.

**Outlines.** A text field or select without a `border` or `background` of its
own gets an outlined look. Style either one to draw it yourself.

**Buttons.** The default button style is ordinary CSS under your inline style:
padding `0.57em 1.14em`, a fully rounded radius, `--secondary-container`
background, `--on-secondary-container` text. Override any of it. A disabled
button is dimmed and takes no input.

## Input

Lite sends four event types:

| Event | When |
| --- | --- |
| `click` | A tap on an element that listens for `click`. |
| `contextmenu` | A long press on an element that listens for `contextmenu`. |
| `input` | A text field changed (every keystroke), a slider moved, a checkbox or radio was toggled, a select option was picked. |
| `change` | A text field lost focus or was submitted with a changed value, a slider was let go, a checkbox or radio was toggled, a select option was picked. |

Both bubble through your tree, so a listener on a parent sees its children's
events. But only an element that **itself** listens for `click` or
`contextmenu` is tappable. A tap on a child that doesn't listen goes to the
nearest ancestor that does, and `event.target` is that ancestor.

So `event.target === event.currentTarget` can't tell a tap on a backdrop from
a tap on a child of it that doesn't listen. To close a screen when its
backdrop is tapped, give the panel inside its own `onClick` that calls
`event.stopPropagation()`.

Elements with a `disabled` attribute don't send `click` or `contextmenu`.

The client updates a control as soon as the player uses it, then tells your
script. When the event arrives, the element's `value` or `checked` already
holds the new state, so read it from `event.currentTarget`. Ticking a radio
unticks the others in its group in your tree too.

A controlled input works as in a browser. Render the value you hold, and
update it in `onInput`:

```ts
function NameField() {
  const [name, setName] = useState("");
  return html`<input value=${name} onInput=${(e) => setName(e.currentTarget.value)} />`;
}
```

What the player is typing is only replaced when the value you render differs
from it.

## CSS

### Supported properties

| Area | Properties |
| --- | --- |
| Layout | `display` (`block`, `inline`, `inline-block`, `flex`, `inline-flex`, `none`), `position` (`absolute`, `fixed`), `top`, `right`, `bottom`, `left`, `inset` |
| Flex | `flex-direction` (with `-reverse`), `flex-wrap`, `justify-content`, `align-items`, `align-self`, `gap`, `row-gap`, `column-gap`, `flex`, `flex-grow` |
| Size | `width`, `height`, `min-width`, `max-width`, `min-height`, `max-height` |
| Box | `padding`, `margin` (and their sides), `border` (shorthands, sides and longhands), `border-radius` (and its corners), `background`, `background-color`, `box-shadow`, `opacity`, `overflow`, `overflow-x`, `overflow-y` |
| Visibility | `visibility` (`hidden` keeps the space), `pointer-events: none` |
| Text | `color`, `font-size`, `font-weight`, `font-style`, `font-family`, `line-height`, `letter-spacing`, `text-align`, `text-decoration`, `text-decoration-line`, `text-shadow`, `white-space`, `text-overflow: ellipsis`, `-webkit-line-clamp`, `line-clamp` |
| Controls | `accent-color`, `object-fit` (on `img`) |

Text properties are inherited, as in CSS. So are custom properties.

### Values

| Kind | Supported |
| --- | --- |
| Lengths | `px` (or a bare number), `%`, `em`, `rem`, `vw`, `vh`, `vmin`, `vmax`, `pt` |
| Math | `calc()` with `+`, `-`, `*`, `/`; `min()`, `max()`, `clamp()` of lengths without percentages |
| Colors | `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()`, `hsl()`/`hsla()` (comma or space syntax, with `/ alpha`), `currentColor`, `transparent`, and the common named colors |
| Variables | `var(--name)` and `var(--name, fallback)`, anywhere in a value |
| Font size keywords | `xx-small` to `xx-large`, `smaller`, `larger` |

`rem` is the base 14px. `vw` and `vh` are of the screen.

Only the common named colors are known (`red`, `orange`, `gold`, `gray`,
`skyblue`, `crimson` and the like). For anything else, use hex.

### How the layout differs from a browser

Lite builds the layout out of native layout widgets, so a few things work
differently:

- **Stretching needs a known size.** A block's children fill its width, and
  flex items stretch across, **only when the container's own width (or height,
  across a row) is known**: set on it, inherited from a parent that has one,
  or from a screen's root. Otherwise they shrink to fit. On a HUD widget,
  whose root fits its content, give the outer element a `width` if you want
  rows to line up.
- **`flex-grow` needs room to grow into.** It only works without `flex-wrap`,
  and when the container's main size is known. The grow factor is rounded to
  a whole number. `flex-shrink`, `flex-basis` and `order` are ignored, and so
  is the basis part of the `flex` shorthand.
- **`align-self` only switches stretching** on or off for that item. Other
  values follow the container's `align-items`.
- **`align-items: stretch` doesn't apply when wrapping.** Wrapped items are
  aligned to the start, center or end.
- **`position: absolute` is against the parent**, not the nearest positioned
  ancestor. `fixed` is the same as `absolute`. `relative` and `z-index` do
  nothing: absolute children are drawn over the rest, in order.
- **Percentages in `padding`, `margin` and the `top`/`right`/`bottom`/`left`
  offsets aren't supported.** Percentages in sizes are of what the parent
  allows, or of the flex container for flex items.
- **`margin: auto`** only centers (or pushes right) horizontally, inside a
  container with a known width.
- **`overflow: auto` and `scroll`** make the content scrollable, along one
  axis: horizontally for a row (or with only `overflow-x`), vertically
  otherwise. `hidden` and `clip` clip it.
- **Borders.** Every style except `none` and `hidden` draws solid. Corners are
  only rounded when all four sides are the same. A percentage radius of 50% or
  more makes a pill or a circle, anything less is square. Elliptical radii
  (`/`) are ignored.
- **Backgrounds** are a color only. Gradients and images aren't drawn.
- **`box-shadow`** takes several shadows, but not `inset` ones.
- **`font-family`.** Any family containing "mono" or "courier" is monospace.
  Otherwise the first family is used if the client has it, and `sans-serif`
  and `system-ui` are the client's default font.
- **Ellipsis.** `text-overflow: ellipsis` works with `white-space: nowrap`
  (one line) or a `-webkit-line-clamp`.

Not supported at all: `display: grid` (drawn as a block), `transform`,
`transition`, `animation`, `filter`, `cursor`, pseudo-classes and pseudo-elements.
Use the [web flavor](/ui/web) if you need these.

## Images

`img` draws a `src` that's a **data URI** or an `http(s)` URL:

```ts
html`<img src=${"data:image/png;base64," + ICON_BASE64} width="16" height="16" />`;
```

- Size it with the `width` and `height` attributes, in pixels.
- `object-fit` picks how it fills that box: `fill` (the default), `contain`,
  `cover`, `none` or `scale-down`.
- A source that fails to load shows a broken image icon.

Decoded data URIs are cached, so re-rendering the same `src` doesn't decode it
again. Ship small icons as data URIs, the same way as
[embedded sounds](/api/audio#embedding-a-sound-as-base64).
