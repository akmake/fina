/**
 * Pergola Pricing Module
 * Aggregates all cost components from the engine result.
 */

export function calcTotalPrice(result) {
  const matCost   = result.summary?.materialCost  ?? 0;
  const hwCost    = result.hardwareCost            ?? 0;
  const roofCost  = result.roofMaterialCost        ?? 0;
  const foundCost = result.foundationCost          ?? 0;
  const fnCost    = result.finishCost              ?? 0;
  const sideCost  = result.totalSideCost           ?? 0;
  const lightCost = result.lightingCost            ?? 0;
  const gutCost   = result.gutterCost              ?? 0;

  const subTotal = matCost + hwCost + roofCost + foundCost + fnCost + sideCost + lightCost + gutCost;
  const vat      = +(subTotal * 0.17).toFixed(2);
  const total    = +(subTotal + vat).toFixed(2);
  const pricePerSqM = result.coverage?.area > 0 ? +(total / result.coverage.area).toFixed(0) : 0;

  return {
    breakdown: [
      { label: 'חומרי מבנה (פרופילים)',  cost: +matCost.toFixed(2) },
      { label: 'חומרי גג',              cost: +roofCost.toFixed(2) },
      { label: 'ברגים ואביזרים',         cost: +hwCost.toFixed(2) },
      { label: 'יסודות',                cost: +foundCost.toFixed(2) },
      { label: 'גימור/צבע',             cost: +fnCost.toFixed(2) },
      { label: 'חיפויי צד',             cost: +sideCost.toFixed(2) },
      { label: 'תאורה',                 cost: +lightCost.toFixed(2) },
      { label: 'מרזבים',                cost: +gutCost.toFixed(2) },
    ].filter(r => r.cost > 0),
    subTotal: +subTotal.toFixed(2),
    vat, total, pricePerSqM,
  };
}

export function formatCurrency(n) {
  if (typeof n !== 'number' || isNaN(n)) return '₪0';
  return '₪' + n.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
