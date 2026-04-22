import { type Item, ItemSize, ItemType } from 'eolib';
import mitt from 'mitt';
import {
  type Client,
  type EquipmentSlot,
  getEquipmentSlotFromString,
} from '../../client';
import { isMobile } from '../../main';
import { settings } from '../../settings';
import { playSfxById, SfxId } from '../../sfx';
import { getItemMeta } from '../../utils';
import type { Vector2 } from '../../vector';
import { Base } from '../base-ui';
import { addMobileCloseButton } from '../utils';

import './inventory.css';

type ItemPosition = {
  id: number;
  tab: number;
  x: number;
  y: number;
};

const DEFAULT_COLS = 8;
const DEFAULT_ROWS = 10;
const CELL_SIZE = 26; // px — fixed cell size

const ITEM_SIZE = {
  [ItemSize.Size1x1]: { x: 1, y: 1 },
  [ItemSize.Size1x2]: { x: 1, y: 2 },
  [ItemSize.Size1x3]: { x: 1, y: 3 },
  [ItemSize.Size1x4]: { x: 1, y: 4 },
  [ItemSize.Size2x1]: { x: 2, y: 1 },
  [ItemSize.Size2x2]: { x: 2, y: 2 },
  [ItemSize.Size2x3]: { x: 2, y: 3 },
  [ItemSize.Size2x4]: { x: 2, y: 4 },
};

type Events = {
  dropItem: { at: 'cursor' | 'feet'; itemId: number };
  useItem: number;
  openPaperdoll: undefined;
  equipItem: { slot: EquipmentSlot; itemId: number };
  junkItem: number;
  addChestItem: number;
  addLockerItem: number;
  addTradeItem: number;
  assignToSlot: { itemId: number; slotIndex: number };
};

export class Inventory extends Base {
  private client: Client;
  private emitter = mitt<Events>();
  protected container: HTMLDivElement = document.querySelector('#inventory')!;
  private grid: HTMLDivElement = this.container.querySelector('.grid')!;
  private positions: ItemPosition[] = [];
  private tab = 0;
  private tabCount = 1;
  private activeCols = DEFAULT_COLS;
  private activeRows = DEFAULT_ROWS;
  private tabsContainer: HTMLDivElement =
    this.container.querySelector('.tabs')!;
  private uiContainer = document.getElementById('ui')!;
  private pointerDownAt = 0;

  private dragging: {
    item: Item;
    el: HTMLElement;
    pointerId: number;
    ghost: HTMLElement;
    offsetX: number;
    offsetY: number;
  } | null = null;

  private boundOnPointerMove = this.onPointerMove.bind(this);
  private boundOnPointerUp = this.onPointerUp.bind(this);
  private boundOnPointerCancel = this.onPointerCancel.bind(this);

  private currentWeight: HTMLSpanElement =
    this.container.querySelector('.weight .current')!;
  private maxWeight: HTMLSpanElement =
    this.container.querySelector('.weight .max')!;
  private btnPaperdoll: HTMLButtonElement = this.container.querySelector(
    'button[data-id="paperdoll"]',
  )!;
  private btnDrop: HTMLButtonElement = this.container.querySelector(
    'button[data-id="drop"]',
  )!;
  private btnJunk: HTMLButtonElement = this.container.querySelector(
    'button[data-id="junk"]',
  )!;
  private lastItemSelected = 0;
  private mobileActionBar: HTMLDivElement | null = null;

  private onPointerDown(e: PointerEvent, el: HTMLDivElement, item: Item) {
    if (e.button !== 0 && e.pointerType !== 'touch') return;

    // On mobile: tap to select + show action bar (no drag)
    if (isMobile()) {
      e.preventDefault();
      e.stopPropagation();
      this.selectMobileItem(el, item);
      return;
    }

    const now = new Date();
    if (this.pointerDownAt) {
      const diff = now.getTime() - this.pointerDownAt;
      if (diff < 200) {
        this.emitter.emit('useItem', item.id);
      }
      this.pointerDownAt = now.getTime();
    } else {
      this.pointerDownAt = now.getTime();
    }

    const rect = el.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const ghost = el.querySelector('img')!.cloneNode(true) as HTMLElement;
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.margin = '0';
    ghost.style.inset = 'auto';
    ghost.style.left = '0';
    ghost.style.top = '0';
    ghost.style.transform = `translate(${e.clientX - offsetX}px, ${e.clientY - offsetY}px)`;
    ghost.style.opacity = '0.9';
    ghost.style.willChange = 'transform';
    ghost.style.zIndex = '9999';
    // hide original element
    el.style.display = 'none';

    document.body.appendChild(ghost);

    this.dragging = {
      item,
      el,
      pointerId: e.pointerId,
      ghost,
      offsetX,
      offsetY,
    };

    playSfxById(SfxId.InventoryPickup);

    window.addEventListener('pointermove', this.boundOnPointerMove, {
      passive: false,
    });
    window.addEventListener('pointerup', this.boundOnPointerUp, {
      passive: false,
    });
    window.addEventListener('pointercancel', this.boundOnPointerCancel, {
      passive: false,
    });
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.dragging || e.pointerId !== this.dragging.pointerId) return;

