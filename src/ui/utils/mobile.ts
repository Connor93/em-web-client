import { isMobile } from '../../main';

/**
 * Injects a mobile close button (×) into the first .dialog-header
 * of the given container element. No-ops on desktop.
 * Safe to call multiple times — only injects once.
 */
export function addMobileCloseButton(container: Element, onClose: () => void) {
  if (!isMobile()) return;

  const header = container.querySelector('.dialog-header, .top');
  if (!header) return;

  // Already injected?
  if (header.querySelector('.mobile-close-btn')) return;

  const btn = document.createElement('button');
  btn.className = 'mobile-close-btn';
  btn.type = 'button';
  btn.textContent = '×';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClose();
  });

  header.appendChild(btn);
}

/**
 * Adds a mobile backdrop overlay used by slide-in panels.
 * Returns the backdrop element for later removal.
 */
export function addMobileBackdrop(onDismiss: () => void): HTMLDivElement {
  const backdrop = document.createElement('div');
  backdrop.className = 'mobile-panel-backdrop';
  document.body.appendChild(backdrop);

  // Small delay for CSS transition
  requestAnimationFrame(() => {
    backdrop.classList.add('active');
  });

  backdrop.addEventListener('click', () => {
    onDismiss();
  });

  return backdrop;
}

/**
 * Remove a mobile backdrop with fade-out transition.
 */
export function removeMobileBackdrop(backdrop: HTMLDivElement | null) {
  if (!backdrop) return;
  backdrop.classList.remove('active');
  backdrop.addEventListener('transitionend', () => {
    backdrop.remove();
  });
}
