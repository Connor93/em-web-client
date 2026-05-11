# Wedding / Marriage Flow

## Summary

The web client currently sends `MarriageOpenClientPacket` and `PriestOpenClientPacket` when the user clicks a Lawyer/Priest NPC, but no handlers exist for the corresponding server replies and no UI is wired in. The whole marriage feature is therefore dead. The server-side code (`etheos/src/handlers/Marriage.cpp`, `Priest.cpp`, `wedding.cpp`) is fully functional and matches the OG client. We need to add the client packet handlers and dialog UIs.

Server NPCs on Calamity:
- **Law Bob** (NPC id 115, type `ENF::Law` / `Lawyer`) — registers a fiancé and handles divorce.
- **Priest** (NPC id 114, type `ENF::Priest`) — performs the ceremony.

## Protocol summary

### Marriage family (Lawyer)

**Outbound (already wired in `npc-interaction-manager.ts`):**
- `MarriageOpenClientPacket { npcIndex }` — sent on click.

**Inbound (new):**
- `MarriageOpenServerPacket { sessionId }` — server response. The "sessionId" field actually carries `npc->id` (NPC database id); we just need to store it as `client.sessionId` so the request packet can echo it.
- `MarriageReplyServerPacket { replyCode, replyCodeData }`
  - `MarriageReply.AlreadyMarried` (1)
  - `MarriageReply.NotMarried` (2)
  - `MarriageReply.Success` (3) — `replyCodeData.goldAmount` carries new gold balance
  - `MarriageReply.NotEnoughGold` (4)
  - `MarriageReply.WrongName` (5)
  - `MarriageReply.ServiceBusy` (6)
  - `MarriageReply.DivorceNotification` (7) — sent to the partner of the divorcing player

**Outbound (new send-side):**
- `MarriageRequestClientPacket { requestType, sessionId, name }`
  - `MarriageRequestType.MarriageApproval` (1) — register fiancé named `name`. Costs `MarriagePrice` gold.
  - `MarriageRequestType.Divorce` (2) — divorce partner named `name`. Costs `DivorcePrice` gold.

### Priest family (Priest NPC)

**Outbound (already wired):**
- `PriestOpenClientPacket { npcIndex }`

**Inbound (new):**
- `PriestOpenServerPacket { sessionId }` — server response (only sent if no wedding is in progress and the player has a fiancé, no partner yet).
- `PriestReplyServerPacket { replyCode }`
  - `PriestReply.NotDressed` (1)
  - `PriestReply.LowLevel` (2)
  - `PriestReply.PartnerNotPresent` (3)
  - `PriestReply.PartnerNotDressed` (4)
  - `PriestReply.Busy` (5)
  - `PriestReply.DoYou` (6) — prompt this partner with "I do" button
  - `PriestReply.PartnerAlreadyMarried` (7)
  - `PriestReply.NoPermission` (8)
- `PriestRequestServerPacket { sessionId, partnerName }` — sent to partner: "X wants to marry you" prompt. Accepting sends `PriestAcceptClientPacket`.

**Outbound (new send-side):**
- `PriestRequestClientPacket { sessionId, name }` — partner1 requests wedding with `name` (their fiancé) at the priest.
- `PriestAcceptClientPacket { sessionId }` — partner2 accepts the wedding request from partner1.
- `PriestUseClientPacket { sessionId }` — say "I do" when prompted.

### Ceremony state machine (server side, for awareness)

After both partners are present and accepted, the priest broadcasts narration via NPC `Talk` packets (existing `talk` handler renders these). Each partner gets a `PriestReply.DoYou` prompt at the right state, responds with `PriestUseClientPacket`. Server hands out wedding rings via `Item.Get` and effects via existing handlers — no client work needed beyond the prompts.

## Files to create

1. `src/handlers/marriage.ts` — handles `Marriage.Open` and `Marriage.Reply` server packets.
2. `src/handlers/priest.ts` — handles `Priest.Open`, `Priest.Reply`, `Priest.Request`.
3. `src/ui/marriage-dialog/marriage-dialog.ts` + `.css` — Law Bob dialog (Register Fiancé / Divorce / Close).
4. `src/ui/priest-dialog/priest-dialog.ts` + `.css` — Priest dialog (Marry partner) and the "I do" / "X wants to marry you" prompts (small modal sub-views).

