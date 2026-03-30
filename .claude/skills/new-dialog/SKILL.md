---
name: new-dialog
description: Scaffold a new UI dialog (HTML template, TS class, CSS, barrel export, wiring)
---

# New UI Dialog

Scaffold a new UI dialog component. This touches multiple files — follow each step.

## Arguments

- **name**: Dialog name in kebab-case (e.g., `chest-dialog`, `trade-dialog`)
- **id**: HTML element ID (e.g., `chest`, `trade`)
- **label**: Dialog title text (e.g., `"Chest"`, `"Trade"`)
- **self-wiring**: Whether the dialog wires its own client events (default: false)

## Steps

### 1. Add HTML template to `index.html`

Add inside the `#dialogs` container. Dialog starts hidden:

```html
<div id="<id>" class="hidden">
  <div class="dialog-contents"></div>
  <button class="themed-btn" type="button" data-id="cancel">Cancel</button>
</div>
```

For `BaseDialogMd` dialogs, include a `<span>` for the label — the base class manages it.

### 2. Create component directory and files

Create `src/ui/<name>/` with three files:

**`src/ui/<name>/<name>.ts`:**

```typescript
import mitt from 'mitt';

import type { Client } from '../../client';
import { BaseDialogMd } from '../base-dialog-md';

import './<name>.css';

type Events = {
  // Define dialog-specific events here
};

export class <ClassName> extends BaseDialogMd<Events> {
  constructor(client: Client) {
    super(client, document.getElementById('<id>')! as HTMLDivElement, '<label>');

    // Wire static buttons once in constructor
    // Wire client events here if self-wiring
  }

  on<Event extends keyof Events>(
    event: Event,
    handler: (data: Events[Event]) => void,
  ) {
    this.emitter.on(event, handler);
  }

  render() {
    this.dialogContents.innerHTML = '';
    // Build dialog content using document.createElement
    // NEVER use innerHTML with interpolated values
  }
}
```

For simpler dialogs without a label bar, extend `Base` instead of `BaseDialogMd`.

**`src/ui/<name>/<name>.css`:**

```css
#<id> {
  /* Dialog container styles */
}

#<id> .dialog-contents {
  /* Content area styles */
}
```

Scope all selectors under `#<id>`. Use CSS classes, not inline styles.

**`src/ui/<name>/index.ts`:**

```typescript
export * from './<name>';
```

### 3. Instantiate in `src/main.ts`

Add the import and instantiation in the UI component section:

```typescript
import { <ClassName> } from './ui/<name>';

const <instanceName> = new <ClassName>(client);
```

### 4. Wire events

**If NOT self-wiring**, add to both wiring files:

In `src/wiring/client-events.ts`:
- Add to the `ClientEventDeps` interface with the dialog's public method signatures
- Add `client.on(...)` listeners that call dialog methods (show, hide, update data)

In `src/main.ts`:
- Pass the instance to `wireClientEvents({ ..., <instanceName> })`

In `src/wiring/ui-events.ts` (if dialog emits events back to client):
- Add to the `UiEventDeps` interface
- Add listeners for dialog events that call client methods
- Pass the instance to `wireUiEvents({ ..., <instanceName> })`

**If self-wiring**, the dialog handles its own `client.on(...)` calls in the constructor — no wiring file changes needed. Just instantiate with `new <ClassName>(client)` in main.ts (no variable assignment needed if nothing else references it).

### 5. Make draggable (optional)

Add the element ID to the `initDraggableDialogs([...])` call in `src/main.ts`.

### 6. Verify

```bash
npx tsc --noEmit
```
