# Tooltip Stat Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix player tooltip HP/TP bars and level to update in real-time for both the local player and other players.

**Architecture:** Three changes: (1) client-side fix for local player tooltip to read authoritative client state instead of stale character object, (2) server-side addition of TP percentage byte to existing combat broadcast packets, with matching client-side reads, (3) server-side addition of level byte to the level-up broadcast packet, with matching client-side read.

**Tech Stack:** TypeScript (client), C++ (etheos server), eolib packet protocol

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/map.ts` (client) | Modify | Use `client.*` stats for local player tooltip |
| `../etheos/src/map.cpp` (server) | Modify | Add TP% byte to 3 combat broadcast packets |
| `../etheos/src/npc.cpp` (server) | Modify | Add level byte to level-up broadcast |
| `src/handlers/avatar.ts` (client) | Modify | Read TP% from AvatarReply and AvatarAdmin |
| `src/handlers/spell.ts` (client) | Modify | Read TP% from SpellTargetOther |
| `src/handlers/item.ts` (client) | Modify | Read level from ItemAccept broadcast |

---

### Task 1: Fix local player tooltip to use authoritative client stats

**Files:**
- Modify: `src/map.ts:2041-2054`

The tooltip reads `character.hp/maxHp/tp/maxTp/level` from the character object in `nearby.characters`, but many handlers only update `client.hp/tp/maxHp/maxTp/level` without syncing to the character object. For the local player, `client.*` is the source of truth.

- [ ] **Step 1: Add local player check to tooltip data**

In `src/map.ts`, replace the tooltip `update()` call (lines 2041-2054) with a version that checks if the hovered character is the local player:

```typescript
const isLocalPlayer = character.playerId === this.client.playerId;

this.playerTooltip.update(
  {
    name: `${charName}${guildSuffix}`,
    level: isLocalPlayer ? this.client.level : character.level,
    className,
    hp: isLocalPlayer ? this.client.hp : character.hp,
    maxHp: isLocalPlayer ? this.client.maxHp : character.maxHp,
    tp: isLocalPlayer ? this.client.tp : character.tp,
    maxTp: isLocalPlayer ? this.client.maxTp : character.maxTp,
  },
  pageX,
  pageY,
  scale,
);
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/map.ts
git commit -m "fix(tooltip): use authoritative client stats for local player tooltip"
```

---

### Task 2: Add TP percentage to server combat broadcast packets

**Files:**
- Modify: `/Users/cfraser/Projects/etheos/src/map.cpp:2128-2142` (spell damage — PACKET_AVATAR ADMIN)
- Modify: `/Users/cfraser/Projects/etheos/src/map.cpp:1680-1697` (physical damage — PACKET_AVATAR REPLY)
- Modify: `/Users/cfraser/Projects/etheos/src/map.cpp:2190-2207` (heal spell — PACKET_SPELL TARGET_OTHER)

Add a TP percentage byte (0-100) to each of these three broadcast packets, appended after the existing data. The TP percentage for the victim uses the same formula as the existing HP percentage: `(victim->tp / victim->maxtp) * 100.0`.

For the heal spell case, the caster's TP changes (they spend TP), so we send the **caster's** TP percentage (since the victim's TP is unaffected by heals). For damage cases, the victim's TP doesn't change from damage, but we include it anyway for consistency so the tooltip always has fresh data.

- [ ] **Step 1: Add TP% to PACKET_AVATAR ADMIN (spell damage to player)**

In `/Users/cfraser/Projects/etheos/src/map.cpp`, find the spell damage broadcast block starting at line 2128. After the existing `builder.AddShort(spell_id);` (line 2137), add the victim's TP percentage. Also update the reserved size from 12 to 13:

Before:
```cpp
PacketBuilder builder(PACKET_AVATAR, PACKET_ADMIN, 12);
builder.AddShort(from->PlayerID());
builder.AddShort(victim->PlayerID());
builder.AddThree(amount);
builder.AddChar(from->direction);
builder.AddChar(static_cast<unsigned char>(util::clamp<int>(
    static_cast<int>(double(victim->hp) / double(victim->maxhp) * 100.0), 0,
    100)));
builder.AddChar(victim->hp == 0);
builder.AddShort(spell_id);
```

After:
```cpp
PacketBuilder builder(PACKET_AVATAR, PACKET_ADMIN, 13);
builder.AddShort(from->PlayerID());
builder.AddShort(victim->PlayerID());
builder.AddThree(amount);
builder.AddChar(from->direction);
builder.AddChar(static_cast<unsigned char>(util::clamp<int>(
    static_cast<int>(double(victim->hp) / double(victim->maxhp) * 100.0), 0,
    100)));
builder.AddChar(victim->hp == 0);
builder.AddShort(spell_id);
builder.AddChar(static_cast<unsigned char>(util::clamp<int>(
    static_cast<int>(double(victim->tp) / double(victim->maxtp) * 100.0), 0,
    100)));
