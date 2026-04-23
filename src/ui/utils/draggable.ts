/**
 * Makes a dialog element draggable by its header/title area.
 * Stores last position in localStorage so windows reopen where the user left them.
 * Accounts for CSS transform: scale() on the #ui container.
 */

import { isMobile } from '../../main';

const STORAGE_PREFIX = 'ui-pos-';
const BASE_Z_INDEX = 1050;
let topZIndex = BASE_Z_INDEX;

/** Bring a dialog element to the front of the stacking order. */
export function bringToFront(element: HTMLElement): void {
  topZIndex += 1;
  element.style.zIndex = `${topZIndex}`;
}

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

  if (!registeredIds.includes(id)) {
    registeredIds.push(id);
  }

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
      target.closest('.quest-progress-body') ||
      target.closest('.post-list') ||
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

  // Bring to front on any click anywhere in the dialog
  element.addEventListener('pointerdown', () => bringToFront(element));
}

/** All registered draggable element IDs, for bulk operations. */
const registeredIds: string[] = [];

/**
 * Re-clamp all draggable dialog positions to stay within container bounds.
 * Call this on window resize so dialogs don't go off-screen.
 */
export function reclampDraggablePositions(): void {
  const scale = getUiScale();
  const uiEl = document.getElementById('ui');
  const containerW = uiEl ? uiEl.offsetWidth : window.innerWidth / scale;
  const containerH = uiEl ? uiEl.offsetHeight : window.innerHeight / scale;

  for (const id of registeredIds) {
    const element = document.getElementById(id);
    if (!element || element.style.position !== 'fixed') continue;

    const currentX = Number.parseFloat(element.style.left) || 0;
    const currentY = Number.parseFloat(element.style.top) || 0;

    const clampedX = Math.max(0, Math.min(currentX, containerW - 50));
    const clampedY = Math.max(0, Math.min(currentY, containerH - 50));

    if (clampedX !== currentX || clampedY !== currentY) {
      element.style.left = `${clampedX}px`;
      element.style.top = `${clampedY}px`;

      localStorage.setItem(
        STORAGE_PREFIX + id,
        JSON.stringify({ x: clampedX, y: clampedY }),
      );
    }
  }
}

/**
 * Rescale all saved draggable positions when the UI scale changes.
 * Converts CSS-space coordinates from old scale to new scale
 * so dialogs stay in the same visual screen position.
 */
export function rescaleDraggablePositions(
  oldScale: number,
  newScale: number,
): void {
  if (oldScale === newScale || oldScale <= 0 || newScale <= 0) return;

  const ratio = oldScale / newScale;

  for (const id of registeredIds) {
    const key = STORAGE_PREFIX + id;
    const saved = localStorage.getItem(key);
    if (!saved) continue;

    try {
      const { x, y } = JSON.parse(saved);
      const newX = x * ratio;
      const newY = y * ratio;
      localStorage.setItem(key, JSON.stringify({ x: newX, y: newY }));

      // If the element is currently visible, update its position
      const element = document.getElementById(id);
      if (element && element.style.position === 'fixed') {
        element.style.left = `${newX}px`;
        element.style.top = `${newY}px`;
      }
    } catch {
      // ignore bad data
    }
  }
}

/**
 * Restore saved position or center the element on screen.
 * Call this in the element's show() method.
 */
export function restoreOrCenter(element: HTMLElement) {
  if (isMobile()) return; // Mobile uses CSS-driven positioning
  const id = element.id;
  if (!id) return;

  bringToFront(element);

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
