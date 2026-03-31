import { ItemType } from 'eolib';
import type { Client } from '../../client';
import { saveAutolootSettings } from '../../managers/autoloot-manager';
import { playSfxById, SfxId } from '../../sfx';

import './autoloot-panel.css';

/** Item type categories shown as filter chips. */
const TYPE_CATEGORIES: { label: string; types: ItemType[] }[] = [
  { label: 'Currency', types: [ItemType.Currency] },
  {
    label: 'Equipment',
    types: [
      ItemType.Weapon,
      ItemType.Shield,
      ItemType.Armor,
      ItemType.Hat,
      ItemType.Boots,
      ItemType.Gloves,
      ItemType.Accessory,
      ItemType.Belt,
      ItemType.Necklace,
      ItemType.Ring,
      ItemType.Armlet,
      ItemType.Bracer,
    ],
  },
  {
    label: 'Consumables',
    types: [
      ItemType.Heal,
      ItemType.Alcohol,
      ItemType.EffectPotion,
      ItemType.CureCurse,
    ],
  },
  { label: 'Keys', types: [ItemType.Key] },
  {
    label: 'Other',
    types: [
      ItemType.General,
      ItemType.Teleport,
      ItemType.ExpReward,
      ItemType.HairDye,
    ],
  },
];

export class AutolootPanel {
  private client: Client;
  private container: HTMLDivElement;
  private pill: HTMLDivElement;
  private pillLabel: HTMLSpanElement;
  private expanded: HTMLDivElement;
  private toggle: HTMLDivElement;
  private searchInput: HTMLInputElement;
  private resultsContainer: HTMLDivElement;
  private ignoredContainer: HTMLDivElement;
  private typeChips: Map<string, HTMLDivElement> = new Map();
  private isOpen = false;

