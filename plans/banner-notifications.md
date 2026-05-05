# Banner Notifications — Implementation Plan

## Context

A player suggested adding on-screen banner notifications for important server-driven events, specifically awakened NPC announcements. Investigation revealed a real gap: awakened NPC lifecycle messages (`[BOSS_AWAKEN]`, `[BOSS_ENRAGE]`, `[BOSS_TIMEOUT]`) are detected and suppressed in `src/handlers/message.ts:36-133` — they reach the client but never appear anywhere visible. Admin `/announce` only appears in chat tabs and a chat bubble, easy to miss in scroll.

This plan adds a tiered banner surface covering awakened NPC lifecycle, admin announcements, and server restart/shutdown warnings.

## Decisions

| Decision | Choice |
|---|---|
| Scope | Awakened NPC lifecycle, admin `/announce`, server restart/shutdown |
| Awakened scope split | Awaken-spawn + death = **server-wide**; enrage/shield/timeout = **same-map only** |
| Placement | Top strip, full-width, sits **above** BossBar |
| Stacking | Queue (one banner at a time) |
| Tiers | Critical (red, pulse) / Event (gold, glow) / Info (blue, flat) |
| Audio | Silent — banner adds no new SFX |
| Player setting | Single on/off toggle |

### Tier mapping

| Source | Tier |
|---|---|
| Server restart / shutdown | Critical |
| `TalkServer` global awakening / death announcement (prefixed `[BANNER:event]`) | Event |
| `TalkAnnounce` (admin `/announce`) | Event |
| `bossEnraged`, `bossShielded`, `bossTimeout` (map-local) | Info |

`bossAwakened` and `bossDied` events do not trigger map-local banners — the global `TalkServer` announcement covers all players including those on the boss map (no duplicate).

## Files

**New**
- `src/ui/banner-notification/banner-notification.ts` — FIFO queue, three tiers, slide+fade
- `src/ui/banner-notification/banner-notification.css`
- `src/ui/banner-notification/index.ts`

**Modified**
- `index.html` — static `<div id="banner-notification" class="hidden">` with icon/text/close
- `src/types/events.ts` — add `bannerNotification: { tier; text; icon? }`
- `src/settings.ts` — add `bannerNotifications: 'enabled' | 'disabled'`
- `src/ui/settings-dialog/settings-dialog.ts` — toggle row
- `src/ui/index.ts` — export
- `src/main.ts` — instantiate
- `src/wiring/client-events.ts` — subscribe `bannerNotification` → component; emit Info banners from boss state events
- `src/handlers/talk.ts` — emit Event banner from `handleTalkAnnounce` and prefix-detected `handleTalkServer`
- `src/ui/boss-bar/boss-bar.ts` — add `getName(npcIndex)` accessor for Info banner text
- `src/ui/boss-bar/boss-bar.css` — push down when banner visible (`body.has-banner #boss-bars`)

## Server contract (etheos)

- `etheos/src/awakened_system.cpp` — prefix the world-wide awaken/death `ServerMsg()` with `[BANNER:event]`
- Server restart/shutdown broadcasts — prefix `[BANNER:critical]`

Until the server change ships, the client falls back to text-pattern detection in `handleTalkServer`.

## Verification

1. Admin `/announce` → Event banner at top, 6s, chat tabs unchanged
2. Awakened NPC spawn (global) → all players see Event banner
3. Map-local enrage/shield/timeout → only on-map players see Info banner
4. No duplicate banner for awaken (global only fires)
5. Queue: two announces 1s apart → second waits for first
6. Settings toggle off → no banners; queue drops in-flight items
7. Critical pulse on shutdown
8. Mobile: shrunken padding, close button tappable
9. No regressions: SFX, chat log, boss bar unaffected
10. `pnpm lint` and `pnpm build` clean
