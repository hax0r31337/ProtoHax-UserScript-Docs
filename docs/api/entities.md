---
id: entities
title: Entities
sidebar_position: 2
---

# Entities

`session.entityState` is an **`EntityStateTracker`** — the live entity model.

## `EntityStateTracker`

| Member | Type | Description |
| --- | --- | --- |
| `entities` | `Map<bigint, AbstractEntity>` | All tracked entities, keyed by runtime id. |
| `playerList` | `Map<string, PlayerListEntry>` | The player (tab) list, keyed by UUID string. |
| `localPlayer` | [`EntityLocalPlayer`](/api/local-player) | The local player. |

```ts
ctx.on("tick", () => {
  for (const entity of ctx.session.entityState.entities.values()) {
    console.log(entity.name, entity.position);
  }
});
```

## The entity hierarchy

Every value in `entities` is an `AbstractEntity`. The concrete subclasses are
**value exports**, so you narrow with `instanceof`:

```
AbstractEntity
├── EntityPlayer
│   ├── EntityNetworkPlayer   // other players
│   └── EntityLocalPlayer     // you — see the Local Player page
├── EntityCreature            // mobs
└── EntityItem                // dropped items
```

```ts
import { EntityCreature, EntityNetworkPlayer } from "@protohax/userscript";

for (const e of ctx.session.entityState.entities.values()) {
  if (e instanceof EntityNetworkPlayer) {
    console.log("player", e.username, e.health);
  } else if (e instanceof EntityCreature && e.isHostile) {
    console.log("hostile mob", e.identifier);
  }
}
```

## `AbstractEntity`

The base every entity shares.

| Member | Type | Description |
| --- | --- | --- |
| `runtimeId` | `bigint` | Network runtime id (the key in `entities`). |
| `position` | `Vector3` | World position. |
| `prevPosition` | `Vector3` | Position on the previous tick. |
| `motion` | `Vector3` | Current velocity. |
| `rotation` | `Vector3` | Rotation as `(pitch, yaw, headYaw)`. |
| `isOnGround` | `boolean` | Whether the entity is on the ground. |
| `aabb` | `AABB` | World-space bounding box. |
| `get aabbShape` | `AABB` | Untranslated box (translate by `position` for world-space). |
| `tickLived` | `bigint` | Ticks the entity has existed. |
| `health` | `number` | Current health. |
| `maxHealth` | `number` | Maximum health. |
| `absorption` | `number` | Absorption (yellow) health. |
| `scale` | `number` | Model scale. |
| `effects` | `Map<string, MobEffect>` | Active status effects, keyed by handle (e.g. `minecraft:invisibility`). |
| `hurtTime` | `number` | Remaining hurt-animation ticks. |
| `get canBeAttacked` | `boolean` | Whether this is a valid attack target. |
| `get name` | `string` | Display name. |
| `entityEvents` | `EventEmitter<EntityEvents>` | Per-entity event emitter (see below). |
| `getMetadata<T>(key)` | `T \| undefined` | Read a raw metadata value by key. |

### `EntityPlayer` (adds)

Base of both other players and the local player.

| Member | Type | Description |
| --- | --- | --- |
| `uuid` | `UUID` | Player UUID. |
| `username` | `string` | Player name. |
| `gamemode` | `GameMode` | Current game mode. |
| `permissionLevel` | `PermissionLevel` | Permission level. |
| `get playerListEntry` | `PlayerListEntry \| undefined` | This player's tab-list entry, if present. |
| `get eyePosition` | `Vector3` | Eye position (accounts for sneak/swim/crawl). |
| `get nameColor` | `string \| null` | Chat/team color code parsed from the name, if any. |
| `get armorColor` | `Color \| undefined` | Team armor color, if any. |

`EntityNetworkPlayer` is `EntityPlayer` with no additional members — it's the
type of *other* players in the world.

### `EntityCreature` (adds)

| Member | Type | Description |
| --- | --- | --- |
| `identifier` | `string` | Normalized entity identifier, e.g. `minecraft:zombie`. |
| `isLiving` | `boolean` | Whether this is a living entity (mob). |
| `isHostile` | `boolean` | Whether this is a hostile mob. |
| `isPickable` | `boolean` | Whether this entity can be picked/attacked. |
| `isCustom` | `boolean` | Whether this is a non-vanilla (custom) entity. |

### `EntityItem` (adds)

| Member | Type | Description |
| --- | --- | --- |
| `item` | [`ItemStack`](/api/inventory#itemstack) | The dropped item stack. |

## Per-entity events — `entityEvents`

Each entity has its own `EventEmitter` for changes to *that* entity:

```ts
ctx.on("entity_spawn", (entity) => {
  entity.entityEvents.on("health", () => {
    console.log(entity.name, "health ->", entity.health);
  });
});
```

The `EntityEvents` map:

| Event | Payload | Fires when |
| --- | --- | --- |
| `move` | `()` | Position/rotation changed. |
| `health` | `()` | Health changed. |
| `hurt` | `()` | Entity took damage. |
| `destroy` | `()` | Entity was removed. |
| `name` | `()` | Display name changed. |
| `attribute` | `(key: string)` | An attribute updated. |
| `effect` | `("add" \| "remove" \| "update", key)` | A status effect changed. |
| `inventory_update` | `()` | Inventory changed (**does not fire for the local player**). |
| `metadata_<key>` | `(value)` | A specific metadata field changed. |

## `PlayerListEntry`

The tab-list entry — present even for players not currently spawned as entities.

| Member | Type |
| --- | --- |
| `uuid` | `UUID` |
| `entity_unique_id` | `bigint` |
| `username` | `string` |
| `build_platform` | `number` |
| `skin` | `PlayerSkin` |

### `UUID`

| Member | Signature | Description |
| --- | --- | --- |
| `bytes` | `Uint8Array` | Raw 16 bytes. |
| `equals(other)` | `boolean` | Compare two UUIDs. |
| `toString()` | `string` | Canonical string form. |
| `UUID.parse(str)` | `static UUID` | Parse from string. |
| `UUID.ZERO` | `static UUID` | The all-zero UUID. |

### `PlayerSkin`

| Member | Signature | Description |
| --- | --- | --- |
| `get hasVisibleGeometry` | `boolean` | Skin has any visible geometry. |
| `get hasValidGeometry` | `boolean` | Skin has valid humanoid geometry. |
| `extractAvatar()` | `Uint8Array \| undefined` | Face/avatar as raw RGBA pixels, if derivable. |

## `GameMode` and `PermissionLevel`

These are **string-union types**, not enums — compare against the string:

```ts
type GameMode =
  | "survival" | "creative" | "adventure"
  | "survival_spectator" | "creative_spectator"
  | "fallback" | "spectator" | number;

type PermissionLevel =
  | "visitor" | "member" | "operator" | "custom" | number;

if (player.gamemode === "creative") { /* ... */ }
```
