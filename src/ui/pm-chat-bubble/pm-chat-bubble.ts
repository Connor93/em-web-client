import mitt from 'mitt';
import { capitalize } from '../../utils';

type Events = {
  send: { target: string; message: string };
  close: { name: string };
};

export class PmChatBubble {
  public readonly name: string;
  public readonly el: HTMLDivElement;
  private emitter = mitt<Events>();
  private messages: HTMLDivElement;
  private input: HTMLInputElement;
  private unreadDot: HTMLDivElement;
  private expanded = false;
  private ownName: string;

  constructor(playerName: string, ownName: string) {
    this.name = playerName.toLowerCase();
    this.ownName = ownName.toLowerCase();

    this.el = document.createElement('div');
    this.el.classList.add('pm-bubble');

    // ── Collapsed view elements ──
    const collapsedName = document.createElement('span');
    collapsedName.classList.add('pm-name');
    collapsedName.textContent = capitalize(this.name);
    this.el.appendChild(collapsedName);

    this.unreadDot = document.createElement('div');
    this.unreadDot.classList.add('pm-unread');
    this.el.appendChild(this.unreadDot);

    const closeBtn = document.createElement('div');
    closeBtn.classList.add('pm-close-btn');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.emitter.emit('close', { name: this.name });
    });
    this.el.appendChild(closeBtn);

    // ── Expanded view elements (hidden when collapsed) ──
    const header = document.createElement('div');
    header.classList.add('pm-header');

    const headerName = document.createElement('span');
    headerName.classList.add('pm-name');
    headerName.textContent = capitalize(this.name);
    header.appendChild(headerName);

    const minimizeBtn = document.createElement('div');
    minimizeBtn.classList.add('pm-close-btn');
    minimizeBtn.textContent = '−';
    minimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.collapse();
    });
    header.appendChild(minimizeBtn);

    const headerCloseBtn = document.createElement('div');
    headerCloseBtn.classList.add('pm-close-btn');
    headerCloseBtn.textContent = '×';
    headerCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.emitter.emit('close', { name: this.name });
    });
    header.appendChild(headerCloseBtn);

    this.el.appendChild(header);

    this.messages = document.createElement('div');
    this.messages.classList.add('pm-messages');
    this.el.appendChild(this.messages);

    const inputRow = document.createElement('div');
    inputRow.classList.add('pm-input-row');

    this.input = document.createElement('input');
    this.input.classList.add('pm-input');
    this.input.type = 'text';
    this.input.placeholder = 'Type a message…';
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && this.input.value.trim()) {
        this.sendCurrentMessage();
      }
    });
    inputRow.appendChild(this.input);

    const sendBtn = document.createElement('button');
    sendBtn.classList.add('pm-send-btn');
    sendBtn.type = 'button';
    sendBtn.textContent = '▸';
    sendBtn.addEventListener('click', () => {
      if (this.input.value.trim()) {
        this.sendCurrentMessage();
      }
    });
    inputRow.appendChild(sendBtn);

    this.el.appendChild(inputRow);

    // Click collapsed pill to expand (only if not dragged)
    // handled inside setupDrag

    // ── Dragging ──
    this.setupDrag(header);
  }

  on<Event extends keyof Events>(
    event: Event,
    handler: (data: Events[Event]) => void,
  ) {
    this.emitter.on(event, handler);
  }

  addReceivedMessage(message: string) {
    this.appendMessage(message, 'received', this.name);
    if (!this.expanded) {
      this.unreadDot.classList.add('active');
    }
  }

  addSentMessage(message: string) {
    this.appendMessage(message, 'sent', this.ownName);
  }

  expand() {
    this.expanded = true;
    this.el.classList.add('expanded');
    this.unreadDot.classList.remove('active');
    this.messages.scrollTo(0, this.messages.scrollHeight);
    setTimeout(() => this.input.focus(), 50);
  }

  collapse() {
    this.expanded = false;
    this.el.classList.remove('expanded');
  }

  destroy() {
    this.el.remove();
  }

  private sendCurrentMessage() {
    const msg = this.input.value.trim();
    this.input.value = '';
    this.emitter.emit('send', { target: this.name, message: msg });
  }

  private appendMessage(
    text: string,
    type: 'sent' | 'received',
    authorName: string,
  ) {
    const div = document.createElement('div');
    div.classList.add('pm-msg', type);

    const author = document.createElement('div');
    author.classList.add('pm-msg-author');
    author.textContent = capitalize(authorName);
    div.appendChild(author);

    const content = document.createElement('span');
    content.textContent = text;
    div.appendChild(content);

    this.messages.appendChild(div);
    this.messages.scrollTo(0, this.messages.scrollHeight);
  }

  private setupDrag(header: HTMLDivElement) {
    let dragging = false;
    let didDrag = false;
    let startMouseX = 0;
    let startMouseY = 0;
    let startLeft = 0;
    let startTop = 0;
    const DRAG_THRESHOLD = 5;

    const getScale = (): number => {
      const ui = document.getElementById('ui');
      if (!ui) return 1;
      const m = ui.style.transform.match(/scale\(([^)]+)\)/);
      return m ? Number.parseFloat(m[1]) : 1;
    };

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.pm-close-btn')) return;

      const scale = getScale();
      dragging = true;
      didDrag = false;
      startMouseX = e.clientX;
      startMouseY = e.clientY;

      const rect = this.el.getBoundingClientRect();
      startLeft = rect.left / scale;
      startTop = rect.top / scale;
      e.preventDefault();
    };

    // Listen on both the pill (collapsed) and header (expanded)
    this.el.addEventListener('mousedown', (e: MouseEvent) => {
      if (this.expanded) return;
      onMouseDown(e);
    });
    header.addEventListener('mousedown', (e: MouseEvent) => {
      onMouseDown(e);
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!dragging) return;
      const rawDx = e.clientX - startMouseX;
      const rawDy = e.clientY - startMouseY;
      if (!didDrag && Math.abs(rawDx) + Math.abs(rawDy) < DRAG_THRESHOLD)
        return;
      didDrag = true;

      const scale = getScale();
      const dx = rawDx / scale;
      const dy = rawDy / scale;

      // Clamp to #ui container bounds
      const uiEl = document.getElementById('ui');
      const containerW = uiEl ? uiEl.offsetWidth : window.innerWidth / scale;
      const containerH = uiEl ? uiEl.offsetHeight : window.innerHeight / scale;
      const elW = this.el.offsetWidth;
      const elH = this.el.offsetHeight;

      const newLeft = Math.max(0, Math.min(startLeft + dx, containerW - elW));
      const newTop = Math.max(0, Math.min(startTop + dy, containerH - elH));

      this.el.style.position = 'fixed';
      this.el.style.left = `${newLeft}px`;
      this.el.style.top = `${newTop}px`;
    });

    document.addEventListener('mouseup', () => {
      if (dragging && !didDrag && !this.expanded) {
        this.expand();
      }
      dragging = false;
    });
  }
}
