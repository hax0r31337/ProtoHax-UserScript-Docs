---
id: debugging
title: Debugging
---

# Debugging

## Where `console` output goes

`console.log` / `console.warn` / `console.error` from a script are piped to the
client's log:

| Platform | Where |
| --- | --- |
| Windows | `%TEMP%\ProtoHax\log.txt` |
| Android | logcat, under the `ProtoHax` tag |

Tail it live while you test:

```powershell
# Windows
Get-Content "$env:TEMP\ProtoHax\log.txt" -Wait -Tail 50
```

```bash
# Android (device connected over adb)
adb logcat -s ProtoHax
```

## Errors land there too

A setup function or lifecycle hook that throws is logged and
[contained](/guides/getting-started/context#errors-are-contained) — the session
keeps running for every other module. So a module that silently "does nothing"
usually left its stack trace in the log: check there first.

## In-game feedback

For quick state checks mid-game, a client-side chat line beats alt-tabbing to
the log — it is local-only and never sent to the server:

```ts
ctx.session.sendChatMessage(`target: ${target?.username ?? "none"}`);
```

Do **not** log from a [`movement_tick`](/api/movement) handler on every tick:
that handler blocks the game thread, and logging 20 lines a second is enough to
be felt. Log from `tick` instead, or gate it behind a counter.

## Reminders

- Scripts are read at **startup** — a rebuild needs a client restart (or
  `npm run dev` plus a restart) to take effect. If your latest `console.log`
  never appears, you are probably still running the old bundle.
- The bundler does **not** type-check; run `npm run check`. A script that fails
  to parse or throws at load simply won't register its modules — the log says
  why.
