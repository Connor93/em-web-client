import type { Client } from '../../client';
import { isMobile } from '../../main';
import { playSfxById, SfxId } from '../../sfx';
import { BaseDialogMd } from '../base-dialog-md';

import './spell-book.css';

type Events = {
  assignToSlot: { spellId: number; slotIndex: number };
};

export class SpellBook extends BaseDialogMd<Events> {
  protected container: HTMLDivElement = document.querySelector('#spell-book')!;
  private spellGrid: HTMLDivElement =
    this.container.querySelector('.spell-grid')!;

  private dragging: {
    spellId: number;
    el: HTMLElement;
    pointerId: number;
    ghost: HTMLElement;
    offsetX: number;
    offsetY: number;
  } | null = null;

  private mobileActionBar: HTMLDivElement | null = null;

  constructor(client: Client) {
    super(client, document.querySelector('#spell-book')!, 'Spell Book');
  }

  public render() {
    this.spellGrid.innerHTML = '';

    this.updateLabelText(
      `Spell Book (${this.client.spells.length}) Points (${this.client.skillPoints})`,
    );

    for (const spell of this.client.spells) {
      const record = this.client.getEsfRecordById(spell.id);
      if (!record) continue;

      const spellElement = document.createElement('div');
      const icon = document.createElement('div');
      icon.classList.add('spell-icon');
      icon.style.backgroundImage = `url('/gfx/gfx025/${record.iconId + 100}.png')`;

      icon.addEventListener('pointerdown', (e) => {
        this.onPointerDown(e, icon, spell.id);
      });

      spellElement.appendChild(icon);

      const click = () => {
        this.showTrainingPanel(spell.id);
      };

      const name = document.createElement('span');
      name.classList.add('spell-name');
      name.innerText = record.name;
      spellElement.appendChild(name);

      const level = document.createElement('span');
      level.classList.add('spell-level');
      level.innerText = `Lvl: ${spell.level}`;
      spellElement.appendChild(level);

      if (!isMobile()) {
        const btnLevelUp = document.createElement('button');
        btnLevelUp.classList.add('spell-levelup-btn');
        btnLevelUp.textContent = 'Level Up';
        btnLevelUp.addEventListener('click', click);
        spellElement.appendChild(btnLevelUp);
      }

      this.spellGrid.appendChild(spellElement);
    }
  }

  private onPointerDown(e: PointerEvent, el: HTMLDivElement, spellId: number) {
    if (e.button !== 0 && e.pointerType !== 'touch') return;

    // On mobile: tap to select + show action bar (no drag)
    if (isMobile()) {
      e.preventDefault();
      e.stopPropagation();
      this.selectMobileSpell(el, spellId);
      return;
    }

    (e.target as Element).setPointerCapture(e.pointerId);

    const rect = el.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.margin = '0';
    ghost.style.inset = 'auto';
    ghost.style.left = '0';
    ghost.style.top = '0';
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.backgroundPositionX = `-${rect.width}px`;
    ghost.style.transform = `translate(${e.clientX - offsetX}px, ${e.clientY - offsetY}px)`;
    ghost.style.opacity = '0.9';
    ghost.style.willChange = 'transform';
    ghost.style.zIndex = '9999';

    document.body.appendChild(ghost);

    this.dragging = {
      spellId,
      el,
      pointerId: e.pointerId,
      ghost,
      offsetX,
      offsetY,
    };

    playSfxById(SfxId.InventoryPickup);

    window.addEventListener('pointermove', this.onPointerMove.bind(this), {
      passive: false,
    });
    window.addEventListener('pointerup', this.onPointerUp.bind(this), {
      passive: false,
    });
    window.addEventListener('pointercancel', this.onPointerCancel.bind(this), {
      passive: false,
    });
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.dragging || e.pointerId !== this.dragging.pointerId) return;

    // keep ghost under the finger/cursor
    const { ghost, offsetX, offsetY } = this.dragging;
    ghost.style.transform = `translate(${e.clientX - offsetX}px, ${e.clientY - offsetY}px)`;

