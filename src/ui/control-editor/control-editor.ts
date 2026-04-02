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

export class ControlEditor {
  private active = false;
  private banner: HTMLDivElement | null = null;
  private dragging: HTMLElement | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  private joystick = document.getElementById('joystick-container')!;
  private attackButton = document.getElementById('btn-attack')!;
  private sitButton = document.getElementById('btn-toggle-sit')!;
  private actionsContainer = document.getElementById(
    'mobile-actions-container',
  )!;
  private controlsContainer = document.getElementById('mobile-controls')!;

  private labels: HTMLDivElement[] = [];

  private emitter = mitt<ControlEditorEvents>();

  // Bound handlers for cleanup
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

    // Create banner
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

    // Reparent attack and sit out of the flex container so they can be independently positioned
    // Read their rects BEFORE reparenting
    const attackRect = this.attackButton.getBoundingClientRect();
    const sitRect = this.sitButton.getBoundingClientRect();
    this.controlsContainer.appendChild(this.attackButton);
    this.controlsContainer.appendChild(this.sitButton);

    // Add labels below each control
    this.addLabel(this.joystick, 'Move');
    this.addLabel(this.attackButton, 'Attack');
    this.addLabel(this.sitButton, 'Sit');

    // Convert current positions to fixed left/top for dragging
    this.convertToFixed(this.joystick);
    this.convertToFixedAt(this.attackButton, attackRect);
    this.convertToFixedAt(this.sitButton, sitRect);

    // Set up touch drag handlers with capture to block input.ts
    for (const element of [this.joystick, this.attackButton, this.sitButton]) {
      element.addEventListener('touchstart', this.handleTouchStartCapture, {
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

    // Remove banner
    if (this.banner) {
      this.banner.remove();
      this.banner = null;
    }

    // Remove labels
    for (const label of this.labels) {
      label.remove();
    }
    this.labels = [];

    // Save positions before clearing inline styles
    this.savePositions();

    // Remove drag handlers
    for (const element of [this.joystick, this.attackButton, this.sitButton]) {
      element.removeEventListener('touchstart', this.handleTouchStartCapture, {
        capture: true,
      });
    }
    document.removeEventListener('touchmove', this.handleTouchMoveCapture, {
      capture: true,
    });
    document.removeEventListener('touchend', this.handleTouchEndCapture, {
      capture: true,
    });

    // Clear inline styles
    this.joystick.style.cssText = '';
    this.attackButton.style.cssText = '';
    this.sitButton.style.cssText = '';

    // Reparent attack and sit back into the flex container
    this.actionsContainer.appendChild(this.attackButton);
    this.actionsContainer.appendChild(this.sitButton);

    // Re-apply stored positions (may set them back to fixed if custom positions exist)
    this.loadPositions();

    this.emitter.emit('done', undefined);
  }

  private addLabel(element: HTMLElement, text: string): void {
    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = text;
    element.appendChild(label);
    this.labels.push(label);
  }

  private convertToFixed(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    this.convertToFixedAt(element, rect);
  }

  private convertToFixedAt(element: HTMLElement, rect: DOMRect): void {
    element.style.position = 'fixed';
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
    element.style.bottom = 'auto';
    element.style.right = 'auto';
  }

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
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rect = this.dragging.getBoundingClientRect();

    let newLeft = touch.clientX - this.dragOffsetX;
    let newTop = touch.clientY - this.dragOffsetY;

    // Constrain to viewport bounds
    newLeft = Math.max(0, Math.min(newLeft, viewportWidth - rect.width));
    newTop = Math.max(0, Math.min(newTop, viewportHeight - rect.height));

    this.dragging.style.left = `${newLeft}px`;
    this.dragging.style.top = `${newTop}px`;
  }

  private onTouchEnd(event: TouchEvent): void {
    if (!this.active || !this.dragging) return;

    event.preventDefault();
    event.stopPropagation();

    this.dragging = null;
  }

  private loadPositions(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const positions: ControlPositions = JSON.parse(raw);
      this.applyStoredPositions(positions);
    } catch {
      // Invalid JSON — ignore
    }
  }

  private savePositions(): void {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const positions: ControlPositions = {};

    const joystickRect = this.joystick.getBoundingClientRect();
    positions.joystick = {
      x: (joystickRect.left / viewportWidth) * 100,
      y: (joystickRect.top / viewportHeight) * 100,
    };

    const attackRect = this.attackButton.getBoundingClientRect();
    positions.attack = {
      x: (attackRect.left / viewportWidth) * 100,
      y: (attackRect.top / viewportHeight) * 100,
    };

    const sitRect = this.sitButton.getBoundingClientRect();
    positions.sit = {
      x: (sitRect.left / viewportWidth) * 100,
      y: (sitRect.top / viewportHeight) * 100,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  }

  private resetPositions(): void {
    localStorage.removeItem(STORAGE_KEY);

    // Clear inline styles so CSS defaults take over
    this.joystick.style.cssText = '';
    this.attackButton.style.cssText = '';
    this.sitButton.style.cssText = '';

    // Temporarily reparent back to get correct default positions
    this.actionsContainer.appendChild(this.attackButton);
    this.actionsContainer.appendChild(this.sitButton);

    // Wait a frame for layout to recalculate
    requestAnimationFrame(() => {
      // Read default positions then reparent for editing
      const attackRect = this.attackButton.getBoundingClientRect();
      const sitRect = this.sitButton.getBoundingClientRect();
      this.controlsContainer.appendChild(this.attackButton);
      this.controlsContainer.appendChild(this.sitButton);

      // Re-convert to fixed for continued dragging
      this.convertToFixed(this.joystick);
      this.convertToFixedAt(this.attackButton, attackRect);
      this.convertToFixedAt(this.sitButton, sitRect);
    });
  }

  private applyStoredPositions(positions: ControlPositions): void {
    if (positions.joystick) {
      this.joystick.style.position = 'fixed';
      this.joystick.style.left = `${positions.joystick.x}vw`;
      this.joystick.style.top = `${positions.joystick.y}vh`;
      this.joystick.style.bottom = 'auto';
      this.joystick.style.right = 'auto';
    }

    if (positions.attack) {
      this.attackButton.style.position = 'fixed';
      this.attackButton.style.left = `${positions.attack.x}vw`;
      this.attackButton.style.top = `${positions.attack.y}vh`;
      this.attackButton.style.bottom = 'auto';
      this.attackButton.style.right = 'auto';
    }

    if (positions.sit) {
      this.sitButton.style.position = 'fixed';
      this.sitButton.style.left = `${positions.sit.x}vw`;
      this.sitButton.style.top = `${positions.sit.y}vh`;
      this.sitButton.style.bottom = 'auto';
      this.sitButton.style.right = 'auto';
    }
  }
}
