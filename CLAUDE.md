# eoweb — Endless Online Web Client

Browser-based client for Endless Online (protocol 0.0.28). TypeScript + Vite + Canvas 2D rendering.

## Companion Server: etheos

The game server lives at `../etheos/` (C++17, forked from EOSERV). These repos are tightly coupled — they share the EO 0.0.28 packet protocol.

**When to reference the server:**
- **Implementing any packet handler**: Check the server-side handler first (`../etheos/src/handlers/<Family>.cpp`) to understand what data is sent, field ordering, and edge cases
- **Adding a new feature**: The server may already support it — check before assuming server changes are needed
- **Debugging protocol issues**: Compare client-side deserialization with server-side serialization
- **Understanding game mechanics**: Server logic is the source of truth for formulas, limits, and rules

**Key server locations:**
| What | Where |
|------|-------|
| Packet handlers | `../etheos/src/handlers/` (one file per packet family) |
| Project knowledge | `../etheos/docs/project_knowledge.md` (critical context — config offsets, packet ordering, etc.) |
| NPC logic | `../etheos/src/npc.cpp`, `npc_data.cpp` |
| Map logic | `../etheos/src/map.cpp` |
| Quest system | `../etheos/src/quest.cpp` |
| Config definitions | `../etheos/src/eoserv_config.cpp` |
| Game data | `../etheos/data/` (pubs, maps) |

**Handler correspondence:** Client `src/handlers/attack.ts` ↔ Server `src/handlers/Attack.cpp`, etc. The naming maps 1:1 by packet family.

## Commands

```bash
pnpm dev              # Vite dev server
pnpm build            # TypeScript + Vite production build
pnpm lint             # Biome check
pnpm format           # Biome check --write (auto-format)
pnpm find-dead-code   # ts-prune (unused exports)
```

Pre-commit hook (lefthook) runs Biome check on staged files.

## Architecture

```
main.ts          Entry point — UI init, event wiring, game loop (120 tick/s fixed timestep)
client.ts        Central state container + thin method delegates to managers
bus.ts           PacketBus — WebSocket packet send/receive via eolib
map.ts           Isometric MapRenderer (layered depth-sorted canvas)
```

### Layers

| Layer | Location | Role |
|-------|----------|------|
| **Handlers** | `src/handlers/` | Deserialize packets → update Client state → emit events |
| **Managers** | `src/managers/` | Business logic functions; `Client` delegates to these |
| **Wiring** | `src/wiring/` | Binds Client events → UI (`client-events.ts`) and UI events → Client (`ui-events.ts`) |
| **UI** | `src/ui/` | DOM components extending `Base` or `BaseDialogMd`, each with own CSS |
| **Render** | `src/render/` | Canvas animation classes (walk, attack, spell, effects, health bars) |
| **Types** | `src/types/` | Pure types, enums, event definitions |

### Data flow

```
Server → PacketBus → Handler → Client state update → emit event → Wiring → UI update
User input → UI emits event → Wiring → Client method → Manager function → PacketBus → Server
```

## Key Patterns

### Event bus (mitt)

```typescript
// Emitting (in handlers/managers)
client.emit('inventoryChanged', undefined);

// Listening (in wiring)
client.on('inventoryChanged', () => inventory.renderOnly());
```

Event types defined in `src/types/events.ts`.

### Manager functions

Standalone functions receiving `client` as first param. Exported via `src/managers/index.ts` barrel.

```typescript
// managers/my-manager.ts
export function doSomething(client: Client, param: Type): void { ... }

// client.ts delegates
doSomething(param: Type) { Managers.doSomething(this, param); }
```

### UI components

Each in `src/ui/<name>/` with its own `.ts` and `.css`. Extend `Base` (panels) or `BaseDialogMd` (modal dialogs). Use `mitt` emitter for component events. Show/hide via CSS classes.

### Handlers

