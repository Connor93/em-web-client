# Encyclopedia Maps Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Maps" tab to the encyclopedia that lets players browse all game maps with a tile-spec colored canvas preview, NPC spawn markers, warp markers with tooltips, and cross-linked NPC/map lists.

**Architecture:** Vite plugin generates `map-manifest.json` at build time by reading all EMF files. The encyclopedia's Maps tab loads this manifest for the list panel, then fetches individual EMF files on demand for the detail view. A canvas element renders the tile-spec colored map overview with interactive NPC/warp markers.

**Tech Stack:** TypeScript, Vite plugin (Node.js), eolib EMF deserialization, HTML Canvas 2D

**Spec:** `docs/superpowers/specs/2026-04-10-encyclopedia-maps-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `vite-plugin-map-manifest.ts` | Create | Vite plugin: scan public/maps/, read EMF headers, write map-manifest.json |
| `vite.config.ts` | Modify | Register the map manifest plugin |
| `index.html` | Modify | Add Maps tab button |
| `src/ui/encyclopedia/encyclopedia.ts` | Modify | Add maps tab type, manifest loading, map filtering, map detail rendering, canvas drawing |
| `src/ui/encyclopedia/encyclopedia.css` | Modify | Add map canvas, tooltip, and marker styles |

---

### Task 1: Vite Plugin — Map Manifest Generator

**Files:**
- Create: `vite-plugin-map-manifest.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Create the Vite plugin**

Create `vite-plugin-map-manifest.ts` in the project root (same level as `vite.config.ts`). This plugin runs during the build and dev server startup, scans `public/maps/`, reads each EMF file to extract the map name, and writes `map-manifest.json`.

```typescript
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { Plugin } from 'vite';

/**
 * Minimal EMF header reader — extracts map name without full eolib dependency.
 * EMF format: 3-byte magic "EMF", then name as a fixed-length string (24 bytes max).
 * The name is encoded as EO "encoded" bytes that we need to decode.
 */
function readEmfName(buffer: Uint8Array): string {
  // EMF header: bytes 0-2 = "EMF"
  if (buffer[0] !== 0x45 || buffer[1] !== 0x4d || buffer[2] !== 0x46) {
    return '';
  }

  // Bytes 3-26 are the map name (24 bytes, padded with 0xFF)
  const nameBytes: number[] = [];
  for (let i = 3; i < 27; i++) {
    if (buffer[i] === 0xff) break;
    nameBytes.push(buffer[i]);
  }

  // EO string encoding: bytes are inverted/flipped in chunks
  // This is a simplified decoder — the actual name encoding in EMF
  // is just raw bytes (not EO-encoded) for the name field
  return String.fromCharCode(...nameBytes);
}

export function mapManifestPlugin(): Plugin {
  const generateManifest = (publicDir: string, outDir: string) => {
    const mapsDir = resolve(publicDir, 'maps');
    const files = readdirSync(mapsDir).filter((f) => f.endsWith('.emf'));
    const manifest: { id: number; name: string }[] = [];

    for (const file of files) {
      const id = Number.parseInt(file.replace('.emf', ''), 10);
      if (Number.isNaN(id) || id <= 0) continue;

      try {
        const buffer = new Uint8Array(readFileSync(resolve(mapsDir, file)));
        const name = readEmfName(buffer);
        manifest.push({ id, name: name || `Map ${id}` });
      } catch {
        manifest.push({ id, name: `Map ${id}` });
      }
    }

    manifest.sort((a, b) => a.id - b.id);
    writeFileSync(
      resolve(outDir, 'map-manifest.json'),
      JSON.stringify(manifest),
    );
    console.log(`[map-manifest] Generated manifest with ${manifest.length} maps`);
  };

  return {
    name: 'map-manifest',
    configureServer(server) {
      // Generate into public/ for dev server
      const publicDir = resolve(server.config.root, 'public');
      generateManifest(publicDir, publicDir);
    },
    closeBundle() {
      // Generate into dist/ for production build
      const publicDir = resolve(process.cwd(), 'public');
      const outDir = resolve(process.cwd(), 'dist');
      generateManifest(publicDir, outDir);
    },
  };
}
```

