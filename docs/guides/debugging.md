---
id: debugging
title: Debugging
---

# Debugging

## Where `console` output goes

`console.log`, `console.warn`, and `console.error` from your script go to the
client's log:

| Platform | Where |
| --- | --- |
| Windows | `%TEMP%\ProtoHax\log.txt` |
| Android | logcat, under the `ProtoHax` tag |

Follow it live while you test:

```powershell
# Windows
Get-Content "$env:TEMP\ProtoHax\log.txt" -Wait -Tail 50
```

```bash
# Android (device connected over adb)
adb logcat -s ProtoHax
```

## Errors land there too

When a setup function or lifecycle hook throws, the error is logged and
[contained](/guides/getting-started/context#errors-are-contained): the session
keeps running for every other module.

So if a module quietly "does nothing", check the log first. The stack trace is
probably there.

## In-game feedback

For quick checks mid-game, a client-side chat line is faster than switching to
the log. It's local only and never sent to the server:

```ts
ctx.session.sendChatMessage(`target: ${target?.username ?? "none"}`);
```

:::warning

Don't log from a [`movement_tick`](/api/movement) or
[`input_tick`](/api/input) handler on every tick. Those handlers block the game
thread, and 20 log lines a second is enough to notice.
Log from `tick` instead, or only every N ticks using a counter.

:::

## Reminders

- Scripts are read at **startup**. After a rebuild you need to restart the
  client (`npm run dev` redeploys, but you still restart). If your newest
  `console.log` never shows up, you're probably still running the old bundle.
- The bundler does **not** type-check, so run `npm run check`. A script that
  fails to parse or throws while loading won't register its modules, and the
  log will say why.
