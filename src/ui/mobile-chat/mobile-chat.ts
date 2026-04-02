import mitt from 'mitt';
import { ChatTab } from '../../client';
import type { ChatIcon } from '../../types/chat';
import { Base } from '../base-ui';

import './mobile-chat.css';

type Events = {
  chat: string;
  focus: undefined;
  blur: undefined;
};

interface ChatLine {
  tab: ChatTab;
  message: string;
  name?: string;
  icon: ChatIcon;
}

export class MobileChat extends Base {
  protected container = document.getElementById('mobile-chat-drawer')!;

  private drawer = document.getElementById('mobile-chat-drawer')!;
  private drawerMessages =
    this.drawer.querySelector<HTMLDivElement>('.drawer-messages')!;
  private drawerForm =
    this.drawer.querySelector<HTMLFormElement>('.drawer-input-form')!;
  private drawerInput =
    this.drawer.querySelector<HTMLInputElement>('.drawer-input')!;
  private drawerExpandButton =
    this.drawer.querySelector<HTMLButtonElement>('.drawer-expand')!;

  private fullscreen = document.getElementById('mobile-chat-fullscreen')!;
  private fullscreenMessages = this.fullscreen.querySelector<HTMLDivElement>(
    '.fullscreen-messages',
  )!;
  private fullscreenForm = this.fullscreen.querySelector<HTMLFormElement>(
    '.fullscreen-input-form',
  )!;
  private fullscreenInput =
    this.fullscreen.querySelector<HTMLInputElement>('.fullscreen-input')!;
  private fullscreenCloseButton =
    this.fullscreen.querySelector<HTMLButtonElement>('.fullscreen-close')!;
  private fullscreenTabButtons =
    this.fullscreen.querySelectorAll<HTMLButtonElement>(
      '.fullscreen-tabs .tab',
    );

  private emitter = mitt<Events>();
  private messages: ChatLine[] = [];
  private activeTab: ChatTab = ChatTab.Local;
  private drawerOpen = false;
  private fullscreenOpen = false;
  private drawerCloseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();

    // Drawer form submit
    this.drawerForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = this.drawerInput.value.trim();
      if (value) {
        this.emitter.emit('chat', value);
        this.drawerInput.value = '';
      }
    });

    // Drawer expand → open fullscreen
    this.drawerExpandButton.addEventListener('click', () => {
      this.closeDrawer();
      this.openFullscreen();
    });

    // Drawer input focus/blur
    this.drawerInput.addEventListener('focus', () => {
      this.emitter.emit('focus', undefined);
    });
    this.drawerInput.addEventListener('blur', () => {
      this.emitter.emit('blur', undefined);
    });

    // Fullscreen form submit
    this.fullscreenForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = this.fullscreenInput.value.trim();
      if (value) {
        this.emitter.emit('chat', value);
        this.fullscreenInput.value = '';
      }
    });

    // Fullscreen close
    this.fullscreenCloseButton.addEventListener('click', () => {
      this.closeFullscreen();
    });

    // Fullscreen input focus/blur
    this.fullscreenInput.addEventListener('focus', () => {
      this.emitter.emit('focus', undefined);
    });
    this.fullscreenInput.addEventListener('blur', () => {
      this.emitter.emit('blur', undefined);
    });

    // Fullscreen tab buttons
    for (const button of this.fullscreenTabButtons) {
      button.addEventListener('click', () => {
        for (const other of this.fullscreenTabButtons) {
          other.classList.remove('active');
        }
        button.classList.add('active');

        const tabName = button.dataset.tab;
        switch (tabName) {
          case 'local':
            this.activeTab = ChatTab.Local;
            break;
          case 'global':
            this.activeTab = ChatTab.Global;
            break;
          case 'group':
            this.activeTab = ChatTab.Group;
            break;
          case 'system':
            this.activeTab = ChatTab.System;
            break;
        }

        this.renderFullscreenMessages();
      });
    }

    // Click outside drawer to close
    document.addEventListener('click', (event) => {
      if (!this.drawerOpen) return;
      const target = event.target as HTMLElement;
      if (
        this.drawer.contains(target) ||
        target.closest('#btn-chat-badge') !== null
      ) {
        return;
      }
      this.closeDrawer();
    });
  }

  addMessage(
    tab: ChatTab,
    message: string,
    icon: ChatIcon,
    name?: string,
  ): void {
    this.messages.push({ tab, message, name, icon });

    if (this.drawerOpen) {
      this.renderDrawerMessages();
    }
    if (this.fullscreenOpen) {
      this.renderFullscreenMessages();
    }
  }

  toggleDrawer(): void {
    if (this.drawerOpen) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  }

  openDrawer(): void {
    if (this.fullscreenOpen) return;

    if (this.drawerCloseTimer !== null) {
      clearTimeout(this.drawerCloseTimer);
      this.drawerCloseTimer = null;
    }

    this.drawerOpen = true;
    this.drawer.classList.remove('hidden');
    // Force reflow before adding open class for CSS transition
    void this.drawer.offsetHeight;
    this.drawer.classList.add('open');
    this.renderDrawerMessages();
  }

  closeDrawer(): void {
    if (!this.drawerOpen) return;

    this.drawerOpen = false;
    this.drawer.classList.remove('open');
    this.drawerInput.blur();

    this.drawerCloseTimer = setTimeout(() => {
      this.drawer.classList.add('hidden');
      this.drawerCloseTimer = null;
    }, 250);
  }

  openFullscreen(): void {
    this.fullscreenOpen = true;
    this.fullscreen.classList.remove('hidden');
    this.renderFullscreenMessages();
  }

  closeFullscreen(): void {
    this.fullscreenOpen = false;
    this.fullscreen.classList.add('hidden');
    this.fullscreenInput.blur();
  }

  isOpen(): boolean {
    return this.drawerOpen || this.fullscreenOpen;
  }

  clear(): void {
    this.messages = [];
    this.drawerMessages.textContent = '';
    this.fullscreenMessages.textContent = '';
  }

  on<K extends keyof Events>(
    event: K,
    handler: (payload: Events[K]) => void,
  ): void {
    this.emitter.on(event, handler);
  }

  private renderDrawerMessages(): void {
    this.drawerMessages.textContent = '';
    const filtered = this.filterMessages(this.messages);
    const recent = filtered.slice(-3);
    for (const line of recent) {
      this.drawerMessages.appendChild(this.createChatLine(line));
    }
    this.drawerMessages.scrollTop = this.drawerMessages.scrollHeight;
  }

  private renderFullscreenMessages(): void {
    this.fullscreenMessages.textContent = '';
    const filtered = this.filterMessages(this.messages);
    for (const line of filtered) {
      this.fullscreenMessages.appendChild(this.createChatLine(line));
    }
    this.fullscreenMessages.scrollTop = this.fullscreenMessages.scrollHeight;
  }

  private filterMessages(lines: ChatLine[]): ChatLine[] {
    if (this.activeTab === ChatTab.Local) {
      return lines;
    }
    return lines.filter((line) => line.tab === this.activeTab);
  }

  private createChatLine(line: ChatLine): HTMLDivElement {
    const container = document.createElement('div');
    container.classList.add('chat-line');

    if (line.name) {
      const author = document.createElement('span');
      author.classList.add('chat-author');
      author.textContent = `${line.name} `;
      container.appendChild(author);
    }

    const messageSpan = document.createElement('span');
    messageSpan.textContent = line.message;
    container.appendChild(messageSpan);

    return container;
  }
}
