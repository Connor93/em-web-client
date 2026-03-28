import { isMobile } from '../../main';

/**
 * Creates a mobile split-view container with two panels side by side.
 * Hides the #cover and #dialogs overlays so the split-view is the top layer.
 * Returns a cleanup function that restores DOM positions.
 */
export function createMobileSplitView(
  leftEl: HTMLElement,
  rightEl: HTMLElement,
  onClose: () => void,
): () => void {
  if (!isMobile()) return () => {};

  const leftParent = leftEl.parentNode;
  const rightParent = rightEl.parentNode;

  const wrapper = document.createElement('div');
  wrapper.className = 'mobile-split-view';

  // Ensure both are visible
  leftEl.classList.remove('hidden');
  rightEl.classList.remove('hidden');

  // Move into split-view (left, right)
  wrapper.appendChild(leftEl);
  wrapper.appendChild(rightEl);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'mobile-split-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => onClose());
  wrapper.appendChild(closeBtn);

  document.body.appendChild(wrapper);

  // Hide cover/dialogs overlays so they don't obscure split-view
  const cover = document.getElementById('cover');
  const dialogs = document.getElementById('dialogs');
  cover?.classList.add('hidden');
  dialogs?.classList.add('hidden');

  // Return cleanup function
  return () => {
    if (leftParent) {
      leftParent.appendChild(leftEl);
      leftEl.classList.add('hidden');
    }
    if (rightParent) {
      rightParent.appendChild(rightEl);
      rightEl.classList.add('hidden');
    }
    wrapper.remove();
  };
}