## Files to modify

1. `src/types/events.ts` — add events: `marriageOpened`, `marriageReply`, `priestOpened`, `priestReply`, `priestPartnerRequest`.
2. `src/handlers/index.ts` — register the two new handler bundles.
3. `src/main.ts` — instantiate the two dialogs and pass them to wiring deps.
4. `src/wiring/client-events.ts` — connect events to dialog methods. Add `MarriageDialog` / `PriestDialog` deps shape.
5. `index.html` — add `<div id="marriage-dialog">` and `<div id="priest-dialog">` static templates.

## Implementation plan

### Step 1 — Handlers
- `marriage.ts`: store `sessionId` on `Marriage.Open`, emit `marriageOpened`. On `Marriage.Reply`, update gold on success, emit `marriageReply` with the code (and partner-divorce notification).
- `priest.ts`: store `sessionId` on `Priest.Open`, emit `priestOpened`. On `Priest.Reply`, emit `priestReply` (the `DoYou` code triggers the I-Do confirmation; other codes are status messages). On `Priest.Request`, emit `priestPartnerRequest` with the requesting partner's name.

### Step 2 — Marriage dialog
- Header: "Lawyer". Body has two buttons:
  - **Register Fiancé** → input partner name → Submit sends `MarriageRequest(MarriageApproval, name)`.
  - **Divorce** → input partner name → Submit sends `MarriageRequest(Divorce, name)`.
- On `marriageReply`, update body to a status message ("You are now engaged!", "You don't have enough gold", etc.) with an OK button to return to menu / close.
- Success path: replenish gold from `replyCodeData.goldAmount` (already done in handler) + `inventoryChanged` event.

### Step 3 — Priest dialog
- Header: "Priest". Body shows a single field: "Partner's name" (defaults blank — server validates against the player's own `fiance` value). Submit sends `PriestRequestClientPacket`.
- On `priestReply`:
  - `DoYou` → swap to a "Do you take X to be your wife/husband?" sub-view with an **I Do!** button → sends `PriestUseClientPacket`.
  - Other codes → status message with OK.
- Partner notification (`priestPartnerRequest`): show a separate confirmation toast/dialog with Accept / Decline buttons. Accept sends `PriestAcceptClientPacket`. Decline just closes (server has no decline packet).

### Step 4 — Wiring
- Add deps shape entries for `marriageDialog` and `priestDialog`.
- Register listeners for the four new events.
- `marriageOpened` → show marriage dialog.
- `priestOpened` → show priest dialog.
- `priestReply` → forward to priest dialog state machine.
- `priestPartnerRequest` → show priest's partner-request prompt.
- `marriageReply` → forward to marriage dialog status view.

### Step 5 — Verify
- `pnpm tsc --noEmit`
- `pnpm lint`
- Manual smoke test in dev: walk to Law Bob (NPC 115) on the appropriate map, verify dialog opens, attempt to register fiancé without partner — should see "Already married" or "Wrong name" message; attempt with proper flow on test server.

## Open questions

- Server map config requires the priest map to have a `Wedding` registered (`map->wedding`). If the test map isn't configured, the priest dialog will show but `Priest.Open` won't return — that's a server-data issue, not client-side. Document this if encountered.
- `PriestReply.LowLevel` returns a `char` in one branch in `Priest.cpp` (line 184–187 sets ID without size parameter). eolib may decode it as a 2-byte short. We'll handle whatever eolib gives us — if there's a deserialize error in practice, we can defensively guard.

## Out of scope

- Editing the inventory/paperdoll to ensure the wedding outfit is equipped — server enforces this and surfaces `NotDressed` / `PartnerNotDressed` reply codes which we just display.
- Wedding music / effects / ring inventory — all driven by existing Jukebox / Effect / Item.Get handlers.
