---
id: audio
title: Audio
sidebar_position: 9.5
---

# Audio

`registerAudio` sends an audio file to the client UI and hands you back an
`AudioClip` to play it with. The sound plays on the device running the client,
on top of the game's own audio. It doesn't pause or duck the game's music.

```ts
import { registerAudio } from "@protohax/userscript";

const clip = registerAudio(bytes); // bytes: a Uint8Array holding the file
clip.play();
```

The API is **fire and forget**. Every call sends a message to the client UI and
returns straight away, and nothing ever comes back. You can't wait for a clip
to load or finish playing, and a call never throws because of the UI.

## `registerAudio(data)`

| Parameter | Type | Description |
| --- | --- | --- |
| `data` | `Uint8Array` | A whole encoded audio file: mp3, ogg, wav, or anything else the platform's player decodes. |

Returns an `AudioClip`, ready to use right away. You don't need to wait for it to
load: calls made before loading has finished are queued and run once it has,
in the order you made them.

The client works the format out from the data, so there's no type or file name
to pass. If it can't load the data, the player sees an **Audio Failed** dialog
with the error. Your script isn't told, and every later call on that clip
does nothing.

Each call registers a **new** clip and sends the whole file again, even for data
you've registered before. Register a sound once and keep the clip around. See
[Register once](#register-once).

## `AudioClip`

### Playback

| Member | Description |
| --- | --- |
| `play()` | Play from the start. If it's already playing, it restarts. |
| `pause()` | Pause where it is. |
| `resume()` | Carry on from where it was paused or stopped. |
| `stop()` | Stop and rewind to the start. |
| `destroy()` | Stop it and free it on the client. |

### Settings

Setting one of these is sent to the client right away, whether the clip is
playing or not.

| Member | Type | Default | Description |
| --- | --- | --- | --- |
| `volume` | `number` | `1` | From `0` (silent) to `1` (full). Values outside that range are clamped. |
| `rate` | `number` | `1` | Playback speed. `2` plays twice as fast. The pitch stays the same. |
| `looping` | `boolean` | `false` | Whether it starts over when it reaches the end. |

The getters return the last value you set, not something read back from the
client.

### Handle

| Member | Type | Description |
| --- | --- | --- |
| `handle` | `number` | The id the client knows this clip by. Read only. |
| `destroyed` | `boolean` | Whether `destroy()` has been called. Read only. |

After `destroy()`, every other call on the clip is ignored and logs a warning.
Register the data again if you need the sound back.

## Embedding a sound as base64

A userscript is a single file, so the simplest way to ship a sound with it is to
paste the file in as a base64 string, then decode it with
`Uint8Array.fromBase64`.

Encode the file once on your machine:

```bash
base64 -w0 ding.ogg > ding.b64     # Linux
base64 -i ding.ogg -o ding.b64     # macOS
```

Then paste the result into your script:

```ts
import { registerAudio } from "@protohax/userscript";

// the contents of ding.b64, trimmed here
const DING_BASE64 = "T2dnUwACAAAAAAAAAAB3aAAAAAAAAAB4uU0BHgF2b3JiaXMAAAAAAUSs...";

const ding = registerAudio(Uint8Array.fromBase64(DING_BASE64));
ding.volume = 0.5;
ding.play();
```

Base64 makes the file about a third larger, so keep embedded sounds short.
A compressed format like ogg or mp3 keeps the script much smaller than wav.

:::note[`Uint8Array.fromBase64` and TypeScript]

The client's JavaScript engine has `Uint8Array.fromBase64`. Its types ship with
TypeScript 6 when `target` is `ESNext`, as in the
[recommended `tsconfig.json`](/guides/project-setup/bundling#setting-it-up-by-hand). On an older
TypeScript, decode with `atob` instead:

```ts
const bytes = Uint8Array.from(atob(DING_BASE64), (c) => c.charCodeAt(0));
```

:::

## Register once

[`setup(ctx)` runs once per session](/guides/getting-started/two-phases#phase-2--setupctx),
so a `registerAudio` call inside it registers a fresh copy of the sound every
time you join a server. Keep the clip in a variable at the top level of your
script instead, and register it the first time you need it:

```ts
import { defineModule, registerAudio, type AudioClip } from "@protohax/userscript";

const DING_BASE64 = "T2dnUwACAAAAAAAAAAB3aAAAAAAAAAB4uU0BHgF2b3JiaXMAAAAAAUSs...";

let ding: AudioClip | undefined;

function playDing(volume: number) {
  ding ??= registerAudio(Uint8Array.fromBase64(DING_BASE64));
  ding.volume = volume;
  ding.play();
}

defineModule(
  { name: "Kill Sound" },
  {
    volume: { type: "number", name: "Volume", def: 0.8, min: 0, max: 1, step: 0.05 },
  },
  (ctx) => {
    ctx.on("target_killed", () => playDing(ctx.options.volume.value));
  },
);
```

Setting `volume` just before `play()` picks up the menu value each time, so
changes in the menu apply to the next sound.

## Looping sounds

For a sound that runs while something is going on, set `looping` and use
`resume()` and `pause()`. `resume()` also starts a clip that has never
played.

```ts
let alarm: AudioClip | undefined;

ctx.onEnable(() => {
  alarm ??= registerAudio(Uint8Array.fromBase64(ALARM_BASE64));
  alarm.looping = true;
  alarm.resume();
});

ctx.onDisable(() => alarm?.pause());
```

Use `stop()` instead of `pause()` if the next start should begin from the top.
