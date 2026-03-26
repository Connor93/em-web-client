# Player Command & Feature Gap Analysis

Comparison of Etheos server capabilities vs web client support.
Last updated: 2026-03-24

## How Player Commands Work

Commands prefixed with `#` have two processing paths:

1. **Client-side** — Handled in `command-manager.ts` before being sent to the server.
2. **Server-side** — If the client doesn't consume it, the message is sent as chat. The server's `playercommands.cpp` intercepts and runs the handler.

Most server-side commands reply with standard `ServerMsg`/`StatusMsg` packets and work without client changes. Some trigger specialized packets that need dedicated client handling.

---

## Server Player Commands (`playercommands.cpp`)

| Command | Aliases | Description | Client Support |
|---------|---------|-------------|---------------|
| `#help` | `#?` | Lists available commands | ✅ Works (ServerMsg) |
| `#clearquest` | `#cq` | Remove quest from active list | ✅ Works (ServerMsg) |
| `#broadcasting` | `#bc` | Broadcast message (costs ticket) | ⚠️ Needs announce packet handling |
| `#trade` | — | Cross-map trade request | ❌ No trade handler |
| `#add` | `#update` | Bulk-add stat points | ✅ Works (stat update packets) |
| `#hide` | — | Hide equipment / toggle dialog | ⚠️ Dialog needs quest link handling |
| `#show` | — | Show equipment / toggle dialog | ⚠️ Dialog needs quest link handling |
| `#guild` | — | Guild hub + subcommands | ⚠️ Partial (see below) |
| `#ach` | — | View achievement progress | ✅ Works (ServerMsg) |

### `#guild` Subcommands

| Subcommand | Description | Client Support |
|------------|-------------|---------------|
| *(none)* | Opens guild hub dialog | ⚠️ Needs quest dialog link handling |
| `bounty` | View daily guild bounties | ✅ Works (Message_Accept) |
| `points` | View guild points & level | ✅ Works (Message_Accept) |
| `info` | Detailed guild info | ✅ Works (Message_Accept) |
| `top` / `leaderboard` | Top 10 guilds | ✅ Works (Message_Accept) |
| `storage` | Open guild storage | ⚠️ Uses Locker_Open — verify remote |
| `warp` / `teleport` | Teleport to guild member | ⚠️ Dialog link interaction |
| `board` | View request board | ⚠️ Dialog link interaction |
| `post` | Post board request | ✅ Works (StatusMsg) |
| `accept` | Accept board request | ✅ Works (StatusMsg) |
| `deliver` | Deliver items for request | ✅ Works (StatusMsg) |
| `cancel` | Cancel board request | ✅ Works (StatusMsg) |
| `buffs` | View/toggle guild buffs | ✅ Works (StatusMsg) |
| `donate` | Donate gold for guild points | ⚠️ Sends Item_Junk packet |
| `upgrade` | Unlock a guild perk | ✅ Works (StatusMsg) |
| `inbox` | Open delivery inbox | ⚠️ Uses Locker_Open — verify remote |

## Client-Only Commands (`command-manager.ts`)

| Command | Description |
|---------|-------------|
| `#ping` | Measures server latency |
| `#find` | Find a player online |
| `#loc` | Show current map coordinates |
| `#engine` | Show client version info |
| `#usage` | Show session play time |
| `#nowall` | Toggle wall collision (admin) |
| `#smooth` | Toggle movement interpolation |
| `#debug` | Toggle debug overlay |
| `#item` | Look up item info |
| `#npc` | Look up NPC info |

---

## Missing Packet Handlers

Server handler files with no corresponding web client handler:

| Server Handler | Purpose | Priority | Status |
|---------------|---------|----------|--------|
| `Trade.cpp` | Player-to-player trading | 🔴 High | ❌ Not started |
| `Guild.cpp` | Guild create/join/manage/members | 🔴 High | ❌ Not started |
| `Barber.cpp` | Hair/style changes | 🟡 Medium | ❌ Not started |
| `Citizen.cpp` | Home town system | 🟡 Medium | ❌ Not started |
| `Global.cpp` | Global/world messages | 🟡 Medium | ❌ Not started |
| `Marriage.cpp` | Marriage system | 🟢 Low | ❌ Not started |
| `Priest.cpp` | Wedding ceremony | 🟢 Low | ❌ Not started |
| `Jukebox.cpp` | Jukebox music player | 🟢 Low | ❌ Not started |

---

## Implementation Priorities

### High Priority (core gameplay)
- [ ] **Trade system** — `Trade_*` packets (request, accept, offer, agree, close)
- [ ] **Guild system** — `Guild_*` packets (create, join, list, members, ranks)
- [ ] **Guild dialog interaction** — Quest dialog link clicks for guild hub menus

### Medium Priority (common features)
- [ ] **Barber** — `Barber_*` packets for hair changes
- [ ] **Citizen** — `Citizen_*` packets for home town
- [ ] **Global messages** — Announce/global chat display
- [ ] **Equipment toggle dialog** — `#hide`/`#show` with no args

### Low Priority (nice to have)
- [ ] **Marriage/Priest** — Wedding system packets
- [ ] **Jukebox** — Music selection UI
