import { BarberBuyClientPacket, type CharacterMapInfo, Direction } from 'eolib';
import { CharacterFrame } from '../../atlas';
import type { Client } from '../../client';
import { CHARACTER_HEIGHT, CHARACTER_WIDTH, GAME_FPS } from '../../consts';
import { playSfxById, SfxId } from '../../sfx';
import { Base } from '../base-ui';

import './barber-dialog.css';

export class BarberDialog extends Base {
  private client: Client;
  protected container = document.getElementById('barber-dialog')!;
  private dialogs = document.getElementById('dialogs')!;
  private cover = document.querySelector<HTMLDivElement>('#cover')!;
  private previewImg = this.container.querySelector<HTMLImageElement>(
    '.barber-preview img',
  )!;

  private hairStyle = 0;
  private hairColor = 0;
  private maxStyle = 50;
  private maxColor = 9;

  private originalHairStyle = 0;
  private originalHairColor = 0;
  private character: CharacterMapInfo | null = null;
  private open = false;

  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private lastRenderTime: DOMHighResTimeStamp | undefined;

  private txtStyle = this.container.querySelector<HTMLSpanElement>(
    '[data-id="style-val"]',
  )!;
  private txtColor = this.container.querySelector<HTMLSpanElement>(
    '[data-id="color-val"]',
  )!;
  private controlsEl =
    this.container.querySelector<HTMLDivElement>('.barber-controls')!;
  private footerEl =
    this.container.querySelector<HTMLDivElement>('.barber-footer')!;
  private confirmEl: HTMLDivElement | null = null;

  constructor(client: Client) {
    super();
    this.client = client;

    this.offscreen = document.createElement('canvas');
    this.offscreen.width = CHARACTER_WIDTH + 40;
    this.offscreen.height = CHARACTER_HEIGHT + 40;
    this.offCtx = this.offscreen.getContext('2d')!;

    this.container
      .querySelector('[data-id="style-prev"]')!
      .addEventListener('click', () => this.changeStyle(-1));
    this.container
      .querySelector('[data-id="style-next"]')!
      .addEventListener('click', () => this.changeStyle(1));
    this.container
      .querySelector('[data-id="color-prev"]')!
      .addEventListener('click', () => this.changeColor(-1));
    this.container
      .querySelector('[data-id="color-next"]')!
      .addEventListener('click', () => this.changeColor(1));

    this.container
      .querySelector('[data-id="buy"]')!
      .addEventListener('click', () => this.showConfirmation());
    this.container
      .querySelector('[data-id="cancel"]')!
      .addEventListener('click', () => {
        playSfxById(SfxId.ButtonClick);
        this.hide();
      });

    this.client.on('barberPurchased', () => {
      // Update originals so hide() doesn't revert back
      this.originalHairStyle = this.hairStyle;
      this.originalHairColor = this.hairColor;
      this.hide();
    });
  }

  show() {
    this.character = this.client.getCharacterById(this.client.playerId) ?? null;
    if (this.character) {
      this.originalHairStyle = this.character.hairStyle;
      this.originalHairColor = this.character.hairColor;
      this.hairStyle = this.character.hairStyle;
      this.hairColor = this.character.hairColor;
    }
    this.open = true;
    this.updateLabels();
    this.hideConfirmation();
    this.cover.classList.remove('hidden');
    this.container.classList.remove('hidden');
    this.dialogs.classList.remove('hidden');
    this.client.typing = true;
    this.lastRenderTime = undefined;
    requestAnimationFrame((now) => this.renderPreview(now));
  }

  hide() {
    this.open = false;

    if (this.character) {
      this.character.hairStyle = this.originalHairStyle;
      this.character.hairColor = this.originalHairColor;
      this.client.atlas.refresh();
    }

    this.cover.classList.add('hidden');
    this.container.classList.add('hidden');

    if (!document.querySelector('#dialogs > div:not(.hidden)')) {
      this.dialogs.classList.add('hidden');
      this.client.typing = false;
    }
  }

  private changeStyle(delta: number) {
    this.hairStyle =
      (this.hairStyle + delta + this.maxStyle + 1) % (this.maxStyle + 1);
    playSfxById(SfxId.ButtonClick);
    this.applyPreview();
  }

