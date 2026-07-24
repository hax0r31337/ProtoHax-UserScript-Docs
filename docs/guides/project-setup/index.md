---
id: index
title: Project Setup
slug: /guides/project-setup
---

# Project Setup

A userscript ships as **one JavaScript file**. You write TypeScript across as
many files as you like, a bundler collapses them into that single file, and you
drop it into the client's scripts folder.

## The template

The fastest way to start is the template repository, which is already wired for
all of the above:

> **[ProtoHax-UserScript-Template](https://github.com/hax0r31337/ProtoHax-UserScript-Template)**

```bash
git clone https://github.com/hax0r31337/ProtoHax-UserScript-Template my-script
cd my-script
npm install

npm run build      # -> dist/my-script.js
npm run deploy     # build, then copy into the client's scripts folder
npm run dev        # rebuild + redeploy on every save
npm run check      # type-check without building
```

It ships a worked example module — cancelling chat packets — in `src/index.ts`,
plus the build and deploy scripts described in this section.
Bundling is rollup, configured in `rollup.config.mjs`; `script.config.mjs` holds
the knobs you actually change (output name, sourcemap, minify, and the
[metadata banner](/guides/project-setup/bundling#optional-a-userscript-banner)).

## In this section

- **[Bundling](/guides/project-setup/bundling)** — what the built file must
  look like, and how to set the build up by hand.
- **[Structure & Sharing](/guides/project-setup/structure)** — many modules in
  one script, and sharing code between scripts with `phaxuser:` imports.
- **[Installing & Deploying](/guides/project-setup/installing)** — where the
  built file goes on Windows and Android.

With the template cloned and `npm run deploy` working, you can skip straight to
[Getting Started](/guides/getting-started) and come back here when you need the
details.
