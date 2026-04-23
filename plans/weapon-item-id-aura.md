# Weapon Item ID Aura Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track actual weapon item IDs for all nearby players so auras only apply to the specific configured item, not all items sharing the same graphic ID.

**Architecture:** Server sends weapon item IDs via a custom packet (family 53 "PACKET_WEAPON_INFO") whenever characters appear or change equipment. Client stores a `Map<playerId, weaponItemId>` and the aura renderer looks up by item ID instead of graphic ID.

**Tech Stack:** C++ (etheos server), TypeScript (em-web-client)

---

### Task 1: Server — Add PACKET_WEAPON_INFO and helper

**Files:**
- Modify: `/Users/cfraser/Projects/etheos/src/fwd/packet.hpp` (add packet family constant)
- Modify: `/Users/cfraser/Projects/etheos/src/character.hpp` (add helper method declaration)
- Modify: `/Users/cfraser/Projects/etheos/src/character.cpp` (add helper method + send on equip)

- [ ] **Step 1: Add packet family constant**

In `/Users/cfraser/Projects/etheos/src/fwd/packet.hpp`, after `PACKET_BOSS = 52,` add:

```cpp
PACKET_WEAPON_INFO = 53,
```

- [ ] **Step 2: Add helper method declaration**

In `/Users/cfraser/Projects/etheos/src/character.hpp`, in the public methods section (near `AddPaperdollData`), add:

```cpp
void SendWeaponItemId(Character *to);
void BroadcastWeaponItemId();
```

- [ ] **Step 3: Implement helper methods**

In `/Users/cfraser/Projects/etheos/src/character.cpp`, after the `AddPaperdollData` method, add:

```cpp
void Character::SendWeaponItemId(Character *to) {
  int weapon_item_id = this->paperdoll[Character::Weapon];

  // Check glamor locker override
  for (const Character_Item &glamor_item : this->glamor_locker) {
    const EIF_Data &glamor_eif = this->world->eif->Get(glamor_item.id);
    if (glamor_eif.type == EIF::Weapon) {
      weapon_item_id = glamor_item.id;
      break;
    }
  }

  // Check cosmetic override
  if (this->cosmetic_paperdoll[Character::Weapon]) {
    // Cosmetic stores graphic ID, not item ID — find matching item
    // For cosmetics, the weapon visual changes but the item ID doesn't matter
    // for aura purposes. The aura should follow the visual weapon.
    // Since cosmetic only stores graphic ID and we need item ID, skip cosmetic
    // override here — the glamor locker and actual paperdoll are sufficient.
  }

  if (weapon_item_id == 0) return;

  PacketBuilder builder(PACKET_WEAPON_INFO, PACKET_REPLY, 4);
  builder.AddShort(this->PlayerID());
  builder.AddShort(weapon_item_id);
  to->Send(builder);
}

void Character::BroadcastWeaponItemId() {
  UTIL_FOREACH(this->map->characters, updatecharacter) {
    if (!this->InRange(updatecharacter)) continue;
    this->SendWeaponItemId(updatecharacter);
  }
}
```

- [ ] **Step 4: Commit server changes (packet definition + helpers)**

```bash
cd ~/Projects/etheos
git add src/fwd/packet.hpp src/character.hpp src/character.cpp
git commit -m "feat: add PACKET_WEAPON_INFO for weapon item ID broadcasting"
```

---

### Task 2: Server — Send weapon item IDs on map enter and equipment change

**Files:**
- Modify: `/Users/cfraser/Projects/etheos/src/handlers/Welcome.cpp` (send on login)
- Modify: `/Users/cfraser/Projects/etheos/src/handlers/Warp.cpp` (send on warp)
- Modify: `/Users/cfraser/Projects/etheos/src/handlers/Paperdoll.cpp` (send on equip/unequip)
- Modify: `/Users/cfraser/Projects/etheos/src/handlers/Locker.cpp` (send on glamor change)

- [ ] **Step 1: Send weapon item IDs after Welcome enter-game**

In `/Users/cfraser/Projects/etheos/src/handlers/Welcome.cpp`, in the `Welcome_Msg` handler, after the main welcome reply is sent to the player, add code to send weapon item IDs for all nearby characters to the joining player, and broadcast the joining player's weapon item ID to nearby characters:

