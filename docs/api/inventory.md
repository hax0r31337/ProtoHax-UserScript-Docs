---
id: inventory
title: Items & Inventory
sidebar_position: 6
---

# Items & Inventory

`session.itemState` is an **`ItemStateTracker`** — the local inventories, open
containers and forms, the item registry, and the controller that moves/drops
items.

## `ItemStateTracker`

| Member | Type | Description |
| --- | --- | --- |
| `controller` | `AbstractInventoryController` | Moves/drops/consumes items (see below). |
| `openContainer` | `AbstractDynamicInventory \| null` | The currently open container/inventory, if any. |
| `openForm` | `Form \| null` | The currently open modal form, if any. |
| `items` | `Map<number, ItemDefinition>` | Item registry, keyed by network runtime id. |
| `itemsByName` | `Map<string, ItemDefinition>` | Item registry, keyed by identifier (e.g. `minecraft:diamond_sword`). |
| `simulateOpenInventory()` | `void` | Silently open the player inventory server-side (no-op if already open). |
| `closeContainer()` | `void` | Close the currently open container. |

## `AbstractInventoryController`

`itemState.controller`. Every mutation goes through here — it produces the
correct transaction packets for the current server-auth mode.

| Member | Signature | Description |
| --- | --- | --- |
| `moveItem(from, fromSlot, to, toSlot)` | `void` | Move/merge/swap items between container slots. |
| `dropItem(container, slot, amount)` | `void` | Drop `amount` items from a slot. |
| `dropItemStack(container, slot)` | `void` | Drop the entire stack in a slot (and swing). |
| `consumeItem(container, slot, amount)` | `void` | Reduce a slot's stack by `amount` and resync the client. |
| `getLegacyRequestId()` | `number` | Allocate a decreasing legacy transaction request id. |
| `isUsingItem` | `boolean` | Whether the player is currently using/charging an item. |
| `itemInUseDuration` | `number` | Ticks the current item has been in use. |

The `from`/`to`/`container` arguments are `AbstractInventoryContainer`s — i.e.
`localPlayer.inventory`, `.inventoryArmor`, `.inventoryOffhand`, or a currently
open container.

```ts
const { entityState, itemState } = ctx.session;
const inv = entityState.localPlayer.inventory;
const armor = entityState.localPlayer.inventoryArmor;

// move whatever is in inventory slot 9 into the helmet slot (slot 0)
itemState.controller.moveItem(inv, 9, armor, 0);
```

## Inventory containers

```
AbstractInventory                         // content: (ItemStack | undefined)[]
└── AbstractInventoryContainer            // id, type, getSlotType(slot)
    ├── PlayerInventory                   // hotbar + main; hand, selectedSlot, ...
    ├── PlayerInventoryArmor              // helmet/chestplate/leggings/boots
    ├── PlayerInventoryOffhand           // offhand
    └── AbstractDynamicInventory          // opened chests/containers; coordinates, hide()...
```

### `AbstractInventory`

| Member | Type | Description |
| --- | --- | --- |
| `content` | `(ItemStack \| undefined)[]` | Backing slot array. **An empty slot is `undefined`.** |

> **Note — there is no `isEmpty`.** A slot is empty exactly when
> `content[slot] === undefined`. Check for that rather than looking for an
> "air" item.

### `AbstractInventoryContainer` (adds)

| Member | Signature | Description |
| --- | --- | --- |
| `id` | `WindowID` | Window id of this container. |
| `type` | `WindowType` | Window type. |
| `getSlotType(slot)` | `FullContainerName` | Container-slot type for a slot index. |

### `PlayerInventory`

`localPlayer.inventory` — the hotbar + main inventory.

