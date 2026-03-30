---
name: review
description: Review recent changes against project conventions, architecture, and code quality standards
---

# eoweb Code Reviewer

Review all changed files against the project's conventions and architectural patterns. Focus on real issues — don't flag nitpicks or style issues that Biome already catches.

## Process

### 1. Identify what changed

Run `git diff HEAD` (or `git diff --cached` if staged) to see all modifications. Also check `git status` for new untracked files.

### 2. Run automated checks first

```bash
npx tsc --noEmit 2>&1 | head -50
npx @biomejs/biome check . 2>&1 | head -50
```

Report any type errors or lint failures before proceeding to manual review.

### 3. Review each changed file against these rules

#### Architecture violations

- **Layer boundaries**: Handlers should only deserialize packets, update Client state, and emit events — no UI manipulation. UI components should never send packets directly — they emit events that wiring connects to Client methods.
- **Data flow**: `Server → Handler → Client → emit → Wiring → UI` and `UI → emit → Wiring → Client → Manager → PacketBus`. Flag any shortcuts.
- **State ownership**: All mutable game state must live on `Client`. No separate stores, no state in UI components beyond DOM references.
- **Manager pattern**: Business logic belongs in manager functions (`src/managers/`), not in Client methods directly. Client methods should be thin delegates: `doThing(param) { Managers.doThing(this, param); }`

#### DOM rules

- **No `innerHTML` with interpolated values** — this is an XSS risk. Only acceptable for static content with no variables. Dynamic content must use `document.createElement` + `textContent`.
- **Static HTML templates**: Dialog structure should be in `index.html`, not built entirely in JS. Dynamic content updates via `textContent`, `classList`, targeted manipulation.
- **Constructor wiring**: Static buttons should be queried and wired once in the constructor, not recreated on each render.
- **CSS classes over inline styles**: Flag any `style.cssText`, `style.color`, `style.display` etc. Exception: truly dynamic runtime values (progress bar widths, scroll thumb positions, canvas coordinates).

#### Naming conventions (new code only)

- **No abbreviations in new code**: `button` not `btn`, `element` not `el`, `message` not `msg`, `amount` not `amt`, `description` not `desc`. Do NOT flag abbreviations in unchanged legacy code.
- **Perspective naming**: `local*` for the local player, not `your*` or `my*`.
- **Handler functions**: `handle<Family><Action>` pattern (private), `register<Family>Handlers` (exported).
- **PascalCase** classes, **camelCase** functions/events/variables.

#### Integration checklist (for new features)

If new handlers, dialogs, or managers were added, verify:

- [ ] Handler registered in `src/handlers/index.ts` via `registerAllHandlers`
- [ ] Manager functions exported via `src/managers/index.ts` barrel
- [ ] New UI component has barrel export (`index.ts`)
- [ ] New dialog has HTML template in `index.html`
- [ ] New dialog instantiated in `src/main.ts`
- [ ] Events wired in `src/wiring/client-events.ts` and/or `src/wiring/ui-events.ts` (unless self-wiring)
- [ ] New event types added to `src/types/events.ts`
- [ ] Client delegate method added if new manager function exists
- [ ] Draggable registration if dialog should be movable

#### Import conventions

- **Barrel imports**: Import from the directory (`'../managers'`), not individual files (`'../managers/movement-manager'`).
- **Type-only imports**: Use `import type` for types that aren't used as values.

### 4. Output format

Organize findings by severity:

**Errors** — Must fix before committing:
- Type errors, lint failures
- XSS risks (innerHTML with interpolation)
- Architecture violations (wrong layer, broken data flow)
- Missing integration points (unregistered handler, unwired dialog)

**Warnings** — Should fix:
- Convention violations in new code
- Missing barrel exports
- Inline styles that should be CSS classes

**Notes** — Consider:
- Suggestions for improvement that don't violate any rules

For each finding, include:
- File path and line number
- What the issue is
- What it should be instead

If everything looks good, say so — don't invent issues.
