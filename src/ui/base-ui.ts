import { makeDraggable, restoreOrCenter } from './utils/draggable';

export abstract class Base {
  protected container!: Element;

  show() {
    this.container.classList.remove('hidden');
  }

  hide() {
    this.container.classList.add('hidden');
  }

  toggle() {
    if (this.container.classList.contains('hidden')) {
      this.show();
    } else {
      this.hide();
    }
  }
}

/**
 * Initialize dragging + position restore for a set of dialog panels.
 * Call this once after all UI constructors have run.
 */
export function initDraggableDialogs(ids: string[]) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;

    makeDraggable(el);

    // Observe class changes to detect show/hide
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (
          m.type === 'attributes' &&
          m.attributeName === 'class' &&
          !el.classList.contains('hidden')
        ) {
          restoreOrCenter(el);
        }
      }
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
  }
}
