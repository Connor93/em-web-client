# Fork Reset & Reapply Plan

## Context

Local `master` has been reset to `upstream/master` (`42adabb`). The original fork state is preserved at `backup/master-pre-reset`. Some Phase 0 files have already been ported.

**Key principle**: All code must follow the **upstream controller pattern**: `client.mapController`, `client.authController`, `client.sessionController`, `client.keyboardController`, etc. The fork previously used `client.managers.x`.

---

## Current State (as of handoff)

### Already Ported (Phase 0 partial):
- ✅ `vite.config.ts` — `__BUILD_VERSION__` define added
- ✅ `src/db.ts` — Copied from backup (cache busting + resilient deserialization)
- ✅ `src/utils/get-shield-metadata.ts` — Custom wings (id 27) added
- ✅ `public/weapon-metadata.json` — Copied from backup
- ✅ `src/settings.ts` — Copied from backup
- ✅ `src/types/chat.ts` — Copied from backup
- ✅ `src/types/input.ts` — Copied from backup
- ✅ `src/ui/dialog-icon.ts` — Copied from backup
- ✅ `src/utils/get-weapon-metadata.ts` — Copied from backup

### Remaining Phase 0 (foundational/graphical):

#### `src/atlas.ts` — EGF-First Strategy (Tiered)

**KEY INSIGHT**: Upstream switched from PNGs to EGFs (Endless Graphics Files) via `GfxLoader` + Web Worker → `ImageBitmap`. The fork had replaced this with direct PNG `HTMLImageElement` loading. **Keep upstream's EGF approach** and only apply genuine bug/type fixes. Test before adding race condition guards.

##### Tier 1: Type-Safety & Bug Fixes (apply immediately, keep EGF)

Apply these to upstream's atlas.ts without changing the loading mechanism:

| Change | Description |
|--------|-------------|
| `Record<>` type annotations | On `WEAPON_VISIBLE_MAP`, `WEAPON_FRAME_MAP`, `BACK_FRAME_MAP`, offset maps, `CHARACTER_FRAME_OFFSETS` |
| Effect frame typing | `Frame[]` → `(Frame \| undefined)[]` in `EffectAtlasEntry` |
| Frame null guards | `if (frame)` checks in `packToAtlases()` |
| `frameArray` fix | `frameArray[i] = undefined!` → `frameArray![i] = undefined` |
| NPC frames type | inline type → `(Frame \| undefined)[]` |
| Cast removals | Remove `as Record<>` casts (handled by annotations) |
| Bounding box fix | `y < bmp.height` → `y < bmp.height - 1` (exclude registration markers) |
| Tile staleness check | `this.tiles.length` → `this.tiles.length && this.tiles.every(…)` |
| Static tile grid | Add `mapRenderer.getRequiredTileIds()` registration |
| Assertion cleanup | `client.map!` → `client.map`, `client.bus!` → `client.bus` |
| Controller rename | `client.mapController.getDoor` → `client.getDoor` |
| Remove hat error log | Remove `console.error` for missing hat bitmap |
| NPC `as Frame` cast | Apply `as Frame` on npc frame init |

##### Tier 2: Race Condition Guards (only if Tier 1 + testing shows issues)

- Add `refreshGeneration`/`currentGeneration` fields
- Add generation capture in `refresh()`
- Add `this.refreshGeneration++` in `reset()`
- Wrap Promise callbacks with generation checks

##### Tier 3: PNG Fallback (last resort)

Full fork atlas diff switching from EGF to PNG loading. Only needed if EGF approach has fundamental issues.

**Full fork diff**: `git diff upstream/master backup/master-pre-reset -- src/atlas.ts`

#### `src/handlers/welcome.ts` — Equipment Fix + Black Tile Fix

Port these specific changes (adapt to upstream controller pattern):

1. **Equipment slot swap** (critical bug fix — paperdoll shows wrong items):
   ```typescript
   client.equipment.gloves = data.equipment.accessory;
   client.equipment.accessory = data.equipment.gloves;
   client.equipment.armor = data.equipment.belt;
   client.equipment.belt = data.equipment.armor;
   ```

