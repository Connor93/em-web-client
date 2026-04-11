# Encyclopedia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browsable, searchable in-game encyclopedia with master/detail split, cross-linked entries, and graphics for items, NPCs, spells, and classes.

**Architecture:** Single `Encyclopedia` UI component with left browse panel (tabs + search + list) and right detail panel. Reuses existing pub data on Client, existing source request packets, and existing `updateItemSources`/`updateNpcSources` events. Button added to in-game menu.

**Tech Stack:** TypeScript, DOM manipulation (project convention), CSS, eolib pub types

**Spec:** `docs/superpowers/specs/2026-04-10-encyclopedia-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/ui/encyclopedia/encyclopedia.ts` | Create | Main component: tabs, search, list rendering, detail rendering, cross-linking, source data |
| `src/ui/encyclopedia/encyclopedia.css` | Create | All encyclopedia styles |
| `src/ui/encyclopedia/index.ts` | Create | Barrel export |
| `index.html` | Modify | Add encyclopedia HTML shell + menu button |
| `src/ui/in-game-menu/in-game-menu.ts` | Modify | Add `'encyclopedia'` to toggle type union |
| `src/wiring/ui-events.ts` | Modify | Add encyclopedia dep + toggle wiring |
| `src/main.ts` | Modify | Import and instantiate Encyclopedia |

---

### Task 1: HTML Shell + Menu Button

**Files:**
- Modify: `index.html` (add encyclopedia shell div + menu button)

- [ ] **Step 1: Add the encyclopedia menu button to `#in-game-menu`**

In `index.html`, find the Quests button (the one with `data-id="quests"`) and add the encyclopedia button directly after it, before the Settings button:

```html
<button class="menu-btn" type="button" data-id="encyclopedia">
  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/></svg>
  Encyclopedia
</button>
```

- [ ] **Step 2: Add the encyclopedia HTML shell**

In `index.html`, find the `#guild-dialog` div and add the encyclopedia shell before it (inside the `#dialogs` container):

```html
<div id="encyclopedia" class="hidden">
  <div class="enc-header">
    <span class="enc-title">Encyclopedia</span>
    <button class="enc-close" data-id="enc-close">&times;</button>
  </div>
  <div class="enc-tabs">
    <button class="enc-tab active" data-tab="all">All</button>
    <button class="enc-tab" data-tab="items">Items</button>
    <button class="enc-tab" data-tab="npcs">NPCs</button>
    <button class="enc-tab" data-tab="spells">Spells</button>
    <button class="enc-tab" data-tab="classes">Classes</button>
  </div>
  <div class="enc-body">
    <div class="enc-list-panel">
      <div class="enc-search-wrap">
        <input class="enc-search" type="text" placeholder="Search..." />
      </div>
      <div class="enc-list"></div>
    </div>
    <div class="enc-detail-panel">
      <div class="enc-detail-empty">Select an entry to view details</div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Verify no syntax errors**

Run: `pnpm build`
Expected: Build succeeds (new HTML is inert — no TS references it yet).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(encyclopedia): add HTML shell and menu button"
```

---

### Task 2: CSS Styles

**Files:**
- Create: `src/ui/encyclopedia/encyclopedia.css`

- [ ] **Step 1: Create the encyclopedia CSS file**

Create `src/ui/encyclopedia/encyclopedia.css` with the following styles. These follow the existing project conventions — using the same color palette as guild-dialog and info-dialog (`rgba(18,16,12)` backgrounds, `#d4b896` accent, `#e0daca` text, `#a89b8c` dim text).

