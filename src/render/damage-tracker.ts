/**
 * Detects critical hits by comparing dealt damage against the player's
 * stat-sheet maxDamage.  Normal hits are always reduced by NPC defense
 * and therefore cannot exceed maxDamage — anything above that threshold
 * is a critical hit.
 */
export class DamageTracker {
  private maxDamage = 0;

  /** Update the player's current max damage stat. */
  setMaxDamage(value: number) {
    this.maxDamage = value;
  }

  /** Returns true if the damage qualifies as a critical hit. */
  isCritical(damage: number): boolean {
    return this.maxDamage > 0 && damage > this.maxDamage;
  }

  clear() {
    this.maxDamage = 0;
  }
}
