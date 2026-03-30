export class HealthBar {
  percentage: number;
  damage: number;
  heal: number;
  critical: boolean;
  ticks = 4;
  renderedFirstFrame = false;

  constructor(percentage: number, damage: number, heal = 0, critical = false) {
    this.percentage = percentage;
    this.damage = damage;
    this.heal = heal;
    this.critical = critical;
  }

  tick() {
    if (this.ticks === 0 || !this.renderedFirstFrame) {
      return;
    }

    this.ticks = Math.max(this.ticks - 1, 0);
  }
}