```css
/* ── Encyclopedia Panel ─────────────────────────────────────────── */

#encyclopedia {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 620px;
  max-width: 95vw;
  max-height: 80vh;
  background: linear-gradient(
    180deg,
    rgba(30, 26, 20, 0.97),
    rgba(22, 19, 15, 0.98)
  );
  border: 1px solid rgba(212, 184, 150, 0.25);
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
  z-index: 1055;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #e0daca;
  font-size: 11px;
  user-select: none;
}

/* ── Header ─────────────────────────────────────────────────────── */

#encyclopedia .enc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: linear-gradient(
    90deg,
    rgba(212, 184, 150, 0.12),
    rgba(212, 184, 150, 0.04)
  );
  border-bottom: 1px solid rgba(212, 184, 150, 0.15);
}

#encyclopedia .enc-title {
  font-size: 13px;
  font-weight: 600;
  color: #d4b896;
}

#encyclopedia .enc-close {
  background: none;
  border: none;
  color: #a89b8c;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  font-family: inherit;
  line-height: 1;
}

#encyclopedia .enc-close:hover {
  color: #e0daca;
}

/* ── Tabs ───────────────────────────────────────────────────────── */

#encyclopedia .enc-tabs {
  display: flex;
  border-bottom: 1px solid rgba(212, 184, 150, 0.15);
  background: rgba(0, 0, 0, 0.2);
}

#encyclopedia .enc-tab {
  flex: 1;
  padding: 6px 8px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #a89b8c;
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
  text-align: center;
  transition:
    color 0.15s,
    border-color 0.15s;
}

#encyclopedia .enc-tab:hover {
  color: #e0daca;
}

#encyclopedia .enc-tab.active {
  color: #d4b896;
  border-bottom-color: #d4b896;
  background: rgba(212, 184, 150, 0.06);
}

/* ── Body: Split Layout ─────────────────────────────────────────── */

#encyclopedia .enc-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── List Panel (left) ──────────────────────────────────────────── */

#encyclopedia .enc-list-panel {
  width: 40%;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(212, 184, 150, 0.1);
}

#encyclopedia .enc-search-wrap {
  padding: 8px;
}

#encyclopedia .enc-search {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid rgba(212, 184, 150, 0.2);
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.3);
  color: #e0daca;
  font-family: inherit;
  font-size: 11px;
  box-sizing: border-box;
  outline: none;
}

#encyclopedia .enc-search:focus {
  border-color: rgba(212, 184, 150, 0.4);
}

#encyclopedia .enc-search::placeholder {
  color: #a89b8c;
}

#encyclopedia .enc-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

#encyclopedia .enc-list::-webkit-scrollbar {
  width: 4px;
}

#encyclopedia .enc-list::-webkit-scrollbar-track {
  background: transparent;
}

#encyclopedia .enc-list::-webkit-scrollbar-thumb {
  background: rgba(212, 184, 150, 0.3);
  border-radius: 2px;
}

/* ── List: Category Landing Grid ────────────────────────────────── */

#encyclopedia .enc-cat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 8px;
}

#encyclopedia .enc-cat-card {
  background: rgba(212, 184, 150, 0.06);
  border: 1px solid rgba(212, 184, 150, 0.12);
  border-radius: 5px;
  padding: 14px 8px;
  text-align: center;
  cursor: pointer;
  transition: background 0.15s;
}

#encyclopedia .enc-cat-card:hover {
  background: rgba(212, 184, 150, 0.12);
}

#encyclopedia .enc-cat-icon {
  font-size: 22px;
  margin-bottom: 4px;
}

#encyclopedia .enc-cat-name {
  color: #d4b896;
  font-size: 10px;
  font-weight: 600;
}

#encyclopedia .enc-cat-count {
  color: #a89b8c;
  font-size: 9px;
}

/* ── List: Group Header ─────────────────────────────────────────── */

#encyclopedia .enc-group-header {
  color: #d4b896;
  font-size: 10px;
  font-weight: 600;
  padding: 5px 10px 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ── List: Result Row ───────────────────────────────────────────── */

#encyclopedia .enc-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  cursor: pointer;
  border-bottom: 1px solid rgba(212, 184, 150, 0.06);
  transition: background 0.1s;
}

#encyclopedia .enc-row:hover {
  background: rgba(212, 184, 150, 0.1);
}

#encyclopedia .enc-row.selected {
  background: rgba(212, 184, 150, 0.12);
}

#encyclopedia .enc-row-icon {
  width: 28px;
  height: 28px;
  background: rgba(212, 184, 150, 0.08);
  border: 1px solid rgba(212, 184, 150, 0.15);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

#encyclopedia .enc-row-icon img {
  max-width: 100%;
  max-height: 100%;
  image-rendering: pixelated;
}

#encyclopedia .enc-row-info {
  flex: 1;
  min-width: 0;
}

#encyclopedia .enc-row-name {
  color: #e0daca;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

#encyclopedia .enc-row-sub {
  color: #a89b8c;
  font-size: 9px;
}

#encyclopedia .enc-row-badge {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(212, 184, 150, 0.1);
  color: #a89b8c;
  flex-shrink: 0;
}

/* ── List: Result Count ─────────────────────────────────────────── */

#encyclopedia .enc-result-count {
  text-align: center;
  color: #a89b8c;
  font-size: 9px;
  padding: 4px 0;
}

/* ── Detail Panel (right) ───────────────────────────────────────── */

#encyclopedia .enc-detail-panel {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px;
}

#encyclopedia .enc-detail-panel::-webkit-scrollbar {
  width: 4px;
}

#encyclopedia .enc-detail-panel::-webkit-scrollbar-track {
  background: transparent;
}

#encyclopedia .enc-detail-panel::-webkit-scrollbar-thumb {
  background: rgba(212, 184, 150, 0.3);
  border-radius: 2px;
}

#encyclopedia .enc-detail-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #a89b8c;
  font-size: 12px;
}

/* ── Detail: Header ─────────────────────────────────────────────── */

#encyclopedia .enc-detail-graphic {
  width: 64px;
  height: 64px;
  margin: 0 auto 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(212, 184, 150, 0.06);
  border: 1px solid rgba(212, 184, 150, 0.15);
  border-radius: 4px;
  overflow: hidden;
}

#encyclopedia .enc-detail-graphic img {
  max-width: 100%;
  max-height: 100%;
  image-rendering: pixelated;
}

#encyclopedia .enc-detail-name {
  text-align: center;
  color: #d4b896;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 2px;
}

#encyclopedia .enc-detail-type {
  text-align: center;
  color: #a89b8c;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

#encyclopedia .enc-detail-badge {
  display: inline-block;
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(244, 67, 54, 0.15);
  border: 1px solid rgba(244, 67, 54, 0.3);
  color: #ef9a9a;
  margin-left: 6px;
}

/* ── Detail: Back Button ────────────────────────────────────────── */

#encyclopedia .enc-back {
  background: none;
  border: none;
  color: #a89b8c;
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
  padding: 0 0 6px 0;
  transition: color 0.15s;
}

#encyclopedia .enc-back:hover {
  color: #d4b896;
}

/* ── Detail: Section ────────────────────────────────────────────── */

#encyclopedia .enc-section-header {
  color: #d4b896;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 0 2px;
  border-bottom: 1px solid rgba(212, 184, 150, 0.15);
  margin-top: 8px;
  margin-bottom: 4px;
}

/* ── Detail: Stat Grid ──────────────────────────────────────────── */

#encyclopedia .enc-stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
}

#encyclopedia .enc-stat {
  display: flex;
  justify-content: space-between;
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 2px;
}

#encyclopedia .enc-stat .label {
  color: #a89b8c;
}

#encyclopedia .enc-stat .value {
  color: #e0daca;
  font-weight: 600;
}

/* ── Detail: Source Rows ────────────────────────────────────────── */

#encyclopedia .enc-source-row {
  font-size: 10px;
  color: #a89b8c;
  padding: 2px 4px;
}

#encyclopedia .enc-source-row span {
  color: #e0daca;
}

/* ── Detail: Cross-links ────────────────────────────────────────── */

#encyclopedia .enc-link {
  color: #d4b896;
  cursor: pointer;
  transition: color 0.15s;
}

#encyclopedia .enc-link:hover {
  color: #e8d4b2;
  text-decoration: underline;
}

/* ── Detail: Loading ────────────────────────────────────────────── */

#encyclopedia .enc-loading {
  color: #a89b8c;
  font-size: 10px;
  padding: 2px 4px;
}

/* ── Detail: Show-all toggle ────────────────────────────────────── */

#encyclopedia .enc-show-all {
  background: none;
  border: none;
  color: #d4b896;
  font-size: 9px;
  font-family: inherit;
  cursor: pointer;
  padding: 2px 4px;
}

#encyclopedia .enc-show-all:hover {
  text-decoration: underline;
}

/* ── Mobile: Full-screen overlay ────────────────────────────────── */

body.is-mobile #encyclopedia:not(.hidden) {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  max-height: 100% !important;
  transform: none !important;
  border-radius: 0 !important;
  z-index: 1060 !important;
  animation: enc-slide-in 0.2s ease-out;
}

body.is-mobile #encyclopedia .enc-body {
  flex-direction: column;
}

body.is-mobile #encyclopedia .enc-list-panel {
  width: 100%;
  border-right: none;
  border-bottom: 1px solid rgba(212, 184, 150, 0.1);
}

body.is-mobile #encyclopedia .enc-list-panel.enc-mobile-hidden {
  display: none;
}

body.is-mobile #encyclopedia .enc-detail-panel.enc-mobile-hidden {
  display: none;
}

@keyframes enc-slide-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 2: Verify the file was created correctly**

Run: `pnpm lint`
Expected: No errors on the new CSS file.

- [ ] **Step 3: Commit**

```bash
git add src/ui/encyclopedia/encyclopedia.css
git commit -m "feat(encyclopedia): add CSS styles"
```

---

### Task 3: Barrel Export + Encyclopedia Skeleton Class

**Files:**
- Create: `src/ui/encyclopedia/index.ts`
- Create: `src/ui/encyclopedia/encyclopedia.ts`

- [ ] **Step 1: Create barrel export**

Create `src/ui/encyclopedia/index.ts`:

```typescript
export { Encyclopedia } from './encyclopedia';
```

- [ ] **Step 2: Create the encyclopedia skeleton**

Create `src/ui/encyclopedia/encyclopedia.ts` with the basic class structure — open/close, tab switching, search input wiring. No detail rendering yet.

```typescript
import {
  type EcfRecord,
  type EifRecord,
  type EnfRecord,
  type EsfRecord,
  Element as EoElement,
  ItemType,
  NpcType,
  SkillNature,
  SkillTargetRestrict,
  SkillTargetType,
  SkillType,
} from 'eolib';
import type { Client } from '../../client';
import { getItemGraphicPath } from '../../utils';
import { Base } from '../base-ui';

import './encyclopedia.css';

type EncyclopediaTab = 'all' | 'items' | 'npcs' | 'spells' | 'classes';

interface HistoryEntry {
  tab: EncyclopediaTab;
  type: 'item' | 'npc' | 'spell' | 'class';
  id: number;
}

export class Encyclopedia extends Base {
  private client: Client;
  protected container = document.getElementById('encyclopedia')!;
  private tabButtons: NodeListOf<HTMLButtonElement>;
  private searchInput: HTMLInputElement;
  private listElement: HTMLDivElement;
  private detailPanel: HTMLDivElement;
  private activeTab: EncyclopediaTab = 'all';
  private selectedId = 0;
  private selectedType: 'item' | 'npc' | 'spell' | 'class' | '' = '';
  private history: HistoryEntry[] = [];
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;
  private sourceCleanup: (() => void) | null = null;

