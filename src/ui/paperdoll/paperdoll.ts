import { CharacterDetails, CharacterIcon, EquipmentPaperdoll } from 'eolib';
import { type Client, EquipmentSlot } from '../../client';
import { isMobile } from '../../main';
import { playSfxById, SfxId } from '../../sfx';
import { capitalize, getItemMeta } from '../../utils';
import { Base } from '../base-ui';
import { addMobileCloseButton, characterIconToChatIcon } from '../utils';

import './paperdoll.css';

export class Paperdoll extends Base {
  protected container = document.getElementById('paperdoll')!;
  private dialogs = document.getElementById('dialogs')!;
  private client: Client;
  private cover = document.getElementById('cover')!;
  private bntOk = this.container.querySelector<HTMLButtonElement>(
    'button[data-id="ok"]',
  );
  private imgBoots: HTMLDivElement = this.container.querySelector(
    '.item[data-id="boots"]',
  )!;
  private imgAccessory: HTMLDivElement = this.container.querySelector(
    '.item[data-id="accessory"]',
  )!;
  private imgGloves: HTMLDivElement = this.container.querySelector(
    '.item[data-id="gloves"]',
  )!;
  private imgBelt: HTMLDivElement = this.container.querySelector(
    '.item[data-id="belt"]',
  )!;
  private imgArmor: HTMLDivElement = this.container.querySelector(
    '.item[data-id="armor"]',
  )!;
  private imgNecklace: HTMLDivElement = this.container.querySelector(
    '.item[data-id="necklace"]',
  )!;
  private imgHat: HTMLImageElement = this.container.querySelector(
    '.item[data-id="hat"]',
  )!;
  private imgShield: HTMLDivElement = this.container.querySelector(
    '.item[data-id="shield"]',
  )!;
  private imgWeapon: HTMLDivElement = this.container.querySelector(
    '.item[data-id="weapon"]',
  )!;
  private imgRing1: HTMLDivElement = this.container.querySelector(
    '.item[data-id="ring-1"]',
  )!;
  private imgRing2: HTMLDivElement = this.container.querySelector(
    '.item[data-id="ring-2"]',
  )!;
  private imgArmlet1: HTMLDivElement = this.container.querySelector(
    '.item[data-id="armlet-1"]',
  )!;
  private imgArmlet2: HTMLDivElement = this.container.querySelector(
    '.item[data-id="armlet-2"]',
  )!;
  private imgBracer1: HTMLDivElement = this.container.querySelector(
    '.item[data-id="bracer-1"]',
  )!;
  private imgBracer2: HTMLDivElement = this.container.querySelector(
    '.item[data-id="bracer-2"]',
  )!;
  private spanName: HTMLSpanElement = this.container.querySelector(
    'span[data-id="name"]',
  )!;
  private spanHome: HTMLSpanElement = this.container.querySelector(
    'span[data-id="home"]',
  )!;
  private spanClass: HTMLSpanElement = this.container.querySelector(
    'span[data-id="class"]',
  )!;
  private spanPartner: HTMLSpanElement = this.container.querySelector(
    'span[data-id="partner"]',
  )!;
  private spanTitle: HTMLSpanElement = this.container.querySelector(
    'span[data-id="title"]',
  )!;
  private spanGuild: HTMLSpanElement = this.container.querySelector(
    'span[data-id="guild"]',
  )!;
  private spanRank: HTMLSpanElement = this.container.querySelector(
    'span[data-id="rank"]',
  )!;
  private divIcon: HTMLDivElement = this.container.querySelector('div.icon')!;

  private icon = CharacterIcon.Player;
  private details = new CharacterDetails();
  private equipment = new EquipmentPaperdoll();

  private mobileActionBar: HTMLDivElement | null = null;

  /** Maps each equipment slot element to its EquipmentSlot + ID getter */
  private slotMap: {
    el: HTMLDivElement;
    slot: EquipmentSlot;
    getId: () => number;
  }[];

