# Encyclopedia Maps Tab Design

**Date:** 2026-04-10
**Status:** Approved

## Summary

Add a "Maps" tab to the existing encyclopedia panel. Players can browse all game maps, see a tile-spec colored overview of each map, view NPC spawn points and warp connections, and click through to navigate between maps and NPC details. No server changes required.

## Architecture

### Build Step: Map Manifest

A Vite plugin scans `public/maps/*.emf` at build time, reads each EMF file to extract the map name and ID, and writes `map-manifest.json` to the build output directory.

**Format:**
```json
[
  { "id": 1, "name": "Test Map" },
  { "id": 5, "name": "Aeven" }
]
```

This file is served statically by nginx in the Docker container (lands in `dist/` alongside other build output).

### Data Flow

1. User clicks the "Maps" tab in the encyclopedia
2. On first open, fetch `/map-manifest.json` and cache in memory
3. List panel shows all maps, searchable by name or ID
4. Selecting a map fetches `/maps/{padded_id}.emf`, deserializes with `Emf.deserialize()`
5. Map EMF data cached in memory after first load for instant re-selection
6. Detail panel renders map canvas + NPC list + connected maps list

### New/Modified Files

| File | Action | Purpose |
|------|--------|---------|
| `vite-plugin-map-manifest.ts` | Create | Vite plugin to generate map-manifest.json at build time |
| `vite.config.ts` | Modify | Register the map manifest plugin |
| `src/ui/encyclopedia/encyclopedia.ts` | Modify | Add Maps tab handling, map detail rendering, canvas drawing |
| `src/ui/encyclopedia/encyclopedia.css` | Modify | Add map-specific styles (canvas, tooltip, spawn/warp markers) |
| `index.html` | Modify | Add Maps tab button to encyclopedia tabs |

### No Server Changes

All map data comes from static EMF files already served by the web server. The manifest is generated at build time. No new packets needed.

## List Panel (Left Side)

When the "Maps" tab is active:
- Fetch manifest on first access, cache in memory
- Show all maps sorted by ID
- Each row: map name + map ID as subtitle
- Search filters by map name (case-insensitive partial match) or by ID
- Standard 50-result cap with count indicator
- Selecting a row loads and displays that map's detail

## Detail View (Right Side)

### Map Canvas (Top ~50% of Detail Panel)

Renders a tile-spec colored overview of the entire map on a `<canvas>` element.

**Tile colors:**
- Walkable: dark background tone
- Wall/blocked: lighter tone
- Water: blue
- Warp tiles: bright gold/yellow markers
- NPC spawn positions: distinct colored dots (green or red)

**Sizing:** Tiles scaled to fit canvas width, aspect ratio maintained. Canvas height determined by map dimensions.

**Interaction:**
- Hover NPC dot → tooltip showing NPC name
- Hover warp marker → tooltip showing destination map name
- Click NPC dot → navigate to that NPC's detail (via encyclopedia cross-link)
- Click warp marker → navigate to that destination map's detail within Maps tab

### Map Info Section

Below the canvas:
- Map name, ID
- Dimensions (width x height)
- Map type (from MapType enum)
- Music ID (if set)

### NPCs Section

List of NPC spawns from `emf.npcs`:
- NPC name (cross-linked to NPC detail via `navigateTo('npc', npcId)`)
- Spawn count (`amount` field)
- Position coordinates (x, y)

NPC names resolved via `client.getEnfRecordById(npc.id)`.

### Connected Maps Section

Unique destination maps extracted from `emf.warpRows`:
- Destination map name (cross-linked to that map's detail)
- Level requirement (if > 0)
- Number of warp tiles leading to that destination

Destination map names loaded from the manifest. If not in manifest, show "Map #ID".

## Map Canvas Rendering

Uses a standard HTML `<canvas>` element (not PixiJS). For each tile in the map:

1. Iterate `emf.tileSpecRows` to build a tile-spec lookup (same pattern as minimap's `buildCaches`)
2. For each tile coordinate (0..width, 0..height), look up tile spec
3. Map tile spec to a color:
   - `None`/walkable: `#1a1612` (dark)
   - `Wall`/`FakeWall`/`MapEdge`: `#3d3428` (lighter)
   - `Water`: `#1a3050` (blue)
   - `Chest`/`BankVault`: `#4a3a20` (brown)
   - Default blocked: `#2a2218` (medium dark)
4. Overlay warp tiles as bright markers (gold `#d4b896`)
5. Overlay NPC spawn positions as colored dots (green `#4caf50`)

**Scale calculation:** `pixelsPerTile = Math.max(1, Math.floor(canvasWidth / mapWidth))`. For large maps this may be 1-2 pixels per tile; for small maps, larger.

**Tooltip:** On `mousemove`, check if cursor is over an NPC dot or warp marker by comparing pixel position to tile coordinates. Show/hide a positioned tooltip div with the name.

## Tab Integration

### HTML Change

Add Maps tab button to `#encyclopedia .enc-tabs` in `index.html`:
```html
<button class="enc-tab" data-tab="maps">Maps</button>
```

### Encyclopedia Class Changes

- Add `'maps'` to `EncyclopediaTab` type union
- Add manifest loading (fetch + cache)
- Add `filterMaps(term)` method — search by name or ID
- Add `renderMapDetail(mapId)` method — load EMF, draw canvas, render NPC/warp lists
- Add canvas drawing logic with tooltip handling
- Map EMF cache: `Map<number, Emf>` to avoid re-fetching

## Mobile Behavior

Same pattern as other tabs:
- Full-screen overlay, list/detail stacked
- Canvas scales to fit narrow width
- "← List" button returns to map list
- `enc-mobile-hidden` toggling

## Performance

- Manifest fetched once, cached in memory
- EMF files fetched on demand per map, cached in `Map<number, Emf>`
- Canvas rendering is synchronous and fast (simple colored rectangles)
- No PixiJS dependency — pure canvas 2D context

## Out of Scope (Future Enhancements)

- Actual graphic tile rendering (render real tile images instead of colored squares)
- Map editing
- Real-time player/NPC positions (shows spawn templates, not live data)
- Indoor/outdoor layer toggling
- Map grouping or world map view
