---
id: banner
title: Metadata Banner
---

# Metadata Banner

Built scripts get copied, renamed, and shared. A Tampermonkey-style metadata
block at the top of the file is an easy way to keep its name and version
attached:

```js
// ==UserScript==
// @name         my-script
// @version      1.2.0
// @description  Does something useful
// @author       you
// ==/UserScript==

import { defineModule } from "@protohax/userscript";
```

The banner is **entirely optional**. It's just a comment; the client doesn't
require or read it. It simply tells whoever ends up with the file what it is
and which version they have.

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

:::warning

If you minify, make sure the minifier keeps comments. terser drops them by
default, which strips the banner back out:

```js
terser({ format: { comments: "all" } })
```

:::

## In the template

The template builds the banner for you:

- It fills in `name`, `version`, `description`, and `author` from
  `package.json`.
- You can add extra fields in `script.config.mjs`.
- terser is set to keep all comments, so the banner survives minification.

To bump the version in the built file, just bump it in `package.json`.
