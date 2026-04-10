import {
  type EcfRecord,
  type EifRecord,
  type EnfRecord,
  Element as EoElement,
  EoWriter,
  type EsfRecord,
  ItemSize,
  ItemSpecial,
  ItemType,
  NpcType,
  PacketAction,
  PacketFamily,
  SkillNature,
  SkillTargetRestrict,
  SkillTargetType,
  SkillType,
} from 'eolib';
import type { Client } from '../../client';
import { getItemGraphicPath } from '../../utils';
import { Base } from '../base-ui';
import { makeDraggable, restoreOrCenter } from '../utils/draggable';

import './encyclopedia.css';

// Custom packet action values (matching lookup-commands.ts)
const ITEM_SOURCE_ACTION = 19 as unknown as PacketAction;
const NPC_SOURCE_ACTION = PacketAction.Tell; // action 20

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

    this.tabButtons =
      this.container.querySelectorAll<HTMLButtonElement>('.enc-tab');
    this.searchInput =
      this.container.querySelector<HTMLInputElement>('.enc-search')!;
    this.listElement =
      this.container.querySelector<HTMLDivElement>('.enc-list')!;
    this.detailPanel =
      this.container.querySelector<HTMLDivElement>('.enc-detail-panel')!;

    // Close button
    this.container
      .querySelector('[data-id="enc-close"]')!
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
    document.addEventListener('keydown', (event) => {
      if (
        event.key === 'Escape' &&
        !this.container.classList.contains('hidden')
      ) {
        this.hide();
      }
    });

    // Draggable by header only
    makeDraggable(this.container as HTMLElement, '.enc-header');
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class' &&
          !this.container.classList.contains('hidden')
        ) {
          restoreOrCenter(this.container as HTMLElement);
        }
      }
    });
    observer.observe(this.container, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  show() {
    this.container.classList.remove('hidden');
    // Reset mobile state so both panels are visible on open
    this.container
      .querySelector('.enc-list-panel')
      ?.classList.remove('enc-mobile-hidden');
    this.detailPanel.classList.remove('enc-mobile-hidden');
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
      if (
        record?.name &&
        (term === '' || record.name.toLowerCase().includes(term))
      ) {
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
      if (
        record?.name &&
        (term === '' || record.name.toLowerCase().includes(term))
      ) {
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
      if (
        record?.name &&
        (term === '' || record.name.toLowerCase().includes(term))
      ) {
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
      if (
        record?.name &&
        (term === '' || record.name.toLowerCase().includes(term))
      ) {
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
    let rendered = 0;

    if (this.activeTab === 'all' || this.activeTab === 'items') {
      const items = this.filterItems(term);
      totalCount += items.length;
      if (items.length > 0 && this.activeTab === 'all') {
        this.addGroupHeader(`Items (${items.length})`);
      }
      const limit = MAX_RESULTS - rendered;
      for (const item of items.slice(0, limit)) {
        this.addListRow(
          'item',
          item.id,
          item.record.name,
          this.getItemSubtitle(item.record),
          this.getItemBadge(item.record),
          this.getItemIconPath(item.id, item.record),
        );
        rendered++;
      }
    }

    if (this.activeTab === 'all' || this.activeTab === 'npcs') {
      const npcs = this.filterNpcs(term);
      totalCount += npcs.length;
      if (rendered < MAX_RESULTS) {
        if (npcs.length > 0 && this.activeTab === 'all') {
          this.addGroupHeader(`NPCs (${npcs.length})`);
        }
        const limit = MAX_RESULTS - rendered;
        for (const npc of npcs.slice(0, limit)) {
          this.addListRow(
            'npc',
            npc.id,
            npc.record.name,
            this.getNpcSubtitle(npc.record),
            this.getNpcBadge(npc.record),
            this.getNpcIconPath(npc.record),
          );
          rendered++;
        }
      }
    }

    if (this.activeTab === 'all' || this.activeTab === 'spells') {
      const spells = this.filterSpells(term);
      totalCount += spells.length;
      if (rendered < MAX_RESULTS) {
        if (spells.length > 0 && this.activeTab === 'all') {
          this.addGroupHeader(`Spells (${spells.length})`);
        }
        const limit = MAX_RESULTS - rendered;
        for (const spell of spells.slice(0, limit)) {
          this.addListRow(
            'spell',
            spell.id,
            spell.record.name,
            this.getSpellSubtitle(spell.record),
            this.getSpellBadge(spell.record),
            this.getSpellIconPath(spell.record),
          );
          rendered++;
        }
      }
    }

    if (this.activeTab === 'all' || this.activeTab === 'classes') {
      const classes = this.filterClasses(term);
      totalCount += classes.length;
      if (rendered < MAX_RESULTS) {
        if (classes.length > 0 && this.activeTab === 'all') {
          this.addGroupHeader(`Classes (${classes.length})`);
        }
        const limit = MAX_RESULTS - rendered;
        for (const cls of classes.slice(0, limit)) {
          this.addListRow(
            'class',
            cls.id,
            cls.record.name,
            this.getClassSubtitle(cls.record),
            '',
            null,
          );
          rendered++;
        }
      }
    }

    // Show result count if capped
    if (totalCount > MAX_RESULTS) {
      const countDiv = document.createElement('div');
      countDiv.className = 'enc-result-count';
      countDiv.textContent = `Showing ${rendered} of ${totalCount}`;
      this.listElement.appendChild(countDiv);
    }
  }

  private renderCategoryLanding() {
    const grid = document.createElement('div');
    grid.className = 'enc-cat-grid';

    const categories: {
      tab: EncyclopediaTab;
      icon: string;
      name: string;
      count: number;
    }[] = [
      {
        tab: 'items',
        icon: '\u2694\uFE0F',
        name: 'Items',
        count: this.client.eif?.items.filter((item) => item?.name).length ?? 0,
      },
      {
        tab: 'npcs',
        icon: '\uD83D\uDC79',
        name: 'NPCs',
        count: this.client.enf?.npcs.filter((npc) => npc?.name).length ?? 0,
      },
      {
        tab: 'spells',
        icon: '\u2728',
        name: 'Spells',
        count:
          this.client.esf?.skills.filter((spell) => spell?.name).length ?? 0,
      },
      {
        tab: 'classes',
        icon: '\uD83C\uDFAD',
        name: 'Classes',
        count: this.client.ecf?.classes.filter((cls) => cls?.name).length ?? 0,
      },
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
    row.dataset.type = type;
    row.dataset.id = String(id);
    if (this.selectedType === type && this.selectedId === id) {
      row.classList.add('selected');
    }

    const iconContainer = document.createElement('div');
    iconContainer.className = 'enc-row-icon';
    if (iconPath) {
      const image = document.createElement('img');
      image.src = iconPath;
      image.loading = 'lazy';
      iconContainer.appendChild(image);
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
    const tabMap = {
      item: 'items',
      npc: 'npcs',
      spell: 'spells',
      class: 'classes',
    } as const;
    this.activeTab = tabMap[type];
    this.updateTabHighlight();
    this.searchInput.value = '';
    this.selectEntry(type, id);
    this.renderList();
  }

  private highlightSelectedRow() {
    for (const row of this.listElement.querySelectorAll('.enc-row')) {
      const element = row as HTMLElement;
      const isMatch =
        element.dataset.type === this.selectedType &&
        element.dataset.id === String(this.selectedId);
      element.classList.toggle('selected', isMatch);
    }
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

    // Mobile: always show a "back to list" button
    if (document.body.classList.contains('is-mobile')) {
      const backToList = document.createElement('button');
      backToList.className = 'enc-back';
      backToList.textContent = '\u2190 List';
      backToList.addEventListener('click', () => {
        this.container
          .querySelector('.enc-list-panel')
          ?.classList.remove('enc-mobile-hidden');
        this.detailPanel.classList.add('enc-mobile-hidden');
      });
      this.detailPanel.appendChild(backToList);
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
      this.container
        .querySelector('.enc-list-panel')
        ?.classList.add('enc-mobile-hidden');
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
    if (record.minDamage > 0 || record.maxDamage > 0)
      combatStats.push(['Damage', `${record.minDamage}-${record.maxDamage}`]);
    if (record.accuracy > 0)
      combatStats.push(['Accuracy', `+${record.accuracy}`]);
    if (record.evade > 0) combatStats.push(['Evade', `+${record.evade}`]);
    if (record.armor > 0) combatStats.push(['Armor', `+${record.armor}`]);
    if (record.returnDamage > 0)
      combatStats.push(['Return Damage', `+${record.returnDamage}`]);
    if (combatStats.length > 0)
      this.addStatSection('Combat Stats', combatStats);

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
    if (record.lightResistance > 0)
      resistances.push(['Light', `${record.lightResistance}`]);
    if (record.darkResistance > 0)
      resistances.push(['Dark', `${record.darkResistance}`]);
    if (record.earthResistance > 0)
      resistances.push(['Earth', `${record.earthResistance}`]);
    if (record.airResistance > 0)
      resistances.push(['Air', `${record.airResistance}`]);
    if (record.waterResistance > 0)
      resistances.push(['Water', `${record.waterResistance}`]);
    if (record.fireResistance > 0)
      resistances.push(['Fire', `${record.fireResistance}`]);
    if (resistances.length > 0) this.addStatSection('Resistances', resistances);

    // Element
    if (record.element !== EoElement.None) {
      this.addStatSection('Element', [
        [getElementName(record.element), `${record.elementDamage}`],
      ]);
    }

    // Properties
    const properties: [string, string][] = [];
    if (record.size !== ItemSize.Size1x1)
      properties.push(['Size', getItemSizeName(record.size)]);
    if (record.weight > 0) properties.push(['Weight', `${record.weight}`]);
    if (record.special === ItemSpecial.Cursed)
      properties.push(['Special', 'Cursed']);
    if (record.special === ItemSpecial.Lore)
      properties.push(['Special', 'Lore']);
    if (properties.length > 0) this.addStatSection('Properties', properties);

    // Requirements
    const requirements: [string, string][] = [];
    if (record.levelRequirement > 0)
      requirements.push(['Level', `${record.levelRequirement}`]);
    if (record.classRequirement > 0) {
      const classRecord = this.client.getEcfRecordById(record.classRequirement);
      if (classRecord) {
        requirements.push([
          'Class',
          `__class:${record.classRequirement}:${classRecord.name}`,
        ]);
      } else {
        requirements.push(['Class', `#${record.classRequirement}`]);
      }
    }
    if (record.strRequirement > 0)
      requirements.push(['STR', `${record.strRequirement}`]);
    if (record.intRequirement > 0)
      requirements.push(['INT', `${record.intRequirement}`]);
    if (record.wisRequirement > 0)
      requirements.push(['WIS', `${record.wisRequirement}`]);
    if (record.agiRequirement > 0)
      requirements.push(['AGI', `${record.agiRequirement}`]);
    if (record.conRequirement > 0)
      requirements.push(['CON', `${record.conRequirement}`]);
    if (record.chaRequirement > 0)
      requirements.push(['CHA', `${record.chaRequirement}`]);
    if (requirements.length > 0)
      this.addStatSection('Requirements', requirements);

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

    let typeString = getNpcTypeName(record.type);
    if (record.boss) typeString += ' \u2022 Boss';
    this.addDetailType(typeString);

    // Combat stats
    const combatStats: [string, string][] = [];
    if (record.hp > 0) combatStats.push(['HP', `${record.hp}`]);
    if (record.tp > 0) combatStats.push(['TP', `${record.tp}`]);
    if (record.minDamage > 0 || record.maxDamage > 0)
      combatStats.push(['Damage', `${record.minDamage}-${record.maxDamage}`]);
    if (record.accuracy > 0)
      combatStats.push(['Accuracy', `${record.accuracy}`]);
    if (record.evade > 0) combatStats.push(['Evade', `${record.evade}`]);
    if (record.armor > 0) combatStats.push(['Armor', `${record.armor}`]);
    if (record.returnDamage > 0)
      combatStats.push(['Return Damage', `${record.returnDamage}`]);
    if (record.level > 0) combatStats.push(['Level', `${record.level}`]);
    if (record.experience > 0)
      combatStats.push(['Experience', `${record.experience}`]);
    if (combatStats.length > 0)
      this.addStatSection('Combat Stats', combatStats);

    // Element
    const elementStats: [string, string][] = [];
    if (record.element !== EoElement.None)
      elementStats.push([
        'Element',
        `${getElementName(record.element)} (${record.elementDamage})`,
      ]);
    if (record.elementWeakness !== EoElement.None)
      elementStats.push([
        'Weakness',
        `${getElementName(record.elementWeakness)} (${record.elementWeaknessDamage})`,
      ]);
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
    this.addDetailType(
      `${getSkillNatureName(record.nature)} \u2022 ${getSkillTypeName(record.type)}`,
    );

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
    this.addStatSection('Targeting', targeting);

    // Power
    const power: [string, string][] = [];
    if (record.minDamage > 0 || record.maxDamage > 0)
      power.push(['Damage', `${record.minDamage}-${record.maxDamage}`]);
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
      this.addStatSection('Element', [
        [getElementName(record.element), `${record.elementPower}`],
      ]);
    }

    // Info
    const info: [string, string][] = [];
    if (record.maxSkillLevel > 0)
      info.push(['Max Level', `${record.maxSkillLevel}`]);
    if (record.chant) info.push(['Chant', record.chant]);
    if (info.length > 0) this.addStatSection('Info', info);
  }

  // ── Class detail ──

  private renderClassDetail(classId: number) {
    const record = this.client.getEcfRecordById(classId);
    if (!record) return;

    this.addDetailName(record.name);
    this.addDetailType(`Class Type ${record.parentType}`);

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

      const hasData =
        data.drops.length > 0 ||
        data.shops.length > 0 ||
        data.crafts.length > 0;
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
          const npcId = this.findNpcIdByName(drop.npcName);
          if (npcId > 0) {
            this.addSourceLinkWithSuffix(
              'npc',
              npcId,
              drop.npcName,
              ` (${drop.dropRate.toFixed(1)}%)`,
            );
          } else {
            const row = document.createElement('div');
            row.className = 'enc-source-row';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = drop.npcName;
            row.appendChild(nameSpan);
            row.appendChild(
              document.createTextNode(` (${drop.dropRate.toFixed(1)}%)`),
            );
            this.detailPanel.appendChild(row);
          }
        }
      }

      if (data.shops.length > 0) {
        this.addSectionHeader('Sold By');
        for (const shop of data.shops) {
          const npcId = this.findNpcIdByName(shop.npcName);
          if (npcId > 0) {
            this.addSourceLinkWithSuffix(
              'npc',
              npcId,
              shop.npcName,
              ` \u2014 ${shop.price}g`,
            );
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
            this.addSourceLinkWithSuffix(
              'npc',
              npcId,
              craft.npcName,
              ` (${craft.ingredients})`,
            );
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

    const wrappedHandler = (data: Parameters<typeof handler>[0]) => {
      this.client.off('updateItemSources', wrappedHandler);
      this.sourceCleanup = null;
      handler(data);
    };
    this.client.on('updateItemSources', wrappedHandler);
    this.sourceCleanup = () => {
      this.client.off('updateItemSources', wrappedHandler);
    };

    // Send the source request packet
    const writer = new EoWriter();
    writer.addShort(itemId);
    this.client.bus.sendBuf(
      PacketFamily.Item,
      ITEM_SOURCE_ACTION,
      writer.toByteArray(),
    );
  }

  private requestNpcSources(npcId: number, loadingDiv: HTMLElement) {
    const handler = (data: {
      drops: { itemName: string; amount: string; dropRate: number }[];
      shopItems: {
        itemName: string;
        buyPrice: number;
        sellPrice: number;
      }[];
      crafts: { itemName: string; ingredients: string }[];
      spawnMaps: number[];
    }) => {
      loadingDiv.remove();

      const hasData =
        data.drops.length > 0 ||
        data.shopItems.length > 0 ||
        data.crafts.length > 0 ||
        data.spawnMaps.length > 0;
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
            this.addSourceLinkWithSuffix(
              'item',
              itemId,
              drop.itemName,
              ` x${drop.amount} (${drop.dropRate.toFixed(1)}%)`,
            );
          } else {
            const row = document.createElement('div');
            row.className = 'enc-source-row';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = drop.itemName;
            row.appendChild(nameSpan);
            row.appendChild(
              document.createTextNode(
                ` x${drop.amount} (${drop.dropRate.toFixed(1)}%)`,
              ),
            );
            this.detailPanel.appendChild(row);
          }
        }
      }

      if (data.shopItems.length > 0) {
        this.addSectionHeader('Shop Inventory');
        for (const item of data.shopItems) {
          const itemId = this.findItemIdByName(item.itemName);
          if (itemId > 0) {
            this.addSourceLinkWithSuffix(
              'item',
              itemId,
              item.itemName,
              ` (Buy: ${item.buyPrice}g / Sell: ${item.sellPrice}g)`,
            );
          } else {
            const row = document.createElement('div');
            row.className = 'enc-source-row';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = item.itemName;
            row.appendChild(nameSpan);
            row.appendChild(
              document.createTextNode(
                ` (Buy: ${item.buyPrice}g / Sell: ${item.sellPrice}g)`,
              ),
            );
            this.detailPanel.appendChild(row);
          }
        }
      }

      if (data.crafts.length > 0) {
        this.addSectionHeader('Crafts');
        for (const craft of data.crafts) {
          const itemId = this.findItemIdByName(craft.itemName);
          if (itemId > 0) {
            this.addSourceLinkWithSuffix(
              'item',
              itemId,
              craft.itemName,
              ` (${craft.ingredients})`,
            );
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

    const wrappedHandler = (data: Parameters<typeof handler>[0]) => {
      this.client.off('updateNpcSources', wrappedHandler);
      this.sourceCleanup = null;
      handler(data);
    };
    this.client.on('updateNpcSources', wrappedHandler);
    this.sourceCleanup = () => {
      this.client.off('updateNpcSources', wrappedHandler);
    };

    // Send the source request packet
    const writer = new EoWriter();
    writer.addShort(npcId);
    this.client.bus.sendBuf(
      PacketFamily.Npc,
      NPC_SOURCE_ACTION,
      writer.toByteArray(),
    );
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
      const image = document.createElement('img');
      image.src = iconPath;
      container.appendChild(image);
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

  private addSourceLink(
    type: 'item' | 'npc' | 'spell' | 'class',
    id: number,
    name: string,
  ) {
    const row = document.createElement('div');
    row.className = 'enc-source-row';
    const link = document.createElement('span');
    link.className = 'enc-link';
    link.textContent = name;
    link.addEventListener('click', () => this.navigateTo(type, id));
    row.appendChild(link);
    this.detailPanel.appendChild(row);
  }

  private addSourceLinkWithSuffix(
    type: 'item' | 'npc' | 'spell' | 'class',
    id: number,
    name: string,
    suffix: string,
  ) {
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
    if (record.levelRequirement > 0)
      return `${type} \u2022 Lv ${record.levelRequirement}`;
    return type;
  }

  private getItemBadge(record: EifRecord): string {
    if (record.minDamage > 0 || record.maxDamage > 0)
      return `Dmg ${record.minDamage}-${record.maxDamage}`;
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
    if (record.minDamage > 0 || record.maxDamage > 0)
      return `Dmg ${record.minDamage}-${record.maxDamage}`;
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
    case ItemType.General:
      return 'General';
    case ItemType.Currency:
      return 'Currency';
    case ItemType.Heal:
      return 'Potion';
    case ItemType.Teleport:
      return 'Teleport';
    case ItemType.ExpReward:
      return 'Exp Reward';
    case ItemType.Key:
      return 'Key';
    case ItemType.Weapon:
      return 'Weapon';
    case ItemType.Shield:
      return 'Shield';
    case ItemType.Armor:
      return 'Armor';
    case ItemType.Hat:
      return 'Hat';
    case ItemType.Boots:
      return 'Boots';
    case ItemType.Gloves:
      return 'Gloves';
    case ItemType.Accessory:
      return 'Accessory';
    case ItemType.Belt:
      return 'Belt';
    case ItemType.Necklace:
      return 'Necklace';
    case ItemType.Ring:
      return 'Ring';
    case ItemType.Armlet:
      return 'Armlet';
    case ItemType.Bracer:
      return 'Bracer';
    case ItemType.Alcohol:
      return 'Beverage';
    case ItemType.EffectPotion:
      return 'Effect';
    case ItemType.HairDye:
      return 'Hair Dye';
    case ItemType.CureCurse:
      return 'Cure';
    default:
      return 'Unknown';
  }
}

function getNpcTypeName(type: NpcType): string {
  switch (type) {
    case NpcType.Friendly:
      return 'Friendly';
    case NpcType.Passive:
      return 'Passive';
    case NpcType.Aggressive:
      return 'Aggressive';
    case NpcType.Shop:
      return 'Shop';
    case NpcType.Inn:
      return 'Inn';
    case NpcType.Bank:
      return 'Bank';
    case NpcType.Barber:
      return 'Barber';
    case NpcType.Guild:
      return 'Guild';
    case NpcType.Priest:
      return 'Priest';
    case NpcType.Lawyer:
      return 'Lawyer';
    case NpcType.Trainer:
      return 'Trainer';
    case NpcType.Quest:
      return 'Quest';
    default:
      return 'Unknown';
  }
}

function getSkillNatureName(nature: SkillNature): string {
  switch (nature) {
    case SkillNature.Spell:
      return 'Spell';
    case SkillNature.Skill:
      return 'Skill';
    default:
      return 'Unknown';
  }
}

function getSkillTypeName(type: SkillType): string {
  switch (type) {
    case SkillType.Heal:
      return 'Heal';
    case SkillType.Attack:
      return 'Attack';
    case SkillType.Bard:
      return 'Bard';
    default:
      return 'Unknown';
  }
}

function getTargetTypeName(type: SkillTargetType): string {
  switch (type) {
    case SkillTargetType.Normal:
      return 'Normal';
    case SkillTargetType.Self:
      return 'Self';
    case SkillTargetType.Group:
      return 'Group';
    default:
      return 'Unknown';
  }
}

function getTargetRestrictName(restrict: SkillTargetRestrict): string {
  switch (restrict) {
    case SkillTargetRestrict.Npc:
      return 'NPC';
    case SkillTargetRestrict.Friendly:
      return 'Friendly';
    case SkillTargetRestrict.Opponent:
      return 'Opponent';
    default:
      return 'None';
  }
}

function getItemSizeName(size: ItemSize): string {
  switch (size) {
    case ItemSize.Size1x1:
      return '1x1';
    case ItemSize.Size1x2:
      return '1x2';
    case ItemSize.Size1x3:
      return '1x3';
    case ItemSize.Size1x4:
      return '1x4';
    case ItemSize.Size2x1:
      return '2x1';
    case ItemSize.Size2x2:
      return '2x2';
    case ItemSize.Size2x3:
      return '2x3';
    case ItemSize.Size2x4:
      return '2x4';
    default:
      return '1x1';
  }
}

function getElementName(element: EoElement): string {
  switch (element) {
    case EoElement.Light:
      return 'Light';
    case EoElement.Dark:
      return 'Dark';
    case EoElement.Earth:
      return 'Earth';
    case EoElement.Wind:
      return 'Air';
    case EoElement.Water:
      return 'Water';
    case EoElement.Fire:
      return 'Fire';
    default:
      return 'None';
  }
}
