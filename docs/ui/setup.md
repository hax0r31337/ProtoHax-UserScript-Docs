---
id: setup
title: Preact & htm
---

# Preact & htm

The client ships its own copies of [Preact](https://preactjs.com/) and
[htm](https://github.com/developit/htm). Import them by their usual names and
the client hands your script its copies, the same way it resolves
`@protohax/userscript`.

| Import | What you get |
| --- | --- |
| `preact` | Preact 11: `h`, `render`, `Fragment`, `Component`, `createContext`, ... |
| `preact/compat` | The React compatibility layer, **hooks included**: `useState`, `useEffect`, `useRef`, `memo`, `forwardRef`, ... |
| `@preact/compat` | The same module as `preact/compat`. |
| `htm` | htm 3, for JSX-like templates without a build step. |

Nothing else is shipped. In particular there's **no `preact/hooks`** module:
import hooks from `preact/compat`.

```ts
import { h, render } from "preact";
import { useState, useEffect } from "preact/compat";
import htm from "htm";

const html = htm.bind(h);
```

You don't have to use Preact at all. The shim takes plain DOM calls too, see
[The DOM Shim](/ui/dom).

## Installing the types

Install the packages as dev dependencies, for the types only:

```bash
npm install --save-dev preact@^11 htm@^3
```

Pick the same major versions the client ships (Preact 11, htm 3), so the types
match what runs.

## Keeping them external

Like `@protohax/userscript`, these imports have to **stay in the built file**,
so the client can resolve them. Add them to your bundler's externals. With the
template's rollup config:

```js
export default {
  // ...
  external: [
    "@protohax/userscript",
    "preact",
    "preact/compat",
    "@preact/compat",
    "htm",
  ],
};
```

:::warning[Keep every Preact import external]

If your bundle inlines its own copy of Preact while something else uses the
client's, there are two Preacts. Hooks then fail in confusing ways, because a
component rendered by one copy calls hooks registered with the other. Keep all
of `preact`, `preact/compat` and `@preact/compat` external, and don't import
from `preact/hooks`.

:::

## htm or JSX

**htm** needs no build setup. It parses tagged templates at runtime, once per
template:

```ts
const html = htm.bind(h);

function Counter() {
  const [count, setCount] = useState(0);
  return html`<button onClick=${() => setCount(count + 1)}>Clicked ${count}</button>`;
}

render(html`<${Counter} />`, widget.root);
```

**JSX** works too, with the classic runtime, so every element compiles to an
`h(...)` call from the `preact` you already import. In `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "h",
    "jsxFragmentFactory": "Fragment"
  }
}
```

And in the swc plugin options of `rollup.config.mjs`:

```js
swc({
  swc: {
    jsc: {
      target: "esnext",
      parser: { syntax: "typescript", tsx: true },
      transform: {
        react: { runtime: "classic", pragma: "h", pragmaFrag: "Fragment" },
      },
    },
  },
}),
```

Add `".tsx"` to the node-resolve `extensions`, and import `h` (and `Fragment`
if you use `<>...</>`) in every `.tsx` file:

```tsx
import { h, Fragment } from "preact";

const Hello = () => <div>Hello</div>;
```

:::note[The automatic JSX runtime]

`"jsx": "react-jsx"` with `jsxImportSource: "preact"` imports
`preact/jsx-runtime`, which the client doesn't ship. It still works as long as
your bundler **inlines** `preact/jsx-runtime` (leave it out of `external`) and
keeps `preact` itself external, so the inlined runtime uses the client's
Preact.

:::

## Types vs. runtime

Preact's types describe a browser. A few things differ at runtime:

- **Event handlers get a [`UiEvent`](/ui/dom#uievent)**, not a DOM
  `MouseEvent` or `InputEvent`. `type`, `target`, `currentTarget`,
  `preventDefault()` and `stopPropagation()` are there. Most mouse, key and
  pointer fields are only set in the [web flavor](/ui/web#events).
- **Refs point to a [`UiElement`](/ui/dom#uielement)**, which has no
  `getBoundingClientRect`, `focus` or `querySelector`.
- **There's no global `document` or `window`.** Preact doesn't need them, it
  creates nodes through `widget.root.ownerDocument`. Libraries that reach for
  `document` won't work.
- **Write units in style values.** Preact 11 passes numbers through as they
  are, so `style={{ width: 120 }}` sends `120`. Lite reads a bare number as
  pixels, but a webview drops it. Write `"120px"` so both flavors agree.

Reading a control's value from its event works as you'd expect, since
`UiElement` has `value` and `checked`:

```ts
html`<input onInput=${(e) => setName(e.currentTarget.value)} />`;
```

## Libraries

Libraries written for Preact generally work if they stick to rendering
components. Ones built on React need `react` and `react-dom` aliased to
`preact/compat` in your bundler, with the result still external. Libraries that measure the layout, use
portals into `document.body`, or touch `window` won't work.