  constructor(client: Client) {
    super();
    this.client = client;

    this.tabButtons = this.container.querySelectorAll<HTMLButtonElement>('.enc-tab');
    this.searchInput = this.container.querySelector<HTMLInputElement>('.enc-search')!;
    this.listElement = this.container.querySelector<HTMLDivElement>('.enc-list')!;
    this.detailPanel = this.container.querySelector<HTMLDivElement>('.enc-detail-panel')!;

    // Close button
    this.container.querySelector('[data-id="enc-close"]')!
      .addEventListener('click', () => this.hide());

    // Tab switching
    for (const button of this.tabButtons) {
      button.addEventListener('click', () => {
        this.activeTab = button.dataset.tab as EncyclopediaTab;
        this.updateTabHighlight();
        this.renderList();
      });
    }

    // Search input (debounced)
    this.searchInput.addEventListener('input', () => {
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => this.renderList(), 150);
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.container.classList.contains('hidden')) {
        this.hide();
      }
    });
  }

  toggle() {
    if (this.container.classList.contains('hidden')) {
      this.show();
    } else {
      this.hide();
    }
  }

  show() {
    this.container.classList.remove('hidden');
    this.searchInput.focus();
    this.renderList();
  }

  hide() {
    this.container.classList.add('hidden');
    this.cleanupSourceListeners();
  }

  // ── Tab management ──

  private updateTabHighlight() {
    for (const button of this.tabButtons) {
      button.classList.toggle('active', button.dataset.tab === this.activeTab);
    }
  }

  // ── Search & filtering ──

  private getSearchTerm(): string {
    return this.searchInput.value.trim().toLowerCase();
  }

  private filterItems(term: string): { id: number; record: EifRecord }[] {
    if (!this.client.eif) return [];
    const results: { id: number; record: EifRecord }[] = [];
    for (let i = 0; i < this.client.eif.items.length; i++) {
      const record = this.client.eif.items[i];
      if (record?.name && (term === '' || record.name.toLowerCase().includes(term))) {
        results.push({ id: i + 1, record });
      }
    }
    return results;
  }

  private filterNpcs(term: string): { id: number; record: EnfRecord }[] {
    if (!this.client.enf) return [];
    const results: { id: number; record: EnfRecord }[] = [];
    for (let i = 0; i < this.client.enf.npcs.length; i++) {
      const record = this.client.enf.npcs[i];
      if (record?.name && (term === '' || record.name.toLowerCase().includes(term))) {
        results.push({ id: i + 1, record });
      }
    }
    return results;
  }

  private filterSpells(term: string): { id: number; record: EsfRecord }[] {
    if (!this.client.esf) return [];
    const results: { id: number; record: EsfRecord }[] = [];
    for (let i = 0; i < this.client.esf.skills.length; i++) {
      const record = this.client.esf.skills[i];
      if (record?.name && (term === '' || record.name.toLowerCase().includes(term))) {
        results.push({ id: i + 1, record });
      }
    }
    return results;
  }

  private filterClasses(term: string): { id: number; record: EcfRecord }[] {
    if (!this.client.ecf) return [];
    const results: { id: number; record: EcfRecord }[] = [];
    for (let i = 0; i < this.client.ecf.classes.length; i++) {
      const record = this.client.ecf.classes[i];
      if (record?.name && (term === '' || record.name.toLowerCase().includes(term))) {
        results.push({ id: i + 1, record });
      }
    }
    return results;
  }

  // ── List rendering ──

  renderList() {
    this.listElement.innerHTML = '';
    const term = this.getSearchTerm();

    // "All" tab with empty search: show category landing grid
    if (this.activeTab === 'all' && term === '') {
      this.renderCategoryLanding();
      return;
    }

    const MAX_RESULTS = 50;
    let totalCount = 0;

    if (this.activeTab === 'all' || this.activeTab === 'items') {
      const items = this.filterItems(term);
      totalCount += items.length;
      if (items.length > 0 && this.activeTab === 'all') {
        this.addGroupHeader(`Items (${items.length})`);
      }
      for (const item of items.slice(0, MAX_RESULTS)) {
        this.addListRow(
          'item',
          item.id,
          item.record.name,
          this.getItemSubtitle(item.record),
          this.getItemBadge(item.record),
          this.getItemIconPath(item.id, item.record),
        );
      }
    }

    if (this.activeTab === 'all' || this.activeTab === 'npcs') {
      const npcs = this.filterNpcs(term);
      totalCount += npcs.length;
      if (npcs.length > 0 && this.activeTab === 'all') {
        this.addGroupHeader(`NPCs (${npcs.length})`);
      }
      for (const npc of npcs.slice(0, MAX_RESULTS)) {
        this.addListRow(
          'npc',
          npc.id,
          npc.record.name,
          this.getNpcSubtitle(npc.record),
          this.getNpcBadge(npc.record),
          this.getNpcIconPath(npc.record),
        );
      }
    }

    if (this.activeTab === 'all' || this.activeTab === 'spells') {
      const spells = this.filterSpells(term);
      totalCount += spells.length;
      if (spells.length > 0 && this.activeTab === 'all') {
        this.addGroupHeader(`Spells (${spells.length})`);
      }
      for (const spell of spells.slice(0, MAX_RESULTS)) {
        this.addListRow(
          'spell',
          spell.id,
          spell.record.name,
          this.getSpellSubtitle(spell.record),
          this.getSpellBadge(spell.record),
          this.getSpellIconPath(spell.record),
        );
      }
    }

    if (this.activeTab === 'all' || this.activeTab === 'classes') {
      const classes = this.filterClasses(term);
      totalCount += classes.length;
      if (classes.length > 0 && this.activeTab === 'all') {
        this.addGroupHeader(`Classes (${classes.length})`);
      }
      for (const cls of classes.slice(0, MAX_RESULTS)) {
        this.addListRow(
          'class',
          cls.id,
          cls.record.name,
          this.getClassSubtitle(cls.record),
          '',
          null,
        );
      }
    }

    // Show result count if capped
    if (totalCount > MAX_RESULTS && this.activeTab !== 'all') {
      const countDiv = document.createElement('div');
      countDiv.className = 'enc-result-count';
      countDiv.textContent = `Showing ${MAX_RESULTS} of ${totalCount}`;
      this.listElement.appendChild(countDiv);
    }
  }

  private renderCategoryLanding() {
    const grid = document.createElement('div');
    grid.className = 'enc-cat-grid';

    const categories: { tab: EncyclopediaTab; icon: string; name: string; count: number }[] = [
      { tab: 'items', icon: '\u2694\uFE0F', name: 'Items', count: this.client.eif?.items.filter((i) => i?.name).length ?? 0 },
      { tab: 'npcs', icon: '\uD83D\uDC79', name: 'NPCs', count: this.client.enf?.npcs.filter((n) => n?.name).length ?? 0 },
      { tab: 'spells', icon: '\u2728', name: 'Spells', count: this.client.esf?.skills.filter((s) => s?.name).length ?? 0 },
      { tab: 'classes', icon: '\uD83C\uDFAD', name: 'Classes', count: this.client.ecf?.classes.filter((c) => c?.name).length ?? 0 },
    ];

    for (const category of categories) {
      const card = document.createElement('div');
      card.className = 'enc-cat-card';
      card.addEventListener('click', () => {
        this.activeTab = category.tab;
        this.updateTabHighlight();
        this.renderList();
      });

      const icon = document.createElement('div');
      icon.className = 'enc-cat-icon';
      icon.textContent = category.icon;
      card.appendChild(icon);

      const name = document.createElement('div');
      name.className = 'enc-cat-name';
      name.textContent = category.name;
      card.appendChild(name);

      const count = document.createElement('div');
      count.className = 'enc-cat-count';
      count.textContent = `${category.count} entries`;
      card.appendChild(count);

      grid.appendChild(card);
    }

    this.listElement.appendChild(grid);
  }

  private addGroupHeader(text: string) {
    const header = document.createElement('div');
    header.className = 'enc-group-header';
    header.textContent = text;
    this.listElement.appendChild(header);
  }

  private addListRow(
    type: 'item' | 'npc' | 'spell' | 'class',
    id: number,
    name: string,
    subtitle: string,
    badge: string,
    iconPath: string | null,
  ) {
    const row = document.createElement('div');
    row.className = 'enc-row';
    if (this.selectedType === type && this.selectedId === id) {
      row.classList.add('selected');
    }

    const iconContainer = document.createElement('div');
    iconContainer.className = 'enc-row-icon';
    if (iconPath) {
      const img = document.createElement('img');
      img.src = iconPath;
      img.loading = 'lazy';
      iconContainer.appendChild(img);
    }
    row.appendChild(iconContainer);

    const info = document.createElement('div');
    info.className = 'enc-row-info';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'enc-row-name';
    nameDiv.textContent = name;
    info.appendChild(nameDiv);

    const subDiv = document.createElement('div');
    subDiv.className = 'enc-row-sub';
    subDiv.textContent = subtitle;
    info.appendChild(subDiv);

    row.appendChild(info);

    if (badge) {
      const badgeDiv = document.createElement('div');
      badgeDiv.className = 'enc-row-badge';
      badgeDiv.textContent = badge;
      row.appendChild(badgeDiv);
    }

    row.addEventListener('click', () => this.selectEntry(type, id));
    this.listElement.appendChild(row);
  }

  // ── Entry selection & detail ──

  selectEntry(type: 'item' | 'npc' | 'spell' | 'class', id: number) {
    // Push to history if navigating from another entry
    if (this.selectedId > 0 && this.selectedType !== '') {
      this.history.push({
        tab: this.activeTab,
        type: this.selectedType as HistoryEntry['type'],
        id: this.selectedId,
      });
    }

    this.selectedType = type;
    this.selectedId = id;
    this.cleanupSourceListeners();
    this.highlightSelectedRow();
    this.renderDetail();
  }

  private navigateBack() {
    const entry = this.history.pop();
    if (!entry) return;

    this.selectedType = entry.type;
    this.selectedId = entry.id;
    this.activeTab = entry.tab;
    this.updateTabHighlight();
    this.cleanupSourceListeners();
    this.renderList();
    this.highlightSelectedRow();
    this.renderDetail();
  }

  private navigateTo(type: 'item' | 'npc' | 'spell' | 'class', id: number) {
    // Switch to the appropriate tab
    const tabMap = { item: 'items', npc: 'npcs', spell: 'spells', class: 'classes' } as const;
    this.activeTab = tabMap[type];
    this.updateTabHighlight();
    this.searchInput.value = '';
    this.selectEntry(type, id);
    this.renderList();
  }

  private highlightSelectedRow() {
    for (const row of this.listElement.querySelectorAll('.enc-row')) {
      row.classList.remove('selected');
    }
    // Find the matching row — rows don't have data attributes, so re-render handles this
  }

  private cleanupSourceListeners() {
    if (this.sourceCleanup) {
      this.sourceCleanup();
      this.sourceCleanup = null;
    }
  }

  // ── Detail rendering ──

  private renderDetail() {
    this.detailPanel.innerHTML = '';

    if (this.selectedType === '' || this.selectedId === 0) {
      const empty = document.createElement('div');
      empty.className = 'enc-detail-empty';
      empty.textContent = 'Select an entry to view details';
      this.detailPanel.appendChild(empty);
      return;
    }

    // Back button
    if (this.history.length > 0) {
      const back = document.createElement('button');
      back.className = 'enc-back';
      back.textContent = '\u2190 Back';
      back.addEventListener('click', () => this.navigateBack());
      this.detailPanel.appendChild(back);
    }

    switch (this.selectedType) {
      case 'item':
        this.renderItemDetail(this.selectedId);
        break;
      case 'npc':
        this.renderNpcDetail(this.selectedId);
        break;
      case 'spell':
        this.renderSpellDetail(this.selectedId);
        break;
      case 'class':
        this.renderClassDetail(this.selectedId);
        break;
    }

    // Handle mobile: show detail, hide list
    if (document.body.classList.contains('is-mobile')) {
      this.container.querySelector('.enc-list-panel')?.classList.add('enc-mobile-hidden');
      this.detailPanel.classList.remove('enc-mobile-hidden');
    }
  }

  // ── Item detail ──

  private renderItemDetail(itemId: number) {
    const record = this.client.getEifRecordById(itemId);
    if (!record) return;

    // Graphic
    this.addDetailGraphic(this.getItemIconPath(itemId, record));
    this.addDetailName(record.name);
    this.addDetailType(this.getItemSubtitle(record));

    // Combat stats
    const combatStats: [string, string][] = [];
    if (record.minDamage > 0 || record.maxDamage > 0) combatStats.push(['Damage', `${record.minDamage}-${record.maxDamage}`]);
    if (record.accuracy > 0) combatStats.push(['Accuracy', `+${record.accuracy}`]);
    if (record.evade > 0) combatStats.push(['Evade', `+${record.evade}`]);
    if (record.armor > 0) combatStats.push(['Armor', `+${record.armor}`]);
    if (record.returnDamage > 0) combatStats.push(['Return Dmg', `+${record.returnDamage}`]);
    if (combatStats.length > 0) this.addStatSection('Combat Stats', combatStats);

    // Attributes
    const attributes: [string, string][] = [];
    if (record.str > 0) attributes.push(['STR', `+${record.str}`]);
    if (record.intl > 0) attributes.push(['INT', `+${record.intl}`]);
    if (record.wis > 0) attributes.push(['WIS', `+${record.wis}`]);
    if (record.agi > 0) attributes.push(['AGI', `+${record.agi}`]);
    if (record.con > 0) attributes.push(['CON', `+${record.con}`]);
    if (record.cha > 0) attributes.push(['CHA', `+${record.cha}`]);
    if (attributes.length > 0) this.addStatSection('Attributes', attributes);

    // Restorative
    const restorative: [string, string][] = [];
    if (record.hp > 0) restorative.push(['HP', `+${record.hp}`]);
    if (record.tp > 0) restorative.push(['TP', `+${record.tp}`]);
    if (restorative.length > 0) this.addStatSection('Restorative', restorative);

    // Resistances
    const resistances: [string, string][] = [];
    if (record.lightResistance > 0) resistances.push(['Light', `${record.lightResistance}`]);
    if (record.darkResistance > 0) resistances.push(['Dark', `${record.darkResistance}`]);
    if (record.earthResistance > 0) resistances.push(['Earth', `${record.earthResistance}`]);
    if (record.airResistance > 0) resistances.push(['Air', `${record.airResistance}`]);
    if (record.waterResistance > 0) resistances.push(['Water', `${record.waterResistance}`]);
    if (record.fireResistance > 0) resistances.push(['Fire', `${record.fireResistance}`]);
    if (resistances.length > 0) this.addStatSection('Resistances', resistances);

    // Element
    if (record.element !== EoElement.None) {
      this.addStatSection('Element', [[getElementName(record.element), `${record.elementDamage}`]]);
    }

    // Properties
    const properties: [string, string][] = [];
    if (record.weight > 0) properties.push(['Weight', `${record.weight}`]);
    if (properties.length > 0) this.addStatSection('Properties', properties);

    // Requirements
    const requirements: [string, string][] = [];
    if (record.levelRequirement > 0) requirements.push(['Level', `${record.levelRequirement}`]);
    if (record.classRequirement > 0) {
      const classRecord = this.client.getEcfRecordById(record.classRequirement);
      if (classRecord) {
        requirements.push(['Class', `__class:${record.classRequirement}:${classRecord.name}`]);
      } else {
        requirements.push(['Class', `#${record.classRequirement}`]);
      }
    }
    if (record.strRequirement > 0) requirements.push(['STR', `${record.strRequirement}`]);
    if (record.intRequirement > 0) requirements.push(['INT', `${record.intRequirement}`]);
    if (record.wisRequirement > 0) requirements.push(['WIS', `${record.wisRequirement}`]);
    if (record.agiRequirement > 0) requirements.push(['AGI', `${record.agiRequirement}`]);
    if (record.conRequirement > 0) requirements.push(['CON', `${record.conRequirement}`]);
    if (record.chaRequirement > 0) requirements.push(['CHA', `${record.chaRequirement}`]);
    if (requirements.length > 0) this.addStatSection('Requirements', requirements);

    // Sources — loading placeholder, then async fill
    this.addSectionHeader('Sources');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'enc-loading';
    loadingDiv.textContent = 'Loading...';
    this.detailPanel.appendChild(loadingDiv);

    this.requestItemSources(itemId, loadingDiv);
  }

  // ── NPC detail ──

  private renderNpcDetail(npcId: number) {
    const record = this.client.getEnfRecordById(npcId);
    if (!record) return;

    // Graphic
    this.addDetailGraphic(this.getNpcIconPath(record));
    this.addDetailName(record.name);

    let typeStr = getNpcTypeName(record.type);
    if (record.boss) typeStr += ' \u2022 Boss';
    this.addDetailType(typeStr);

    // Combat stats
    const combatStats: [string, string][] = [];
    if (record.hp > 0) combatStats.push(['HP', `${record.hp}`]);
    if (record.tp > 0) combatStats.push(['TP', `${record.tp}`]);
    if (record.minDamage > 0 || record.maxDamage > 0) combatStats.push(['Damage', `${record.minDamage}-${record.maxDamage}`]);
    if (record.accuracy > 0) combatStats.push(['Accuracy', `${record.accuracy}`]);
    if (record.evade > 0) combatStats.push(['Evade', `${record.evade}`]);
    if (record.armor > 0) combatStats.push(['Armor', `${record.armor}`]);
    if (record.returnDamage > 0) combatStats.push(['Return Dmg', `${record.returnDamage}`]);
    if (record.level > 0) combatStats.push(['Level', `${record.level}`]);
    if (record.experience > 0) combatStats.push(['Experience', `${record.experience}`]);
    if (combatStats.length > 0) this.addStatSection('Combat Stats', combatStats);

    // Element
    const elementStats: [string, string][] = [];
    if (record.element !== EoElement.None) elementStats.push(['Element', `${getElementName(record.element)} (${record.elementDamage})`]);
    if (record.elementWeakness !== EoElement.None) elementStats.push(['Weakness', `${getElementName(record.elementWeakness)} (${record.elementWeaknessDamage})`]);
    if (elementStats.length > 0) this.addStatSection('Element', elementStats);

    // Sources — loading placeholder
    this.addSectionHeader('Sources');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'enc-loading';
    loadingDiv.textContent = 'Loading...';
    this.detailPanel.appendChild(loadingDiv);

    this.requestNpcSources(npcId, loadingDiv);
  }

  // ── Spell detail ──

  private renderSpellDetail(spellId: number) {
    const record = this.client.getEsfRecordById(spellId);
    if (!record) return;

    // Graphic (spell icon)
    this.addDetailGraphic(this.getSpellIconPath(record));
    this.addDetailName(record.name);
    this.addDetailType(`${getSkillNatureName(record.nature)} \u2022 ${getSkillTypeName(record.type)}`);

    // Costs
    const costs: [string, string][] = [];
    if (record.tpCost > 0) costs.push(['TP Cost', `${record.tpCost}`]);
    if (record.spCost > 0) costs.push(['SP Cost', `${record.spCost}`]);
    if (record.castTime > 0) costs.push(['Cast Time', `${record.castTime}`]);
    if (costs.length > 0) this.addStatSection('Costs', costs);

    // Targeting
    const targeting: [string, string][] = [];
    targeting.push(['Target', getTargetTypeName(record.targetType)]);
    targeting.push(['Restrict', getTargetRestrictName(record.targetRestrict)]);
    if (targeting.length > 0) this.addStatSection('Targeting', targeting);

    // Power
    const power: [string, string][] = [];
    if (record.minDamage > 0 || record.maxDamage > 0) power.push(['Damage', `${record.minDamage}-${record.maxDamage}`]);
    if (record.accuracy > 0) power.push(['Accuracy', `+${record.accuracy}`]);
    if (record.evade > 0) power.push(['Evade', `+${record.evade}`]);
    if (record.armor > 0) power.push(['Armor', `+${record.armor}`]);
    if (power.length > 0) this.addStatSection('Power', power);

    // Healing
    const healing: [string, string][] = [];
    if (record.hpHeal > 0) healing.push(['HP Heal', `${record.hpHeal}`]);
    if (record.tpHeal > 0) healing.push(['TP Heal', `${record.tpHeal}`]);
    if (record.spHeal > 0) healing.push(['SP Heal', `${record.spHeal}`]);
    if (healing.length > 0) this.addStatSection('Healing', healing);

    // Attributes
    const attributes: [string, string][] = [];
    if (record.str > 0) attributes.push(['STR', `+${record.str}`]);
    if (record.intl > 0) attributes.push(['INT', `+${record.intl}`]);
    if (record.wis > 0) attributes.push(['WIS', `+${record.wis}`]);
    if (record.agi > 0) attributes.push(['AGI', `+${record.agi}`]);
    if (record.con > 0) attributes.push(['CON', `+${record.con}`]);
    if (record.cha > 0) attributes.push(['CHA', `+${record.cha}`]);
    if (attributes.length > 0) this.addStatSection('Attributes', attributes);

    // Element
    if (record.element !== EoElement.None) {
      this.addStatSection('Element', [[getElementName(record.element), `${record.elementPower}`]]);
    }

    // Info
    const info: [string, string][] = [];
    if (record.maxSkillLevel > 0) info.push(['Max Level', `${record.maxSkillLevel}`]);
    if (record.chant) info.push(['Chant', record.chant]);
    if (info.length > 0) this.addStatSection('Info', info);

    // Learned by (cross-reference ECF)
    this.addSectionHeader('Learned By');
    let foundClass = false;
    if (this.client.ecf) {
      for (let i = 0; i < this.client.ecf.classes.length; i++) {
        const classRecord = this.client.ecf.classes[i];
        if (!classRecord?.name) continue;
        // Check if any spells require this class
        if (this.client.esf) {
          for (let j = 0; j < this.client.esf.skills.length; j++) {
            const spell = this.client.esf.skills[j];
            if (spell && spell.classRequirement === i + 1) {
              // This class has at least one spell — but we want classes that can learn THIS spell
              break;
            }
          }
        }
      }
    }
    // Simpler approach: check if this spell has a classRequirement
    if (record.classRequirement > 0) {
      const classRecord = this.client.getEcfRecordById(record.classRequirement);
      if (classRecord) {
        this.addSourceLink('class', record.classRequirement, classRecord.name);
        foundClass = true;
      }
    }
    if (!foundClass) {
      const row = document.createElement('div');
      row.className = 'enc-source-row';
      row.textContent = 'All classes';
      this.detailPanel.appendChild(row);
    }
  }

  // ── Class detail ──

  private renderClassDetail(classId: number) {
    const record = this.client.getEcfRecordById(classId);
    if (!record) return;

    this.addDetailName(record.name);
    this.addDetailType(`Class Type ${record.type}`);

    // Base stat bonuses
    const stats: [string, string][] = [];
    if (record.str > 0) stats.push(['STR', `+${record.str}`]);
    if (record.intl > 0) stats.push(['INT', `+${record.intl}`]);
    if (record.wis > 0) stats.push(['WIS', `+${record.wis}`]);
    if (record.agi > 0) stats.push(['AGI', `+${record.agi}`]);
    if (record.con > 0) stats.push(['CON', `+${record.con}`]);
    if (record.cha > 0) stats.push(['CHA', `+${record.cha}`]);
    if (stats.length > 0) {
      this.addStatSection('Base Stat Bonuses', stats);
    }

    // Learnable spells (cross-reference ESF classRequirement)
    this.addSectionHeader('Learnable Spells');
    let spellCount = 0;
    if (this.client.esf) {
      for (let i = 0; i < this.client.esf.skills.length; i++) {
        const spell = this.client.esf.skills[i];
        if (spell?.name && spell.classRequirement === classId) {
          this.addSourceLink('spell', i + 1, spell.name);
          spellCount++;
        }
      }
    }
    if (spellCount === 0) {
      const row = document.createElement('div');
      row.className = 'enc-source-row';
      row.textContent = 'None';
      this.detailPanel.appendChild(row);
    }

    // Equippable items (cross-reference EIF classRequirement)
    this.addSectionHeader('Equippable Items');
    const equippable: { id: number; name: string }[] = [];
    if (this.client.eif) {
      for (let i = 0; i < this.client.eif.items.length; i++) {
        const item = this.client.eif.items[i];
        if (item?.name && item.classRequirement === classId) {
          equippable.push({ id: i + 1, name: item.name });
        }
      }
    }

    const INITIAL_SHOW = 10;
    if (equippable.length === 0) {
      const row = document.createElement('div');
      row.className = 'enc-source-row';
      row.textContent = 'None';
      this.detailPanel.appendChild(row);
    } else {
      const shown = equippable.slice(0, INITIAL_SHOW);
      for (const item of shown) {
        this.addSourceLink('item', item.id, item.name);
      }
      if (equippable.length > INITIAL_SHOW) {
        const remaining = equippable.slice(INITIAL_SHOW);
        const toggleButton = document.createElement('button');
        toggleButton.className = 'enc-show-all';
        toggleButton.textContent = `Show ${remaining.length} more...`;
        toggleButton.addEventListener('click', () => {
          toggleButton.remove();
          for (const item of remaining) {
            this.addSourceLink('item', item.id, item.name);
          }
        });
        this.detailPanel.appendChild(toggleButton);
      }
    }
  }

  // ── Source data requests ──

  private requestItemSources(itemId: number, loadingDiv: HTMLElement) {
    const handler = (data: {
      drops: { npcName: string; dropRate: number }[];
      shops: { npcName: string; price: number }[];
      crafts: { npcName: string; ingredients: string }[];
    }) => {
      loadingDiv.remove();

      const hasData = data.drops.length > 0 || data.shops.length > 0 || data.crafts.length > 0;
      if (!hasData) {
        const row = document.createElement('div');
        row.className = 'enc-source-row';
        row.textContent = 'No source data available';
        this.detailPanel.appendChild(row);
        return;
      }

      if (data.drops.length > 0) {
        this.addSectionHeader('Dropped By');
        for (const drop of data.drops) {
          // Try to find the NPC ID by name for cross-linking
          const npcId = this.findNpcIdByName(drop.npcName);
          if (npcId > 0) {
            this.addSourceLinkWithSuffix('npc', npcId, drop.npcName, ` (${drop.dropRate.toFixed(1)}%)`);
          } else {
            const row = document.createElement('div');
            row.className = 'enc-source-row';
            row.innerHTML = '';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = drop.npcName;
            row.appendChild(nameSpan);
            row.appendChild(document.createTextNode(` (${drop.dropRate.toFixed(1)}%)`));
            this.detailPanel.appendChild(row);
          }
        }
      }

      if (data.shops.length > 0) {
        this.addSectionHeader('Sold By');
        for (const shop of data.shops) {
          const npcId = this.findNpcIdByName(shop.npcName);
          if (npcId > 0) {
            this.addSourceLinkWithSuffix('npc', npcId, shop.npcName, ` \u2014 ${shop.price}g`);
          } else {
            const row = document.createElement('div');
            row.className = 'enc-source-row';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = shop.npcName;
            row.appendChild(nameSpan);
            row.appendChild(document.createTextNode(` \u2014 ${shop.price}g`));
            this.detailPanel.appendChild(row);
          }
        }
      }

      if (data.crafts.length > 0) {
        this.addSectionHeader('Crafted At');
        for (const craft of data.crafts) {
          const npcId = this.findNpcIdByName(craft.npcName);
          if (npcId > 0) {
            this.addSourceLinkWithSuffix('npc', npcId, craft.npcName, ` (${craft.ingredients})`);
          } else {
            const row = document.createElement('div');
            row.className = 'enc-source-row';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = craft.npcName;
            row.appendChild(nameSpan);
            row.appendChild(document.createTextNode(` (${craft.ingredients})`));
            this.detailPanel.appendChild(row);
          }
        }
      }
    };

    this.client.on('updateItemSources', handler);
    this.sourceCleanup = () => this.client.off('updateItemSources', handler);

    // Send the source request packet (reuse lookup-commands logic)
    const { EoWriter, PacketFamily } = require('eolib');
    const writer = new EoWriter();
    writer.addShort(itemId);
    this.client.bus.sendBuf(PacketFamily.Item, 19, writer.toByteArray());
  }

  private requestNpcSources(npcId: number, loadingDiv: HTMLElement) {
    const handler = (data: {
      drops: { itemName: string; amount: string; dropRate: number }[];
      shopItems: { itemName: string; buyPrice: number; sellPrice: number }[];
      crafts: { itemName: string; ingredients: string }[];
      spawnMaps: number[];
    }) => {
      loadingDiv.remove();

      const hasData = data.drops.length > 0 || data.shopItems.length > 0 || data.crafts.length > 0 || data.spawnMaps.length > 0;
      if (!hasData) {
        const row = document.createElement('div');
        row.className = 'enc-source-row';
        row.textContent = 'No source data available';
        this.detailPanel.appendChild(row);
        return;
      }

      if (data.drops.length > 0) {
        this.addSectionHeader('Drops');
        for (const drop of data.drops) {
          const itemId = this.findItemIdByName(drop.itemName);
          if (itemId > 0) {
            this.addSourceLinkWithSuffix('item', itemId, drop.itemName, ` x${drop.amount} (${drop.dropRate.toFixed(1)}%)`);
          } else {
            const row = document.createElement('div');
            row.className = 'enc-source-row';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = drop.itemName;
            row.appendChild(nameSpan);
            row.appendChild(document.createTextNode(` x${drop.amount} (${drop.dropRate.toFixed(1)}%)`));
            this.detailPanel.appendChild(row);
          }
        }
      }

      if (data.shopItems.length > 0) {
        this.addSectionHeader('Shop Inventory');
        for (const item of data.shopItems) {
          const itemId = this.findItemIdByName(item.itemName);
          if (itemId > 0) {
            this.addSourceLinkWithSuffix('item', itemId, item.itemName, ` (Buy: ${item.buyPrice}g / Sell: ${item.sellPrice}g)`);
          } else {
            const row = document.createElement('div');
            row.className = 'enc-source-row';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = item.itemName;
            row.appendChild(nameSpan);
            row.appendChild(document.createTextNode(` (Buy: ${item.buyPrice}g / Sell: ${item.sellPrice}g)`));
            this.detailPanel.appendChild(row);
          }
        }
      }

      if (data.crafts.length > 0) {
        this.addSectionHeader('Crafts');
        for (const craft of data.crafts) {
          const itemId = this.findItemIdByName(craft.itemName);
          if (itemId > 0) {
            this.addSourceLinkWithSuffix('item', itemId, craft.itemName, ` (${craft.ingredients})`);
          } else {
            const row = document.createElement('div');
            row.className = 'enc-source-row';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = craft.itemName;
            row.appendChild(nameSpan);
            row.appendChild(document.createTextNode(` (${craft.ingredients})`));
            this.detailPanel.appendChild(row);
          }
        }
      }

      if (data.spawnMaps.length > 0) {
        this.addSectionHeader('Spawn Maps');
        const row = document.createElement('div');
        row.className = 'enc-source-row';
        row.textContent = `Maps: ${data.spawnMaps.join(', ')}`;
        this.detailPanel.appendChild(row);
      }
    };

    this.client.on('updateNpcSources', handler);
    this.sourceCleanup = () => this.client.off('updateNpcSources', handler);

    // Send the source request packet
    const { EoWriter, PacketFamily } = require('eolib');
    const writer = new EoWriter();
    writer.addShort(npcId);
    this.client.bus.sendBuf(PacketFamily.Npc, 20, writer.toByteArray());
  }

  // ── Lookup helpers ──

  private findNpcIdByName(name: string): number {
    if (!this.client.enf) return 0;
    for (let i = 0; i < this.client.enf.npcs.length; i++) {
      if (this.client.enf.npcs[i]?.name === name) return i + 1;
    }
    return 0;
  }

  private findItemIdByName(name: string): number {
    if (!this.client.eif) return 0;
    for (let i = 0; i < this.client.eif.items.length; i++) {
      if (this.client.eif.items[i]?.name === name) return i + 1;
    }
    return 0;
  }

  // ── Detail DOM helpers ──

  private addDetailGraphic(iconPath: string | null) {
    const container = document.createElement('div');
    container.className = 'enc-detail-graphic';
    if (iconPath) {
      const img = document.createElement('img');
      img.src = iconPath;
      container.appendChild(img);
    }
    this.detailPanel.appendChild(container);
  }

  private addDetailName(name: string) {
    const div = document.createElement('div');
    div.className = 'enc-detail-name';
    div.textContent = name;
    this.detailPanel.appendChild(div);
  }

  private addDetailType(type: string) {
    const div = document.createElement('div');
    div.className = 'enc-detail-type';
    div.textContent = type;
    this.detailPanel.appendChild(div);
  }

  private addSectionHeader(text: string) {
    const header = document.createElement('div');
    header.className = 'enc-section-header';
    header.textContent = text;
    this.detailPanel.appendChild(header);
  }

  private addStatSection(title: string, stats: [string, string][]) {
    this.addSectionHeader(title);
    const grid = document.createElement('div');
    grid.className = 'enc-stat-grid';
    for (const [label, value] of stats) {
      const stat = document.createElement('div');
      stat.className = 'enc-stat';

      // Handle cross-links in values (e.g., "__class:3:Mage")
      if (value.startsWith('__class:')) {
        const parts = value.split(':');
        const classId = Number.parseInt(parts[1], 10);
        const className = parts[2];

        const labelSpan = document.createElement('span');
        labelSpan.className = 'label';
        labelSpan.textContent = label;
        stat.appendChild(labelSpan);

        const link = document.createElement('span');
        link.className = 'enc-link';
        link.textContent = className;
        link.addEventListener('click', () => this.navigateTo('class', classId));
        stat.appendChild(link);
      } else {
        const labelSpan = document.createElement('span');
        labelSpan.className = 'label';
        labelSpan.textContent = label;
        stat.appendChild(labelSpan);

        const valueSpan = document.createElement('span');
        valueSpan.className = 'value';
        valueSpan.textContent = value;
        stat.appendChild(valueSpan);
      }

      grid.appendChild(stat);
    }
    this.detailPanel.appendChild(grid);
  }

  private addSourceLink(type: 'item' | 'npc' | 'spell' | 'class', id: number, name: string) {
    const row = document.createElement('div');
    row.className = 'enc-source-row';
    const link = document.createElement('span');
    link.className = 'enc-link';
    link.textContent = name;
    link.addEventListener('click', () => this.navigateTo(type, id));
    row.appendChild(link);
    this.detailPanel.appendChild(row);
  }

  private addSourceLinkWithSuffix(type: 'item' | 'npc' | 'spell' | 'class', id: number, name: string, suffix: string) {
    const row = document.createElement('div');
    row.className = 'enc-source-row';
    const link = document.createElement('span');
    link.className = 'enc-link';
    link.textContent = name;
    link.addEventListener('click', () => this.navigateTo(type, id));
    row.appendChild(link);
    row.appendChild(document.createTextNode(suffix));
    this.detailPanel.appendChild(row);
  }

  // ── Graphic path helpers ──

  private getItemIconPath(itemId: number, record: EifRecord): string {
    return getItemGraphicPath(itemId, record.graphicId);
  }

  private getNpcIconPath(record: EnfRecord): string | null {
    if (!record.graphicId || record.graphicId <= 0) return null;
    // NPC standing south frame: (graphicId - 1) * 40 + 1 (1-based)
    const frameId = (record.graphicId - 1) * 40 + 1;
    return `/gfx/gfx021/${100 + frameId}.png`;
  }

  private getSpellIconPath(record: EsfRecord): string | null {
    if (!record.iconId || record.iconId <= 0) return null;
    return `/gfx/gfx025/${record.iconId + 100}.png`;
  }

  // ── Subtitle/badge helpers ──

  private getItemSubtitle(record: EifRecord): string {
    const type = getItemTypeName(record.type);
    if (record.levelRequirement > 0) return `${type} \u2022 Lv ${record.levelRequirement}`;
    return type;
  }

  private getItemBadge(record: EifRecord): string {
    if (record.minDamage > 0 || record.maxDamage > 0) return `Dmg ${record.minDamage}-${record.maxDamage}`;
    if (record.armor > 0) return `Arm ${record.armor}`;
    if (record.hp > 0) return `+${record.hp} HP`;
    return '';
  }

  private getNpcSubtitle(record: EnfRecord): string {
    const type = getNpcTypeName(record.type);
    if (record.boss) return `${type} \u2022 Boss`;
    if (record.level > 0) return `${type} \u2022 Lv ${record.level}`;
    return type;
  }

  private getNpcBadge(record: EnfRecord): string {
    if (record.hp > 0) return `HP ${record.hp}`;
    return '';
  }

  private getSpellSubtitle(record: EsfRecord): string {
    const nature = getSkillNatureName(record.nature);
    if (record.tpCost > 0) return `${nature} \u2022 TP ${record.tpCost}`;
    return nature;
  }

  private getSpellBadge(record: EsfRecord): string {
    if (record.minDamage > 0 || record.maxDamage > 0) return `Dmg ${record.minDamage}-${record.maxDamage}`;
    if (record.hpHeal > 0) return `Heal ${record.hpHeal}`;
    return '';
  }

  private getClassSubtitle(record: EcfRecord): string {
    const bonuses: string[] = [];
    if (record.str > 0) bonuses.push(`STR+${record.str}`);
    if (record.intl > 0) bonuses.push(`INT+${record.intl}`);
    if (record.wis > 0) bonuses.push(`WIS+${record.wis}`);
    if (record.agi > 0) bonuses.push(`AGI+${record.agi}`);
    if (record.con > 0) bonuses.push(`CON+${record.con}`);
    if (record.cha > 0) bonuses.push(`CHA+${record.cha}`);
    return bonuses.join(' ') || 'No bonuses';
  }
}

