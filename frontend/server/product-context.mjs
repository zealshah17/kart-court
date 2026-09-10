// Normalize the backend's product_extractions response without fetching any URLs.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
function cleanUrl(value) {
  const raw = text(value, 4000);
  const unwrapped = raw.match(/^\[[\s\S]*\]\((https?:\/\/[^\s]+)\)$/)?.[1] || raw;
  try { const url = new URL(unwrapped); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}

export function buildProductContext(row) {
  if (!object(row)) throw new Error('Provide one product_extractions row as a JSON object.');
  if (!object(row.product) || !text(row.product.title || row.product.name, 1000)) {
    throw new Error('The row must contain a product object with a title or name.');
  }
  if (row.reviews != null && (!Array.isArray(row.reviews) || row.reviews.some(review => !object(review)))) {
    throw new Error('reviews must be an array of review objects.');
  }
  if (row.roomContext != null && typeof row.roomContext !== 'string') throw new Error('roomContext must be user-provided text.');
  if (row.extraction != null && !object(row.extraction)) throw new Error('extraction must be an object.');
  const source = row.product;
  const customerSummary = object(source.customerSummary) ? {
    text: text(source.customerSummary.text, 8000) || null,
    source: text(source.customerSummary.source, 100) || null,
    capturedFrom: text(source.customerSummary.capturedFrom, 100) || null,
    topics: Array.isArray(source.customerSummary.topics)
      ? source.customerSummary.topics
          .filter(item => object(item))
          .map(item => ({
            name: text(item.name, 300) || null,
            sentiment: ['positive', 'negative', 'mixed'].includes(item.sentiment) ? item.sentiment : null,
            mentions: Number.isFinite(Number(item.mentions)) ? Number(item.mentions) : null,
            positiveMentions: Number.isFinite(Number(item.positiveMentions)) ? Number(item.positiveMentions) : null,
            negativeMentions: Number.isFinite(Number(item.negativeMentions)) ? Number(item.negativeMentions) : null,
            summary: text(item.summary, 1500) || null,
          }))
          .filter(item => item.name)
      : [],
  } : null;
  const product = {
    asin: text(source.asin || row.asin, 30) || null,
    url: cleanUrl(source.url || row.source_url),
    title: text(source.title || source.name, 1000),
    price: typeof source.price === 'number' ? source.price : text(source.price, 100) || null,
    currency: text(source.currency, 10) || null,
    rating: source.rating ?? null, ratingCount: source.ratingCount ?? null,
    bulletPoints: Array.isArray(source.bulletPoints) ? source.bulletPoints.filter(item => typeof item === 'string').slice(0, 30).map(item => text(item, 3000)) : [],
    description: text(source.description, 8000) || null,
    // Extraction can accidentally append Amazon's internal widget JSON here.
    availability: text(source.availability, 3000).split('{')[0].trim() || null,
    specifications: object(source.specifications) ? source.specifications : {},
    customerSummary,
  };
  // Also accept the original, simpler application product shape.
  for (const field of ['material', 'color', 'dimensions', 'assembly_required', 'features']) {
    if (source[field] != null) product[field] = source[field];
  }
  const provided = row.reviews || [];
  const customerSummaryReview = object(source.customerSummary) && text(source.customerSummary.text, 2500)
    ? {
        evidenceId: 'customer_summary',
        sourceReviewId: null,
        rating: null,
        title: 'Amazon customer summary',
        body: text(source.customerSummary.text, 2500),
        variant: null,
      }
    : null;
  const readable = [...provided.map((review, index) => ({
    evidenceId: `review:${index}`,
    sourceReviewId: typeof review.id === 'string' ? text(review.id, 200) : null,
    rating: review.rating ?? null,
    title: text(review.title, 300),
    body: text(review.body || review.text || review.content || review.reviewText, 2500),
    variant: text(review.variant, 200) || null,
  })).filter(review => review.title || review.body), ...(customerSummaryReview ? [customerSummaryReview] : [])];
  const reviews = readable.slice(0, 40);
  const warnings = Array.isArray(row.extraction?.warnings)
    ? row.extraction.warnings.filter(item => typeof item === 'string').map(item => text(item, 1000)).slice(0, 10) : [];
  if (!reviews.length && !customerSummaryReview) warnings.push('No readable customer review text was provided. This does not mean the product has no reviews or ratings.');
  if (readable.length > reviews.length && !customerSummaryReview) warnings.push('Only the first 40 readable review excerpts are included; this is not necessarily a representative sample.');
  const extraction = {
    fetchedAt: text(row.extraction?.fetchedAt || row.createdAt || row.created_at, 100) || null,
    reviewSourceUrl: cleanUrl(row.extraction?.reviewSourceUrl),
    reviewScope: text(row.extraction?.reviewScope, 100) || 'unspecified',
    warnings,
  };
  const reviewCoverage = {
    provided: Math.max(provided.length, customerSummaryReview ? 1 : 0),
    readable: readable.length,
    used: reviews.length,
    omitted: Math.max(provided.length - reviews.length, 0),
    scope: extraction.reviewScope,
  };
  const roomContext = text(row.roomContext, 3000) || null;
  const context = { product, reviews, extraction, reviewCoverage, roomContext };
  if (Buffer.byteLength(JSON.stringify(context)) > 120000) throw new Error('Product evidence is too large. Supply a smaller product object or shorter reviews.');
  return context;
}
