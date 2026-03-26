/**
 * Makes a dialog element draggable by its header/title area.
 * Stores last position in localStorage so windows reopen where the user left them.
 */

const STORAGE_PREFIX = 'ui-pos-';

export function makeDraggable(element: HTMLElement, handleSelector?: string) {
  const id = element.id;
  if (!id) return;

  const handle = handleSelector
    ? element.querySelector<HTMLElement>(handleSelector)
    : element;

  if (!handle) return;

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.style.cursor = 'move';
  handle.style.userSelect = 'none';

  const onPointerDown = (event: PointerEvent) => {
    // Only left-click
    if (event.button !== 0) return;
    // Don't drag if clicking a button or input
    const target = event.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea')
    )
      return;

    isDragging = true;
    const rect = element.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;

    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!isDragging) return;

    const x = event.clientX - offsetX;
    const y = event.clientY - offsetY;

    element.style.position = 'fixed';
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
    element.style.margin = '0';
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!isDragging) return;
    isDragging = false;
    handle.releasePointerCapture(event.pointerId);

    // Save position
    const rect = element.getBoundingClientRect();
    localStorage.setItem(
      STORAGE_PREFIX + id,
      JSON.stringify({ x: rect.left, y: rect.top }),
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
  const id = element.id;
  if (!id) return;

  const saved = localStorage.getItem(STORAGE_PREFIX + id);
  if (saved) {
    try {
      const { x, y } = JSON.parse(saved);
      // Clamp to viewport
      const maxX = window.innerWidth - 50;
      const maxY = window.innerHeight - 50;
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

  // Center on screen
  element.style.position = 'fixed';
  element.style.left = '50%';
  element.style.top = '50%';
  element.style.right = 'auto';
  element.style.bottom = 'auto';
  element.style.transform = 'translate(-50%, -50%)';
  element.style.margin = '0';

  // After centering, read the actual position and switch to px so dragging works
  requestAnimationFrame(() => {
    const rect = element.getBoundingClientRect();
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
    element.style.transform = '';
  });
}