**Important note on EMF name encoding:** The name extraction above is a best-effort approach. EMF files may use a custom encoding for the name field. If names come out garbled, the implementer should check the actual byte layout by reading a known map file (e.g., 00005.emf which should be "Aeven" or similar) and adjust the offset/decoding. An alternative approach is to use eolib's `Emf.deserialize()` in the plugin — but that requires importing eolib in the Vite config context. If the simple approach doesn't work, fall back to:

```typescript
import { Emf, EoReader } from 'eolib';

function readEmfName(buffer: Uint8Array): string {
  try {
    const reader = new EoReader(buffer);
    const emf = Emf.deserialize(reader);
    return emf.name || '';
  } catch {
    return '';
  }
}
```

- [ ] **Step 2: Register the plugin in vite.config.ts**

In `vite.config.ts`, add the import and register the plugin:

```typescript
import { mapManifestPlugin } from './vite-plugin-map-manifest';
```

Add `mapManifestPlugin()` to the `plugins` array (before the existing `exclude-local-config` plugin):

```typescript
plugins: [
  mapManifestPlugin(),
  {
    name: 'exclude-local-config',
    // ... existing plugin
  },
],
```

- [ ] **Step 3: Verify the plugin works**

Run: `pnpm build`
Expected: Console shows `[map-manifest] Generated manifest with 169 maps`. Check `dist/map-manifest.json` exists and contains entries with ids and names.

Also test dev server: `pnpm dev` — check `public/map-manifest.json` is generated and accessible at `http://localhost:3000/map-manifest.json`.

- [ ] **Step 4: Add map-manifest.json to .gitignore**

Add `public/map-manifest.json` to `.gitignore` since it's generated at build/dev time.

- [ ] **Step 5: Commit**

```bash
git add vite-plugin-map-manifest.ts vite.config.ts .gitignore
git commit -m "feat(encyclopedia): add Vite plugin to generate map manifest"
```

---

### Task 2: HTML + CSS for Maps Tab

**Files:**
- Modify: `index.html`
- Modify: `src/ui/encyclopedia/encyclopedia.css`

- [ ] **Step 1: Add Maps tab button to index.html**

In `index.html`, find the encyclopedia tabs section and add the Maps tab after Classes:

```html
<button class="enc-tab" data-tab="maps">Maps</button>
```

The full tabs section should now be:
```html
<div class="enc-tabs">
  <button class="enc-tab active" data-tab="all">All</button>
  <button class="enc-tab" data-tab="items">Items</button>
  <button class="enc-tab" data-tab="npcs">NPCs</button>
  <button class="enc-tab" data-tab="spells">Spells</button>
  <button class="enc-tab" data-tab="classes">Classes</button>
  <button class="enc-tab" data-tab="maps">Maps</button>
</div>
```

- [ ] **Step 2: Add map-specific CSS styles**

Append to `src/ui/encyclopedia/encyclopedia.css`:

```css
/* ── Map Canvas ───────���──────────────────────────────────────────── */

#encyclopedia .enc-map-canvas-wrap {
  position: relative;
  margin-bottom: 8px;
  background: #0d0b08;
  border: 1px solid rgba(212, 184, 150, 0.15);
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
}

#encyclopedia .enc-map-canvas {
  display: block;
  image-rendering: pixelated;
}

/* ── Map Tooltip ──────────────���──────────────────────────────────── */

#encyclopedia .enc-map-tooltip {
  position: absolute;
  padding: 3px 8px;
  background: rgba(18, 16, 12, 0.95);
  border: 1px solid rgba(212, 184, 150, 0.3);
  border-radius: 3px;
  color: #e0daca;
  font-size: 10px;
  pointer-events: none;
  white-space: nowrap;
  z-index: 10;
  display: none;
}

/* ── Map Info ────────────────────────────────────────────────────── */

#encyclopedia .enc-map-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 10px;
  color: #a89b8c;
}

#encyclopedia .enc-map-info span {
  color: #e0daca;
}

/* ── Map Legend ────────────��───────────────────────────────���──────── */

#encyclopedia .enc-map-legend {
  display: flex;
  gap: 10px;
  padding: 4px 0;
  font-size: 9px;
  color: #a89b8c;
  margin-bottom: 6px;
}

#encyclopedia .enc-map-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

#encyclopedia .enc-map-legend-swatch {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add index.html src/ui/encyclopedia/encyclopedia.css
git commit -m "feat(encyclopedia): add Maps tab HTML and CSS"
```

