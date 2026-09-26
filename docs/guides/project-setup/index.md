---
id: index
title: Project Setup
slug: /guides/project-setup
---

# Project Setup

A userscript ships as **one JavaScript file**. You write TypeScript in as many
files as you like, a bundler combines them into one file, and you drop that
file into the client's scripts folder.

## The template

The quickest way to start is the template repository, which has all of this set
up already:
[ProtoHax-UserScript-Template](https://github.com/hax0r31337/ProtoHax-UserScript-Template).

```bash
git clone https://github.com/hax0r31337/ProtoHax-UserScript-Template my-script
cd my-script
npm install

npm run build      # -> dist/my-script.js
npm run deploy     # build, then copy into the client's scripts folder
npm run dev        # rebuild + redeploy on every save
npm run check      # type-check without building
```

What you get:

- A working example module in `src/index.ts` that cancels chat packets.
- The build and deploy scripts described in this section.
- Bundling with rollup, configured in `rollup.config.mjs`.
- `script.config.mjs` for the settings you'll actually change: output name,
  sourcemap, minify, and the [metadata banner](/guides/project-setup/banner).

## In this section

- [Bundling](/guides/project-setup/bundling): what the built file must look
  like, and how to set up the build by hand.
- [Metadata Banner](/guides/project-setup/banner): the optional
  `==UserScript==` block that keeps a file's name and version attached to it.
- [Structure & Sharing](/guides/project-setup/structure): many modules in one
  script, and sharing code between scripts with `phaxuser:` imports.
- [Installing & Deploying](/guides/project-setup/installing): where the built
  file goes on Windows and Android.

:::tip

Once the template is cloned and `npm run deploy` works, you can jump straight to
[Getting Started](/guides/getting-started) and come back here when you need the
details.

:::
