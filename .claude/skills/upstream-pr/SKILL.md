---
name: upstream-pr
description: Create a feature branch for an upstream PR to sorokya/eoweb
disable-model-invocation: true
---

# Upstream PR

Create a standalone feature branch off `upstream/master` for submitting a PR to `sorokya/eoweb`.

## Arguments

- **feature**: Feature name for the branch (e.g., `guild-dialog`, `auto-battle`)
- **files**: Source files/directories to include from local `master`

## Steps

### 1. Fetch upstream and create branch

```bash
git fetch upstream
git checkout -b feature/<feature> upstream/master
```

### 2. Cherry-pick feature files from local master

```bash
git checkout master -- <files>
```

Typically includes:
- `src/handlers/<feature>.ts` — packet handler
- `src/ui/<feature>/` — UI component directory
- `src/types/` changes — if new event types were added
- `src/managers/<feature>.ts` — if new manager functions were added
- `src/render/<feature>.ts` — if new render classes were added

### 3. Manually patch shared integration files

These files aggregate feature code and can't be cleanly cherry-picked. Edit each one to add only the lines needed for this feature:

| File | What to add |
|------|-------------|
| `src/handlers/index.ts` | Import and register call for the new handler |
| `src/main.ts` | Import, instantiation, and wiring call for new UI components |
| `src/wiring/client-events.ts` | Interface entry and event listeners for the new dialog |
| `src/wiring/ui-events.ts` | Interface entry and event listeners (if dialog emits back to client) |
| `index.html` | HTML template for new dialogs |

### 4. Verify the branch compiles and lints cleanly

```bash
npx tsc --noEmit
npx @biomejs/biome check --write .
```

Fix any type errors — the branch must be standalone with no dependencies on other feature branches.

### 5. Commit and push

```bash
git add -A
git commit -m "feat: <description>"
git push origin feature/<feature>
```

### 6. Create PR

Create a PR targeting `sorokya/eoweb:master` using `gh pr create`.

## Important

- Each feature branch must be **standalone** — no dependencies on other feature PRs
- Only include code relevant to this specific feature
- The branch is based on `upstream/master`, not local `master`
