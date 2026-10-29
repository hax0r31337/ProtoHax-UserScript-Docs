---
id: bundling
title: Bundling
---

# Bundling

:::tip

Using the [template](/guides/project-setup)? This is all set up already. Read on
if you want to know *why*, or want to set up a project by hand.

:::

## What the output must look like

Whatever tooling you use, the built file has to follow two rules:

1. **It's an ES module.** The client loads it as ESM.
2. **`@protohax/userscript` stays external.** The import must survive into the
   output unbundled:

```js
// dist/my-script.js
import { defineModule } from "@protohax/userscript";

defineModule({ name: "AutoSprint" }, /* ... */);
```

At load time, the client resolves that bare import to its own **live
singletons**: the same module manager, game state, and patched `prismarine-nbt`
the built-in modules use. That's why the package is types-only. There's no
runtime code to bundle, and inlining a stub would give your script a second,
disconnected copy of the world.

Everything else (your own files, and any pure-JavaScript npm packages you use)
gets inlined. The result is self-contained apart from that one import.

### Libraries the client ships

The client also ships its own copies of Preact and htm, for
[UI widgets](/ui). If you use them, keep these imports external too:

| Import | Client's copy |
| --- | --- |
| `preact` | Preact 11 |
| `preact/compat`, `@preact/compat` | Preact's React compatibility layer, hooks included |
| `htm` | htm 3 |

```js
external: ["@protohax/userscript", "preact", "preact/compat", "@preact/compat", "htm"],
```

These are the only bare imports the client resolves. See
[Preact & htm](/ui/setup) for the details.

## Setting it up by hand

If you'd rather set up the build yourself, install the tools:

```bash
npm init -y
npm install --save-dev @protohax/userscript typescript \
  rollup @rollup/plugin-swc @swc/core \
  @rollup/plugin-node-resolve @rollup/plugin-commonjs
```

In `package.json`, note `"type": "module"`:

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

- **Keep `skipLibCheck` on.** Versions before 0.5 need it, because their
  declarations include a harmless duplicate declaration from the host's packet
  definitions. From 0.5 on it's optional but still recommended. Your own code
  is fully type-checked either way.
- **`isolatedModules` and `verbatimModuleSyntax`** match how swc transpiles:
  one file at a time, with type-only imports written as `import type`.

`rollup.config.mjs` builds the bundle:

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
    // A userscript is always a single file.
    inlineDynamicImports: true,
  },
  // Must stay external (see above).
  external: ["@protohax/userscript"],
  plugins: [
    resolve({
      // Lets extensionless imports (`./modules/auto-sprint`) resolve to .ts.
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

Then build:

```bash
npx rollup -c
```

Any other bundler works too, as long as the facade (`@protohax/userscript`) is
external and the output is a single ES module. Add the
[libraries the client ships](#libraries-the-client-ships) to `external` if you
build UI widgets.

## Types are not checked by the bundler

swc strips types without checking them, so a successful build tells you nothing
about type errors. Run `npm run check` (`tsc --noEmit`) or keep an editor with a
TypeScript server open. Treat the bundle as the last step, not the safety net.

## Next

Optionally, add a [metadata banner](/guides/project-setup/banner) so the built
file carries its own name and version.
