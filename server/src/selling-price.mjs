/** Margin, then a fixed per-item adjustment, then upward increment rounding, then cents. */
export function sellingPrice(cost, margin, adjustment = 0, roundUp = null) {
  if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(margin) || margin < 0
    || !Number.isFinite(adjustment) || (roundUp !== null && (!Number.isFinite(roundUp) || roundUp <= 0))) return NaN;
  let amount = cost * (1 + margin / 100) + adjustment;
  if (roundUp !== null) {
    const steps = amount / roundUp;
    // Suppress floating-point noise when the amount is already on an increment boundary.
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(steps)) * 4;
    amount = Math.ceil(steps - tolerance) * roundUp;
  }
  const price = Math.round((amount + Number.EPSILON) * 100) / 100;
  return Number.isFinite(price) && price > 0 ? price : NaN;
}
