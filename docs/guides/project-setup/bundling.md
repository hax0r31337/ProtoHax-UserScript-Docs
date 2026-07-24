---
id: bundling
title: Bundling
---

# Bundling

> Using the [template](/guides/project-setup)? All of this is already
> configured — read on only if you want to know *why*, or to set a project up
> by hand.

## What the output must look like

Whatever tooling you use, the built file has to satisfy two rules.

**1. It is an ES module.** The client loads it as ESM.

**2. `@protohax/userscript` stays external.** The import must survive into the
output *unbundled*:

```js
// dist/my-script.js
import { defineModule, ModuleCategory } from "@protohax/userscript";

defineModule({ name: "AutoSprint", category: ModuleCategory.Movement }, /* ... */);
```

The client resolves that bare specifier at load time to its own **live
singletons** — the same module manager, game state, and patched
`prismarine-nbt` the built-in modules use. This is why the package is
types-only: there is no runtime code to bundle, and inlining a stub would hand
your script a second, disconnected copy of the world.

Everything *else* — your own files, any pure-JavaScript npm package you depend
on — is inlined, so the result is self-contained apart from that one import.

## Setting it up by hand

If you would rather build the project yourself:

```bash
npm init -y
npm install --save-dev @protohax/userscript typescript \
  rollup @rollup/plugin-swc @swc/core \
  @rollup/plugin-node-resolve @rollup/plugin-commonjs
```

`package.json` — note `"type": "module"`:

```json
{
  "type": "module",
  "scripts": {
    "build": "rollup -c",
    "check": "tsc --noEmit"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext", "DOM"],
    "strict": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

> **`skipLibCheck` is required.** The published declarations vendor the host's
> packet definitions verbatim, which contain a harmless duplicate declaration.
> Your own code is still fully type-checked.
>
> `isolatedModules` / `verbatimModuleSyntax` match how swc transpiles —
> file-by-file, with type-only imports written as `import type`.

`rollup.config.mjs` — the bundle itself:

```js
import swc from "@rollup/plugin-swc";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

export default {
  input: "src/index.ts",
  output: {
    file: "dist/my-script.js",
    format: "es",
    sourcemap: "inline",
    // A userscript is one file by definition.
    inlineDynamicImports: true,
  },
  // The one rule that matters — see above.
  external: ["@protohax/userscript"],
  plugins: [
    resolve({
      // Extensionless imports (`./modules/auto-sprint`) have to be told to
      // resolve to .ts.
      extensions: [".ts", ".mjs", ".js", ".json"],
      // The host is neither Node nor a browser: no builtins, no shims.
      browser: false,
      preferBuiltins: false,
    }),
    commonjs(),
    swc({ swc: { jsc: { target: "esnext", parser: { syntax: "typescript" } } } }),
  ],
};
```

```bash
npx rollup -c
```

Any other bundler works too, as long as the facade is marked external and the
output is a single ES module.

## Types are not checked by the bundler

swc strips types without checking them: a build that succeeds says nothing
about whether your code type-checks. Run `npm run check` (`tsc --noEmit`), or
keep an editor with a TypeScript server open, and treat the bundle as the last
step rather than the safety net.

## Optional: a UserScript banner

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

import { defineModule, ModuleCategory } from "@protohax/userscript";
```

It is **entirely optional** — the client neither requires nor interprets the
block, it is just a comment — but it tells whoever ends up with the file what it
is and which version they have.

In rollup, emit it with `output.banner`:

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

The template generates it from `package.json` (with extra fields configurable in
`script.config.mjs`) and configures terser to keep all comments, so the block
survives minification.