| Member | Signature | Description |
| --- | --- | --- |
| `selectedSlot` | `number` | Server-side selected hotbar slot (0–8). |
| `clientSelectedSlot` | `number` | Client-side selected hotbar slot (0–8). |
| `get/set hand` | `ItemStack \| undefined` | The item in the held hotbar slot. |
| `setHotbarSlot(slot, toClient?)` | `void` | Switch the held slot (optionally reflect to client). |
| `sendMobEquipment(toClient?)` | `void` | Resend equipment for the current slot. |

### `PlayerInventoryArmor`

`localPlayer.inventoryArmor` — four get/set accessors: `helmet`, `chestplate`,
`leggings`, `boots` (each `ItemStack | undefined`).

### `PlayerInventoryOffhand`

`localPlayer.inventoryOffhand` — `get offhand` (`ItemStack | undefined`).

### `AbstractDynamicInventory`

An opened container (e.g. a chest). This is the type of `itemState.openContainer`.

| Member | Signature | Description |
| --- | --- | --- |
| `coordinates` | `Vector3` | World coordinates of the container block, if any. |
| `created` | `Date` | When the container was opened. |
| `get isInitialized` | `boolean` | Whether the container has been initialized. |
| `initialize()` | `void` | Mark it initialized. |
| `get isHidden` | `boolean` | Whether the container is currently hidden (silent). |
| `canHide()` | `boolean` | Whether it can be silent/hidden. |
| `hide()` | `void` | Hide (silence) the container; throws if it can't be. |

## `ItemStack`

An **immutable** item stack. There are no setters — you derive a new stack and
reassign it (e.g. to `inventory.hand`).

| Member | Signature | Description |
| --- | --- | --- |
| `definition` | `ItemDefinition` | The item's static definition. |
| `amount` | `number` | Stack size. **(Not `count`.)** |
| `metadata` | `number` | Item metadata/damage value. |
| `block` | `BlockState \| undefined` | Associated block state, for placeable items. |
| `nbt` | `{ version, nbt } \| undefined` | Raw NBT payload, if any. |
| `get simplifiedNbt` | `ItemNbt \| undefined` | Lazily-simplified item NBT. |
| `get nbtHash` | `number` | Hash of the item's NBT (0 if none). |
| `get typeHash` | `number` | Identity hash for grouping "same" items. |
| `get durability` | `number` | Current damage taken (from NBT). |
| `get customColor` | `Color \| undefined` | Custom (dyed) color, if set. |

Derivations (return a **new** stack):

| Method | Returns | Description |
| --- | --- | --- |
| `reduceAmount(amount)` | `ItemStack \| undefined` | Fewer items (undefined if depleted). |
| `addAmount(amount)` | `ItemStack` | More items. |
| `withAmount(amount)` | `ItemStack \| undefined` | Exact amount (undefined if ≤ 0). |
| `withDamage(damage)` | `ItemStack \| undefined` | Given damage (undefined if it would break). |
| `withStackId(stackId)` | `ItemStack` | Given network stack id. |

Queries:

| Method | Returns | Description |
| --- | --- | --- |
| `canStackWith(other)` | `boolean` | Same type/metadata/nbt as `other`. |
| `isCorrectTool(block)` | `boolean` | Whether this is the correct tool for `block`. |
| `newDurability(block)` | `number` | Damage this would take from breaking `block`. |
| `getDestroySpeed(block)` | `number` | Block-breaking speed against `block`. |

```ts
const inv = ctx.session.entityState.localPlayer.inventory;
const held = inv.hand;
if (held) {
  console.log(held.definition.name, "x", held.amount);
}
```

### `ItemDefinition`

| Member | Type | Description |
| --- | --- | --- |
| `runtimeId` | `number` | Network runtime id. |
| `name` | `string` | Identifier, e.g. `minecraft:diamond_sword`. |
| `tags` | `Set<string>` | Item tags. |
| `durability` | `number` | Max damage before breaking. |
| `maxStack` | `number` | Max stack size. |

### `Form`

`itemState.openForm` — an open modal form:

| Member | Type |
| --- | --- |
| `form_id` | `number` |
| `data` | `string` (raw JSON) |
