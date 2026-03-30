/**
 * Makes "always-present" UI elements (HUD, Chat) repositionable.
 *
 * Desktop: pointer-based drag, gated by a global lock toggle.
 * Mobile: long-press (500ms) to drag, always available.
 * Positions persist in localStorage with scale-aware coordinates.
 */

import { isMobile } from '../../main';

const STORAGE_PREFIX = 'ui-pos-';
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_THRESHOLD = 8;

/** All registered movable elements, for bulk operations. */
const registeredElements: HTMLElement[] = [];

let locked = true;

function getUiScale(): number {
  const ui = document.getElementById('ui');
  if (!ui) return 1;
  const match = ui.style.transform.match(/scale\(([^)]+)\)/);
  return match ? Number.parseFloat(match[1]) : 1;
}

function getStorageKey(element: HTMLElement): string {
  const prefix = isMobile() ? 'mobile-' : '';
  return STORAGE_PREFIX + prefix + element.id;
}

function savePosition(element: HTMLElement): void {
  const key = getStorageKey(element);
  localStorage.setItem(
    key,
    JSON.stringify({
      x: Number.parseFloat(element.style.left) || 0,
      y: Number.parseFloat(element.style.top) || 0,
    }),
  );
}

function applyPosition(element: HTMLElement, x: number, y: number): void {
  const scale = getUiScale();
  const uiElement = document.getElementById('ui');
  const containerWidth = uiElement
    ? uiElement.offsetWidth
    : window.innerWidth / scale;
  const containerHeight = uiElement
    ? uiElement.offsetHeight
    : window.innerHeight / scale;

  const clampedX = Math.max(0, Math.min(x, containerWidth - 50));
  const clampedY = Math.max(0, Math.min(y, containerHeight - 50));

  element.style.position = 'fixed';
  element.style.left = `${clampedX}px`;
  element.style.top = `${clampedY}px`;
  element.style.right = 'auto';
  element.style.bottom = 'auto';
  element.style.margin = '0';
}

function restorePosition(element: HTMLElement): void {
  const key = getStorageKey(element);
  const saved = localStorage.getItem(key);
  if (!saved) return;

  try {
    const { x, y } = JSON.parse(saved);
    applyPosition(element, x, y);
  } catch {
    // Ignore bad data
  }
}

function clearPosition(element: HTMLElement): void {
  const key = getStorageKey(element);
  localStorage.removeItem(key);
  // Also clear the other platform's key
  const otherPrefix = isMobile() ? '' : 'mobile-';
  localStorage.removeItem(STORAGE_PREFIX + otherPrefix + element.id);
  // Remove inline positioning to restore CSS defaults
  element.style.position = '';
  element.style.left = '';
  element.style.top = '';
  element.style.right = '';
  element.style.bottom = '';
  element.style.margin = '';
}

function setupDesktopDrag(element: HTMLElement): void {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  element.addEventListener('pointerdown', (event: PointerEvent) => {
    if (locked || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('select')
    )
      return;

    isDragging = true;
    const scale = getUiScale();
    startX = event.clientX;
    startY = event.clientY;

    const rect = element.getBoundingClientRect();
    startLeft = rect.left / scale;
    startTop = rect.top / scale;

    element.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  element.addEventListener('pointermove', (event: PointerEvent) => {
    if (!isDragging) return;
    const scale = getUiScale();
    const dx = (event.clientX - startX) / scale;
    const dy = (event.clientY - startY) / scale;
    applyPosition(element, startLeft + dx, startTop + dy);
  });

  element.addEventListener('pointerup', (event: PointerEvent) => {
    if (!isDragging) return;
    isDragging = false;
    element.releasePointerCapture(event.pointerId);
    savePosition(element);
  });
}

function setupMobileDrag(element: HTMLElement): void {
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let isDragging = false;
  let startTouchX = 0;
  let startTouchY = 0;
  let startLeft = 0;
  let startTop = 0;

  element.addEventListener(
    'touchstart',
    (event: TouchEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('select') ||
        target.closest('ul') ||
        target.closest('#chat-tab-bar')
      )
        return;

      const touch = event.touches[0];
      startTouchX = touch.clientX;
      startTouchY = touch.clientY;

      longPressTimer = setTimeout(() => {
        isDragging = true;
        const scale = getUiScale();
        const rect = element.getBoundingClientRect();
        startLeft = rect.left / scale;
        startTop = rect.top / scale;

        // Visual feedback: lift effect
        element.style.transform = 'scale(1.02)';
        element.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
        element.style.transition = 'transform 0.15s, box-shadow 0.15s';

        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }, LONG_PRESS_MS);
    },
    { passive: true },
  );

  element.addEventListener(
    'touchmove',
    (event: TouchEvent) => {
      const touch = event.touches[0];

      // Cancel long-press if finger moved too much before threshold
      if (!isDragging && longPressTimer) {
        const dx = Math.abs(touch.clientX - startTouchX);
        const dy = Math.abs(touch.clientY - startTouchY);
        if (dx > LONG_PRESS_MOVE_THRESHOLD || dy > LONG_PRESS_MOVE_THRESHOLD) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        return;
      }

      if (!isDragging) return;

      event.preventDefault();
      const scale = getUiScale();
      const dx = (touch.clientX - startTouchX) / scale;
      const dy = (touch.clientY - startTouchY) / scale;
      applyPosition(element, startLeft + dx, startTop + dy);
    },
    { passive: false },
  );

  const endDrag = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (isDragging) {
      isDragging = false;
      element.style.transform = '';
      element.style.boxShadow = '';
      element.style.transition = '';
      savePosition(element);
    }
  };

  element.addEventListener('touchend', endDrag);
  element.addEventListener('touchcancel', endDrag);
}

/**
 * Register an element as repositionable.
 * On desktop: drag is gated by the lock state.
 * On mobile: long-press to drag is always available.
 */
export function makeMovable(element: HTMLElement): void {
  if (!element || !element.id) return;
  registeredElements.push(element);

  // Restore saved position
  restorePosition(element);

  if (isMobile()) {
    setupMobileDrag(element);
  } else {
    setupDesktopDrag(element);
  }
}

/**
 * Desktop: toggle whether movable elements can be dragged.
 * Adds/removes visual indicators (dashed border, move cursor).
 */
export function setMovableLocked(isLocked: boolean): void {
  locked = isLocked;
  for (const element of registeredElements) {
    if (isLocked) {
      element.classList.remove('ui-unlocked');
    } else {
      element.classList.add('ui-unlocked');
    }
  }
}

/**
 * Clear all saved positions and restore CSS defaults.
 */
export function resetMovablePositions(): void {
  for (const element of registeredElements) {
    clearPosition(element);
  }
}