  constructor(client: Client) {
    super();
    this.client = client;
    this.bntOk!.addEventListener!('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });

    this.slotMap = [
      {
        el: this.imgBoots,
        slot: EquipmentSlot.Boots,
        getId: () => this.equipment.boots,
      },
      {
        el: this.imgAccessory,
        slot: EquipmentSlot.Accessory,
        getId: () => this.equipment.accessory,
      },
      {
        el: this.imgGloves,
        slot: EquipmentSlot.Gloves,
        getId: () => this.equipment.gloves,
      },
      {
        el: this.imgBelt,
        slot: EquipmentSlot.Belt,
        getId: () => this.equipment.belt,
      },
      {
        el: this.imgArmor,
        slot: EquipmentSlot.Armor,
        getId: () => this.equipment.armor,
      },
      {
        el: this.imgNecklace,
        slot: EquipmentSlot.Necklace,
        getId: () => this.equipment.necklace,
      },
      {
        el: this.imgHat,
        slot: EquipmentSlot.Hat,
        getId: () => this.equipment.hat,
      },
      {
        el: this.imgShield,
        slot: EquipmentSlot.Shield,
        getId: () => this.equipment.shield,
      },
      {
        el: this.imgWeapon,
        slot: EquipmentSlot.Weapon,
        getId: () => this.equipment.weapon,
      },
      {
        el: this.imgRing1,
        slot: EquipmentSlot.Ring1,
        getId: () => this.equipment.ring[0],
      },
      {
        el: this.imgRing2,
        slot: EquipmentSlot.Ring2,
        getId: () => this.equipment.ring[1],
      },
      {
        el: this.imgArmlet1,
        slot: EquipmentSlot.Armlet1,
        getId: () => this.equipment.armlet[0],
      },
      {
        el: this.imgArmlet2,
        slot: EquipmentSlot.Armlet2,
        getId: () => this.equipment.armlet[1],
      },
      {
        el: this.imgBracer1,
        slot: EquipmentSlot.Bracer1,
        getId: () => this.equipment.bracer[0],
      },
      {
        el: this.imgBracer2,
        slot: EquipmentSlot.Bracer2,
        getId: () => this.equipment.bracer[1],
      },
    ];

    this.client.on('equipmentChanged', () => {
      if (this.details.playerId === client.playerId) {
        this.equipment.accessory = client.equipment.accessory;
        this.equipment.armlet = client.equipment.armlet;
        this.equipment.armor = client.equipment.armor;
        this.equipment.belt = client.equipment.belt;
        this.equipment.boots = client.equipment.boots;
        this.equipment.bracer = client.equipment.bracer;
        this.equipment.gloves = client.equipment.gloves;
        this.equipment.hat = client.equipment.hat;
        this.equipment.necklace = client.equipment.necklace;
        this.equipment.ring = client.equipment.ring;
        this.equipment.shield = client.equipment.shield;
        this.equipment.weapon = client.equipment.weapon;
        this.render();
      }
    });

    // Desktop: right-click to unequip
    // Mobile: handled via tap + action bar below
    for (const entry of this.slotMap) {
      entry.el.addEventListener('contextmenu', () => {
        if (this.details.playerId !== this.client.playerId) return;
        this.client.unequipItem(entry.slot);
      });

      // Mobile: tap to select + show action bar
      entry.el.addEventListener('pointerdown', (e) => {
        if (!isMobile()) return;
        if (this.details.playerId !== this.client.playerId) return;
        const itemId = entry.getId();
        if (!itemId) return;

        e.preventDefault();
        e.stopPropagation();
        this.selectMobileEquipment(entry.el, entry.slot, itemId);
      });
    }
  }

  setData(
    icon: CharacterIcon,
    details: CharacterDetails,
    equipment: EquipmentPaperdoll,
  ) {
    this.icon = icon;
    this.details = details;
    this.equipment = equipment;
  }

  private render() {
    this.container.setAttribute(
      'data-gender',
      (this.details.gender ?? 0).toString(),
    );

    this.spanName.innerText = capitalize(this.details.name);
    this.spanHome.innerText = this.details.home;

    const classRecord = this.client.getEcfRecordById(this.details.classId);
    if (classRecord) {
      this.spanClass.innerText = classRecord.name;
    } else {
      this.spanClass.innerText = '';
    }

    this.spanPartner.innerText = capitalize(this.details.partner);
    this.spanTitle.innerText = this.details.title;
    this.spanGuild.innerText = this.details.guild;
    this.spanRank.innerText = this.details.guildRank;

    this.divIcon.setAttribute(
      'data-id',
      characterIconToChatIcon(this.icon).toString(),
    );

    for (const entry of this.slotMap) {
      this.setEquipment(entry.slot, entry.getId(), entry.el);
    }
  }

  private setEquipment(
    _slot: EquipmentSlot,
    itemId: number,
    el: HTMLDivElement,
  ) {
    const img = el.querySelector<HTMLImageElement>('img')!;
    const tooltip = el.querySelector<HTMLDivElement>('.tooltip')!;

    img.src = '';
    tooltip.innerText = '';
    tooltip.classList.add('hidden');

    if (!itemId) {
      return;
    }

    const record = this.client.getEifRecordById(itemId);
    if (!record) {
      return;
    }

    const meta = getItemMeta(record);
    img.src = `/gfx/gfx023/${100 + record.graphicId * 2}.png`;
    tooltip.innerText = `${record.name}\n${meta.join('\n')}`;
    tooltip.classList.remove('hidden');
  }

  show() {
    this.render();
    this.cover.classList.remove('hidden');
    this.container.classList.remove('hidden');
    this.dialogs.classList.remove('hidden');
    this.client.typing = true;

    if (isMobile()) {
      addMobileCloseButton(this.container, () => this.hide());
    }
  }

  hide() {
    this.hideMobileActionBar();
    this.container.classList.add('hidden');
    this.cover.classList.add('hidden');

    if (!document.querySelector('#dialogs > div:not(.hidden)')) {
      this.dialogs.classList.add('hidden');
      this.client.typing = false;
    }
  }

  isOwnCharacter(): boolean {
    return this.details.playerId === this.client.playerId;
  }

  /* ── Mobile Action Bar ─────────────────────────────────────────── */

  private selectMobileEquipment(
    el: HTMLDivElement,
    slot: EquipmentSlot,
    itemId: number,
  ) {
    // Clear previous selection
    this.container.querySelectorAll('.mobile-selected').forEach((e) => {
      e.classList.remove('mobile-selected');
    });

    el.classList.add('mobile-selected');
    playSfxById(SfxId.InventoryPickup);
    this.showMobileActionBar(slot, itemId);
  }

  private showMobileActionBar(slot: EquipmentSlot, itemId: number) {
    this.hideMobileActionBar();

    const record = this.client.getEifRecordById(itemId);
    const bar = document.createElement('div');
    bar.className = 'mobile-action-bar';

    // Item name
    const nameEl = document.createElement('span');
    nameEl.className = 'action-item-name';
    nameEl.textContent = record?.name ?? `Item #${itemId}`;
    bar.appendChild(nameEl);

    // Unequip button
    const btnUnequip = document.createElement('button');
    btnUnequip.textContent = 'Unequip';
    btnUnequip.addEventListener('click', () => {
      this.client.unequipItem(slot);
      this.hideMobileActionBar();
    });
    bar.appendChild(btnUnequip);

    // Info button
    const btnInfo = document.createElement('button');
    btnInfo.textContent = 'Info';
    btnInfo.addEventListener('click', () => {
      this.removeMobilePopup();
      const popup = this.createInfoPopup(itemId);
      this.container.appendChild(popup);
    });
    bar.appendChild(btnInfo);

    this.mobileActionBar = bar;
    this.container.appendChild(bar);
  }

  private createInfoPopup(itemId: number): HTMLDivElement {
    const popup = document.createElement('div');
    popup.className = 'mobile-info-popup';

    const record = this.client.getEifRecordById(itemId);
    if (!record) {
      popup.textContent = `Item #${itemId}`;
      return popup;
    }

    const meta = getItemMeta(record);
    const lines = [record.name, ...meta];
    popup.textContent = lines.join('\n');
    return popup;
  }

  private removeMobilePopup() {
    this.container.querySelectorAll('.mobile-info-popup').forEach((el) => {
      el.remove();
    });
  }

  private hideMobileActionBar() {
    this.removeMobilePopup();
    if (this.mobileActionBar) {
      this.mobileActionBar.remove();
      this.mobileActionBar = null;
    }
    this.container.querySelectorAll('.mobile-selected').forEach((e) => {
      e.classList.remove('mobile-selected');
    });
  }
}
