---
id: banner
title: Metadata Banner
---

# Metadata Banner

A built script gets copied around, renamed, and shared. A Tampermonkey-style
metadata block at the top of the file is a cheap way to keep its identity
attached to it:

```js
// ==UserScript==
// @name         my-script
// @version      1.2.0
// @description  Does something useful
// @author       you
// ==/UserScript==

import { defineModule } from "@protohax/userscript";
```

It is **entirely optional** — the client neither requires nor interprets the
block, it is just a comment — but it tells whoever ends up with the file what it
is and which version they have.

## Emitting it from rollup

Use `output.banner`:

```js
output: {
  file: "dist/my-script.js",
  format: "es",
  banner: [
    "// ==UserScript==",
    "// @name         my-script",
    "// @version      1.2.0",
    "// ==/UserScript==",
  ].join("\n"),
},
```

If you minify, make sure the minifier keeps comments — terser drops them by
default, which would strip the block back out:

```js
terser({ format: { comments: "all" } })
```

## In the template

The template generates the banner from `package.json` — `name`, `version`,
`description`, `author` — with extra fields configurable in
`script.config.mjs`, and configures terser to keep all comments so the block
survives minification. Bumping the version in `package.json` is enough to bump
it in the built file.
