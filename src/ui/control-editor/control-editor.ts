import mitt from 'mitt';

import './control-editor.css';

interface ControlOffsets {
  joystick?: { dx: number; dy: number };
  attack?: { dx: number; dy: number };
  sit?: { dx: number; dy: number };
}

type ControlEditorEvents = {
  done: undefined;
};

const STORAGE_KEY = 'mobile-control-positions';

/**
 * Draggable control editor.
 *
 * Uses CSS transform: translate(dx, dy) to offset controls from their
 * CSS-default positions. This avoids the mobile browser mismatch between
 * getBoundingClientRect() (visual viewport) and position:fixed top/left
 * (initial containing block).
 *
 * Stored offsets are in px. On load they're applied as a transform.
 * On reset the transform is cleared and controls return to CSS defaults.
 */
export class ControlEditor {
  private active = false;
  private banner: HTMLDivElement | null = null;

  private joystickContainer = document.getElementById('joystick-container')!;
  private attackContainer = document.getElementById('attack-container')!;
  private sitContainer = document.getElementById('sit-container')!;

  private labels: HTMLDivElement[] = [];
  private emitter = mitt<ControlEditorEvents>();

  // Per-control drag state
  private dragging: HTMLElement | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartOffsetX = 0;
  private dragStartOffsetY = 0;

  // Current accumulated offsets per container (px)
  private offsets: Map<HTMLElement, { dx: number; dy: number }> = new Map();

  private handleTouchStartCapture: (e: TouchEvent) => void;
  private handleTouchMoveCapture: (e: TouchEvent) => void;
  private handleTouchEndCapture: (e: TouchEvent) => void;

  constructor() {
    this.handleTouchStartCapture = this.onTouchStart.bind(this);
    this.handleTouchMoveCapture = this.onTouchMove.bind(this);
    this.handleTouchEndCapture = this.onTouchEnd.bind(this);

    // Initialize offsets
    for (const container of this.containers()) {
      this.offsets.set(container, { dx: 0, dy: 0 });
    }

    this.loadPositions();
  }

  on(event: 'done', handler: () => void): void {
    this.emitter.on(event, handler);
  }

  enter(): void {
    this.active = true;
    document.body.classList.add('control-edit-mode');

    // Build banner
    const banner = document.createElement('div');
    banner.id = 'control-editor-banner';

    const title = document.createElement('span');
    title.className = 'editor-title';
    title.textContent = 'Edit Controls';
    banner.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'editor-actions';

    const resetButton = document.createElement('button');
    resetButton.className = 'editor-reset';
    resetButton.textContent = 'Reset';
    resetButton.addEventListener('click', () => this.resetPositions());
    actions.appendChild(resetButton);

    const doneButton = document.createElement('button');
    doneButton.className = 'editor-done';
    doneButton.textContent = 'Done';
    doneButton.addEventListener('click', () => this.exit());
    actions.appendChild(doneButton);

    banner.appendChild(actions);
    document.body.appendChild(banner);
    this.banner = banner;

    // Labels
    this.addLabel(this.joystickContainer, 'Move');
    this.addLabel(this.attackContainer, 'Attack');
    this.addLabel(this.sitContainer, 'Sit');

    // Touch handlers (capture to block input.ts)
    for (const container of this.containers()) {
      container.addEventListener('touchstart', this.handleTouchStartCapture, {
        capture: true,
      });
    }
    document.addEventListener('touchmove', this.handleTouchMoveCapture, {
      capture: true,
    });
    document.addEventListener('touchend', this.handleTouchEndCapture, {
      capture: true,
    });
  }

  exit(): void {
    this.active = false;
    document.body.classList.remove('control-edit-mode');

    if (this.banner) {
      this.banner.remove();
      this.banner = null;
    }

    for (const label of this.labels) {
      label.remove();
    }
    this.labels = [];

    // Remove handlers
    for (const container of this.containers()) {
      container.removeEventListener(
        'touchstart',
        this.handleTouchStartCapture,
        { capture: true },
      );
    }
    document.removeEventListener('touchmove', this.handleTouchMoveCapture, {
      capture: true,
    });
    document.removeEventListener('touchend', this.handleTouchEndCapture, {
      capture: true,
    });

    this.savePositions();
    this.emitter.emit('done', undefined);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private containers(): HTMLElement[] {
    return [this.joystickContainer, this.attackContainer, this.sitContainer];
  }

  private addLabel(container: HTMLElement, text: string): void {
    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = text;
    container.appendChild(label);
    this.labels.push(label);
  }

  private applyTransform(element: HTMLElement, dx: number, dy: number): void {
    element.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  // ── Touch drag ───────────────────────────────────────────────────────────

  private onTouchStart(event: TouchEvent): void {
    if (!this.active) return;
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget as HTMLElement;
    const touch = event.changedTouches[0];
    const offset = this.offsets.get(target) ?? { dx: 0, dy: 0 };

    this.dragging = target;
    this.dragStartX = touch.clientX;
    this.dragStartY = touch.clientY;
    this.dragStartOffsetX = offset.dx;
    this.dragStartOffsetY = offset.dy;
  }

  private onTouchMove(event: TouchEvent): void {
    if (!this.active || !this.dragging) return;
    event.preventDefault();
    event.stopPropagation();

    const touch = event.changedTouches[0];
    const dx = this.dragStartOffsetX + (touch.clientX - this.dragStartX);
    const dy = this.dragStartOffsetY + (touch.clientY - this.dragStartY);

    this.offsets.set(this.dragging, { dx, dy });
    this.applyTransform(this.dragging, dx, dy);
  }

  private onTouchEnd(event: TouchEvent): void {
    if (!this.active || !this.dragging) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragging = null;
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  private loadPositions(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const stored: ControlOffsets = JSON.parse(raw);
      const entries: [keyof ControlOffsets, HTMLElement][] = [
        ['joystick', this.joystickContainer],
        ['attack', this.attackContainer],
        ['sit', this.sitContainer],
      ];

      for (const [key, container] of entries) {
        const offset = stored[key];
        if (!offset) continue;
        this.offsets.set(container, { dx: offset.dx, dy: offset.dy });
        this.applyTransform(container, offset.dx, offset.dy);
      }
    } catch {
      // Invalid data — ignore
    }
  }

  private savePositions(): void {
    const stored: ControlOffsets = {};
    const entries: [keyof ControlOffsets, HTMLElement][] = [
      ['joystick', this.joystickContainer],
      ['attack', this.attackContainer],
      ['sit', this.sitContainer],
    ];

    let hasCustom = false;
    for (const [key, container] of entries) {
      const offset = this.offsets.get(container) ?? { dx: 0, dy: 0 };
      if (offset.dx !== 0 || offset.dy !== 0) {
        hasCustom = true;
      }
      stored[key] = offset;
    }

    if (hasCustom) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private resetPositions(): void {
    localStorage.removeItem(STORAGE_KEY);

    for (const container of this.containers()) {
      this.offsets.set(container, { dx: 0, dy: 0 });
      container.style.transform = '';
    }
  }
}
