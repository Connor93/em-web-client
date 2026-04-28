# Player-Wide Auras (excluding weapon)

> Source plan: `/Users/cfraser/.claude/plans/we-can-currently-add-cached-forest.md` (full design rationale).
> This file tracks implementation steps with checkboxes.

**Goal:** Assign visual auras to specific players that cover the entire body (skin/hair/armor/hat/boots/shield) but **do not** touch the weapon. Existing weapon-aura system continues to work alongside.

**Architecture:** Mirror the weapon-aura pipeline indexed by an arbitrary `AuraID` instead of `ItemID`, persisted per-character on a new `characters.player_aura_id` column, broadcast via a new packet family 54 (`PACKET_PLAYER_AURA`).

**Tech stack:** C++ (etheos server), TypeScript (em-web-client)

---

## Server (etheos)

### Task S1: Packet family + Character broadcast
- [ ] `src/fwd/packet.hpp`: add `PACKET_PLAYER_AURA = 54` after `PACKET_WEAPON_INFO = 53`
- [ ] `src/character.hpp`: declare `void SendPlayerAuraId(Character *to);` and `void BroadcastPlayerAuraId();`
- [ ] `src/character.cpp`: add member `int player_aura_id` (initialize to 0 in constructor), implement send/broadcast methods (mirror SendWeaponItemId at lines 2686-2711)
- [ ] Hook `BroadcastPlayerAuraId()` into the same paths as `BroadcastWeaponItemId()` (login, warp/map change)

### Task S2: Player-aura config loader
- [ ] Create `src/player_aura.hpp` (mirror `weapon_aura.hpp`) — `PlayerAuraProfile` struct with all weapon-aura fields PLUS `std::string render_mode = "front"` and `std::string name`
- [ ] Create `src/player_aura.cpp` (clone `weapon_aura.cpp`) — keyed by `aura_id` instead of `item_id`, parse `RenderMode` and `Name`
- [ ] Add `.cpp` to build (CMakeLists / Makefile)
- [ ] `src/world.hpp`: add `Config player_aura_config;` member
- [ ] `src/world.cpp:Rehash()`: load `player_auras.ini` and call `PlayerAuraSystem::LoadConfig`

### Task S3: Sample config + DB migration
- [ ] Create `data/player_auras.ini` with 2 sample entries (one `front`, one `back`)
- [ ] `install/install.sql`: append `player_aura_id INT NOT NULL DEFAULT 0` to `characters` table
- [ ] Create `install/upgrade/<next>_player_aura_id.sql` with `ALTER TABLE characters ADD COLUMN player_aura_id INT NOT NULL DEFAULT 0;`

### Task S4: DB load/save
- [ ] Find character SELECT in `database.cpp` / character load path; include `player_aura_id` in query and assign to field
- [ ] Find character UPDATE/save path; include `player_aura_id` in UPDATE
- [ ] Verify default 0 persists for existing characters

### Task S5: Admin command `$playeraura`
- [ ] Add command handler in `src/commands/admin.cpp` (or wherever similar `$jail` lives)
- [ ] Lookup target by name (online or DB), validate aura_id against `PlayerAuraSystem::GetProfiles()`
- [ ] Persist + broadcast on update; log change

### Task S6: Dashboard endpoint
- [ ] Add `GET /api/player-auras` JSON endpoint in `src/dashboard.cpp` (mirror weapon-auras serializer near line 723)
- [ ] Include `auraId`, `name`, `renderMode`, color, effects, and non-default effect parameters

### Task S7: Rehash broadcast
- [ ] Find existing `[CONFIG_RELOAD]weapon_auras` emitter; clone for `[CONFIG_RELOAD]player_auras` after `PlayerAuraSystem::LoadConfig`

---

## Client (em-web-client)

### Task C1: Aura config types
- [ ] `src/aura/types.ts`: add `renderMode?: 'front' | 'back'` to `AuraConfig`; add `PlayerAuraConfig` (extends with `auraId`, `name`) and `PlayerAuraResponse` types

### Task C2: AuraManager — second config map
- [ ] `src/aura/aura-manager.ts`: add `playerAuraConfigs: Map<number, PlayerAuraConfig>`, `characterPlayerAuras: Map<number, CachedAura>` (separate cache so weapon + player aura instances don't collide)
- [ ] Add `fetchPlayerAuras()` reusing `fetchWithRetry` helper
- [ ] Add `getPlayerAura(auraId, playerId)` mirroring `getAuraForCharacter`
- [ ] Add cleanup helper to drop a character's aura from both caches on departure

### Task C3: Packet handler + client state
- [ ] Use `new-handler` skill to scaffold `src/handlers/player-aura.ts` (PACKET_PLAYER_AURA = 54, Reply action)
- [ ] `src/client.ts`: add `playerAuraIds: Map<number, number>`, init `auraManager.fetchPlayerAuras()` alongside existing weapon-aura fetch (search line 463)
- [ ] Wire cleanup on player leave / map change (same hooks as `weaponItemIds.delete`)

### Task C4: Atlas — body-only texture
- [ ] `src/atlas.ts`: add `getCharacterTextureWithoutWeapon(playerId, frame): Texture | undefined` — clone the character render path but skip `renderCharacterWeaponBehind` and weapon-front passes
- [ ] Cache key includes appearance hash + frame + 'no-weapon' suffix
- [ ] Reuse same TTL/expiry as character textures

### Task C5: Render passes — front + back modes
- [ ] `src/map.ts`: extract a helper `renderPlayerAura(character, mode, ...)` that draws the body-only sprite with filters when `aura.config.renderMode === mode`
- [ ] Insert `renderPlayerAura(character, 'back', ...)` between weapon-aura block (line 1221) and main char sprite (line 1223)
- [ ] Insert `renderPlayerAura(character, 'front', ...)` after main char sprite (after line 1238, before front-effect loop at line 1240)
- [ ] Skip when `justCharacter` is true (ghost trail) — match weapon-aura pass

### Task C6: Settings toggle
- [ ] Find `weaponAuras` in settings module/UI; add parallel `playerAuras` setting (default 'enabled')
- [ ] Gate render passes on `settings.get('playerAuras') === 'enabled'`

### Task C7: Rehash refetch + verification
- [ ] Find `[CONFIG_RELOAD]weapon_auras` branch in system-message handler; add parallel `[CONFIG_RELOAD]player_auras` calling `auraManager.fetchPlayerAuras()`
- [ ] `pnpm tsc --noEmit && pnpm lint` clean
- [ ] Manual test plan from main plan: assign aura, observe body filter, weapon clean; equip weapon-aura'd weapon, both render simultaneously; clear aura; rehash; toggle setting; persistence across login

---

## Files at-a-glance

**Server create:** `data/player_auras.ini`, `src/player_aura.{hpp,cpp}`, `install/upgrade/<next>_player_aura_id.sql`, admin command section
**Server modify:** `src/fwd/packet.hpp`, `src/world.{hpp,cpp}`, `src/character.{hpp,cpp}`, `src/database.cpp` (load/save), `src/dashboard.cpp`, `install/install.sql`, build files

**Client create:** `src/handlers/player-aura.ts`
**Client modify:** `src/aura/aura-manager.ts`, `src/aura/types.ts`, `src/atlas.ts`, `src/map.ts`, `src/client.ts`, `src/handlers/index.ts`, settings module, `[CONFIG_RELOAD]` system-message branch

## Decisions (confirmed)
- **Lifecycle:** permanent only; cleared via `$playeraura <name> 0`
- **Render mode:** per-aura `RenderMode=front|back` in the INI
- **Stacking:** one player aura at a time (mirrors weapon-aura semantics)
