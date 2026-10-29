---
id: dom
title: The DOM Shim
---

# The DOM Shim

Each widget has its own small DOM: a subset of the browser's `Node`, `Element`
and `Event` API, enough for Preact to render into. You'll mostly meet it
through refs and event handlers, but you can also build a widget with it
directly, no Preact needed:

```ts
const widget = createWidget({ style: "hud", interactive: true });
const doc = widget.document;

const button = doc.createElement("button");
button.textContent = "Ping";
button.style.padding = "4px 8px";
button.addEventListener("click", () => console.log("pong"));

widget.root.appendChild(button);
```

## How changes reach the client

- **Only what's under the root is on the client.** Creating a node, or
  building a whole subtree away from the root, sends nothing. Inserting it
  under the root sends the subtree in one go. Removing it drops it from the
  client.
- **Changes are batched.** Everything you change during one task goes to the
  client in one message, once your code yields.
- **Unchanged values aren't sent.** Setting an attribute, a style property or
  a text node's data to the value it already has does nothing.
- **Nodes belong to their widget.** A node can only be inserted into the
  widget whose document created it. Inserting it into another widget throws.

Nothing comes back from the client except input. There's no layout, so no
sizes, positions or computed styles.

## `UiDocument`

`widget.document`, and every node's `ownerDocument`.

| Member | Description |
| --- | --- |
| `documentElement` | The widget's root, a `div`. The same as `widget.root`. |
| `body` | The same as `documentElement`. |
| `createElement(tag)` | A new HTML element. |
| `createElementNS(namespace, tag)` | A new element in a namespace. SVG and MathML only draw in the [web flavor](/ui/web). |
| `createTextNode(data)` | A new text node. |
| `createComment(data)` | A new comment. Comments are never sent to the client. |

There's no global `document`. Reach the document through `widget.document` or
a node's `ownerDocument`.

## `UiNode`

The base of elements, text nodes and comments.

### Tree

| Member | Description |
| --- | --- |
| `nodeType` | `1` for elements, `3` for text, `8` for comments. |
| `nodeName` | The upper case tag for HTML elements, `#text`, or `#comment`. |
| `ownerDocument` | The document that created it. |
| `parentNode`, `parentElement` | Its parent, or `null`. |
| `childNodes` | Its children. Live, so don't change the array. |
| `firstChild`, `lastChild` | |
| `nextSibling`, `previousSibling` | |
| `isConnected` | Whether it's under the widget's root, so on the client. |
| `textContent` | The text of it and its subtree. Setting it on an element replaces every child with one text node. |
| `hasChildNodes()` | |
| `contains(other)` | Whether `other` is this node or under it. |

### Changing the tree

| Method | Description |
| --- | --- |
| `appendChild(node)` | Insert `node` last. A node that's already somewhere is moved. |
| `insertBefore(node, ref)` | Insert `node` before `ref`, or last if `ref` is `null`. |
| `append(...nodes)` | Insert nodes, and strings as text nodes, last. |
| `removeChild(node)` | |
| `replaceChild(node, old)` | Put `node` where `old` is. |
| `remove()` | Take it out of its parent. |

Text nodes and comments can't have children.

### Events

| Method | Description |
| --- | --- |
| `addEventListener(type, listener, options?)` | `options` is `{ capture?, once? }`, or a boolean for `capture`. `listener` is a function or an object with `handleEvent`. |
| `removeEventListener(type, listener, options?)` | |
| `dispatchEvent(event)` | Run the listeners through the capture and bubble phases, as in a browser. Returns `false` if one called `preventDefault()`. |

The first listener for a type on an element tells the client to start sending
that type for it, and removing the last one tells it to stop. A listener that
throws is logged, and the rest still run.

## `UiElement`

| Member | Description |
| --- | --- |
| `localName` | The tag, lower case for HTML elements. SVG ones keep their case (`linearGradient`). |
| `tagName` | Upper case for HTML elements. |
| `namespaceURI` | |
| `children` | Child elements only. |
| `id`, `className` | The `id` and `class` attributes. |
| `style` | The inline style, see [`UiStyle`](#uistyle). |
| `getAttribute(name)`, `hasAttribute(name)`, `getAttributeNames()` | |
| `setAttribute(name, value)` | `style` goes through `style.cssText`. |
| `removeAttribute(name)` | |
| `toggleAttribute(name, force?)` | Returns whether the attribute is there afterwards. |
| `value` | A control's value. See below. |
| `checked` | Whether a checkbox or radio is ticked. The same as the `checked` attribute. |

HTML attribute names are case insensitive, as in a browser.

**`value`** is the `value` attribute. Unlike a browser, the attribute and the
current value are one and the same, and the client keeps both in sync as the
player types or picks. Without the attribute, a `select`'s value is its first
`option`'s, and an `option`'s or `textarea`'s is its text.

**Not supported:** `innerHTML` (there's no HTML parser, it throws),
`querySelector` and friends, `classList`, `dataset`, `focus()`, `click()`,
`getBoundingClientRect()` and anything else that reads the layout.

## `UiStyle`

An element's inline style, a subset of `CSSStyleDeclaration`.

| Member | Description |
| --- | --- |
| `setProperty(name, value)` | `name` is kebab case, or a custom property (`--name`). An empty or `null` value removes it. |
| `removeProperty(name)` | Returns the old value. |
| `getPropertyValue(name)` | `""` when not set. |
| `cssText` | Every property as text. Setting it replaces them all. |
| `length` | How many properties are set. |

Properties can also be read and set camel cased, the way Preact does:

```ts
el.style.backgroundColor = "var(--surface)";
el.style.setProperty("--accent", "var(--primary)");
```

Which properties the client draws depends on the flavor. See
[Lite CSS](/ui/lite#css), or anything in the [web flavor](/ui/web).

## `UiText` and `UiComment`

A `UiText` has `data` (and `nodeValue`, the same thing). Setting it updates
the text on the client.

A `UiComment` has `data` too, but is never sent to the client. Comments are
kept in the tree so libraries that use them as markers still work.

## `UiEvent`

What event listeners, and Preact's `on...` handlers, receive. You can create
your own with `new UiEvent(type, { bubbles?, cancelable? })` and dispatch it.

| Member | Description |
| --- | --- |
| `type` | |
| `bubbles`, `cancelable` | |
| `target` | The node it was dispatched on. |
| `currentTarget` | The node whose listener is running. |
| `eventPhase` | `UiEvent.CAPTURING_PHASE`, `AT_TARGET`, `BUBBLING_PHASE`, or `NONE` outside a dispatch. |
| `timeStamp` | When it was created, in milliseconds since the epoch. |
| `defaultPrevented` | |
| `preventDefault()` | Sets `defaultPrevented` if it's `cancelable`. Nothing on the client acts on it. |
| `stopPropagation()` | Stop it reaching other nodes. The current node's other listeners still run. |
| `stopImmediatePropagation()` | Stop it reaching any other listener. |
| `composedPath()` | The target and its ancestors, target first. |

Events from the [web flavor](/ui/web#events) also carry pointer, key, wheel
and modifier fields when the browser event had them.