  private changeColor(delta: number) {
    this.hairColor =
      (this.hairColor + delta + this.maxColor + 1) % (this.maxColor + 1);
    playSfxById(SfxId.ButtonClick);
    this.applyPreview();
  }

  private applyPreview() {
    if (this.character) {
      this.character.hairStyle = this.hairStyle;
      this.character.hairColor = this.hairColor;
      this.client.atlas.refresh();
    }
    this.updateLabels();
  }

  private updateLabels() {
    this.txtStyle.textContent = String(this.hairStyle);
    this.txtColor.textContent = String(this.hairColor);
  }

  private showConfirmation() {
    playSfxById(SfxId.ButtonClick);
    this.controlsEl.classList.add('hidden');
    this.footerEl.classList.add('hidden');

    if (!this.confirmEl) {
      this.confirmEl = document.createElement('div');
      this.confirmEl.className = 'barber-confirm';
      this.confirmEl.innerHTML = `
        <p class="barber-confirm-text">Change your hairstyle?</p>
        <div class="barber-confirm-buttons">
          <button class="barber-btn" data-id="confirm-no">No</button>
          <button class="barber-btn primary" data-id="confirm-yes">Yes</button>
        </div>
      `;
      this.confirmEl
        .querySelector('[data-id="confirm-yes"]')!
        .addEventListener('click', () => {
          playSfxById(SfxId.ButtonClick);
          this.buy();
          this.hideConfirmation();
        });
      this.confirmEl
        .querySelector('[data-id="confirm-no"]')!
        .addEventListener('click', () => {
          playSfxById(SfxId.ButtonClick);
          this.hideConfirmation();
        });
      this.container.insertBefore(this.confirmEl, this.footerEl);
    }
    this.confirmEl.classList.remove('hidden');
  }

  private hideConfirmation() {
    if (this.confirmEl) {
      this.confirmEl.classList.add('hidden');
    }
    this.controlsEl.classList.remove('hidden');
    this.footerEl.classList.remove('hidden');
  }

  private renderPreview(now: DOMHighResTimeStamp) {
    if (!this.open) return;

    if (this.lastRenderTime) {
      const elapsed = now - this.lastRenderTime;
      if (elapsed < GAME_FPS) {
        requestAnimationFrame((n) => this.renderPreview(n));
        return;
      }
    }
    this.lastRenderTime = now;

    this.offCtx.clearRect(0, 0, this.offscreen.width, this.offscreen.height);

    const downRight = [Direction.Down, Direction.Right].includes(
      this.character?.direction ?? Direction.Down,
    );

    const frame = this.client.atlas.getCharacterFrame(
      this.client.playerId,
      downRight
        ? CharacterFrame.StandingDownRight
        : CharacterFrame.StandingUpLeft,
    );

    if (!frame) {
      requestAnimationFrame((n) => this.renderPreview(n));
      return;
    }

    const atlas = this.client.atlas.getAtlas(frame.atlasIndex);
    if (!atlas) {
      requestAnimationFrame((n) => this.renderPreview(n));
      return;
    }

    const mirrored = [Direction.Right, Direction.Up].includes(
      this.character?.direction ?? Direction.Down,
    );

    if (mirrored) {
      this.offCtx.save();
      this.offCtx.scale(-1, 1);
      this.offCtx.translate(-this.offscreen.width, 0);
    }

    this.offCtx.drawImage(
      atlas,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      Math.floor(
        (this.offscreen.width >> 1) +
          (mirrored ? frame.mirroredXOffset : frame.xOffset),
      ),
      this.offscreen.height + frame.yOffset - 20,
      frame.w,
      frame.h,
    );

    if (mirrored) {
      this.offCtx.restore();
    }

    this.previewImg.src = this.offscreen.toDataURL();

    requestAnimationFrame((n) => this.renderPreview(n));
  }

  private buy() {
    const packet = new BarberBuyClientPacket();
    packet.hairStyle = this.hairStyle;
    packet.hairColor = this.hairColor;
    packet.sessionId = this.client.sessionId;
    this.client.bus.send(packet);
  }
}