```

- [ ] **Step 2: Add TP% to PACKET_AVATAR REPLY (physical damage to player)**

In `/Users/cfraser/Projects/etheos/src/map.cpp`, find the physical damage broadcast block starting at line 1680. After the existing `builder.AddChar(character->hp == 0);` (line 1689), add the victim's TP percentage. Also update the reserved size from 10 to 11.

Also update the `from_builder` (line 1665, sent to the attacker) with the same TP% addition — the attacker's own view packet should also include it. The `from_builder` has size 12 at line 1665, change to 13.

Before (from_builder, around line 1665-1678):
```cpp
PacketBuilder from_builder(PACKET_AVATAR, PACKET_REPLY, 12);
from_builder.AddShort(0);
from_builder.AddShort(character->PlayerID());
from_builder.AddThree(amount);
from_builder.AddChar(from->direction);
from_builder.AddChar(static_cast<unsigned char>(
    util::clamp<int>(static_cast<int>(double(character->hp) /
                                      double(character->maxhp) * 100.0),
                     0, 100)));
from_builder.AddChar(character->hp == 0);
```

After:
```cpp
PacketBuilder from_builder(PACKET_AVATAR, PACKET_REPLY, 13);
from_builder.AddShort(0);
from_builder.AddShort(character->PlayerID());
from_builder.AddThree(amount);
from_builder.AddChar(from->direction);
from_builder.AddChar(static_cast<unsigned char>(
    util::clamp<int>(static_cast<int>(double(character->hp) /
                                      double(character->maxhp) * 100.0),
                     0, 100)));
from_builder.AddChar(character->hp == 0);
from_builder.AddChar(static_cast<unsigned char>(
    util::clamp<int>(static_cast<int>(double(character->tp) /
                                      double(character->maxtp) * 100.0),
                     0, 100)));
```

Before (broadcast builder, around line 1680-1689):
```cpp
PacketBuilder builder(PACKET_AVATAR, PACKET_REPLY, 10);
builder.AddShort(from->PlayerID());
builder.AddShort(character->PlayerID());
builder.AddThree(amount);
builder.AddChar(from->direction);
builder.AddChar(static_cast<unsigned char>(
    util::clamp<int>(static_cast<int>(double(character->hp) /
                                      double(character->maxhp) * 100.0),
                     0, 100)));
builder.AddChar(character->hp == 0);
```

After:
```cpp
PacketBuilder builder(PACKET_AVATAR, PACKET_REPLY, 11);
builder.AddShort(from->PlayerID());
builder.AddShort(character->PlayerID());
builder.AddThree(amount);
builder.AddChar(from->direction);
builder.AddChar(static_cast<unsigned char>(
    util::clamp<int>(static_cast<int>(double(character->hp) /
                                      double(character->maxhp) * 100.0),
                     0, 100)));
builder.AddChar(character->hp == 0);
builder.AddChar(static_cast<unsigned char>(
    util::clamp<int>(static_cast<int>(double(character->tp) /
                                      double(character->maxtp) * 100.0),
                     0, 100)));
```

- [ ] **Step 3: Add TP% to PACKET_SPELL TARGET_OTHER (heal spell)**

In `/Users/cfraser/Projects/etheos/src/map.cpp`, find the heal spell broadcast block starting at line 2190. After the HP percentage char (line 2196-2198), add the caster's TP percentage. Update reserved size from 18 to 19.

For the heal case, we send the **caster's** TP% because the caster spent TP to cast. The victim's TP is unchanged.

Before:
```cpp
PacketBuilder builder(PACKET_SPELL, PACKET_TARGET_OTHER, 18);
builder.AddShort(victim->PlayerID());
builder.AddShort(from->PlayerID());
builder.AddChar(from->direction);
builder.AddShort(spell_id);
builder.AddInt(displayhp);
builder.AddChar(static_cast<unsigned char>(util::clamp<int>(
    static_cast<int>(double(victim->hp) / double(victim->maxhp) * 100.0), 0,
    100)));
```

After:
```cpp
PacketBuilder builder(PACKET_SPELL, PACKET_TARGET_OTHER, 19);
builder.AddShort(victim->PlayerID());
builder.AddShort(from->PlayerID());
builder.AddChar(from->direction);
builder.AddShort(spell_id);
builder.AddInt(displayhp);
builder.AddChar(static_cast<unsigned char>(util::clamp<int>(
    static_cast<int>(double(victim->hp) / double(victim->maxhp) * 100.0), 0,
    100)));
builder.AddChar(static_cast<unsigned char>(util::clamp<int>(
    static_cast<int>(double(from->tp) / double(from->maxtp) * 100.0), 0,
    100)));