    // keep ghost under the finger/cursor
    const { ghost, offsetX, offsetY } = this.dragging;
    ghost.style.transform = `translate(${e.clientX - offsetX}px, ${e.clientY - offsetY}px)`;

    // prevent page scrolling while dragging on mobile;
    // only preventDefault on touch — on mouse it would suppress mousemove,
    // which the game needs to keep mouseCoords updated for drop targeting
    if (e.pointerType === 'touch') e.preventDefault();
  }

  private onPointerUp(e: PointerEvent) {
    if (!this.dragging || e.pointerId !== this.dragging.pointerId) return;

    const { el, ghost, item } = this.dragging;

    playSfxById(SfxId.InventoryPlace);
    ghost.remove();
    el.style.display = 'flex';
    this.teardownDragListeners();
    this.dragging = null;

    const target = document.elementFromPoint(e.clientX, e.clientY);

    if (!target) return;

    const slot = target.closest('.slot') as HTMLDivElement;
    if (slot) {
      const slots = document.querySelectorAll('#hotbar .slot')!;
      const slotIndex = Array.from(slots).indexOf(slot);
      if (slotIndex === -1) return;

      this.emitter.emit('assignToSlot', {
        itemId: item.id,
        slotIndex,
      });

      return;
    }

    const tabButton = (target as Element).closest(
      '.tabs button',
    ) as HTMLElement;
    if (tabButton) {
      const tabIndex = Number.parseInt(tabButton.dataset.tab ?? '0', 10);
      this.tryMoveToTab(item.id, tabIndex);
      return;
    }

    if (target === this.btnDrop) {
      this.emitter.emit('dropItem', { at: 'feet', itemId: item.id });
      return;
    }

    if (target === this.btnJunk) {
      this.emitter.emit('junkItem', item.id);
      return;
    }

    const chestItems = target.closest('.chest-items');
    if (chestItems) {
      this.emitter.emit('addChestItem', item.id);
      return;
    }

    const lockerGrid = target.closest('.locker-grid');
    if (lockerGrid) {
      this.emitter.emit('addLockerItem', item.id);
      return;
    }

    const tradeDialog = target.closest('#trade-dialog');
    if (tradeDialog) {
      this.emitter.emit('addTradeItem', item.id);
      return;
    }

    const paperdoll = target.closest('#paperdoll');
    if (paperdoll) {
      const itemEl = target.closest('.item');
      if (!itemEl) {
        return;
      }

      const slot = getEquipmentSlotFromString(itemEl.getAttribute('data-id')!);
      if (typeof slot === 'undefined') {
        return;
      }

      this.emitter.emit('equipItem', {
        slot,
        itemId: item.id,
      });
      return;
    }

    const canvas = document.getElementById('game');
    if (target === this.uiContainer || target === canvas) {
      this.emitter.emit('dropItem', { at: 'cursor', itemId: item.id });
      return;
    }

    // Read actual cell size from the DOM (cells use 1fr, rows match).
    // getBoundingClientRect is in screen-space which matches pointer coords.
    const firstCell = this.grid.querySelector('.cell') as HTMLElement | null;
    if (!firstCell) return;

    const rect = this.grid.getBoundingClientRect();
    const style = getComputedStyle(this.grid);
    const uiEl = document.getElementById('ui');
    const scaleMatch = uiEl?.style.transform.match(/scale\(([^)]+)\)/);
    const scale = scaleMatch ? Number.parseFloat(scaleMatch[1]) : 1;
    const padL = Number.parseFloat(style.paddingLeft) * scale;
    const padT = Number.parseFloat(style.paddingTop) * scale;
    const gap = (Number.parseFloat(style.gap) || 1) * scale;

    const cellRect = firstCell.getBoundingClientRect();
    const cellSize = cellRect.width; // Square — width === height

    if (cellSize <= 0) return;

    const pointerX = e.clientX - rect.left - padL;
    const pointerY = e.clientY - rect.top - padT;

    if (pointerX < 0 || pointerY < 0) return;

    const gridX = Math.min(
      this.activeCols - 1,
      Math.floor(pointerX / (cellSize + gap)),
    );
    const gridY = Math.min(
      this.activeRows - 1,
      Math.floor(pointerY / (cellSize + gap)),
    );
    this.tryMoveItem(item.id, gridX, gridY);
  }

  private onPointerCancel() {
    if (!this.dragging) return;

    const { el, ghost } = this.dragging;
    ghost.remove();
    el.style.opacity = '1';
    this.teardownDragListeners();
    this.dragging = null;
  }

  private teardownDragListeners() {
    window.removeEventListener('pointermove', this.boundOnPointerMove);
    window.removeEventListener('pointerup', this.boundOnPointerUp);
    window.removeEventListener('pointercancel', this.boundOnPointerCancel);
  }

  constructor(client: Client) {
    super();
    this.client = client;

    this.client.on('inventoryChanged', () => {
      this.loadPositions();
      this.render();
    });

    // Tab clicks handled via event delegation on the tabs container
    this.tabsContainer.addEventListener('click', (e) => {
      const button = (e.target as Element).closest('button');
      if (!button) return;
      const tabIndex = Number.parseInt(button.dataset.tab ?? '0', 10);
      playSfxById(SfxId.ButtonClick);
      this.tab = tabIndex;
      this.render();
      e.stopPropagation();
    });

    this.btnPaperdoll.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.emitter.emit('openPaperdoll', undefined);
    });

    this.btnDrop.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      if (this.lastItemSelected) {
        this.emitter.emit('dropItem', {
          at: 'feet',
          itemId: this.lastItemSelected,
        });
      }
    });

    this.btnJunk.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      if (this.lastItemSelected) {
        this.emitter.emit('junkItem', this.lastItemSelected);
      }
    });

    // Apply saved inventory size and listen for changes
    this.applyInventorySize();
    settings.on('change', ({ key }) => {
      if (
        key === 'inventoryWidth' ||
        key === 'inventoryHeight' ||
        key === 'inventoryScale'
      ) {
        this.applyInventorySize();
      }
    });

    // Recalculate grid columns on window resize (debounced)
    let resizeTimer: ReturnType<typeof setTimeout>;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!this.container.classList.contains('hidden')) {
          this.applyInventorySize();
        }
      }, 150);
    });
  }

  private applyInventorySize() {
    const width = settings.get('inventoryWidth');
    const height = settings.get('inventoryHeight');
    const scale = settings.get('inventoryScale');

    // Width
    if (width === 'default') {
      this.container.style.removeProperty('width');
    } else {
      this.container.style.setProperty('width', width, 'important');
    }

    // Height (applied to the container; grid fills remaining space via flex)
    if (height === 'default') {
      this.container.style.removeProperty('height');
    } else {
      this.container.style.setProperty('height', height, 'important');
    }

    // Scale (font-size percentage, same as chat)
    const scaleValue = Number.parseFloat(scale) || 1;
    if (scaleValue === 1) {
      this.container.style.removeProperty('font-size');
    } else {
      this.container.style.setProperty(
        'font-size',
        `${scaleValue * 100}%`,
        'important',
      );
    }

    const oldCols = this.activeCols;
    const oldRows = this.activeRows;
    this.updateGridDimensions();

    // Reflow items if grid dimensions changed
    if (oldCols !== this.activeCols || oldRows !== this.activeRows) {
      this.reflowItems();
    }
  }

  /** Compute cols/rows from the container size at fixed cell size. */
  private updateGridDimensions() {
    if (isMobile()) {
      this.activeCols = DEFAULT_COLS;
      this.activeRows = DEFAULT_ROWS;
      return;
    }

    const gridRect = this.grid.getBoundingClientRect();
    const style = getComputedStyle(this.grid);
    const gap = Number.parseFloat(style.gap) || 1;
    const padL = Number.parseFloat(style.paddingLeft);
    const padR = Number.parseFloat(style.paddingRight);
    const padT = Number.parseFloat(style.paddingTop);
    const padB = Number.parseFloat(style.paddingBottom);
    const contentW = gridRect.width - padL - padR;
    const contentH = gridRect.height - padT - padB;

    if (contentW <= 0 || contentH <= 0) return;

    const cols = Math.max(
      DEFAULT_COLS,
      Math.floor((contentW + gap) / (CELL_SIZE + gap)),
    );
    const rows = Math.max(
      DEFAULT_ROWS,
      Math.floor((contentH + gap) / (CELL_SIZE + gap)),
    );

    this.activeCols = cols;
    this.activeRows = rows;

    this.grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    this.grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  }

  /** Compute how many tabs are needed for all items. */
  private computeTabCount(): number {
    if (!this.client.items.length) return 1;
    let maxTab = 0;
    for (const pos of this.positions) {
      if (pos.tab > maxTab) maxTab = pos.tab;
    }
    return Math.max(1, maxTab + 1);
  }

  /** Rebuild tab buttons to match the current tab count. */
  private updateTabButtons() {
    const count = this.tabCount;
    this.tabsContainer.innerHTML = '';

    if (count <= 1) {
      this.tabsContainer.style.display = 'none';
      return;
    }

    this.tabsContainer.style.display = '';
    for (let i = 0; i < count; i++) {
      const button = document.createElement('button');
      button.textContent = `${i + 1}`;
      button.dataset.tab = `${i}`;
      if (i === this.tab) button.classList.add('active');
      this.tabsContainer.appendChild(button);
    }
  }

  /** Reflow all items into current grid dimensions, adding tabs as needed. */
  private reflowItems() {
    if (!this.client.items.length) return;

    const oldPositions = [...this.positions];
    this.positions = [];

    // Sort by old position so reflow order is predictable
    oldPositions.sort((a, b) => a.tab - b.tab || a.y - b.y || a.x - b.x);

    for (const old of oldPositions) {
      const record = this.client.getEifRecordById(old.id);
      if (!record) continue;

      const size = ITEM_SIZE[record.size];
      const position = this.getNextAvailablePosition(old.id, size);
      if (position) {
        this.positions.push(position);
      }
    }

    this.tabCount = this.computeTabCount();
    if (this.tab >= this.tabCount) this.tab = this.tabCount - 1;
    this.savePositions();
    this.render();
  }

  on<Event extends keyof Events>(
    event: Event,
    handler: (data: Events[Event]) => void,
  ) {
    this.emitter.on(event, handler);
  }

  private tryMoveToTab(itemId: number, tab: number) {
    const position = this.getPosition(itemId);
    if (!position) return;

    if (![0, 1].includes(tab)) return;

    const record = this.client.getEifRecordById(itemId);
    if (!record) return;

    // Set position to next place it fits
    const nextPosition = this.getNextAvailablePositionInTab(
      itemId,
      ITEM_SIZE[record.size],
      tab,
    );

    if (nextPosition) {
      position.x = nextPosition.x;
      position.y = nextPosition.y;
      position.tab = tab;
      this.render();
      this.savePositions();
    }
  }

  private tryMoveItem(itemId: number, x: number, y: number) {
    const position = this.getPosition(itemId);
    if (!position) return;

    const record = this.client.getEifRecordById(itemId);
    if (!record) return;

    const size = ITEM_SIZE[record.size];

    // Temporarily remove this item from the positions array to avoid false overlap
    const otherPositions = this.positions.filter((p) => p.id !== itemId);

    const fits = this.doesItemFitAt(position.tab, x, y, size, otherPositions);
    if (!fits) return;

    position.x = x;
    position.y = y;

    this.render();
    this.savePositions();
  }

  private render() {
    this.grid.innerHTML = '';

    const cols = this.activeCols;
    const rows = this.activeRows;

    // Fill the grid with empty cells
    for (let i = 0; i < cols * rows; i++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.style.gridColumn = `${(i % cols) + 1}`;
      cell.style.gridRow = `${Math.floor(i / cols) + 1}`;
      this.grid.appendChild(cell);
    }

    this.currentWeight.innerText = (
      this.client.weight?.current ?? 0
    ).toString();
    this.maxWeight.innerText = (this.client.weight?.max ?? 0).toString();

    // Update tab buttons
    this.tabCount = this.computeTabCount();
    if (this.tab >= this.tabCount) this.tab = Math.max(0, this.tabCount - 1);
    this.updateTabButtons();

    if (!this.client.items.length) {
      return;
    }

    if (!this.positions.length) {
      this.loadPositions();
    }

    for (const item of this.client.items) {
      const position = this.getPosition(item.id);
      if (!position || position.tab !== this.tab) {
        continue;
      }

      const record = this.client.getEifRecordById(item.id);
      if (!record) {
        continue;
      }

      const imgContainer = document.createElement('div');
      imgContainer.classList.add('item');
      const img = document.createElement('img');

      img.src = `/gfx/gfx023/${100 + record.graphicId * 2}.png`;

      const size = ITEM_SIZE[record.size];

      imgContainer.style.gridColumn = `${position.x + 1} / span ${size.x}`;
      imgContainer.style.gridRow = `${position.y + 1} / span ${size.y}`;

      const tooltip = document.createElement('div');
      tooltip.classList.add('tooltip');

      const meta = getItemMeta(record);

      if (item.id === 1) {
        tooltip.innerText = `${item.amount} ${record.name}\n${meta.join('\n')}`;
      } else {
        if (item.amount > 1) {
          tooltip.innerText = `${record.name} x${item.amount}\n${meta.join('\n')}`;
        } else {
          tooltip.innerText = `${record.name}\n${meta.join('\n')}`;
        }
      }

      imgContainer.appendChild(tooltip);
      imgContainer.appendChild(img);

      imgContainer.addEventListener('pointerdown', (e) => {
        this.onPointerDown(e, imgContainer, item);
      });

      imgContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.emitter.emit('useItem', item.id);
      });

      this.grid.appendChild(imgContainer);
    }

    // Recalculate grid dimensions after content is in the DOM
    requestAnimationFrame(() => this.updateGridDimensions());
  }

  private getPosition(id: number): ItemPosition | undefined {
    return this.positions.find((i) => i.id === id);
  }

  private savePositions() {
    localStorage.setItem(
      `${this.client.name}-inventory`,
      JSON.stringify(this.positions),
    );
  }

  loadPositions() {
    const json = localStorage.getItem(`${this.client.name}-inventory`);
    if (!json) {
      this.setInitialItemPositions();
      return;
    }

    try {
      this.positions = JSON.parse(json) as ItemPosition[];
    } catch {
      console.warn('[Inventory] Failed to parse saved positions, resetting');
      this.setInitialItemPositions();
      return;
    }

    let changed = false;
    for (let i = this.positions.length - 1; i >= 0; --i) {
      const position = this.positions[i];
      if (
        position.id !== 1 &&
        !this.client.items.some((i) => i.id === position.id)
      ) {
        this.positions.splice(i, 1);
        changed = true;
      }
    }

    for (const item of this.client.items) {
      const record = this.client.getEifRecordById(item.id);
      if (!record) {
        continue;
      }

      const existing = this.positions.find((p) => p.id === item.id);
      if (!existing) {
        changed = true;
        const position = this.getNextAvailablePosition(
          item.id,
          ITEM_SIZE[record.size],
        );
        if (position) {
          this.positions.push(position);
        }
      }
    }

    if (changed) {
      this.savePositions();
    }
  }

  private setInitialItemPositions() {
    this.positions = [];
    for (const item of this.client.items) {
      const record = this.client.getEifRecordById(item.id);
      if (!record) {
        continue;
      }

      const position = this.getNextAvailablePosition(
        item.id,
        ITEM_SIZE[record.size],
      );
      if (position) {
        this.positions.push(position);
      }
    }

    this.savePositions();
  }

  private getNextAvailablePosition(
    id: number,
    size: Vector2,
  ): ItemPosition | null {
    // Try existing tabs first, then create a new one if needed
    const maxTab = Math.max(this.tabCount, 1);
    for (let tab = 0; tab <= maxTab; ++tab) {
      const position = this.getNextAvailablePositionInTab(id, size, tab);
      if (position) {
        return position;
      }
    }

    return null;
  }

  private getNextAvailablePositionInTab(
    id: number,
    size: Vector2,
    tab: number,
  ): ItemPosition | null {
    for (let y = 0; y < this.activeRows; ++y) {
      for (let x = 0; x < this.activeCols; ++x) {
        if (this.doesItemFitAt(tab, x, y, size)) {
          return { x, y, tab, id };
        }
      }
    }

    return null;
  }

  private doesItemFitAt(
    tab: number,
    x: number,
    y: number,
    size: Vector2,
    positions: ItemPosition[] = this.positions,
  ): boolean {
    for (const pos of positions) {
      if (pos.tab !== tab) continue;

      const record = this.client.getEifRecordById(pos.id);
      if (!record) continue;

      const existingSize = ITEM_SIZE[record.size];

      const overlapX = x < pos.x + existingSize.x && x + size.x > pos.x;
      const overlapY = y < pos.y + existingSize.y && y + size.y > pos.y;

      if (
        (overlapX && overlapY) ||
        x + size.x > this.activeCols ||
        y + size.y > this.activeRows
      ) {
        return false;
      }
    }

    return true;
  }

  /* ── Mobile Action Bar ─────────────────────────────────────────── */

  private selectMobileItem(el: HTMLDivElement, item: Item) {
    // Clear previous selection
    this.grid.querySelectorAll('.mobile-selected').forEach((e) => {
      e.classList.remove('mobile-selected');
    });

    // Dismiss action bars from sibling panels (e.g. locker) in split-view
    const splitView = this.container.closest('.mobile-split-view');
    if (splitView) {
      for (const sibling of splitView.children) {
        if (sibling === this.container) continue;
        sibling.querySelector('.mobile-action-bar')?.remove();
        sibling.querySelectorAll('.mobile-selected').forEach((s) => {
          s.classList.remove('mobile-selected');
        });
      }
    }

    // Highlight new selection
    el.classList.add('mobile-selected');

    playSfxById(SfxId.InventoryPickup);
    this.showMobileActionBar(item);
  }

  private showMobileActionBar(item: Item) {
    this.hideMobileActionBar();

    const bar = document.createElement('div');
    bar.className = 'mobile-action-bar';

    const record = this.client.getEifRecordById(item.id);
    const name = document.createElement('span');
    name.className = 'action-item-name';
    name.textContent = record?.name ?? `Item #${item.id}`;
    bar.appendChild(name);

    // Use button — only for consumable / equippable items
    const usableTypes = [
      ItemType.Heal,
      ItemType.Teleport,
      ItemType.Reserved5, // Transform (skin change items)
      ItemType.Alcohol,
      ItemType.EffectPotion,
      ItemType.HairDye,
      ItemType.ExpReward,
      ItemType.CureCurse,
    ];
    const isEquippable =
      record &&
      typeof getEquipmentSlotFromString(this.getEquipSlotName(record.type)) !==
        'undefined';
    const isUsable = record && usableTypes.includes(record.type);

    if (isUsable) {
      const btnUse = document.createElement('button');
      btnUse.textContent = 'Use';
      btnUse.addEventListener('click', () => {
        this.emitter.emit('useItem', item.id);
        this.hideMobileActionBar();
      });
      bar.appendChild(btnUse);
    }

    // Equip button — only for equippable items
    if (record && isEquippable) {
      const slot = getEquipmentSlotFromString(
        this.getEquipSlotName(record.type),
      )!;
      const btnEquip = document.createElement('button');
      btnEquip.textContent = 'Equip';
      btnEquip.addEventListener('click', () => {
        this.emitter.emit('equipItem', { slot, itemId: item.id });
        this.hideMobileActionBar();
      });
      bar.appendChild(btnEquip);
    }

    // Store button — only when locker dialog is open
    const lockerOpen = !document
      .getElementById('locker')
      ?.classList.contains('hidden');
    if (lockerOpen) {
      const btnStore = document.createElement('button');
      btnStore.textContent = 'Store';
      btnStore.addEventListener('click', () => {
        this.emitter.emit('addLockerItem', item.id);
        this.hideMobileActionBar();
      });
      bar.appendChild(btnStore);
    }

    // Hotbar button — shows slot picker
    const btnHotbar = document.createElement('button');
    btnHotbar.textContent = 'Hotbar';
    btnHotbar.addEventListener('click', () => {
      this.removeMobilePopup();
      const picker = this.createSlotPicker(item);
      this.container.appendChild(picker);
    });
    bar.appendChild(btnHotbar);

    // Info button — shows item stats
    const btnInfo = document.createElement('button');
    btnInfo.textContent = 'Info';
    btnInfo.addEventListener('click', () => {
      this.removeMobilePopup();
      const popup = this.createInfoPopup(item);
      this.container.appendChild(popup);
    });
    bar.appendChild(btnInfo);

    // Drop button
    const btnDrop = document.createElement('button');
    btnDrop.textContent = 'Drop';
    btnDrop.addEventListener('click', () => {
      this.emitter.emit('dropItem', { at: 'feet', itemId: item.id });
      this.hideMobileActionBar();
    });
    bar.appendChild(btnDrop);

    // Junk button
    const btnJunk = document.createElement('button');
    btnJunk.textContent = 'Junk';
    btnJunk.addEventListener('click', () => {
      this.emitter.emit('junkItem', item.id);
      this.hideMobileActionBar();
    });
    bar.appendChild(btnJunk);

    this.mobileActionBar = bar;
    this.container.appendChild(bar);
  }

  private createSlotPicker(item: Item): HTMLDivElement {
    const picker = document.createElement('div');
    picker.className = 'mobile-slot-picker';

    const label = document.createElement('span');
    label.className = 'picker-label';
    label.textContent = 'Slot:';
    picker.appendChild(label);

    const slots = document.querySelectorAll('#hotbar .slot');
    for (let i = 0; i < slots.length; i++) {
      const btn = document.createElement('button');
      btn.textContent = `${i + 1}`;
      btn.addEventListener('click', () => {
        this.emitter.emit('assignToSlot', { itemId: item.id, slotIndex: i });
        this.hideMobileActionBar();
      });
      picker.appendChild(btn);
    }

    return picker;
  }

  private createInfoPopup(item: Item): HTMLDivElement {
    const popup = document.createElement('div');
    popup.className = 'mobile-info-popup';

    const record = this.client.getEifRecordById(item.id);
    if (!record) {
      popup.textContent = `Item #${item.id}`;
      return popup;
    }

    const meta = getItemMeta(record);
    let text = record.name;
    if (item.id === 1) {
      text = `${item.amount} ${record.name}`;
    } else if (item.amount > 1) {
      text = `${record.name} x${item.amount}`;
    }
    if (meta.length) {
      text += `\n${meta.join('\n')}`;
    }

    popup.textContent = text;
    return popup;
  }

  private removeMobilePopup() {
    this.container
      .querySelectorAll('.mobile-slot-picker, .mobile-info-popup')
      .forEach((el) => {
        el.remove();
      });
  }

  private hideMobileActionBar() {
    this.removeMobilePopup();
    if (this.mobileActionBar) {
      this.mobileActionBar.remove();
      this.mobileActionBar = null;
    }
    this.grid.querySelectorAll('.mobile-selected').forEach((e) => {
      e.classList.remove('mobile-selected');
    });
  }

  private getEquipSlotName(itemType: ItemType): string {
    switch (itemType) {
      case ItemType.Weapon:
        return 'weapon';
      case ItemType.Shield:
        return 'shield';
      case ItemType.Armor:
        return 'armor';
      case ItemType.Hat:
        return 'hat';
      case ItemType.Boots:
        return 'boots';
      case ItemType.Gloves:
        return 'gloves';
      case ItemType.Accessory:
        return 'accessory';
      case ItemType.Belt:
        return 'belt';
      case ItemType.Necklace:
        return 'necklace';
      case ItemType.Ring:
        return 'ring-1';
      case ItemType.Armlet:
        return 'armlet-1';
      case ItemType.Bracer:
        return 'bracer-1';
      default:
        return '';
    }
  }

  /** Render items without triggering fullscreen show/cover/dialogs (for split-view). */
  renderOnly() {
    this.render();
  }

  override show() {
    this.render();
    super.show();
    if (!this.container.classList.contains('ui-repositioned')) {
      this.container.style.top = `${Math.floor(window.innerHeight / 2 - this.container.clientHeight / 2)}px`;
    }
    addMobileCloseButton(this.container, () => this.hide());
    requestAnimationFrame(() => this.applyInventorySize());
  }

  hide() {
    this.hideMobileActionBar();
    super.hide();
  }

  toggle() {
    if (this.container.classList.contains('hidden')) {
      this.show();
    } else {
      this.hide();
    }
  }
}