// ── Enum name helpers ──

function getItemTypeName(type: ItemType): string {
  switch (type) {
    case ItemType.General: return 'General';
    case ItemType.Currency: return 'Currency';
    case ItemType.Heal: return 'Potion';
    case ItemType.Teleport: return 'Teleport';
    case ItemType.Spell: return 'Scroll';
    case ItemType.ExpReward: return 'Exp Reward';
    case ItemType.StatReward: return 'Stat Reward';
    case ItemType.SkillReward: return 'Skill Reward';
    case ItemType.Key: return 'Key';
    case ItemType.Weapon: return 'Weapon';
    case ItemType.Shield: return 'Shield';
    case ItemType.Armor: return 'Armor';
    case ItemType.Hat: return 'Hat';
    case ItemType.Boots: return 'Boots';
    case ItemType.Gloves: return 'Gloves';
    case ItemType.Accessory: return 'Accessory';
    case ItemType.Belt: return 'Belt';
    case ItemType.Necklace: return 'Necklace';
    case ItemType.Ring: return 'Ring';
    case ItemType.Armlet: return 'Armlet';
    case ItemType.Bracer: return 'Bracer';
    case ItemType.Alcohol: return 'Beverage';
    case ItemType.EffectPotion: return 'Effect';
    case ItemType.HairDye: return 'Hair Dye';
    case ItemType.CureCurse: return 'Cure';
    default: return 'Unknown';
  }
}

