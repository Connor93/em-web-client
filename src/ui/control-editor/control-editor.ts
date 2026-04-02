import mitt from 'mitt';

import './control-editor.css';

interface ControlPositions {
  joystick?: { x: number; y: number };
  attack?: { x: number; y: number };
  sit?: { x: number; y: number };
}

type ControlEditorEvents = {
  done: undefined;
};

const STORAGE_KEY = 'mobile-control-positions';

/**
 * Draggable control editor.
 *
 * Each control lives in its own fixed-position container:
 *   #joystick-container, #attack-container, #sit-container
 *
 * During edit mode we override each container's left/top/bottom/right
 * with pixel values (via !important) so the user can drag them.
 * On save we convert to viewport-percentage and store in localStorage.
 * On reset we remove stored data and clear inline styles so CSS defaults
 * take over again. No reparenting is needed.
 */
export class ControlEditor {
  private active = false;
  private banner: HTMLDivElement | null = null;
  private dragging: HTMLElement | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  private joystickContainer = document.getElementById('joystick-container')!;
  private attackContainer = document.getElementById('attack-container')!;
  private sitContainer = document.getElementById('sit-container')!;

  private labels: HTMLDivElement[] = [];
  private emitter = mitt<ControlEditorEvents>();

  private handleTouchStartCapture: (e: TouchEvent) => void;
  private handleTouchMoveCapture: (e: TouchEvent) => void;
  private handleTouchEndCapture: (e: TouchEvent) => void;

  constructor() {
    this.handleTouchStartCapture = this.onTouchStart.bind(this);
    this.handleTouchMoveCapture = this.onTouchMove.bind(this);
    this.handleTouchEndCapture = this.onTouchEnd.bind(this);

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

    // Snapshot current positions, then override with fixed px for dragging
    for (const container of this.containers()) {
      const rect = container.getBoundingClientRect();
      this.setFixedPx(container, rect.left, rect.top);
    }

    // Labels
    this.addLabel(this.joystickContainer, 'Move');
    this.addLabel(this.attackContainer, 'Attack');
    this.addLabel(this.sitContainer, 'Sit');

    // Touch handlers
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

    // Convert current px positions to viewport % and persist
    this.savePositions();

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

    // Clear px overrides, re-apply stored % positions
    for (const container of this.containers()) {
      container.style.cssText = '';
    }
    this.loadPositions();

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

  private setFixedPx(element: HTMLElement, left: number, top: number): void {
    element.style.setProperty('left', `${left}px`, 'important');
    element.style.setProperty('top', `${top}px`, 'important');
    element.style.setProperty('bottom', 'auto', 'important');
    element.style.setProperty('right', 'auto', 'important');
  }

  // ── Touch drag ───────────────────────────────────────────────────────────

  private onTouchStart(event: TouchEvent): void {
    if (!this.active) return;
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget as HTMLElement;
    const touch = event.changedTouches[0];
    const rect = target.getBoundingClientRect();

    this.dragging = target;
    this.dragOffsetX = touch.clientX - rect.left;
    this.dragOffsetY = touch.clientY - rect.top;
  }

  private onTouchMove(event: TouchEvent): void {
    if (!this.active || !this.dragging) return;
    event.preventDefault();
    event.stopPropagation();

    const touch = event.changedTouches[0];
    const rect = this.dragging.getBoundingClientRect();
    let newLeft = touch.clientX - this.dragOffsetX;
    let newTop = touch.clientY - this.dragOffsetY;

    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
    newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));

    this.dragging.style.setProperty('left', `${newLeft}px`, 'important');
    this.dragging.style.setProperty('top', `${newTop}px`, 'important');
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
      const positions: ControlPositions = JSON.parse(raw);
      this.applyStoredPositions(positions);
    } catch {
      // Invalid data — ignore, CSS defaults apply
    }
  }

  private savePositions(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const positions: ControlPositions = {};

    for (const [key, container] of [
      ['joystick', this.joystickContainer],
      ['attack', this.attackContainer],
      ['sit', this.sitContainer],
    ] as const) {
      const rect = container.getBoundingClientRect();
      positions[key] = {
        x: (rect.left / width) * 100,
        y: (rect.top / height) * 100,
      };
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  }

  private applyStoredPositions(positions: ControlPositions): void {
    const entries: [keyof ControlPositions, HTMLElement][] = [
      ['joystick', this.joystickContainer],
      ['attack', this.attackContainer],
      ['sit', this.sitContainer],
    ];

    for (const [key, container] of entries) {
      const pos = positions[key];
      if (!pos) continue;
      container.style.setProperty('left', `${pos.x}vw`, 'important');
      container.style.setProperty('top', `${pos.y}vh`, 'important');
      container.style.setProperty('bottom', 'auto', 'important');
      container.style.setProperty('right', 'auto', 'important');
    }
  }

  private resetPositions(): void {
    localStorage.removeItem(STORAGE_KEY);

    // Clear inline styles so CSS defaults take over
    for (const container of this.containers()) {
      container.style.cssText = '';
    }

    // Re-snapshot default positions for continued editing
    requestAnimationFrame(() => {
      for (const container of this.containers()) {
        const rect = container.getBoundingClientRect();
        this.setFixedPx(container, rect.left, rect.top);
      }
    });
  }
}