After the player enters the map and the welcome packet is sent, add:

```cpp
// Send weapon item IDs for nearby characters to the new player
UTIL_FOREACH(player->character->map->characters, nearby_char) {
  if (nearby_char != player->character && player->character->InRange(nearby_char)) {
    nearby_char->SendWeaponItemId(player->character);
  }
}
// Broadcast this player's weapon item ID to nearby characters
player->character->BroadcastWeaponItemId();
```

- [ ] **Step 2: Send weapon item IDs after warp**

In `/Users/cfraser/Projects/etheos/src/handlers/Warp.cpp`, after the warp reply is sent and the character has entered the new map, add the same pattern:

```cpp
// Send weapon item IDs for nearby characters to the warping player
UTIL_FOREACH(character->map->characters, nearby_char) {
  if (nearby_char != character && character->InRange(nearby_char)) {
    nearby_char->SendWeaponItemId(character);
  }
}
// Broadcast this player's weapon item ID to nearby characters
character->BroadcastWeaponItemId();
```

- [ ] **Step 3: Broadcast weapon item ID on equip/unequip**

In `/Users/cfraser/Projects/etheos/src/handlers/Paperdoll.cpp`, in both `Paperdoll_Add` (equip) and `Paperdoll_Remove` (unequip), after the `PACKET_AVATAR PACKET_AGREE` broadcast loop, add:

```cpp
character->BroadcastWeaponItemId();
```

- [ ] **Step 4: Broadcast weapon item ID on glamor locker changes**

In `/Users/cfraser/Projects/etheos/src/handlers/Locker.cpp`, after glamor equip/unequip avatar broadcasts, add:

```cpp
character->BroadcastWeaponItemId();
```

- [ ] **Step 5: Commit server changes**

```bash
cd ~/Projects/etheos
git add src/handlers/Welcome.cpp src/handlers/Warp.cpp src/handlers/Paperdoll.cpp src/handlers/Locker.cpp
git commit -m "feat: broadcast weapon item IDs on login, warp, and equipment changes"
```

---

### Task 3: Client — Add weapon item ID storage and handler

**Files:**
- Modify: `/Users/cfraser/Projects/em-web-client/src/client.ts` (add weaponItemIds map)
- Create: `/Users/cfraser/Projects/em-web-client/src/handlers/weapon-info.ts` (new handler)
- Modify: `/Users/cfraser/Projects/em-web-client/src/handlers/index.ts` (register handler)

- [ ] **Step 1: Add weaponItemIds map to Client**

In `/Users/cfraser/Projects/em-web-client/src/client.ts`, in the class properties section (near other Maps like `npcHealthBars`), add:

```typescript
weaponItemIds = new Map<number, number>();
```

- [ ] **Step 2: Create weapon-info handler**

Create `/Users/cfraser/Projects/em-web-client/src/handlers/weapon-info.ts`:

```typescript
import { type EoReader, PacketAction } from 'eolib';
import type { Client } from '../client';

const PACKET_WEAPON_INFO = 53;

function handleWeaponInfoReply(client: Client, reader: EoReader) {
  const playerId = reader.getShort();
  const weaponItemId = reader.getShort();

  if (weaponItemId > 0) {
    client.weaponItemIds.set(playerId, weaponItemId);
  } else {
    client.weaponItemIds.delete(playerId);
  }
}

export function registerWeaponInfoHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PACKET_WEAPON_INFO as unknown as number,
    PacketAction.Reply,
    (reader) => handleWeaponInfoReply(client, reader),
  );
}
```

- [ ] **Step 3: Register the handler**

In `/Users/cfraser/Projects/em-web-client/src/handlers/index.ts`, import and call `registerWeaponInfoHandlers`:

```typescript
import { registerWeaponInfoHandlers } from './weapon-info';

// In registerAllHandlers():
registerWeaponInfoHandlers(client);
```

- [ ] **Step 4: Clean up weaponItemIds when players leave**

In `/Users/cfraser/Projects/em-web-client/src/handlers/avatar.ts`, in `handleAvatarRemove`, after the character is removed from `client.nearby.characters`, add:

