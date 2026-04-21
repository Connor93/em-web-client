/** Format a drop rate percentage, showing enough decimals for small values. */
export function formatDropRate(rate: number): string {
  if (rate >= 1) return rate.toFixed(1);
  if (rate >= 0.1) return rate.toFixed(2);
  return rate.toFixed(3);
}