  constructor(client: Client) {
    this.client = client;

    // Container
    this.container = document.createElement('div');
    this.container.id = 'autoloot-panel';
    this.container.classList.add('hidden');

    // Pill
    this.pill = document.createElement('div');
    this.pill.className = 'autoloot-pill';

    const paw = document.createElement('span');
    paw.className = 'paw';
    paw.textContent = '\u{1F43E}';
    this.pill.appendChild(paw);

    this.pillLabel = document.createElement('span');
    this.pillLabel.textContent = 'Autoloot: ON';
    this.pill.appendChild(this.pillLabel);

    this.pill.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.toggleExpanded();
    });

    this.container.appendChild(this.pill);

    // Expanded panel
    this.expanded = document.createElement('div');
    this.expanded.className = 'autoloot-expanded';

    // Header with toggle
    const header = document.createElement('div');
    header.className = 'autoloot-header';

    const headerLabel = document.createElement('span');
    headerLabel.textContent = 'Autoloot';
    header.appendChild(headerLabel);

    this.toggle = document.createElement('div');
    this.toggle.className = 'autoloot-toggle on';
    this.toggle.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.client.autolootEnabled = !this.client.autolootEnabled;
      this.updateToggle();
      this.save();
    });
    header.appendChild(this.toggle);
    this.expanded.appendChild(header);

    // Type filters section
    const typeSection = document.createElement('div');
    typeSection.className = 'autoloot-section';

    const typeTitle = document.createElement('div');
    typeTitle.className = 'autoloot-section-title';
    typeTitle.textContent = 'Item Types';
    typeSection.appendChild(typeTitle);

    const typesContainer = document.createElement('div');
    typesContainer.className = 'autoloot-types';

    for (const category of TYPE_CATEGORIES) {
      const chip = document.createElement('div');
      chip.className = 'autoloot-type-chip active';
      chip.textContent = category.label;
      chip.addEventListener('click', () => {
        playSfxById(SfxId.TextBoxFocus);
        const isActive = chip.classList.contains('active');
        if (isActive) {
          for (const type of category.types) {
            this.client.autolootDisabledTypes.add(type);
          }
        } else {
          for (const type of category.types) {
            this.client.autolootDisabledTypes.delete(type);
          }
        }
        chip.classList.toggle('active', !isActive);
        this.save();
      });
      typesContainer.appendChild(chip);
      this.typeChips.set(category.label, chip);
    }

    typeSection.appendChild(typesContainer);
    this.expanded.appendChild(typeSection);

    // Ignore list section
    const ignoreSection = document.createElement('div');
    ignoreSection.className = 'autoloot-section';

    const ignoreTitle = document.createElement('div');
    ignoreTitle.className = 'autoloot-section-title';
    ignoreTitle.textContent = 'Ignored Items';
    ignoreSection.appendChild(ignoreTitle);

    this.searchInput = document.createElement('input');
    this.searchInput.className = 'autoloot-search';
    this.searchInput.type = 'text';
    this.searchInput.placeholder = 'Search items to ignore...';
    this.searchInput.addEventListener('input', () => this.onSearch());
    this.searchInput.addEventListener('focus', () => {
      this.client.typing = true;
    });
    this.searchInput.addEventListener('blur', () => {
      this.client.typing = false;
      // Delay clearing results so click events fire
      setTimeout(() => {
        this.resultsContainer.innerHTML = '';
      }, 200);
    });
    ignoreSection.appendChild(this.searchInput);

    this.resultsContainer = document.createElement('div');
    this.resultsContainer.className = 'autoloot-results';
    ignoreSection.appendChild(this.resultsContainer);

    this.ignoredContainer = document.createElement('div');
    this.ignoredContainer.className = 'autoloot-ignored';
    ignoreSection.appendChild(this.ignoredContainer);

    this.expanded.appendChild(ignoreSection);
    this.container.appendChild(this.expanded);

    document.getElementById('ui')!.appendChild(this.container);
  }

  show() {
    this.container.classList.remove('hidden');
    this.syncFromClient();
  }

  hide() {
    this.container.classList.add('hidden');
    this.isOpen = false;
    this.expanded.classList.remove('open');
  }

  private toggleExpanded() {
    this.isOpen = !this.isOpen;
    this.expanded.classList.toggle('open', this.isOpen);
  }

  /** Sync UI state from client settings (after loading from localStorage). */
  private syncFromClient() {
    this.updateToggle();

    // Sync type chips
    for (const category of TYPE_CATEGORIES) {
      const chip = this.typeChips.get(category.label);
      if (!chip) continue;
      const allDisabled = category.types.every((t) =>
        this.client.autolootDisabledTypes.has(t),
      );
      chip.classList.toggle('active', !allDisabled);
    }

    this.renderIgnoredItems();
  }

  private updateToggle() {
    this.toggle.classList.toggle('on', this.client.autolootEnabled);
    this.pillLabel.textContent = this.client.autolootEnabled
      ? 'Autoloot: ON'
      : 'Autoloot: OFF';
    this.pill.classList.toggle('off', !this.client.autolootEnabled);
  }

  private onSearch() {
    const query = this.searchInput.value.trim().toLowerCase();
    this.resultsContainer.innerHTML = '';

    if (!query || query.length < 2 || !this.client.eif) return;

    const matches: { id: number; name: string }[] = [];
    for (
      let i = 0;
      i < this.client.eif.items.length && matches.length < 8;
      i++
    ) {
      const item = this.client.eif.items[i];
      const itemId = i + 1;
      if (
        item.name &&
        item.name.toLowerCase().includes(query) &&
        !this.client.autolootIgnoredItems.has(itemId)
      ) {
        matches.push({ id: itemId, name: item.name });
      }
    }

    for (const match of matches) {
      const result = document.createElement('div');
      result.className = 'autoloot-result-item';
      result.textContent = match.name;
      result.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent blur from firing before click
        this.client.autolootIgnoredItems.add(match.id);
        this.searchInput.value = '';
        this.resultsContainer.innerHTML = '';
        this.renderIgnoredItems();
        this.save();
        playSfxById(SfxId.TextBoxFocus);
      });
      this.resultsContainer.appendChild(result);
    }
  }

  private renderIgnoredItems() {
    this.ignoredContainer.innerHTML = '';

    for (const itemId of this.client.autolootIgnoredItems) {
      const record = this.client.getEifRecordById(itemId);
      const name = record?.name ?? `Item #${itemId}`;

      const chip = document.createElement('div');
      chip.className = 'autoloot-ignored-chip';

      const label = document.createElement('span');
      label.textContent = name;
      chip.appendChild(label);

      const remove = document.createElement('span');
      remove.className = 'autoloot-ignored-remove';
      remove.textContent = '\u00D7';
      remove.addEventListener('click', () => {
        this.client.autolootIgnoredItems.delete(itemId);
        this.renderIgnoredItems();
        this.save();
        playSfxById(SfxId.TextBoxFocus);
      });
      chip.appendChild(remove);

      this.ignoredContainer.appendChild(chip);
    }
  }

  private save() {
    saveAutolootSettings(this.client);
  }
}
