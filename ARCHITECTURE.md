# Architecture & Code Organization

This document describes the code organization conventions for the `em-web-client` project.

---

## Directory Structure

```
src/
├── client.ts              # Client class — game state + thin method delegates
├── main.ts                # Entry point — orchestrates UI + wiring
├── types/                 # Pure types, interfaces, and enum re-exports
│   ├── index.ts           # Barrel — all types importable from './types'
│   ├── account.ts         # AccountCreateData, CharacterCreateData
│   ├── config.ts          # IConfig
│   ├── equipment.ts       # EquipmentSlot enum + helpers
│   ├── events.ts          # ClientEvents type
│   ├── game.ts            # GameState, SpellTarget, PlayerMenuItem enums
│   ├── metadata.ts        # Weapon/NPC/Effect metadata interfaces
│   ├── render.ts          # IVector2
│   └── ...                # Other type re-exports (sfx, chat, gfx, input, ui)
├── managers/              # Extracted business logic (function delegates)
│   ├── index.ts           # Barrel
│   ├── tick-manager.ts    # Game tick logic (animations, cooldowns, effects)
│   ├── input-manager.ts   # Click handling, cursor logic
│   ├── map-manager.ts     # Pathfinding, doors, map tile queries
│   ├── auth-manager.ts    # Login, character select, warp, file requests
│   ├── audio-manager.ts   # Ambient sound, music
│   ├── npc-interaction-manager.ts
│   ├── chat-manager.ts    # Chat message processing
│   ├── combat-manager.ts  # Spell casting, hotbar
│   └── ...
├── handlers/              # Packet handlers (one per protocol family)
│   ├── index.ts           # Barrel — registers all handlers
│   └── *.ts               # e.g. talk.ts, walk.ts, init.ts
├── wiring/                # Event wiring — connects UI to Client
│   ├── client-events.ts   # Client → UI event bindings
│   └── ui-events.ts       # UI → Client event bindings
├── render/                # Rendering logic (character sprites, effects)
│   └── index.ts           # Barrel
├── utils/                 # Shared utility functions
│   └── index.ts           # Barrel
├── ui/                    # UI components (each in own folder)
│   ├── utils/             # UI-specific utilities
│   │   └── index.ts       # Barrel
│   ├── inventory/
│   ├── paperdoll/
│   └── ...
└── ...
```

---

## Conventions

### Barrel Files (Index Exports)

Every directory with multiple modules has an `index.ts` barrel file that re-exports all public symbols. **Always import from the barrel, not from sub-paths.**

```typescript
// ✅ Good
import { capitalize, getItemMeta } from '../utils';
import { createIconMenuItem } from '../utils';

// ❌ Bad
import { capitalize } from '../utils/capitalize';
import { getItemMeta } from '../utils/get-item-meta';
```

When adding a new file to a directory, **add its exports to the barrel**.

### Types & Enums

- **Enums** stay in their implementation files alongside the runtime code that uses them (e.g., `SfxId` stays in `sfx.ts` next to `playSfxById`)
- **Pure types and interfaces** go in `src/types/`
- The `src/types/` barrel re-exports enums from implementation files for convenience, but **does not define duplicate enums**
- Consumers should import types from wherever is natural for their use case — if they need `playSfxById` from `sfx.ts`, importing `SfxId` from the same file is preferred

### Manager Pattern (Function Delegates)

Business logic is extracted from `Client` into standalone functions in `src/managers/`:

```typescript
// In managers/map-manager.ts
export function canWalk(client: Client, coords: Vector2, silent = false): boolean { ... }

// In client.ts — thin delegate
canWalk(coords: Vector2, silent = false): boolean {
  return MapManager.canWalk(this, coords, silent);
}
```

The `Client` class acts as a **state container + thin facade** — methods delegate to manager functions that receive `client` as their first argument.

### Wiring Modules

`src/wiring/` contains event binding code extracted from `main.ts`:
- `client-events.ts` — binds Client events to UI updates
- `ui-events.ts` — binds UI interactions to Client actions

### Packet Handlers

Each file in `src/handlers/` handles one protocol packet family. Handlers register via:
```typescript
export function registerTalkHandlers(client: Client) {
  client.bus.on('Talk_Player', (reader) => handleTalkPlayer(client, reader));
}
```

All handlers are registered through the `handlers/index.ts` barrel.

### UI Components

Each UI component lives in `src/ui/<name>/` with:
- `<name>.ts` — component class (extends `Base` or `BaseDialogMd`)
- `<name>.css` — scoped styles

---

## Pre-Commit Checks

Always run before committing:

```bash
pnpm format   # Biome formatter
pnpm lint     # Biome linter
pnpm build    # TypeScript + Vite build
```
