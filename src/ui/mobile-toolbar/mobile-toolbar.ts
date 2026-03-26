import mitt from 'mitt';
import type { Client } from '../../client';
import { playSfxById, SfxId } from '../../sfx';
import { Base } from '../base-ui';

import './mobile-toolbar.css';

type ToggleTarget =
  | 'inventory'
  | 'map'
  | 'spells'
  | 'stats'
  | 'online'
  | 'party'
  | 'guild';

type Events = {
  toggle: ToggleTarget;
  exit: undefined;
};

const MENU_ITEMS: { id: ToggleTarget; label: string; svg: string }[] = [
  {
    id: 'inventory',
    label: 'Inventory',
    svg: `<svg viewBox="0 0 24 24"><path d="M20 7H4a1 1 0 0 0-1 1v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1zM5 4h14a1 1 0 1 1 0 2H5a1 1 0 0 1 0-2z"/></svg>`,
  },
  {
    id: 'map',
    label: 'Map',
    svg: `<svg viewBox="0 0 24 24"><path d="M9 2L3 5v17l6-3 6 3 6-3V2l-6 3-6-3zM9 4.5l6 3v12l-6-3v-12z"/></svg>`,
  },
  {
    id: 'spells',
    label: 'Spells',
    svg: `<svg viewBox="0 0 24 24"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/></svg>`,
  },
  {
    id: 'stats',
    label: 'Stats',
    svg: `<svg viewBox="0 0 24 24"><path d="M16 11V3H8v6H2v12h20V11h-6zm-6-6h4v14h-4V5zM4 11h4v8H4v-8zm16 8h-4v-6h4v6z"/></svg>`,
  },
  {
    id: 'online',
    label: 'Online',
    svg: `<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
  },
  {
    id: 'party',
    label: 'Party',
    svg: `<svg viewBox="0 0 24 24"><path d="M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1C4.76 14.04 4.39 14 4 14c-.99 0-1.93.21-2.78.58A2.01 2.01 0 0 0 0 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85A6.95 6.95 0 0 0 20 14c-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z"/></svg>`,
  },
  {
    id: 'guild',
    label: 'Guild',
    svg: `<svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.67-3.13 9.04-7 10.2-3.87-1.16-7-5.53-7-10.2V6.3l7-3.12z"/></svg>`,
  },
];

export class MobileToolbar extends Base {
  protected container: HTMLElement = document.getElementById('mobile-toolbar')!;
  private emitter = mitt<Events>();
  private overlay!: HTMLDivElement;
  private panel!: HTMLDivElement;
  private menuOpen = false;

  constructor(_client: Client) {
    super();
    this.buildCornerButtons();
    this.buildMenuPanel();
  }

  private buildCornerButtons() {
    this.container.innerHTML = '';

    // Exit button (X)
    const exitBtn = document.createElement('button');
    exitBtn.className = 'corner-btn';
    exitBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
    exitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playSfxById(SfxId.ButtonClick);
      this.emitter.emit('exit');
    });

    // Hamburger button (☰)
    const menuBtn = document.createElement('button');
    menuBtn.className = 'corner-btn';
    menuBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>`;
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playSfxById(SfxId.ButtonClick);
      this.toggleMenu();
    });

    this.container.appendChild(exitBtn);
    this.container.appendChild(menuBtn);
  }

  private buildMenuPanel() {
    // Overlay
    this.overlay = document.createElement('div');
    this.overlay.id = 'mobile-menu-overlay';
    this.overlay.addEventListener('click', () => this.closeMenu());
    document.body.appendChild(this.overlay);

    // Panel
    this.panel = document.createElement('div');
    this.panel.id = 'mobile-menu-panel';

    for (const item of MENU_ITEMS) {
      const btn = document.createElement('button');
      btn.className = 'menu-item-btn';
      btn.innerHTML = `${item.svg}<span>${item.label}</span>`;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playSfxById(SfxId.ButtonClick);
        this.closeMenu();
        this.emitter.emit('toggle', item.id);
      });

      this.panel.appendChild(btn);
    }

    document.body.appendChild(this.panel);
  }

  private toggleMenu() {
    this.menuOpen ? this.closeMenu() : this.openMenu();
  }

  private openMenu() {
    this.menuOpen = true;
    this.overlay.classList.add('open');
    this.panel.classList.add('open');
  }

  private closeMenu() {
    this.menuOpen = false;
    this.overlay.classList.remove('open');
    this.panel.classList.remove('open');
  }

  show() {
    this.container.classList.remove('hidden');
  }

  hide() {
    this.container.classList.add('hidden');
    this.closeMenu();
  }

  // keep API compatible - no hotbar rendering needed now
  refresh() {}

  on<Event extends keyof Events>(
    event: Event,
    handler: (data: Events[Event]) => void,
  ) {
    this.emitter.on(event, handler);
  }
}
