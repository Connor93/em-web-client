/**
 * Makes a dialog element draggable by its header/title area.
 * Stores last position in localStorage so windows reopen where the user left them.
 * Accounts for CSS transform: scale() on the #ui container.
 */

import { isMobile } from '../../main';

const STORAGE_PREFIX = 'ui-pos-';

function getUiScale(): number {
  const ui = document.getElementById('ui');
  if (!ui) return 1;
  const transform = ui.style.transform;
  const match = transform.match(/scale\(([^)]+)\)/);
  return match ? Number.parseFloat(match[1]) : 1;
}

export function makeDraggable(element: HTMLElement, handleSelector?: string) {
  if (isMobile()) return; // Mobile uses CSS-driven positioning
  const id = element.id;
  if (!id) return;

  const handle = handleSelector
    ? element.querySelector<HTMLElement>(handleSelector)
    : element;

  if (!handle) return;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  handle.style.cursor = 'move';
  handle.style.userSelect = 'none';

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('select') ||
      target.closest('.grid') ||
      target.closest('.item') ||
      target.closest('.item-list') ||
      target.closest('.chest-items') ||
      target.closest('.dialog-contents') ||
      target.closest('.spell-grid') ||
      target.closest('.shop-grid') ||
      target.closest('.locker-grid') ||
      target.closest('.grid-card') ||
      target.closest('.link') ||
      target.tagName === 'IMG' ||
      target.tagName === 'CANVAS'
    )
      return;

    isDragging = true;
    const scale = getUiScale();

    startX = event.clientX;
    startY = event.clientY;

    const rect = element.getBoundingClientRect();
    startLeft = rect.left / scale;
    startTop = rect.top / scale;

    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!isDragging) return;

    const scale = getUiScale();
    const dx = (event.clientX - startX) / scale;
    const dy = (event.clientY - startY) / scale;

    element.style.position = 'fixed';
    element.style.left = `${startLeft + dx}px`;
    element.style.top = `${startTop + dy}px`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
    element.style.margin = '0';
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!isDragging) return;
    isDragging = false;
    handle.releasePointerCapture(event.pointerId);

    // Save position
    localStorage.setItem(
      STORAGE_PREFIX + id,
      JSON.stringify({
        x: Number.parseFloat(element.style.left),
        y: Number.parseFloat(element.style.top),
      }),
    );
  };

  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', onPointerUp);
}

/**
 * Restore saved position or center the element on screen.
 * Call this in the element's show() method.
 */
export function restoreOrCenter(element: HTMLElement) {
  if (isMobile()) return; // Mobile uses CSS-driven positioning
  const id = element.id;
  if (!id) return;

  const scale = getUiScale();
  const uiEl = document.getElementById('ui');
  // Use the #ui container dimensions (CSS-space, before transform)
  const containerW = uiEl ? uiEl.offsetWidth : window.innerWidth / scale;
  const containerH = uiEl ? uiEl.offsetHeight : window.innerHeight / scale;

  const saved = localStorage.getItem(STORAGE_PREFIX + id);
  if (saved) {
    try {
      const { x, y } = JSON.parse(saved);
      const maxX = containerW - 50;
      const maxY = containerH - 50;
      element.style.position = 'fixed';
      element.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
      element.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
      element.style.right = 'auto';
      element.style.bottom = 'auto';
      element.style.margin = '0';
      return;
    } catch {
      // ignore bad data
    }
  }

  // Center in the #ui container (in CSS-space coordinates)
  const elW = element.offsetWidth;
  const elH = element.offsetHeight;

  element.style.position = 'fixed';
  element.style.left = `${(containerW - elW) / 2}px`;
  element.style.top = `${(containerH - elH) / 2}px`;
  element.style.right = 'auto';
  element.style.bottom = 'auto';
  element.style.margin = '0';
}
