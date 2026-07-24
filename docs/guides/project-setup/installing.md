---
id: installing
title: Installing & Deploying
---

# Installing & Deploying

## The scripts folder

Copy the built file into the client's **scripts** folder:

| Platform | Folder |
| --- | --- |
| Windows | `%APPDATA%\ProtoHax\scripts` |
| Android | `/storage/emulated/0/Android/data/net.protohax.prod/files/protohax/scripts` |

Every `.js` file there is loaded **once, at client startup** — reconnecting to
a server does not reload them. Restart the client after a rebuild to pick up
your changes.

## `npm run deploy`

The template's `npm run deploy` does the copy for you, and honours a few
overrides:

```bash
npm run deploy                                    # Windows: %APPDATA%\ProtoHax\scripts
npm run deploy -- --adb                           # adb push to a connected device
PROTOHAX_SCRIPTS_DIR=/path/to/scripts npm run deploy
```

`npm run dev` keeps this loop running — rebuild + redeploy on every save.

## Checking it loaded

Start the client and your modules appear in the menu under their categories,
next to the built-in ones. If a module is missing, the script likely failed to
load or threw during registration — see [Debugging](/guides/debugging) for
where `console` output and errors end up on each platform.

## Next

- [Getting Started](/guides/getting-started) — the module lifecycle in detail.
- [Modules](/guides/modules) — the `meta` object in full.
- [Options](/guides/options) — the option schema.