```

- [ ] **Step 4: Build the server**

Run from `../etheos/`: `make` (or whatever the project's build command is)
Expected: Clean build, no errors

- [ ] **Step 5: Commit (server)**

```bash
cd ../etheos
git add src/map.cpp
git commit -m "feat(packets): add TP percentage to combat broadcast packets"
```

---

### Task 3: Read TP percentage in client handlers

**Files:**
- Modify: `src/handlers/avatar.ts:118-169` (handleAvatarReply)
- Modify: `src/handlers/avatar.ts:171-217` (handleAvatarAdmin)
- Modify: `src/handlers/spell.ts:74-105` (handleSpellTargetOther)

After eolib deserializes the known packet fields, the new TP% byte will be left on the reader. Read it with `reader.getChar()` guarded by `reader.remaining > 0` (for backwards compatibility with servers that don't send it yet).

- [ ] **Step 1: Read TP% in handleAvatarReply**

In `src/handlers/avatar.ts`, in `handleAvatarReply`, after the line `victim.hp = Math.round((victim.maxHp * packet.hpPercentage) / 100);` (line 158), add:

```typescript
if (reader.remaining > 0) {
  const tpPercentage = reader.getChar();
  victim.tp = Math.round((victim.maxTp * tpPercentage) / 100);
}
```

- [ ] **Step 2: Read TP% in handleAvatarAdmin**

In `src/handlers/avatar.ts`, in `handleAvatarAdmin`, after the line `victim.hp = Math.round((victim.maxHp * packet.hpPercentage) / 100);` (line 188), add:

```typescript
if (reader.remaining > 0) {
  const tpPercentage = reader.getChar();
  victim.tp = Math.round((victim.maxTp * tpPercentage) / 100);
}
```

- [ ] **Step 3: Read TP% in handleSpellTargetOther**

In `src/handlers/spell.ts`, in `handleSpellTargetOther`, after the line `character.hp = Math.round((character.maxHp * packet.hpPercentage) / 100);` (line 94), add:

```typescript
if (reader.remaining > 0) {
  const casterTpPercentage = reader.getChar();
  if (caster) {
    caster.tp = Math.round((caster.maxTp * casterTpPercentage) / 100);
  }
}
```

Note: For the heal spell, the TP% is the **caster's** (they spent TP), not the victim's. So we update `caster.tp`, not `character.tp`.

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/handlers/avatar.ts src/handlers/spell.ts
git commit -m "feat(tooltip): read TP percentage from combat broadcast packets"
```

---

### Task 4: Add level to server level-up broadcast and read it on client

**Files:**
- Modify: `/Users/cfraser/Projects/etheos/src/npc.cpp:1278-1286` (level-up broadcast)
- Modify: `src/handlers/item.ts:342-351` (handleItemAccept)

The server's `PACKET_ITEM ACCEPT` broadcast to nearby players currently only contains the player ID. Add the new level as an extra char byte.

- [ ] **Step 1: Add level byte to server broadcast**

In `/Users/cfraser/Projects/etheos/src/npc.cpp`, find the level-up broadcast block (around line 1278-1286):

Before:
```cpp
PacketBuilder builder2(PACKET_ITEM, PACKET_ACCEPT);
builder2.AddShort(character->PlayerID());

for (const auto c : this->map->characters) {
  if (c == character || !c->InRange(character))
    continue;

  c->Send(builder2);
}
```

After:
```cpp
PacketBuilder builder2(PACKET_ITEM, PACKET_ACCEPT);
builder2.AddShort(character->PlayerID());
builder2.AddChar(character->level);

for (const auto c : this->map->characters) {
  if (c == character || !c->InRange(character))
    continue;

  c->Send(builder2);
}
```

- [ ] **Step 2: Build the server**

Run from `../etheos/`: `make`
Expected: Clean build

- [ ] **Step 3: Commit server change**

```bash
cd ../etheos
git add src/npc.cpp
git commit -m "feat(packets): include level in level-up broadcast to nearby players"
```

- [ ] **Step 4: Read level in client handleItemAccept**

In `src/handlers/item.ts`, update `handleItemAccept` (line 342-351):

Before:
```typescript
function handleItemAccept(client: Client, reader: EoReader) {
  const packet = ItemAcceptServerPacket.deserialize(reader);
  const character = client.getCharacterById(packet.playerId);
  if (!character) {
    return;
  }

  client.characterEmotes.set(packet.playerId, new Emote(EmoteType.LevelUp));
  playSfxById(SfxId.LevelUp);
}
```

After:
```typescript
function handleItemAccept(client: Client, reader: EoReader) {
  const packet = ItemAcceptServerPacket.deserialize(reader);
  const character = client.getCharacterById(packet.playerId);
  if (!character) {
    return;
  }

  if (reader.remaining > 0) {
    character.level = reader.getChar();
  }

  client.characterEmotes.set(packet.playerId, new Emote(EmoteType.LevelUp));
  playSfxById(SfxId.LevelUp);
}
```

- [ ] **Step 5: Verify client build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit client change**

```bash
git add src/handlers/item.ts
git commit -m "feat(tooltip): read level from level-up broadcast for other players"
```
