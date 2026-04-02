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
  private customPositionsApplied = false;

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

    // Snapshot current screen positions before any DOM changes
    const joystickRect = this.joystick.getBoundingClientRect();
    const attackRect = this.attackButton.getBoundingClientRect();
    const sitRect = this.sitButton.getBoundingClientRect();

    // Ensure attack/sit are direct children of controls container (not flex)
    if (!this.customPositionsApplied) {
      this.controlsContainer.appendChild(this.attackButton);
      this.controlsContainer.appendChild(this.sitButton);
    }

    // Add labels
    this.addLabel(this.joystick, 'Move');
    this.addLabel(this.attackButton, 'Attack');
    this.addLabel(this.sitButton, 'Sit');

    // Apply fixed pixel positions matching where they were on screen
    this.setFixedPosition(this.joystick, joystickRect);
    this.setFixedPosition(this.attackButton, attackRect);
    this.setFixedPosition(this.sitButton, sitRect);

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

    // Save current screen positions as viewport percentages
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

    // Clear all inline styles and re-apply from storage
    this.clearInlineStyles();
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

  private setFixedPosition(element: HTMLElement, rect: DOMRect): void {
    element.style.setProperty('position', 'fixed', 'important');
    element.style.setProperty('left', `${rect.left}px`, 'important');
    element.style.setProperty('top', `${rect.top}px`, 'important');
    element.style.setProperty('bottom', 'auto', 'important');
    element.style.setProperty('right', 'auto', 'important');
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

    this.dragging.style.setProperty('left', `${newLeft}px`, 'important');
    this.dragging.style.setProperty('top', `${newTop}px`, 'important');
  }

  private onTouchEnd(event: TouchEvent): void {
    if (!this.active || !this.dragging) return;

    event.preventDefault();
    event.stopPropagation();

    this.dragging = null;
  }

  private loadPositions(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      this.restoreDefaults();
      return;
    }

    try {
      const positions: ControlPositions = JSON.parse(raw);
      this.applyStoredPositions(positions);
    } catch {
      this.restoreDefaults();
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
    this.clearInlineStyles();

    // Reparent back to flex container for default layout
    this.actionsContainer.appendChild(this.attackButton);
    this.actionsContainer.appendChild(this.sitButton);
    this.customPositionsApplied = false;

    // Wait a frame for layout, then snapshot default positions and re-enter edit
    requestAnimationFrame(() => {
      const joystickRect = this.joystick.getBoundingClientRect();
      const attackRect = this.attackButton.getBoundingClientRect();
      const sitRect = this.sitButton.getBoundingClientRect();

      // Move back out for editing
      this.controlsContainer.appendChild(this.attackButton);
      this.controlsContainer.appendChild(this.sitButton);

      this.setFixedPosition(this.joystick, joystickRect);
      this.setFixedPosition(this.attackButton, attackRect);
      this.setFixedPosition(this.sitButton, sitRect);
    });
  }

  private applyStoredPositions(positions: ControlPositions): void {
    // Reparent attack/sit out of flex container so fixed positioning works cleanly
    if (
      this.attackButton.parentElement === this.actionsContainer ||
      this.sitButton.parentElement === this.actionsContainer
    ) {
      this.controlsContainer.appendChild(this.attackButton);
      this.controlsContainer.appendChild(this.sitButton);
    }
    this.customPositionsApplied = true;

    if (positions.joystick) {
      this.joystick.style.setProperty('position', 'fixed', 'important');
      this.joystick.style.setProperty(
        'left',
        `${positions.joystick.x}vw`,
        'important',
      );
      this.joystick.style.setProperty(
        'top',
        `${positions.joystick.y}vh`,
        'important',
      );
      this.joystick.style.setProperty('bottom', 'auto', 'important');
      this.joystick.style.setProperty('right', 'auto', 'important');
    }

    if (positions.attack) {
      this.attackButton.style.setProperty('position', 'fixed', 'important');
      this.attackButton.style.setProperty(
        'left',
        `${positions.attack.x}vw`,
        'important',
      );
      this.attackButton.style.setProperty(
        'top',
        `${positions.attack.y}vh`,
        'important',
      );
      this.attackButton.style.setProperty('bottom', 'auto', 'important');
      this.attackButton.style.setProperty('right', 'auto', 'important');
    }

    if (positions.sit) {
      this.sitButton.style.setProperty('position', 'fixed', 'important');
      this.sitButton.style.setProperty(
        'left',
        `${positions.sit.x}vw`,
        'important',
      );
      this.sitButton.style.setProperty(
        'top',
        `${positions.sit.y}vh`,
        'important',
      );
      this.sitButton.style.setProperty('bottom', 'auto', 'important');
      this.sitButton.style.setProperty('right', 'auto', 'important');
    }
  }

  private restoreDefaults(): void {
    if (this.customPositionsApplied) {
      this.actionsContainer.appendChild(this.attackButton);
      this.actionsContainer.appendChild(this.sitButton);
      this.customPositionsApplied = false;
    }
  }

  private clearInlineStyles(): void {
    this.joystick.style.cssText = '';
    this.attackButton.style.cssText = '';
    this.sitButton.style.cssText = '';
  }
}