---

### Task 3: Encyclopedia Maps — List Panel + Manifest Loading

**Files:**
- Modify: `src/ui/encyclopedia/encyclopedia.ts`

This task adds manifest loading, map filtering, and map list rendering. No detail view yet.

- [ ] **Step 1: Update types and add map state**

At the top of `encyclopedia.ts`, update the `EncyclopediaTab` type:

```typescript
type EncyclopediaTab = 'all' | 'items' | 'npcs' | 'spells' | 'classes' | 'maps';
```

Update `HistoryEntry` type to include `'map'`:

```typescript
interface HistoryEntry {
  tab: EncyclopediaTab;
  type: 'item' | 'npc' | 'spell' | 'class' | 'map';
  id: number;
}
```

Update `selectedType` field type on the class:

```typescript
private selectedType: 'item' | 'npc' | 'spell' | 'class' | 'map' | '' = '';
```

Add new fields to the class after `sourceCleanup`:

```typescript
private mapManifest: { id: number; name: string }[] | null = null;
private mapCache: Map<number, Emf> = new Map();
```

Add `Emf` and `EoReader` to the eolib import at the top of the file:

```typescript
import {
  // ... existing imports
  Emf,
  EoReader,
  MapTileSpec,
} from 'eolib';
```

- [ ] **Step 2: Add manifest loading method**

Add a method to load the manifest:

```typescript
private async loadMapManifest(): Promise<void> {
  if (this.mapManifest) return;
  try {
    const response = await fetch('/map-manifest.json');
    this.mapManifest = await response.json();
  } catch {
    this.mapManifest = [];
  }
}
```

- [ ] **Step 3: Add map filtering method**

Add `filterMaps` alongside the other filter methods:

```typescript
private filterMaps(term: string): { id: number; name: string }[] {
  if (!this.mapManifest) return [];
  return this.mapManifest.filter((map) => {
    if (term === '') return true;
    if (map.name.toLowerCase().includes(term)) return true;
    if (String(map.id).includes(term)) return true;
    return false;
  });
}
```

- [ ] **Step 4: Update renderList to handle maps tab**

In the `renderList()` method, add a maps section after the classes section (before the result count indicator). The maps tab should NOT appear in the "all" tab — maps are a separate browsing experience:

