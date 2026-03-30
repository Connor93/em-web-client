---
name: new-handler
description: Scaffold a new packet handler (handler file, registration, barrel export)
---

# New Packet Handler

Scaffold a new packet handler for a given protocol family.

## Arguments

- **family**: The PacketFamily name (e.g., `Chest`, `Door`, `Guild`)
- **actions**: The PacketAction(s) to handle (e.g., `Open`, `Reply`, `Agree`)

## Steps

### 1. Create handler file

Create `src/handlers/<family>.ts` (kebab-case for multi-word names like `admin-interact.ts`).

Follow this exact pattern:

```typescript
import {
  <Family><Action>ServerPacket,
  type EoReader,
  PacketAction,
  PacketFamily,
} from 'eolib';

import type { Client } from '../client';

function handle<Family><Action>(client: Client, reader: EoReader) {
  const packet = <Family><Action>ServerPacket.deserialize(reader);
  // TODO: Update client state and emit events
  // client.emit('<eventName>', payload);
}

export function register<Family>Handlers(client: Client) {
  client.bus.registerPacketHandler(
    PacketFamily.<Family>,
    PacketAction.<Action>,
    (reader) => handle<Family><Action>(client, reader),
  );
}
```

Notes:
- Private handler functions: `handle<Family><Action>` (not exported)
- One exported registration function per file: `register<Family>Handlers`
- Multiple actions in the same family go in the same file with separate handler functions
- Import only the specific server packets needed from `eolib`

### 2. Register in `src/handlers/index.ts`

Add the import and call in `registerAllHandlers`:

```typescript
import { register<Family>Handlers } from './<family-file>';

// In registerAllHandlers():
register<Family>Handlers(client);
```

Also add to the named exports at the top of the file.

### 3. Add client events (if needed)

If the handler emits new events, add the event types to `src/types/events.ts` in the `ClientEvents` type.

### 4. Verify

```bash
npx tsc --noEmit
```
