---
id: inventory
title: Items & Inventory
sidebar_position: 6
---

# Items & Inventory

`session.itemState` is an `ItemStateTracker`. It holds your inventories, any
open container or form, and the item registry. It also owns the controller you
use to move and drop items.

## `ItemStateTracker`

| Member | Type | Description |
| --- | --- | --- |
| `controller` | `AbstractInventoryController` | Moves, drops and consumes items ([below](#abstractinventorycontroller)). |
| `openContainer` | `AbstractDynamicInventory \| null` | The open container or inventory, if any. |
| `openForm` | `Form \| null` | The open modal form, if any. |
| `items` | `Map<number, ItemDefinition>` | Item registry, keyed by network runtime id. |
| `itemsByName` | `Map<string, ItemDefinition>` | Item registry, keyed by identifier (e.g. `minecraft:diamond_sword`). |
| `simulateOpenInventory()` | `void` | Quietly open the player inventory on the server. Does nothing if it's already open. |
| `closeContainer()` | `void` | Close the open container. |

## `AbstractInventoryController`

`itemState.controller`. Every inventory change goes through here, and it sends
the right transaction packets for the server's current auth mode.

| Member | Type | Description |
| --- | --- | --- |
| `moveItem(from, fromSlot, to, toSlot)` | `void` | Move, merge or swap items between container slots. |
| `dropItem(container, slot, amount)` | `void` | Drop `amount` items from a slot. |
| `dropItemStack(container, slot)` | `void` | Drop the whole stack in a slot, and swing. |
| `consumeItem(container, slot, amount)` | `void` | Remove `amount` from a slot's stack and resync the client. |
| `isUsingItem` | `boolean` | Whether the player is using or charging an item. |
| `itemInUseDuration` | `number` | How many ticks the current item has been in use. |

The `from`, `to` and `container` arguments are `AbstractInventoryContainer`s:
`localPlayer.inventory`, `.inventoryArmor`, `.inventoryOffhand`, or an open
container.

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
| `content` | `(ItemStack \| undefined)[]` | The slot array. **An empty slot is `undefined`.** |

:::note[There is no `isEmpty`]

A slot is empty exactly when `content[slot] === undefined`. Check for that
instead of looking for an "air" item.

:::

### `AbstractInventoryContainer` (adds)

| Member | Type | Description |
| --- | --- | --- |
| `id` | `WindowID` | Window id of this container. |
| `type` | `WindowType` | Window type. |
| `getSlotType(slot)` | `FullContainerName` | Container-slot type for a slot index. |

### `PlayerInventory`

`localPlayer.inventory`: the hotbar plus the main inventory.

| Member | Type | Description |
| --- | --- | --- |
| `selectedSlot` | `number` | Selected hotbar slot on the server (0–8). |
| `clientSelectedSlot` | `number` | Selected hotbar slot on the client (0–8). |
| `get/set hand` | `ItemStack \| undefined` | The item in the held hotbar slot. |
| `setHotbarSlot(slot, toClient?)` | `void` | Switch the held slot. Optionally show the change on the client too. |
| `sendMobEquipment(toClient?)` | `void` | Resend equipment for the current slot. |

### `PlayerInventoryArmor`

`localPlayer.inventoryArmor`. Has four get/set accessors: `helmet`,
`chestplate`, `leggings` and `boots` (each `ItemStack | undefined`).

### `PlayerInventoryOffhand`

`localPlayer.inventoryOffhand`. Has `get offhand` (`ItemStack | undefined`).

### `AbstractDynamicInventory`

An opened container, such as a chest. This is the type of
`itemState.openContainer`.

| Member | Type | Description |
| --- | --- | --- |
| `coordinates` | `Vector3` | World coordinates of the container block, if any. |
| `created` | `Date` | When the container was opened. |
| `get isInitialized` | `boolean` | Whether the container has been initialized. |
| `initialize()` | `void` | Mark it initialized. |
| `get isHidden` | `boolean` | Whether the container is hidden (silent). |
| `canHide()` | `boolean` | Whether it can be hidden (silent). |
| `hide()` | `void` | Hide (silence) the container. Throws if it can't be hidden. |

## `ItemStack`

An **immutable** item stack. There are no setters: to change a stack, create a
new one and assign it (e.g. to `inventory.hand`).

| Member | Type | Description |
| --- | --- | --- |
| `definition` | `ItemDefinition` | The item's static definition. |
| `amount` | `number` | Stack size. **Not `count`.** |
| `metadata` | `number` | Item metadata/damage value. |
| `block` | `BlockState \| undefined` | Matching block state, for placeable items. |
| `nbt` | `{ version, nbt } \| undefined` | Raw NBT payload, if any. |
| `get simplifiedNbt` | `ItemNbt \| undefined` | Item NBT, simplified on first access. |
| `get nbtHash` | `number` | Hash of the item's NBT (0 if none). |
| `get typeHash` | `number` | Identity hash for grouping "same" items. |
| `get durability` | `number` | Damage taken so far (from NBT). |
| `get customColor` | `Color \| undefined` | Custom (dyed) color, if set. |

These methods return a **new** stack:

| Method | Returns | Description |
| --- | --- | --- |
| `reduceAmount(amount)` | `ItemStack \| undefined` | Fewer items. `undefined` if none are left. |
| `addAmount(amount)` | `ItemStack` | More items. |
| `withAmount(amount)` | `ItemStack \| undefined` | An exact amount. `undefined` if ≤ 0. |
| `withDamage(damage)` | `ItemStack \| undefined` | The given damage. `undefined` if the item would break. |
| `withStackId(stackId)` | `ItemStack` | The given network stack id. |

These methods answer questions about the stack:

| Method | Returns | Description |
| --- | --- | --- |
| `canStackWith(other)` | `boolean` | Whether it has the same type, metadata and NBT as `other`. |
| `isCorrectTool(block)` | `boolean` | Whether this is the correct tool for `block`. |
| `newDurability(block)` | `number` | Damage this item would take from breaking `block`. |
| `getDestroySpeed(block)` | `number` | Breaking speed against `block`. |

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
| `durability` | `number` | Maximum damage before breaking. |
| `maxStack` | `number` | Maximum stack size. |

### `Form`

`itemState.openForm`: an open modal form.

| Member | Type |
| --- | --- |
| `form_id` | `number` |
| `data` | `string` (raw JSON) |
