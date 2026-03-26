# em-web-client Architecture & Patterns

## Project Overview

Browser-based client for Endless Online, built with TypeScript + Vite. Connects to game servers via a WebSocket bridge (`bridge/bridge.js`).

### Running Locally
```bash
npm run dev                                     # Vite dev server (port 8081)
node bridge/bridge.js 8081 game.endless-memories.net 8078  # WebSocket bridge
```

---

## Architecture

### Entry Point
- `src/main.ts` — instantiates `Client`, all UI components, and wires them together
- `index.html` — contains static HTML templates for all dialogs and UI components

### Core Layers

```
index.html (static HTML templates)
    ↓
src/main.ts (instantiation + wiring)
    ↓
src/client.ts (Client — state, event emitter, packet bus)
    ├── src/handlers/ (packet → client events)
    ├── src/wiring/client-events.ts (client events → UI methods)
    └── src/ui/ (UI components)
```

| Layer | Responsibility |
|---|---|
| **Handlers** (`src/handlers/`) | Deserialize server packets, update `Client` state, emit typed events |
| **Client Events** (`src/wiring/client-events.ts`) | Route client events to UI method calls |
| **UI Components** (`src/ui/`) | Render, manage DOM, send client packets |
| **Types** (`src/types/`) | Shared TypeScript interfaces and type definitions |

---

## Established Patterns

### 1. Static HTML Templates

All dialog structure MUST be defined as static HTML in `index.html`. Dynamic content is updated via `textContent`, `classList`, and targeted DOM manipulation — never by rebuilding entire subtrees of static elements.

```html
<!-- index.html -->
<div id="my-dialog" class="hidden">
  <div class="my-header">Title</div>
  <div class="my-body"></div>
  <div class="my-footer">
    <button class="my-btn" data-id="cancel">Cancel</button>
    <button class="my-btn primary" data-id="confirm">Confirm</button>
  </div>
</div>
```

### 2. Constructor Wiring

Static buttons are queried and wired **once** in the constructor. Never dynamically create buttons that could be static.

```typescript
constructor(client: Client) {
  super();
  this.client = client;

  // Wire static buttons once
  this.container
    .querySelector('[data-id="cancel"]')!
    .addEventListener('click', () => this.close());

  // Wire client events
  this.client.on('someEvent', (data) => this.handleEvent(data));
}
```

### 3. Safe DOM Creation

**Never use `innerHTML` with string interpolation.** This is an XSS risk and violates our architecture.

```typescript
// ❌ BAD — XSS risk
element.innerHTML = `<span class="name">${playerName}</span> wants to join.`;

// ✅ GOOD — safe DOM creation
const nameSpan = document.createElement('span');
nameSpan.className = 'name';
nameSpan.textContent = playerName;
element.appendChild(nameSpan);
element.appendChild(document.createTextNode(' wants to join.'));
```

`innerHTML` is acceptable only for static content with no interpolated values (e.g., `body.innerHTML = ''` to clear, or `innerHTML = '<div class="menu"></div>'`).

### 4. CSS Classes Over Inline Styles

All styling MUST use CSS classes. No `style.cssText`, no `style.color = ...` for things that can be a class.

```typescript
// ❌ BAD
element.style.cssText = 'padding: 8px 0;';
textarea.style.resize = 'vertical';

// ✅ GOOD
element.className = 'my-list-container'; // styled in CSS
// CSS: textarea.my-input { resize: vertical; }
```

**Exception**: Dynamic values that truly vary at runtime (e.g., `style.width = \`${percent}%\`\` for progress bars, `style.top` for scroll thumb positioning).

### 5. Handler Pattern

Handlers live in `src/handlers/` and follow a consistent structure:

```typescript
function handleSomethingOpen(client: Client, reader: EoReader) {
  const packet = SomePacket.deserialize(reader);
  client.emit('somethingOpened', { /* typed payload */ });
}

export function registerSomethingHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PacketFamily.Something,
    PacketAction.Open,
    (reader) => handleSomethingOpen(client, reader),
  );
}
```

Register in `src/handlers/index.ts`.

### 6. Self-Wiring Dialogs

Some dialogs (e.g., `GuildDialog`) wire all their own client events in the constructor and don't need entries in `client-events.ts`. When instantiating these:

```typescript
// No variable assignment needed — dialog self-wires via client events
new GuildDialog(client);
```

---

## Coding Standards

### Variable Naming

- **No abbreviations.** All variable, parameter, and method names must be fully spelled out.
- Use `camelCase` for variables and methods, `PascalCase` for classes and types.

| ❌ Avoid | ✅ Use Instead |
|---|---|
| `btn`, `btnOk` | `button`, `okButton` |
| `el`, `nameEl` | `element`, `nameDisplay` |
| `txt`, `txtName` | `text`, `nameDisplay` |
| `msg` | `message` |
| `desc` | `description` |
| `img` | `image` |
| `ctx` | `context` |
| `pct` | `percent` |
| `amt` | `amount` |
| `num` | `count` (or similar) |
| `ing` | `ingredient` |
| `min`/`max` + `Amt` | `minimumAmount`/`maximumAmount` |

### Perspective Naming

Use `local*` instead of `your*` for the local player's perspective:
- `localPlayerId` not `yourPlayerId`

### Import Organization

- All imports at the top of the file (never mid-file or at the bottom)
- Biome handles import sorting automatically

### CSS Organization

- Each UI component has its own `.css` file imported by the `.ts` file
- Use component-scoped class names (e.g., `.guild-btn`, `.trade-item`)
- No duplicate style definitions across components

---

## Feature Branch Workflow (Upstream PRs)

When preparing a feature for upstream PR:

1. Create a feature branch off `upstream/master`:
   ```bash
   git checkout -b feature/my-feature upstream/master
   ```
2. Cherry-pick or checkout the feature files from `master`:
   ```bash
   git checkout master -- src/handlers/my-feature.ts src/ui/my-feature/
   ```
3. Patch shared files (`handlers/index.ts`, `main.ts`, `client-events.ts`, `index.html`) manually
4. Verify: `npx tsc --noEmit` + `npx @biomejs/biome check --write .`
5. Commit, push, create PR targeting `sorokya/eoweb:master`

Each feature branch must be standalone — no dependencies on other feature PRs.
