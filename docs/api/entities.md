---
id: entities
title: Entities
sidebar_position: 2
---

# Entities

`session.entityState` is an `EntityStateTracker`: the live model of every entity
the client knows about, plus the player list.

## `EntityStateTracker`

| Member | Type | Description |
| --- | --- | --- |
| `entities` | `Map<bigint, AbstractEntity>` | All tracked entities, keyed by runtime id. |
| `playerList` | `Map<string, PlayerListEntry>` | The player (tab) list, keyed by UUID string. |
| `localPlayer` | [`EntityLocalPlayer`](/api/local-player) | You. |

```ts
ctx.on("tick", () => {
  for (const entity of ctx.session.entityState.entities.values()) {
    console.log(entity.name, entity.position);
  }
});
```

## The entity hierarchy

Every value in `entities` is an `AbstractEntity`. The subclasses are value
exports, so you can narrow with `instanceof`:

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

The members every entity has.

| Member | Type | Description |
| --- | --- | --- |
| `runtimeId` | `bigint` | Network runtime id (the key in `entities`). |
| `position` | `Vector3` | World position. |
| `prevPosition` | `Vector3` | Position on the previous tick. |
| `motion` | `Vector3` | Current velocity. |
| `rotation` | `Vector3` | Rotation as `(pitch, yaw, headYaw)`. |
| `isOnGround` | `boolean` | Whether the entity is on the ground. |
| `aabb` | `AABB` | Bounding box in world space. |
| `get aabbShape` | `AABB` | Bounding box before translation. Add `position` to get world space. |
| `tickLived` | `bigint` | How many ticks the entity has existed. |
| `health` | `number` | Current health. |
| `maxHealth` | `number` | Maximum health. |
| `absorption` | `number` | Absorption (yellow) health. |
| `scale` | `number` | Model scale. |
| `effects` | `Map<string, MobEffect>` | Active status effects, keyed by handle (e.g. `minecraft:invisibility`). |
| `hurtTime` | `number` | Ticks left in the hurt animation. |
| `get canBeAttacked` | `boolean` | Whether this is a valid attack target. |
| `get name` | `string` | Display name. |
| `entityEvents` | `EventEmitter<EntityEvents>` | This entity's own event emitter ([see below](#per-entity-events--entityevents)). |
| `getMetadata<T>(key)` | `T \| undefined` | Read a raw metadata value by key. |

### `EntityPlayer` (adds)

The base class for both other players and the local player.

| Member | Type | Description |
| --- | --- | --- |
| `uuid` | `UUID` | Player UUID. |
| `username` | `string` | Player name. |
| `gamemode` | `GameMode` | Current game mode. |
| `permissionLevel` | `PermissionLevel` | Permission level. |
| `get playerListEntry` | `PlayerListEntry \| undefined` | This player's tab-list entry, if there is one. |
| `get eyePosition` | `Vector3` | Eye position. Accounts for sneaking, swimming and crawling. |
| `get nameColor` | `string \| null` | Chat/team color code parsed from the name, if any. |
| `get armorColor` | `Color \| undefined` | Team armor color, if any. |

`EntityNetworkPlayer` adds nothing to `EntityPlayer`. It is simply the type of
*other* players in the world.

### `EntityCreature` (adds)

| Member | Type | Description |
| --- | --- | --- |
| `identifier` | `string` | Normalized entity identifier, e.g. `minecraft:zombie`. |
| `isLiving` | `boolean` | Whether this is a living entity (a mob). |
| `isHostile` | `boolean` | Whether this is a hostile mob. |
| `isPickable` | `boolean` | Whether this entity can be picked or attacked. |
| `isCustom` | `boolean` | Whether this is a non-vanilla (custom) entity. |

### `EntityItem` (adds)

| Member | Type | Description |
| --- | --- | --- |
| `item` | [`ItemStack`](/api/inventory#itemstack) | The dropped item stack. |

## Per-entity events — `entityEvents`

Each entity has its own `EventEmitter` that fires when *that* entity changes:

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
| `move` | `()` | Position or rotation changed. |
| `health` | `()` | Health changed. |
| `hurt` | `()` | The entity took damage. |
| `destroy` | `()` | The entity was removed. |
| `name` | `()` | Display name changed. |
| `attribute` | `(key: string)` | An attribute updated. |
| `effect` | `("add" \| "remove" \| "update", key)` | A status effect changed. |
| `inventory_update` | `()` | The inventory changed. **Does not fire for the local player.** |
| `metadata_<key>` | `(value)` | A specific metadata field changed. |

## `PlayerListEntry`

A tab-list entry. It exists even for players who aren't currently spawned as
entities.

| Member | Type |
| --- | --- |
| `uuid` | `UUID` |
| `entity_unique_id` | `bigint` |
| `username` | `string` |
| `build_platform` | `number` |
| `skin` | `PlayerSkin` |

### `UUID`

| Member | Type | Description |
| --- | --- | --- |
| `bytes` | `Uint8Array` | The raw 16 bytes. |
| `equals(other)` | `boolean` | Compare two UUIDs. |
| `toString()` | `string` | Canonical string form. |
| `UUID.parse(str)` | `static UUID` | Parse from a string. |
| `UUID.ZERO` | `static UUID` | The all-zero UUID. |

### `PlayerSkin`

| Member | Type | Description |
| --- | --- | --- |
| `get hasVisibleGeometry` | `boolean` | Whether the skin has any visible geometry. |
| `get hasValidGeometry` | `boolean` | Whether the skin has valid humanoid geometry. |
| `extractAvatar()` | `Uint8Array \| undefined` | The face/avatar as raw RGBA pixels, if it can be derived. |

## `GameMode` and `PermissionLevel`

These are string-union types, not enums. Compare against the string:

```ts
type GameMode =
  | "survival" | "creative" | "adventure"
  | "survival_spectator" | "creative_spectator"
  | "fallback" | "spectator" | number;

type PermissionLevel =
  | "visitor" | "member" | "operator" | "custom" | number;

if (player.gamemode === "creative") { /* ... */ }
```