function getNpcTypeName(type: NpcType): string {
  switch (type) {
    case NpcType.Friendly: return 'Friendly';
    case NpcType.Passive: return 'Passive';
    case NpcType.Aggressive: return 'Aggressive';
    case NpcType.Shop: return 'Shop';
    case NpcType.Inn: return 'Inn';
    case NpcType.Bank: return 'Bank';
    case NpcType.Barber: return 'Barber';
    case NpcType.Guild: return 'Guild';
    case NpcType.Priest: return 'Priest';
    case NpcType.Lawyer: return 'Lawyer';
    case NpcType.Trainer: return 'Trainer';
    case NpcType.Quest: return 'Quest';
    default: return 'Unknown';
  }
}

function getSkillNatureName(nature: SkillNature): string {
  switch (nature) {
    case SkillNature.Spell: return 'Spell';
    case SkillNature.Skill: return 'Skill';
    default: return 'Unknown';
  }
}

function getSkillTypeName(type: SkillType): string {
  switch (type) {
    case SkillType.Heal: return 'Heal';
    case SkillType.Attack: return 'Attack';
    case SkillType.Bard: return 'Bard';
    default: return 'Unknown';
  }
}

function getTargetTypeName(type: SkillTargetType): string {
  switch (type) {
    case SkillTargetType.Normal: return 'Normal';
    case SkillTargetType.Self: return 'Self';
    case SkillTargetType.Group: return 'Group';
    default: return 'Unknown';
  }
}