2. **Black tile fix** — always force atlas rebuild:
   ```typescript
   client.atlas.mapId = -1; // Always force full rebuild — map data may differ from initial build
   ```
   This replaces the upstream's conditional `if (diffMap) { client.atlas.mapId = -1; }` logic.

3. **Usage tracking**: `client.usage = data.usage;` and `client.usageTicks = USAGE_TICKS;`

**Full fork diff**: `git diff upstream/master backup/master-pre-reset -- src/handlers/welcome.ts`

#### `src/sfx.ts` — Settings-Based Volume

```diff
+import { settings } from './settings';
+import { padWithZeros } from './utils';
-import { padWithZeros } from './utils/pad-with-zeros';

 export function playSfxById(id: SfxId, volume = 1.0) {
+  const sfxVolume = settings.getSfxVolume();
+  if (sfxVolume <= 0) return;
+  const finalVolume = volume * sfxVolume;
   // ... use finalVolume instead of volume
```

**Full fork diff**: `git diff upstream/master backup/master-pre-reset -- src/sfx.ts`

#### `src/render/effect.ts` — Import Path Fix
Change `'../utils/get-effect-metadata'` → `'../utils'` and `'../utils/random-range'` → `'../utils'`.
Check if upstream's utils barrel already exports these.

#### `src/chat-bubble.ts` — Null Assertion Fix
Line 36: `this.ctx! = this.canvas.getContext('2d')!;`
**Note**: Check if this is valid TS — may need to be `this.ctx = this.canvas.getContext('2d')!;` instead.

#### Type Files — Add Fork Additions
- `src/types/events.ts` — Add new event type definitions
- `src/types/ui.ts` — Add new UI element type definitions  
- `src/types/index.ts` — Add barrel exports for new types

**Full diffs**: `git diff upstream/master backup/master-pre-reset -- src/types/events.ts src/types/ui.ts src/types/index.ts`

#### Verify Phase 0
```bash
npx tsc --noEmit
npx @biomejs/biome check --write .
```

---

## Phase 1: Deployment Infrastructure

Copy directly from backup — all additive files:
```bash
git checkout backup/master-pre-reset -- \
  .dockerignore .env.deploy.example deploy.sh docker-compose.yml \
  entrypoint.sh nginx.conf AGENT.md ARCHITECTURE.md DEVELOPMENT.md \
  docs/PLAYER_COMMANDS.md scripts/extract_gfx021.py \
  bridge/bridge.js bridge/package.json bridge/package-lock.json \
  public/config.json .gitignore
```

For modified files, manually merge:
- `Dockerfile` — `git diff upstream/master backup/master-pre-reset -- Dockerfile`
- `.github/workflows/docker-publish.yml` — `git diff upstream/master backup/master-pre-reset -- .github/workflows/docker-publish.yml`
- `lefthook.yml` — add tsc typecheck step

---

## Phase 2: Core UI Infrastructure

```bash
git checkout backup/master-pre-reset -- \
  src/ui/info-dialog/info-dialog.ts \
  src/ui/info-dialog/info-dialog.css
```

Port `src/css/style.css` changes (feature dialog styles):
`git diff upstream/master backup/master-pre-reset -- src/css/style.css`

Port `index.html` — add all dialog HTML blocks:
`git diff upstream/master backup/master-pre-reset -- index.html`

---

## Phase 3: Feature Dialogs (one at a time, adapted to controller pattern)

For each feature:
1. Copy new handler/UI files from backup
2. **Update imports/calls to use upstream controller pattern** (`client.sessionController`, `client.mapController`, etc.)
3. Register handler in `src/handlers/index.ts`
4. Wire events in `src/wiring/ui-events.ts` and/or `client-events.ts`
5. Add initialization in `src/main.ts`
6. Add HTML to `index.html`

