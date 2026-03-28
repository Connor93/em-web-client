import { EOResourceID } from '../../edf';

import './game-toast.css';

export type ToastCategory = 'info' | 'warning' | 'loot' | 'exp' | 'action';

const TOAST_DURATION = 4000;
const MAX_TOASTS = 5;

let container: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement {
  if (container) return container;
  container = document.createElement('div');
  container.id = 'game-toasts';
  document.body.appendChild(container);
  return container;
}

function categorise(type: EOResourceID): ToastCategory {
  switch (type) {
    case EOResourceID.STATUS_LABEL_TYPE_WARNING:
      return 'warning';
    case EOResourceID.STATUS_LABEL_TYPE_INFORMATION:
      return 'info';
    case EOResourceID.STATUS_LABEL_TYPE_ACTION:
      return 'action';
    case EOResourceID.STATUS_LABEL_TYPE_ITEM:
      return 'loot';
    default:
      return 'info';
  }
}

const ICONS: Record<ToastCategory, string> = {
  info: '🔔',
  warning: '⚠️',
  loot: '💰',
  exp: '✨',
  action: '⚡',
};

export function showGameToast(
  type: EOResourceID,
  text: string,
  overrideCategory?: ToastCategory,
) {
  const cat = overrideCategory ?? categorise(type);

  // Detect exp-gain messages for special styling
  const isExp = text.toLowerCase().includes('exp');
  const finalCat = isExp && cat === 'info' ? 'exp' : cat;

  const el = document.createElement('div');
  el.classList.add('game-toast', `game-toast--${finalCat}`);

  const icon = document.createElement('span');
  icon.classList.add('game-toast__icon');
  icon.textContent = ICONS[finalCat];
  el.appendChild(icon);

  const msg = document.createElement('span');
  msg.classList.add('game-toast__msg');
  msg.textContent = text;
  el.appendChild(msg);

  const c = getContainer();

  // Enforce max visible
  while (c.children.length >= MAX_TOASTS) {
    c.firstElementChild?.remove();
  }

  c.appendChild(el);

  // Trigger entrance animation
  requestAnimationFrame(() => el.classList.add('show'));

  setTimeout(() => {
    el.classList.add('hide');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, TOAST_DURATION);
}