function getTargetRestrictName(restrict: SkillTargetRestrict): string {
  switch (restrict) {
    case SkillTargetRestrict.Npc: return 'NPC';
    case SkillTargetRestrict.Friendly: return 'Friendly';
    case SkillTargetRestrict.Opponent: return 'Opponent';
    default: return 'None';
  }
}

function getElementName(element: EoElement): string {
  switch (element) {
    case EoElement.Light: return 'Light';
    case EoElement.Dark: return 'Dark';
    case EoElement.Earth: return 'Earth';
    case EoElement.Wind: return 'Air';
    case EoElement.Water: return 'Water';
    case EoElement.Fire: return 'Fire';
    default: return 'None';
  }
}
```

**Important note on `require('eolib')`:** The source request methods use `require` to avoid adding imports that collide with the eolib type imports at the top. In the actual implementation, change these to use top-level imports — add `EoWriter`, `PacketFamily`, and `PacketAction` to the existing eolib import at the top of the file, and replace the `require` calls with direct usage. The `19` constant should be `19 as unknown as PacketAction` (matching lookup-commands.ts pattern) and `20` should be `PacketAction.Tell`.

- [ ] **Step 3: Fix the eolib imports — replace require() with proper imports**

Update the top import to include `EoWriter`, `PacketFamily`, `PacketAction`:

```typescript
import {
  type EcfRecord,
  type EifRecord,
  type EnfRecord,
  type EsfRecord,
  Element as EoElement,
  EoWriter,
  ItemType,
  NpcType,
  PacketAction,
  PacketFamily,
  SkillNature,
  SkillTargetRestrict,
  SkillTargetType,
  SkillType,
} from 'eolib';
```

Add constants after the imports (matching lookup-commands.ts pattern):

```typescript
const ITEM_SOURCE_ACTION = 19 as unknown as PacketAction;
const NPC_SOURCE_ACTION = PacketAction.Tell; // action 20
```

Then in `requestItemSources`, replace the `require` block:

```typescript
const writer = new EoWriter();
writer.addShort(itemId);
this.client.bus.sendBuf(PacketFamily.Item, ITEM_SOURCE_ACTION, writer.toByteArray());
```

And in `requestNpcSources`:

```typescript
const writer = new EoWriter();
writer.addShort(npcId);
this.client.bus.sendBuf(PacketFamily.Npc, NPC_SOURCE_ACTION, writer.toByteArray());
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors. Fix any type issues (check eolib enum exports exist — if `SkillNature`, `SkillType`, `SkillTargetType`, `SkillTargetRestrict`, or `Element` aren't exported from eolib, use numeric comparisons instead).

- [ ] **Step 5: Commit**

```bash
git add src/ui/encyclopedia/
git commit -m "feat(encyclopedia): add main component with search, list, and detail rendering"
```

---

### Task 4: Wire Into Application

**Files:**
- Modify: `src/ui/in-game-menu/in-game-menu.ts`
- Modify: `src/wiring/ui-events.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Add 'encyclopedia' to InGameMenu toggle type**

In `src/ui/in-game-menu/in-game-menu.ts`, add `'encyclopedia'` to the toggle union:

```typescript
type Events = {
  toggle:
    | 'inventory'
    | 'map'
    | 'spells'
    | 'stats'
    | 'online'
    | 'party'
    | 'quests'
    | 'encyclopedia'
    | 'settings';
};
```

- [ ] **Step 2: Add encyclopedia to UiEventDeps and wiring**

In `src/wiring/ui-events.ts`, add to the `UiEventDeps` interface:

```typescript
encyclopedia: { toggle(): void };
```

Add it after the `guildPanel` line (around line 122).

Then in the `handleToggle` switch statement (around line 393, after the `quests` case), add:

```typescript
case 'encyclopedia':
  deps.encyclopedia.toggle();
  break;
```

- [ ] **Step 3: Import and instantiate in main.ts**

In `src/main.ts`, add the import (near the other UI imports):

```typescript
import { Encyclopedia } from './ui/encyclopedia';
```

Add the instantiation (after the `infoDialog` line, around line 249):

```typescript
const encyclopedia = new Encyclopedia(client);
```

Then add `encyclopedia` to the `wireUiEvents` call. Find the existing call and add the property:

```typescript
encyclopedia,
```

- [ ] **Step 4: Verify it builds**

Run: `pnpm build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui/in-game-menu/in-game-menu.ts src/wiring/ui-events.ts src/main.ts
git commit -m "feat(encyclopedia): wire into menu, events, and main"
```

---

### Task 5: Manual Testing & Fixes

**Files:**
- Possibly modify: `src/ui/encyclopedia/encyclopedia.ts`, `src/ui/encyclopedia/encyclopedia.css`

- [ ] **Step 1: Start dev server and test**

Run: `pnpm dev`

Test in browser:
1. Log into the game
2. Click the Encyclopedia button in the right-side menu — panel should open centered
3. Verify "All" tab shows category landing grid with correct entry counts
4. Click "Items" category card — should switch to Items tab with full item list
5. Type in search box — list should filter after 150ms debounce
6. Click an item — right detail panel should show stats, graphic, and source data (loading then filling)
7. Click a cross-linked NPC name in "Dropped By" — should navigate to that NPC's detail
8. Click "Back" button — should return to the previous item
9. Test each tab: NPCs, Spells, Classes
10. Press Escape — should close
11. Test on narrow viewport (mobile) — should go full-screen with stacked layout

- [ ] **Step 2: Fix any issues found during testing**

Common issues to check:
- NPC graphic path formula: verify the standing frame renders (may need to adjust the frame index — try `(graphicId - 1) * 40 + 1` first, if that doesn't render try nearby indices)
- Spell icon path: verify `/gfx/gfx025/${iconId + 100}.png` renders correctly
- eolib enum exports: if any enums aren't available, replace with numeric values
- Source data: verify the custom packets are sent and responses arrive (check network tab)
- Scroll behavior: verify the list scrolls properly with 50+ results
- Search: verify partial matching works, empty search shows all

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: No errors. Fix any issues.

- [ ] **Step 4: Run build**

Run: `pnpm build`
Expected: Build succeeds.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(encyclopedia): polish and fixes from manual testing"
```

---

### Task 6: Mobile Back Navigation

**Files:**
- Modify: `src/ui/encyclopedia/encyclopedia.ts`

- [ ] **Step 1: Add mobile back button to detail panel**

In the `renderDetail` method, after handling the history back button, add mobile-specific back navigation. When on mobile and the detail panel is visible, the existing back button should also restore the list panel:

In `renderDetail`, update the mobile handling section at the bottom:

```typescript
// Handle mobile: show detail, hide list
if (document.body.classList.contains('is-mobile')) {
  this.container.querySelector('.enc-list-panel')?.classList.add('enc-mobile-hidden');
  this.detailPanel.classList.remove('enc-mobile-hidden');
}
```

Add a mobile back handler in the constructor:

```typescript
// Mobile: back to list when detail panel back button is clicked
this.detailPanel.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.classList.contains('enc-back') && document.body.classList.contains('is-mobile')) {
    this.container.querySelector('.enc-list-panel')?.classList.remove('enc-mobile-hidden');
    this.detailPanel.classList.add('enc-mobile-hidden');
  }
});
```

Also update `show()` to reset mobile state:

```typescript
show() {
  this.container.classList.remove('hidden');
  // Reset mobile state
  this.container.querySelector('.enc-list-panel')?.classList.remove('enc-mobile-hidden');
  this.detailPanel.classList.remove('enc-mobile-hidden');
  this.searchInput.focus();
  this.renderList();
}
```

- [ ] **Step 2: Verify mobile behavior**

Test with narrow viewport or mobile device emulation:
1. Open encyclopedia — list should be visible
2. Tap an entry — list hides, detail shows
3. Tap back — detail hides, list shows
4. Widen viewport — both panels should be visible side by side

- [ ] **Step 3: Commit**

```bash
git add src/ui/encyclopedia/encyclopedia.ts
git commit -m "feat(encyclopedia): add mobile back navigation"
```