One file per packet family in `src/handlers/`. Registered in `handlers/index.ts` via `registerAllHandlers(client)`. Pattern: `handleXyzReply(client, reader)`.

## Conventions

- **Barrel exports**: Every directory has `index.ts` — import from the directory, not individual files
- **Naming**: PascalCase classes, camelCase functions/events, `handleXyzReply` for handlers
- **No abbreviations** (going-forward): Spell out all names in new code (`button` not `btn`, `element` not `el`, `message` not `msg`, `amount` not `amt`). Legacy code still uses `btn*`, `el`, `ctx`, `msg` — don't rename these when editing nearby code, but use full names for anything new
- **Perspective naming**: Use `local*` for the local player (`localPlayerId` not `yourPlayerId`)
- **CSS**: Component-scoped class names, each component has own `.css` file. Global styles in `src/css/`
- **State**: All mutable game state lives on `Client` — no separate stores
- **Formatting**: Biome with space indentation; enforced by pre-commit hook

## DOM Rules

- **Static HTML templates**: All dialog structure is defined in `index.html`. Dynamic content updated via `textContent`, `classList`, targeted DOM manipulation — never rebuilding static subtrees
- **Constructor wiring**: Static buttons queried and wired once in constructor, not dynamically created
- **No `innerHTML` with interpolation** (XSS risk). Use `document.createElement` + `textContent` for dynamic values. `innerHTML` only acceptable for static content with no interpolated values
- **CSS classes over inline styles**: No `style.cssText` or `style.color`. Exception: truly dynamic runtime values (progress bar widths, scroll positions)

## Feature Development Workflow

When the user requests a new feature or significant change:

1. **Plan first, code later**: Before writing any implementation code, create a written implementation plan as a markdown file at `plans/<feature-name>.md`. This artifact persists so the user can reference it across sessions.
2. **Create a task list**: Break the plan into discrete tasks using `TaskCreate`. Each task should map to a step in the plan.
3. **Keep both in sync**: As work progresses, update tasks (`TaskUpdate`) to reflect current status. If the plan changes during implementation (scope change, new discovery, revised approach), edit the plan file to match reality.
4. **Plan file format**: Include a summary, list of files to create/modify, implementation steps, and any open questions. Update the plan with decisions made and steps completed.

This workflow is mandatory for all feature work — do not skip straight to coding.

## Project Memory Bank

Proactively save memories during every working session. Don't wait to be asked — capture knowledge as it emerges. The memory index lives at `.claude/projects/.../memory/MEMORY.md`.

**What to capture (save as `project` type memories):**
- **Architectural decisions** — what was chosen and *why* (e.g., "used mitt events instead of direct coupling because...")
- **Critical findings** — non-obvious behaviors, gotchas, or constraints discovered during implementation
- **What didn't work** — failed approaches and why, so we don't repeat them
- **Design trade-offs** — alternatives considered and reasoning for the choice made
- **Integration notes** — how features interact, ordering dependencies, side effects discovered

**What to capture (save as `feedback` type memories):**
- Corrections to approach or style preferences expressed during the session
- Validated approaches that worked well

**When to save:**
- After completing a feature or significant implementation step
- When a non-obvious decision is made or a surprising constraint is discovered
- When something fails and the root cause is identified
- When the user confirms or corrects an approach

**Naming convention:** `project_<topic>.md` or `feedback_<topic>.md` in the memory directory. Keep `MEMORY.md` index updated with every new or removed memory.

## Feature Branch Workflow (Upstream PRs)

1. Branch off `upstream/master`: `git checkout -b feature/my-feature upstream/master`
2. Cherry-pick or checkout feature files from `master`
3. Patch shared files (`handlers/index.ts`, `main.ts`, `client-events.ts`, `index.html`) manually
4. Verify: `npx tsc --noEmit` + `npx @biomejs/biome check --write .`
5. Each feature branch must be standalone — no dependencies on other feature PRs
