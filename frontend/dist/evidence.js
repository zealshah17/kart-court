// Convert current case evidence into cards; no room or product assumptions.
export function evidenceCards({ product, dimensions, conversation, name, width, available, photos = [], notes = [] }) {
  const cards = [];
  if (product) {
    cards.push({ title: name || product.title, label: 'Product', body: [product.price, product.availability].filter(Boolean).join(' · ') || 'Price unavailable', detail: product.title });
    const specs = Object.entries(product.specifications || {}).map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    if (specs.length) cards.push({ title: 'Specifications', label: 'Listing', body: specs.slice(0, 3).join(' · '), detail: specs.join('\n') });
    if (dimensions?.source || width) cards.push({ title: 'Product dimensions', label: 'Size', body: width ? `Width ${width} cm` : dimensions.source, detail: [dimensions?.source, 'Overall product dimensions from the listing.'].filter(Boolean).join('\n'), action: 'product' });
    const count = conversation?.reviewCoverage?.used || 0;
    const hasSummary = Boolean(product?.customerSummary?.text);
    cards.push({
      title: hasSummary ? 'Customer summary' : 'Customer reviews',
      label: count ? 'Review sample' : hasSummary ? 'Summary used' : 'Missing',
      body: hasSummary
        ? 'Amazon summary included as customer-experience evidence'
        : count ? `${count} customer-experience snippets included in the conversation` : 'Review text unavailable',
      detail: [
        product.rating != null ? `Listing rating: ${product.rating}${product.ratingCount != null ? ` (${product.ratingCount} ratings)` : ''}` : 'No listing rating supplied.',
        hasSummary ? 'Amazon customerSummary is the available customer-experience context; it is used instead of waiting for review text.' : 'A star rating is not review text. Add reviews to the product JSON to include customer experiences.',
      ].join('\n'),
    });
  }
  for (const photo of photos) cards.push({ title: photo.name, label: 'Room photo', body: 'Original upload · not analyzed', image: photo.url, detail: 'This photo stays local. Room analysis is not included in the current conversation test.', action: 'photo' });
  if (width || available) {
    const clearance = width && available ? Math.round((available - width) * 100) / 100 : null;
    cards.push({ title: 'Space check', label: clearance === null ? 'Optional' : clearance < 0 ? 'Too wide' : 'Width checked', body: clearance === null ? 'Add available width when you want to compare fit.' : `${available} cm available − ${width} cm product = ${clearance} cm clearance`, detail: 'This checks width only. Depth, access, and recline clearance still need checking. Measurements are optional; you can hear the case without them.', action: 'measurement' });
  }
  for (const [speaker, label] of [['angel', 'Angel’s case'], ['devil', 'Devil’s case']]) {
    const lines = conversation?.lines?.filter(line => line.speaker === speaker) || [];
    if (lines.length) cards.push({ title: label, label: speaker === 'angel' ? 'Pros' : 'Cons & tradeoffs', body: lines[0].text, detail: lines.map(line => line.text).join('\n\n') });
  }
  for (const note of notes) cards.push({ title: note.title, label: 'Your note', body: note.body, detail: note.body });
  return cards;
}
