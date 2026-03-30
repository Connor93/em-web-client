import type { EifRecord, EsfRecord } from 'eolib';
import { getItemGraphicPath, getItemMeta } from '../../utils';
import type { DialogIcon } from '../dialog-icon';

export function createIconMenuItem(
  icon: DialogIcon,
  label: string,
  description: string,
) {
  const menuItem = document.createElement('div');
  menuItem.classList.add('menu-item');

  const menuIcon = document.createElement('div');
  menuIcon.classList.add('menu-item-icon');
  menuIcon.setAttribute('data-id', `${icon}`);
  menuItem.appendChild(menuIcon);

  const menuLabel = document.createElement('div');
  menuLabel.classList.add('menu-label');
  menuLabel.innerText = label;
  menuItem.appendChild(menuLabel);

  const menuDescription = document.createElement('div');
  menuDescription.classList.add('menu-description');
  menuDescription.innerText = description;
  menuItem.appendChild(menuDescription);

  return menuItem;
}

export function createItemMenuItem(
  itemId: number,
  record: EifRecord,
  label: string,
  description: string,
  itemAmount = 1,
) {
  const menuItem = document.createElement('div');
  menuItem.classList.add('menu-item', 'item');

  const menuImg = document.createElement('img');
  menuImg.src = getItemGraphicPath(itemId, record.graphicId, itemAmount);
  menuImg.classList.add('menu-item-img');
  menuItem.appendChild(menuImg);

  const tooltip = document.createElement('div');
  tooltip.classList.add('tooltip');
  const meta = getItemMeta(record);
  tooltip.innerText = `${record.name}\n${meta.join('\n')}`;
  menuItem.appendChild(tooltip);

  const menuLabel = document.createElement('div');
  menuLabel.classList.add('menu-label');
  menuLabel.innerText = label;
  menuItem.appendChild(menuLabel);

  const menuDescription = document.createElement('div');
  menuDescription.classList.add('menu-description');
  menuDescription.innerText = description;
  menuItem.appendChild(menuDescription);

  return menuItem;
}

export function createSkillMenuItem(
  record: EsfRecord,
  label: string,
  description: string,
  onRequirementsClick: (() => void) | null = null,
) {
  const menuItem = document.createElement('div');
  menuItem.classList.add('menu-item');

  const menuIcon = document.createElement('div');
  menuIcon.classList.add('menu-item-icon', 'skill-icon');
  menuIcon.style.backgroundImage = `url('gfx/gfx025/${record.iconId + 100}.png')`;
  menuIcon.style.width = '33px';
  menuIcon.style.height = '31px';
  menuItem.appendChild(menuIcon);

  const menuLabel = document.createElement('div');
  menuLabel.classList.add('menu-label');
  menuLabel.innerText = label;
  menuItem.appendChild(menuLabel);

  if (description) {
    const menuDescription = document.createElement('div');
    menuDescription.classList.add('menu-description', 'link');
    menuDescription.innerText = description;
    menuDescription.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onRequirementsClick) {
        onRequirementsClick();
      }
    });
    menuItem.appendChild(menuDescription);
  }

  return menuItem;
}

export function createTextMenuItem(
  text = ' ',
  onClick: (() => void) | null = null,
) {
  const menuItem = document.createElement('div');
  menuItem.classList.add('menu-item', 'text');
  menuItem.innerText = text;

  if (onClick) {
    menuItem.classList.add('link');
    menuItem.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
  }

  return menuItem;
}

/**
 * Creates a grid-layout item card with icon, name, badge, and hover tooltip.
 * Used by shop/bank/locker grid layouts.
 */
export function createGridItemCard(
  itemId: number,
  record: EifRecord,
  badge: string,
  tooltipExtra = '',
  itemAmount = 1,
) {
  const card = document.createElement('div');
  card.classList.add('grid-card');
  card.dataset.itemId = itemId.toString();

  const imgWrap = document.createElement('div');
  imgWrap.classList.add('card-img-wrap');

  const img = document.createElement('img');
  img.src = getItemGraphicPath(itemId, record.graphicId, itemAmount);
  img.draggable = false;
  imgWrap.appendChild(img);
  card.appendChild(imgWrap);

  const name = document.createElement('span');
  name.classList.add('card-name');
  name.innerText =
    record.name.length > 10 ? `${record.name.substring(0, 9)}…` : record.name;
  card.appendChild(name);

  if (badge) {
    const badgeEl = document.createElement('span');
    badgeEl.classList.add('card-badge');
    badgeEl.innerText = badge;
    card.appendChild(badgeEl);
  }

  const tooltip = document.createElement('div');
  tooltip.classList.add('tooltip');
  const meta = getItemMeta(record);
  const lines = [record.name, ...meta];
  if (tooltipExtra) {
    lines.push('', tooltipExtra);
  }
  tooltip.innerText = lines.join('\n');
  card.appendChild(tooltip);

  // Position tooltip near the cursor, accounting for UI scale
  card.addEventListener('mousemove', (e: MouseEvent) => {
    const uiEl = document.getElementById('ui');
    const m = uiEl?.style.transform.match(/scale\(([^)]+)\)/);
    const scale = m ? Number.parseFloat(m[1]) : 1;
    tooltip.style.left = `${(e.clientX + 12) / scale}px`;
    tooltip.style.top = `${(e.clientY + 12) / scale}px`;
  });

  return card;
}
