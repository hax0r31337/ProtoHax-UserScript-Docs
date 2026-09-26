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

:::note

Every `.js` file in that folder is loaded **once, when the client starts**.
Reconnecting to a server doesn't reload them, so restart the client after each
rebuild to pick up your changes.

:::

## `npm run deploy`

In the template, `npm run deploy` does the copy for you. It supports a few
overrides:

```bash
npm run deploy                                    # Windows: %APPDATA%\ProtoHax\scripts
npm run deploy -- --adb                           # adb push to a connected device
PROTOHAX_SCRIPTS_DIR=/path/to/scripts npm run deploy
```

`npm run dev` keeps this running for you: it rebuilds and redeploys on every
save.

## Checking it loaded

Start the client. Your modules should appear in the menu under the **Script**
category, next to the built-in groups.

If a module is missing, the script probably failed to load or threw while
registering. [Debugging](/guides/debugging) shows where `console` output and
errors end up on each platform.

## Next

- [Getting Started](/guides/getting-started): the module lifecycle in detail.
- [Modules](/guides/modules): the `meta` object in full.
- [Options](/guides/options): the option schema.