### Features:
1. **Book/Quest List**: `handlers/book.ts`, `ui/book/book.ts`, `ui/book/book.css`
2. **Barber**: `handlers/barber.ts`, `ui/barber-dialog/barber-dialog.ts`, `ui/barber-dialog/barber-dialog.css`
3. **Citizen/Inn**: `handlers/citizen.ts`, `ui/citizen-dialog/citizen-dialog.ts`, `ui/citizen-dialog/citizen-dialog.css`
4. **Trade**: `handlers/trade.ts`, `ui/trade-dialog/trade-dialog.ts`, `ui/trade-dialog/trade-dialog.css`
5. **Guild**: `handlers/guild.ts`, `ui/guild-dialog/`, `ui/guild-panel/`
6. **Settings Dialog**: `ui/settings-dialog/`
7. **Lookup Commands**: `handlers/lookup-commands.ts`
8. **Mobile HUD + Toolbar**: `ui/mobile-hud/`, `ui/mobile-toolbar/`
9. **Reconnect Overlay**: HTML + `handlers/connection.ts` changes

---

## Phase 4: Modified File Patches

Remaining changes to existing handler/UI files. For each, use:
```bash
git diff upstream/master backup/master-pre-reset -- <filepath>
```

Key files:
- `src/handlers/init.ts`, `talk.ts`, `music.ts`, `paperdoll.ts`
- `src/client.ts` — feature state vars (settings, ghost NPCs, usage)
- `src/main.ts` — dialog initialization wiring
- `src/wiring/ui-events.ts` + `client-events.ts` — feature event handlers
- `src/ui/hud/hud.ts`, `in-game-menu/in-game-menu.ts`, `chat/chat.ts`, `paperdoll/paperdoll.ts`
- Various other UI files — mostly minor import/feature changes

### UI Positioning Fixes (from backup)

These are visual fixes from the fork that must be ported:

1. **HP/TP/SP bar CSS** — CSS changes for the stat bars at the top of the screen
2. **Paperdoll text positioning** — CSS changes to move text labels to correct spots
3. **Right-hand side icon position swapping** — Icon layout corrections

---

## Phase 5: Verify & Push

```bash
npx tsc --noEmit          # zero errors
npx @biomejs/biome check --write .  # clean
git push --force-with-lease origin master
```

Then diff review: `git diff backup/master-pre-reset master` to confirm no features were lost.

---

## Reference Commands

```bash
# View any file from the backup
git show backup/master-pre-reset:<path>

# View diff for any file
git diff upstream/master backup/master-pre-reset -- <path>

# List all fork-specific additions (files only in fork)
git diff --name-status upstream/master backup/master-pre-reset | grep "^A"

# List all modified files
git diff --name-status upstream/master backup/master-pre-reset | grep "^M"
```

## Upstream Controller Names (for refactoring imports)

The upstream uses these controller names on `client`:
- `client.authController` — AuthenticationController
- `client.sessionController` — SessionController  
- `client.questController` — QuestController
- `client.statSkillController` — StatSkillController
- `client.mapController` — MapController
- `client.keyboardController` — KeyboardController (was movement-controller)
- `client.audioController` — AudioController
- `client.chatController` — ChatController
- `client.commandController` — CommandController
- `client.inventoryController` — InventoryController
- `client.movementController` — MovementController
- `client.npcController` — NpcController
- `client.shopController` — ShopController
- `client.socialController` — SocialController
- `client.bankController` — BankController
- `client.boardController` — BoardController
- `client.chestController` — ChestController
- `client.lockerController` — LockerController
- `client.spellController` — SpellController
- `client.animationController` — AnimationController
- `client.cleanupController` — CleanupController
- `client.drunkController` — DrunkController
- `client.itemProtectionController` — ItemProtectionController
- `client.mouseController` — MouseController
- `client.quakeController` — QuakeController
- `client.usageController` — UsageController
- `client.viewportController` — ViewportController

To see the full list: `grep -n "Controller" src/client.ts | head -40`