    // prevent page scrolling while dragging on mobile
    e.preventDefault();
  }

  private onPointerUp(e: PointerEvent) {
    if (!this.dragging || e.pointerId !== this.dragging.pointerId) return;

    const { el, ghost, spellId } = this.dragging;

    playSfxById(SfxId.InventoryPlace);
    ghost.remove();
    el.style.display = 'flex';
    this.teardownDragListeners();
    this.dragging = null;

    const target = document.elementFromPoint(e.clientX, e.clientY);

    if (!target) return;

    // Direct hit-test hotbar slots by bounding rect (the spell book dialog
    // at z-index 1050 covers the hotbar at 1020, so elementFromPoint misses it)
    const slots = document.querySelectorAll<HTMLDivElement>('#hotbar .slot');
    for (let i = 0; i < slots.length; i++) {
      const rect = slots[i].getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        this.emitter.emit('assignToSlot', { spellId, slotIndex: i });
        return;
      }
    }
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
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
  }

  /* ── Mobile Action Bar ─────────────────────────────────────────── */

  private selectMobileSpell(el: HTMLDivElement, spellId: number) {
    // Clear previous selection
    this.spellGrid.querySelectorAll('.mobile-selected').forEach((e) => {
      e.classList.remove('mobile-selected');
    });

    // Highlight
    el.classList.add('mobile-selected');

    playSfxById(SfxId.InventoryPickup);
    this.showMobileActionBar(spellId);
  }

  private showMobileActionBar(spellId: number) {
    this.hideMobileActionBar();

    const bar = document.createElement('div');
    bar.className = 'mobile-action-bar';

    const record = this.client.getEsfRecordById(spellId);
    const nameEl = document.createElement('span');
    nameEl.className = 'action-item-name';
    nameEl.textContent = record?.name ?? `Spell #${spellId}`;
    bar.appendChild(nameEl);

    // Hotbar button — shows slot picker
    const btnHotbar = document.createElement('button');
    btnHotbar.textContent = 'Hotbar';
    btnHotbar.addEventListener('click', () => {
      this.removeMobilePopup();
      const picker = this.createSlotPicker(spellId);
      this.container.appendChild(picker);
    });
    bar.appendChild(btnHotbar);

    // Info button — shows spell info
    const btnInfo = document.createElement('button');
    btnInfo.textContent = 'Info';
    btnInfo.addEventListener('click', () => {
      this.removeMobilePopup();
      const popup = this.createInfoPopup(spellId);
      this.container.appendChild(popup);
    });
    bar.appendChild(btnInfo);

    // Level up button
    if (this.client.skillPoints > 0) {
      const btnLevel = document.createElement('button');
      btnLevel.textContent = 'Level Up';
      btnLevel.addEventListener('click', () => {
        this.hideMobileActionBar();
        this.showTrainingPanel(spellId);
      });
      bar.appendChild(btnLevel);
    }

    this.mobileActionBar = bar;
    this.container.appendChild(bar);
  }

  private createSlotPicker(spellId: number): HTMLDivElement {
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
        this.emitter.emit('assignToSlot', { spellId, slotIndex: i });
        this.hideMobileActionBar();
      });
      picker.appendChild(btn);
    }

    return picker;
  }

  private createInfoPopup(spellId: number): HTMLDivElement {
    const popup = document.createElement('div');
    popup.className = 'mobile-info-popup';

    const record = this.client.getEsfRecordById(spellId);
    if (!record) {
      popup.textContent = `Spell #${spellId}`;
      return popup;
    }

    const spell = this.client.spells.find((s) => s.id === spellId);
    const lines: string[] = [record.name];
    if (spell) lines.push(`Level: ${spell.level}`);
    if (record.tpCost) lines.push(`TP Cost: ${record.tpCost}`);
    if (record.castTime) lines.push(`Cast Time: ${record.castTime}`);
    if (record.hpHeal) lines.push(`HP Heal: ${record.hpHeal}`);
    if (record.tpHeal) lines.push(`TP Heal: ${record.tpHeal}`);

    popup.textContent = lines.join('\n');
    return popup;
  }

  private removeMobilePopup() {
    this.container
      .querySelectorAll('.mobile-slot-picker, .mobile-info-popup')
      .forEach((el) => {
        el.remove();
      });
  }

  private showTrainingPanel(spellId: number) {
    // Remove existing panel
    this.container.querySelector('.spell-training-panel')?.remove();

    const spell = this.client.spells.find((s) => s.id === spellId);
    const record = this.client.getEsfRecordById(spellId);
    if (!spell || !record) return;

    const maxTrainable = Math.min(this.client.skillPoints, 100 - spell.level);
    if (maxTrainable <= 0) {
      this.client.showError('No skill points available');
      return;
    }

    let amount = 1;

    const panel = document.createElement('div');
    panel.className = 'spell-training-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'training-header';
    header.innerHTML = `<span class="training-spell-name">${record.name}</span><span class="training-level">Lv. ${spell.level}</span>`;
    panel.appendChild(header);

    // Amount selector
    const selector = document.createElement('div');
    selector.className = 'training-selector';

    const btnMinus = document.createElement('button');
    btnMinus.className = 'training-btn';
    btnMinus.textContent = '−';

    const amountDisplay = document.createElement('span');
    amountDisplay.className = 'training-amount';
    amountDisplay.textContent = '1';

    const btnPlus = document.createElement('button');
    btnPlus.className = 'training-btn';
    btnPlus.textContent = '+';

    const btnMax = document.createElement('button');
    btnMax.className = 'training-btn training-max';
    btnMax.textContent = 'Max';

    const updateAmount = (newAmt: number) => {
      amount = Math.max(1, Math.min(newAmt, maxTrainable));
      amountDisplay.textContent = `${amount}`;
      costDisplay.textContent = `Cost: ${amount} SP`;
      resultDisplay.textContent = `Lv. ${spell.level} → ${spell.level + amount}`;
      btnMinus.disabled = amount <= 1;
      btnPlus.disabled = amount >= maxTrainable;
    };

    btnMinus.addEventListener('click', () => updateAmount(amount - 1));
    btnPlus.addEventListener('click', () => updateAmount(amount + 1));
    btnMax.addEventListener('click', () => updateAmount(maxTrainable));

    selector.append(btnMinus, amountDisplay, btnPlus, btnMax);
    panel.appendChild(selector);

    // Info line
    const info = document.createElement('div');
    info.className = 'training-info';

    const costDisplay = document.createElement('span');
    costDisplay.className = 'training-cost';
    costDisplay.textContent = 'Cost: 1 SP';

    const resultDisplay = document.createElement('span');
    resultDisplay.className = 'training-result';
    resultDisplay.textContent = `Lv. ${spell.level} → ${spell.level + 1}`;

    info.append(costDisplay, resultDisplay);
    panel.appendChild(info);

    // Buttons
    const actions = document.createElement('div');
    actions.className = 'training-actions';

    const btnTrain = document.createElement('button');
    btnTrain.className = 'training-confirm';
    btnTrain.textContent = 'Train';
    btnTrain.addEventListener('click', () => {
      for (let i = 0; i < amount; i++) {
        this.client.trainSpell(spellId);
      }
      panel.remove();
    });

    const btnCancel = document.createElement('button');
    btnCancel.className = 'training-cancel';
    btnCancel.textContent = 'Cancel';
    btnCancel.addEventListener('click', () => panel.remove());

    actions.append(btnTrain, btnCancel);
    panel.appendChild(actions);

    // Available SP footer
    const footer = document.createElement('div');
    footer.className = 'training-footer';
    footer.textContent = `Available: ${this.client.skillPoints} SP`;
    panel.appendChild(footer);

    this.container.appendChild(panel);
    updateAmount(1);
  }

  private hideMobileActionBar() {
    this.removeMobilePopup();
    if (this.mobileActionBar) {
      this.mobileActionBar.remove();
      this.mobileActionBar = null;
    }
    this.spellGrid.querySelectorAll('.mobile-selected').forEach((e) => {
      e.classList.remove('mobile-selected');
    });
  }

  override hide() {
    this.hideMobileActionBar();
    super.hide();
  }
}
