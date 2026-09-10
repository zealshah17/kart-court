export function productDimensions(product) {
  const raw = product.specifications?.['Product Dimensions'] || product.specifications?.Dimensions || null;
  const result = { widthCm: null, depthCm: null, heightCm: null, source: raw, kind: 'overall product dimensions' };
  for (const axis of ['width', 'depth', 'height']) {
    const value = product.dimensions?.[`${axis}_cm`];
    if (typeof value === 'number' && value > 0 && value < 10000) result[`${axis}Cm`] = value;
  }
  if (typeof raw === 'string') {
    const labels = { W: 'widthCm', D: 'depthCm', H: 'heightCm' };
    for (const match of raw.matchAll(/(\d+(?:\.\d+)?)\s*("|″|inches|inch|in|cm|mm|m)\s*([WDH])\b/gi)) {
      const multiplier = /^("|″|inches|inch|in)$/i.test(match[2]) ? 2.54 : match[2].toLowerCase() === 'mm' ? .1 : match[2].toLowerCase() === 'm' ? 100 : 1;
      result[labels[match[3].toUpperCase()]] = Math.round(Number(match[1]) * multiplier * 100) / 100;
    }
  }
  return result;
}
