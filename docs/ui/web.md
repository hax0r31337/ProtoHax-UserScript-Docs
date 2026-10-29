---
id: web
title: Web Flavor
---

# Web Flavor

A `web` widget is drawn by a webview, a small browser page of its own. Your
script still renders into the same [DOM shim](/ui/dom), but the client replays
every change onto a real DOM, so all of HTML and CSS works:

- stylesheets in `<style>` elements, and `class`;
- grid, transforms, transitions and animations, filters, gradients;
- SVG (Preact creates `<svg>` and its children in the right namespace);
- any event type, with pointer, key and wheel details.

The page also defines [custom widgets](/ui/custom-widgets), drawn the same as in
lite.

```ts
const widget = createWidget({ style: "screen", flavor: "web" });

render(html`
  <style>
    .card { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .card button { transition: transform 0.1s; }
    .card button:active { transform: scale(0.95); }
  </style>
  <div class="card">...</div>
`, widget.root);
```

## When to use it

The web flavor costs more:

- **One webview per widget.** Each is slower to create and uses more memory
  than a lite widget. It keeps running, and keeps its content, while the widget
  is hidden.
- **Every change and every event crosses into the page** as JSON.

So prefer [lite](/ui/lite), and use `web` for the one rich screen that needs
it, not for a dozen small HUD readouts.

## The page

Your content sits in a page with these defaults:

- The background is **transparent**, so on a HUD only your content shows.
- The body font is `14px/1.43 Roboto, sans-serif`, colored `--on-surface`.
- `box-sizing: border-box` on everything.
- Text can't be selected, except in inputs, textareas and `contenteditable`
  elements.
- Buttons get the client's default button style, and links the `--primary`
  color. Your styles override both.

The [theme variables](/ui/theming) are set on the page's root, so stylesheets
can use them too.

### Sizing

- On a **screen**, the root fills the screen and clips what overflows it.
- On a **HUD**, the webview is resized to fit the root, which is as wide as
  its content (`max-content`), wrapping at the screen's width. Anything drawn
  outside the root's box, like a shadow or an absolutely positioned badge, is
  cut off. Leave padding for it.

On a HUD, `vw` and `vh` are of the webview, which is the size of your content,
so avoid them there.

## What's blocked

The page is only a renderer. To keep it that way, it drops:

- **Scripts and embeds.** `script`, `iframe`, `frame`, `frameset`, `object`,
  `embed`, `base`, `meta`, `link` and `portal` elements are created as inert
  placeholders. There are no external stylesheets: put your CSS in a
  `<style>` element.
- **Inline handlers.** Attributes starting with `on`, and `srcdoc`.
- **`javascript:` URLs** in `href`, `src` and the like.
- **Navigation.** Links don't open, and forms don't submit.

Your logic runs in your script, through the events below.

## Events

The page reports any event type a node in your tree listens for. Listen in
your script as usual (`onPointerDown`, `onKeyDown`, `onWheel`, ...) and the
page starts forwarding that type.

Each event is reported **once, from its target**: the element it happened on,
or its nearest ancestor that your script created. Your script then dispatches
it through your tree, with the capture and bubble phases, and with the
browser event's `bubbles` and `cancelable`.

Along with the [`UiEvent`](/ui/dom#uievent) basics, these fields are copied
over when the browser event has them:

| Field | Events |
| --- | --- |
| `clientX`, `clientY` | Mouse and pointer events. The position in the webview. |
| `button`, `buttons` | Mouse and pointer events. |
| `pointerId`, `pointerType`, `isPrimary` | Pointer events. `pointerId` tells fingers apart, as a pinch needs. |
| `key`, `code` | Keyboard events. |
| `deltaX`, `deltaY` | Wheel events. |
| `altKey`, `ctrlKey`, `shiftKey`, `metaKey` | Mouse, pointer, keyboard and wheel events. |

Two things differ from a browser:

- **`preventDefault()` comes too late.** The page has already done its
  default action by the time your script hears about the event. It only sets
  `defaultPrevented` for the listeners after yours.
- **Events are asynchronous.** Every one makes a round trip from the page to
  your script. `pointermove` and `wheel` arrive at the rate the page fires
  them, so keep their handlers light.

`input` and `change` from form controls are always reported, listened for or
not, so the control's `value` or `checked` in your tree stays in sync with the
page.

## Style values

The page applies your inline styles with the browser's own parser, which
ignores a length without a unit. Preact 11 doesn't add `px` to numbers, so
write units: `{ width: "120px" }`, not `{ width: 120 }`. Unitless properties
like `opacity`, `flex-grow`, `z-index` and `line-height` are fine as numbers.

`!important` at the end of an inline value works.