```typescript
if (this.activeTab === 'maps') {
  const maps = this.filterMaps(term);
  totalCount += maps.length;
  const limit = MAX_RESULTS - rendered;
  for (const map of maps.slice(0, limit)) {
    this.addListRow(
      'map',
      map.id,
      map.name,
      `Map #${map.id}`,
      '',
      null,
    );
    rendered++;
  }
}
```

Update `addListRow` to accept `'map'` as a type — the first parameter type should be:

```typescript
type: 'item' | 'npc' | 'spell' | 'class' | 'map',
```

- [ ] **Step 5: Update tab switching to trigger manifest load**

In the tab switching event listener (in the constructor), add an async manifest load when switching to maps:

```typescript
for (const button of this.tabButtons) {
  button.addEventListener('click', async () => {
    this.activeTab = button.dataset.tab as EncyclopediaTab;
    this.updateTabHighlight();
    if (this.activeTab === 'maps') {
      await this.loadMapManifest();
    }
    this.renderList();
  });
}
```

- [ ] **Step 6: Update navigateTo to handle maps**

Update the `navigateTo` method to handle the `'map'` type:

```typescript
private navigateTo(type: 'item' | 'npc' | 'spell' | 'class' | 'map', id: number) {
  const tabMap = {
    item: 'items',
    npc: 'npcs',
    spell: 'spells',
    class: 'classes',
    map: 'maps',
  } as const;
  this.activeTab = tabMap[type];
  this.updateTabHighlight();
  this.searchInput.value = '';
  this.selectEntry(type, id);
  this.renderList();
}
```

Also update `selectEntry` type signature:

```typescript
selectEntry(type: 'item' | 'npc' | 'spell' | 'class' | 'map', id: number) {
```

- [ ] **Step 7: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/ui/encyclopedia/encyclopedia.ts
git commit -m "feat(encyclopedia): add maps tab list panel with manifest loading"
```

---

### Task 4: Encyclopedia Maps — Detail View with Canvas

**Files:**
- Modify: `src/ui/encyclopedia/encyclopedia.ts`

This task adds the map detail rendering: EMF loading, canvas drawing, NPC/warp lists, tooltips, and click interaction.

- [ ] **Step 1: Add EMF loading method**

```typescript
private async loadMapEmf(mapId: number): Promise<Emf | null> {
  const cached = this.mapCache.get(mapId);
  if (cached) return cached;

  const paddedId = String(mapId).padStart(5, '0');
  try {
    const response = await fetch(`/maps/${paddedId}.emf`);
    if (!response.ok) return null;
    const buffer = new Uint8Array(await response.arrayBuffer());
    const reader = new EoReader(buffer);
    const emf = Emf.deserialize(reader);
    this.mapCache.set(mapId, emf);
    return emf;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Add renderMapDetail method**

In the `renderDetail()` method's switch statement, add the map case:

```typescript
case 'map':
  this.renderMapDetail(this.selectedId);
  break;
```

Then add the `renderMapDetail` method:

```typescript
private async renderMapDetail(mapId: number) {
  const emf = await this.loadMapEmf(mapId);
  if (!emf) {
    const error = document.createElement('div');
    error.className = 'enc-source-row';
    error.textContent = 'Failed to load map data';
    this.detailPanel.appendChild(error);
    return;
  }

  // Map name + ID
  this.addDetailName(emf.name || `Map ${mapId}`);
  this.addDetailType(`Map #${mapId}`);

  // Map info
  const infoDiv = document.createElement('div');
  infoDiv.className = 'enc-map-info';
  infoDiv.innerHTML = '';

  const addInfo = (label: string, value: string) => {
    const span = document.createElement('span');
    span.textContent = `${label}: `;
    const valueSpan = document.createElement('span');
    valueSpan.textContent = value;
    span.appendChild(valueSpan);
    // Wrap in a container
    const item = document.createDocumentFragment();
    const container = document.createElement('div');
    container.textContent = `${label}: `;
    const val = document.createElement('span');
    val.textContent = value;
    container.appendChild(val);
    infoDiv.appendChild(container);
  };

  addInfo('Size', `${emf.width} x ${emf.height}`);
  if (emf.musicId > 0) addInfo('Music', `#${emf.musicId}`);
  this.detailPanel.appendChild(infoDiv);

  // Legend
  const legend = document.createElement('div');
  legend.className = 'enc-map-legend';
  const legendItems: [string, string][] = [
    ['#1a1612', 'Walkable'],
    ['#3d3428', 'Wall'],
    ['#1a3050', 'Water'],
    ['#d4b896', 'Warp'],
    ['#4caf50', 'NPC Spawn'],
  ];
  for (const [color, label] of legendItems) {
    const item = document.createElement('div');
    item.className = 'enc-map-legend-item';
    const swatch = document.createElement('div');
    swatch.className = 'enc-map-legend-swatch';
    swatch.style.background = color;
    item.appendChild(swatch);
    item.appendChild(document.createTextNode(label));
    legend.appendChild(item);
  }
  this.detailPanel.appendChild(legend);

  // Canvas
  this.renderMapCanvas(emf, mapId);

  // NPC spawns section
  if (emf.npcs.length > 0) {
    this.addSectionHeader('NPC Spawns');
    const seen = new Set<number>();
    for (const npc of emf.npcs) {
      if (seen.has(npc.id)) continue;
      seen.add(npc.id);
      const record = this.client.getEnfRecordById(npc.id);
      const name = record ? record.name : `NPC #${npc.id}`;
      const count = emf.npcs.filter((n) => n.id === npc.id).reduce((sum, n) => sum + n.amount, 0);
      if (record) {
        this.addSourceLinkWithSuffix('npc', npc.id, name, ` (x${count})`);
      } else {
        const row = document.createElement('div');
        row.className = 'enc-source-row';
        row.textContent = `${name} (x${count})`;
        this.detailPanel.appendChild(row);
      }
    }
  }

  // Connected maps section
  const warpDestinations = new Map<number, { count: number; levelRequired: number }>();
  for (const row of emf.warpRows) {
    for (const tile of row.tiles) {
      if (!tile.warp) continue;
      const destId = tile.warp.destinationMap;
      if (destId <= 0) continue;
      const existing = warpDestinations.get(destId);
      if (existing) {
        existing.count++;
        existing.levelRequired = Math.max(existing.levelRequired, tile.warp.levelRequired);
      } else {
        warpDestinations.set(destId, { count: 1, levelRequired: tile.warp.levelRequired });
      }
    }
  }

  if (warpDestinations.size > 0) {
    this.addSectionHeader('Connected Maps');
    for (const [destId, info] of warpDestinations) {
      const destName = this.mapManifest?.find((m) => m.id === destId)?.name || `Map #${destId}`;
      let suffix = '';
      if (info.levelRequired > 0) suffix += ` (Lv ${info.levelRequired}+)`;
      if (info.count > 1) suffix += ` — ${info.count} warps`;
      this.addSourceLinkWithSuffix('map', destId, destName, suffix);
    }
  }

  // Handle mobile
  if (document.body.classList.contains('is-mobile')) {
    this.container.querySelector('.enc-list-panel')?.classList.add('enc-mobile-hidden');
    this.detailPanel.classList.remove('enc-mobile-hidden');
  }
}
```

- [ ] **Step 3: Add canvas rendering method**

```typescript
private renderMapCanvas(emf: Emf, mapId: number) {
  const wrap = document.createElement('div');
  wrap.className = 'enc-map-canvas-wrap';

  const canvas = document.createElement('canvas');
  canvas.className = 'enc-map-canvas';

  const tooltip = document.createElement('div');
  tooltip.className = 'enc-map-tooltip';
  wrap.appendChild(tooltip);

  const width = emf.width;
  const height = emf.height;
  if (width <= 0 || height <= 0) return;

  // Scale: fit canvas within detail panel width (~340px)
  const maxCanvasWidth = 340;
  const pixelsPerTile = Math.max(1, Math.floor(maxCanvasWidth / Math.max(width, height)));
  const canvasWidth = width * pixelsPerTile;
  const canvasHeight = height * pixelsPerTile;

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;

  const context = canvas.getContext('2d')!;

  // Build tile spec lookup
  const tileSpecs: (MapTileSpec | null)[][] = Array.from({ length: height + 1 }, () =>
    new Array<MapTileSpec | null>(width + 1).fill(null),
  );
  for (const row of emf.tileSpecRows) {
    for (const tile of row.tiles) {
      if (tile.x <= width && row.y <= height) {
        tileSpecs[row.y][tile.x] = tile.tileSpec;
      }
    }
  }

  // Build warp lookup
  const warps: Map<string, { destinationMap: number; x: number; y: number }> = new Map();
  for (const row of emf.warpRows) {
    for (const tile of row.tiles) {
      if (tile.warp && tile.warp.destinationMap > 0) {
        warps.set(`${tile.x},${row.y}`, {
          destinationMap: tile.warp.destinationMap,
          x: tile.x,
          y: row.y,
        });
      }
    }
  }

  // Build NPC spawn lookup
  const npcSpawns: { x: number; y: number; id: number }[] = [];
  for (const npc of emf.npcs) {
    npcSpawns.push({ x: npc.coords.x, y: npc.coords.y, id: npc.id });
  }

  // Draw tiles
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const spec = tileSpecs[y]?.[x];
      let color: string;
      if (spec === null || spec === undefined) {
        color = '#1a1612'; // walkable / empty
      } else if (spec === MapTileSpec.Wall || spec === MapTileSpec.FakeWall || spec === MapTileSpec.Edge) {
        color = '#3d3428';
      } else if (spec === MapTileSpec.Water) {
        color = '#1a3050';
      } else if (spec === MapTileSpec.Chest || spec === MapTileSpec.BankVault) {
        color = '#4a3a20';
      } else {
        color = '#1a1612'; // chairs, boards, etc. are walkable
      }
      context.fillStyle = color;
      context.fillRect(x * pixelsPerTile, y * pixelsPerTile, pixelsPerTile, pixelsPerTile);
    }
  }

  // Draw warp markers
  context.fillStyle = '#d4b896';
  for (const [, warp] of warps) {
    context.fillRect(warp.x * pixelsPerTile, warp.y * pixelsPerTile, pixelsPerTile, pixelsPerTile);
  }

  // Draw NPC spawn markers (slightly larger for visibility)
  context.fillStyle = '#4caf50';
  for (const spawn of npcSpawns) {
    const size = Math.max(pixelsPerTile, 2);
    context.fillRect(
      spawn.x * pixelsPerTile - Math.floor(size / 4),
      spawn.y * pixelsPerTile - Math.floor(size / 4),
      size,
      size,
    );
  }

  // Tooltip + click interaction
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const tileX = Math.floor((event.clientX - rect.left) / pixelsPerTile);
    const tileY = Math.floor((event.clientY - rect.top) / pixelsPerTile);
    const key = `${tileX},${tileY}`;

    // Check NPC spawn
    const npcSpawn = npcSpawns.find((s) => s.x === tileX && s.y === tileY);
    if (npcSpawn) {
      const record = this.client.getEnfRecordById(npcSpawn.id);
      tooltip.textContent = record ? record.name : `NPC #${npcSpawn.id}`;
      tooltip.style.display = 'block';
      tooltip.style.left = `${event.clientX - rect.left + 12}px`;
      tooltip.style.top = `${event.clientY - rect.top - 8}px`;
      canvas.style.cursor = 'pointer';
      return;
    }

    // Check warp
    const warp = warps.get(key);
    if (warp) {
      const destName = this.mapManifest?.find((m) => m.id === warp.destinationMap)?.name || `Map #${warp.destinationMap}`;
      tooltip.textContent = `→ ${destName}`;
      tooltip.style.display = 'block';
      tooltip.style.left = `${event.clientX - rect.left + 12}px`;
      tooltip.style.top = `${event.clientY - rect.top - 8}px`;
      canvas.style.cursor = 'pointer';
      return;
    }

    tooltip.style.display = 'none';
    canvas.style.cursor = 'default';
  });

  canvas.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
    canvas.style.cursor = 'default';
  });

  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const tileX = Math.floor((event.clientX - rect.left) / pixelsPerTile);
    const tileY = Math.floor((event.clientY - rect.top) / pixelsPerTile);

    // Check NPC spawn click
    const npcSpawn = npcSpawns.find((s) => s.x === tileX && s.y === tileY);
    if (npcSpawn) {
      this.navigateTo('npc', npcSpawn.id);
      return;
    }

    // Check warp click
    const warp = warps.get(`${tileX},${tileY}`);
    if (warp) {
      this.navigateTo('map', warp.destinationMap);
      return;
    }
  });

  wrap.appendChild(canvas);
  this.detailPanel.appendChild(wrap);
}
```

- [ ] **Step 4: Update addSourceLinkWithSuffix to accept 'map' type**

The existing `addSourceLinkWithSuffix` method's type parameter needs to accept `'map'`:

```typescript
private addSourceLinkWithSuffix(
  type: 'item' | 'npc' | 'spell' | 'class' | 'map',
  id: number,
  name: string,
  suffix: string,
) {
```

Also update `addSourceLink`:

```typescript
private addSourceLink(
  type: 'item' | 'npc' | 'spell' | 'class' | 'map',
  id: number,
  name: string,
) {
```

- [ ] **Step 5: Handle async detail rendering**

The `renderMapDetail` method is async (it fetches EMF files). Update `renderDetail` to handle this — the map case should show a loading state:

In `renderDetail()`, before the switch statement, if the type is 'map', show loading first:

```typescript
if (this.selectedType === 'map') {
  const loading = document.createElement('div');
  loading.className = 'enc-loading';
  loading.textContent = 'Loading map...';
  this.detailPanel.appendChild(loading);
}
```

And change the map case in the switch to:

```typescript
case 'map':
  this.renderMapDetail(this.selectedId);
  return; // renderMapDetail handles its own async flow
```

Inside `renderMapDetail`, clear the detail panel at the start (removing the loading state):

```typescript
private async renderMapDetail(mapId: number) {
  // Re-add back button if needed (detail was already cleared by renderDetail)
  // The loading indicator is already showing

  const emf = await this.loadMapEmf(mapId);

  // Clear loading state
  this.detailPanel.innerHTML = '';

  // Mobile back-to-list button
  if (document.body.classList.contains('is-mobile')) {
    const backToList = document.createElement('button');
    backToList.className = 'enc-back';
    backToList.textContent = '\u2190 List';
    backToList.addEventListener('click', () => {
      this.container.querySelector('.enc-list-panel')?.classList.remove('enc-mobile-hidden');
      this.detailPanel.classList.add('enc-mobile-hidden');
    });
    this.detailPanel.appendChild(backToList);
  }

  // History back button
  if (this.history.length > 0) {
    const back = document.createElement('button');
    back.className = 'enc-back';
    back.textContent = '\u2190 Back';
    back.addEventListener('click', () => this.navigateBack());
    this.detailPanel.appendChild(back);
  }

  if (!emf) {
    // ... error handling from above
  }

  // ... rest of the method
}
```

- [ ] **Step 6: Ensure map manifest is loaded when navigating to a map from another tab**

When `navigateTo('map', id)` is called (e.g., from an NPC's spawn maps), the manifest might not be loaded yet. Update `navigateTo`:

```typescript
private async navigateTo(type: 'item' | 'npc' | 'spell' | 'class' | 'map', id: number) {
  const tabMap = {
    item: 'items',
    npc: 'npcs',
    spell: 'spells',
    class: 'classes',
    map: 'maps',
  } as const;
  this.activeTab = tabMap[type];
  this.updateTabHighlight();
  this.searchInput.value = '';
  if (type === 'map') {
    await this.loadMapManifest();
  }
  this.selectEntry(type, id);
  this.renderList();
}
```

- [ ] **Step 7: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/ui/encyclopedia/encyclopedia.ts
git commit -m "feat(encyclopedia): add maps detail view with canvas rendering and interaction"
```

---

### Task 5: Build Verification and Fixes

**Files:**
- Possibly modify: `src/ui/encyclopedia/encyclopedia.ts`, `vite-plugin-map-manifest.ts`

- [ ] **Step 1: Full build test**

Run: `pnpm build`
Expected: Build succeeds, `dist/map-manifest.json` exists with entries.

- [ ] **Step 2: Dev server test**

Run: `pnpm dev`

Test in browser:
1. Open encyclopedia, click Maps tab
2. Verify map list loads with names
3. Search for a map by name or ID
4. Click a map — verify canvas renders with colored tiles
5. Hover NPC dot — tooltip with NPC name
6. Hover warp marker — tooltip with destination map name
7. Click NPC dot — navigates to NPC detail
8. Click warp marker — navigates to that map
9. Click "Back" — returns to previous map
10. Test connected maps list — click a map name to navigate
11. Test NPC spawns list — click NPC name to navigate to NPC detail

- [ ] **Step 3: Verify EMF name extraction works**

Check that map names in the manifest are readable (not garbled). If the simple byte reader doesn't work, switch to the eolib `Emf.deserialize()` approach in the Vite plugin.

- [ ] **Step 4: Run lint**

Run: `pnpm lint`

- [ ] **Step 5: Fix any issues and commit**

```bash
git add -A
git commit -m "fix(encyclopedia): maps tab polish and fixes"
```
