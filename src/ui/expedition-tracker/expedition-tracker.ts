import type { Client } from '../../client';
import { Base } from '../base-ui';
import { makeDraggable } from '../utils/draggable';

import './expedition-tracker.css';

type ProximityLevel = 'cold' | 'cool' | 'warm' | 'hot' | 'burning';

interface ProximityInfo {
  level: ProximityLevel;
  fillPercent: number;
  hint: string;
}

export class ExpeditionTracker extends Base {
  protected container = document.getElementById('expedition-tracker')!;
  private client: Client;

  constructor(client: Client) {
    super();
    this.client = client;

    makeDraggable(this.container);

    // Subscribe to expedition events that should refresh the tracker
    const refreshEvents = [
      'expeditionStarted',
      'expeditionClue',
      'expeditionTarget',
      'expeditionStepComplete',
      'expeditionComplete',
      'expeditionCancelled',
      'expeditionRestored',
      'expeditionCombat',
      'expeditionCombatKill',
      'expeditionWrongMap',
    ] as const;

    for (const event of refreshEvents) {
      this.client.on(event, () => this.refresh());
    }

    this.client.on('expeditionStarted', () => this.show());

    // Toggle visibility from the quest progress expedition tab
    this.client.on('expeditionTrackerToggle', (data) => {
      if (data.visible) {
        this.refresh();
        this.show();
      } else {
        this.hide();
      }
    });
  }

  /**
   * Called externally when the player moves (walk, warp, etc.)
   * to update the proximity indicator.
   */
  onPlayerMoved(): void {
    if (!this.container.classList.contains('hidden')) {
      this.refresh();
    }
  }

  private refresh(): void {
    const exp = this.client.expedition;
    if (!exp || !exp.active) {
      this.hide();
      return;
    }

    this.container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'tracker-header';

    const title = document.createElement('span');
    title.className = 'tracker-title';
    title.textContent = `Step ${exp.currentStep}/${exp.totalSteps}`;
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tracker-close';
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exp.trackerVisible = false;
      this.client.emit('expeditionTrackerToggle', { visible: false });
      this.hide();
    });
    header.appendChild(closeBtn);

    this.container.appendChild(header);

    // Combat state
    if (exp.combat.active) {
      const combat = document.createElement('div');
      combat.className = 'tracker-combat';
      combat.textContent = `\u2694 ${exp.combat.remaining} guardian${exp.combat.remaining !== 1 ? 's' : ''} remaining`;
      this.container.appendChild(combat);
    }

    // Current clue
    if (exp.currentClue) {
      const clue = document.createElement('div');
      clue.className = 'tracker-clue';
      clue.textContent = `\u201C${exp.currentClue}\u201D`;
      this.container.appendChild(clue);
    }

    // Proximity bar (only when not in combat and we have a target)
    if (!exp.combat.active) {
      const proximity = this.computeProximity();

      const barContainer = document.createElement('div');
      barContainer.className = 'tracker-bar-container';

      const bar = document.createElement('div');
      bar.className = 'tracker-bar';

      const fill = document.createElement('div');
      fill.className = `tracker-bar-fill ${proximity.level}`;
      fill.style.width = `${proximity.fillPercent}%`;
      bar.appendChild(fill);

      barContainer.appendChild(bar);
      this.container.appendChild(barContainer);

      // Status row
      const status = document.createElement('div');
      status.className = 'tracker-status';

      const label = document.createElement('span');
      label.className = `tracker-status-label ${proximity.level}`;
      label.textContent =
        proximity.level.charAt(0).toUpperCase() + proximity.level.slice(1);
      status.appendChild(label);

      const hint = document.createElement('span');
      hint.className = 'tracker-status-hint';
      hint.textContent = proximity.hint;
      status.appendChild(hint);

      this.container.appendChild(status);
    }
  }

  private computeProximity(): ProximityInfo {
    const exp = this.client.expedition;
    const target = exp?.target ?? null;

    // No target or wrong map
    if (!target || this.client.mapId !== target.mapId) {
      return { level: 'cold', fillPercent: 5, hint: 'Search the world...' };
    }

    const playerCoords = this.client.getPlayerCoords();
    const dx = Math.abs(playerCoords.x - target.x);
    const dy = Math.abs(playerCoords.y - target.y);
    const distance = dx + dy; // Manhattan distance

    if (distance <= 5) {
      // Burning: 85-100% based on distance (5 → 85%, 0 → 100%)
      const fill = 85 + ((5 - distance) / 5) * 15;
      return {
        level: 'burning',
        fillPercent: Math.round(fill),
        hint: 'Very close!',
      };
    }
    if (distance <= 10) {
      // Hot: 65-85% based on distance (10 → 65%, 6 → 85%)
      const fill = 65 + ((10 - distance) / 4) * 20;
      return {
        level: 'hot',
        fillPercent: Math.round(fill),
        hint: 'Getting warmer...',
      };
    }
    if (distance <= 20) {
      // Warm: 35-65% based on distance (20 → 35%, 11 → 65%)
      const fill = 35 + ((20 - distance) / 9) * 30;
      return {
        level: 'warm',
        fillPercent: Math.round(fill),
        hint: 'On the right track',
      };
    }
    // Cool: 10-35% based on distance (capped at 50 → 10%)
    const maxCoolDist = 50;
    const clampedDist = Math.min(distance, maxCoolDist);
    const fill = 35 - ((clampedDist - 20) / (maxCoolDist - 20)) * 25;
    return {
      level: 'cool',
      fillPercent: Math.round(Math.max(fill, 10)),
      hint: 'Keep exploring...',
    };
  }
}