```typescript
client.weaponItemIds.delete(packet.playerId);
```

Also clear the map on warp/map change. In `/Users/cfraser/Projects/em-web-client/src/handlers/warp.ts`, before `client.nearby = packet.nearby;`, add:

```typescript
client.weaponItemIds.clear();
```

- [ ] **Step 5: Type check and commit**

```bash
npx tsc --noEmit
git add src/client.ts src/handlers/weapon-info.ts src/handlers/index.ts src/handlers/avatar.ts src/handlers/warp.ts
git commit -m "feat: add weapon item ID tracking from server packets"
```

---

### Task 4: Client — Change aura lookup to use item ID

**Files:**
- Modify: `/Users/cfraser/Projects/em-web-client/src/aura/aura-manager.ts` (add item ID lookup map)
- Modify: `/Users/cfraser/Projects/em-web-client/src/map.ts` (use weaponItemIds for aura lookup)

- [ ] **Step 1: Add item ID lookup to AuraManager**

In `/Users/cfraser/Projects/em-web-client/src/aura/aura-manager.ts`, add a second map keyed by item ID alongside the existing graphic ID map. Update `rebuild` and add a `getAuraByItemId` lookup (one may already exist from the encyclopedia work — verify and reuse):

In the `rebuild` method, also populate:
```typescript
private configsByItemId = new Map<number, AuraConfig>();

private rebuild(configs: AuraConfig[]): void {
  this.configs.clear();
  this.configsByItemId.clear();
  this.characterAuras.clear();

  for (const config of configs) {
    if (config.graphicId <= 0 || config.effects.length === 0) continue;
    this.configs.set(config.graphicId, config);
    if (config.itemId > 0) {
      this.configsByItemId.set(config.itemId, config);
    }
  }
}
```

Ensure `getAuraByItemId` uses the `configsByItemId` map for O(1) lookup instead of iterating:
```typescript
getAuraByItemId(itemId: number): CachedAura | undefined {
  const config = this.configsByItemId.get(itemId);
  if (!config) return undefined;
  const { filters, floatEffect } = buildEffects(config);
  return { config, effects: filters, floatEffect };
}
```

Add a method for per-character aura by item ID (with caching):
```typescript
getAuraForCharacter(weaponItemId: number, playerId: number): CachedAura | undefined {
  const config = this.configsByItemId.get(weaponItemId);
  if (!config) return undefined;

  let cached = this.characterAuras.get(playerId);
  if (cached && cached.config === config) return cached;

  const { filters, floatEffect } = buildEffects(config);
  cached = { config, effects: filters, floatEffect };
  this.characterAuras.set(playerId, cached);
  return cached;
}
```

- [ ] **Step 2: Update map renderer to use item ID lookup**

In `/Users/cfraser/Projects/em-web-client/src/map.ts`, in the weapon aura section (around line 1149), change:

```typescript
// OLD:
const aura = this.client.auraManager.getAura(
  character.equipment.weapon,
  character.playerId,
);

// NEW:
const weaponItemId = character.playerId === this.client.playerId
  ? this.client.equipment.weapon
  : this.client.weaponItemIds.get(character.playerId);
const aura = weaponItemId
  ? this.client.auraManager.getAuraForCharacter(weaponItemId, character.playerId)
  : undefined;
```

- [ ] **Step 3: Type check and commit**

```bash
npx tsc --noEmit
git add src/aura/aura-manager.ts src/map.ts
git commit -m "feat: look up weapon auras by item ID instead of graphic ID"
```

---

### Task 5: Client — Update encyclopedia to use optimized lookup

**Files:**
- Modify: `/Users/cfraser/Projects/em-web-client/src/ui/encyclopedia/encyclopedia.ts`

- [ ] **Step 1: Update encyclopedia aura lookup**

The encyclopedia already uses `getAuraByItemId`. Verify it still works with the updated `AuraManager`. The method now uses `configsByItemId` map instead of iterating — this is a transparent improvement, no encyclopedia changes needed unless the method signature changed.

- [ ] **Step 2: Type check and commit if changes were needed**

```bash
npx tsc --noEmit
```
