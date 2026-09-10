import { buildCanonicalProductUrl, extractAsin, extractDomain, resolveRedirect } from '../utils/amazonUrl';
import type { ProductLookupResult, CustomerSummaryTopic } from '../types/product.types';

export class LookupError extends Error {
  constructor(public code: string, message: string, public status = 502) { super(message); }
}

export function getSerpApiKey(): string {
  const key = process.env.SERPAPI_API_KEY?.trim();
  if (!key) throw new LookupError('PROVIDER_NOT_CONFIGURED', 'Set SERPAPI_API_KEY in backend/.env and restart the server.', 503);
  return key;
}
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const string = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

export function normalizeSerpApiResponse(data: unknown, asin: string, url: string, maxReviews = 10): ProductLookupResult {
  const root = object(data);
  const product = object(root.product_results);
  if (!string(product.title)) throw new LookupError('EXTRACTION_FAILED', 'The provider did not return readable product details.');
  const info = object(root.reviews_information);
  const summary = object(info.summary);
  const text = string(summary.text);
  const topics: CustomerSummaryTopic[] = array(summary.insights).flatMap(value => {
    const topic = object(value), mentions = object(topic.mentions), name = string(topic.title);
    if (!name) return [];
    const sentiment = topic.sentiment;
    return [{ name, sentiment: sentiment === 'positive' || sentiment === 'negative' || sentiment === 'mixed' ? sentiment : null,
      mentions: number(mentions.total), positiveMentions: number(mentions.positive), negativeMentions: number(mentions.negative), summary: string(topic.summary) }];
  });
  const images = [...new Set(array(product.thumbnails).map(string).filter((x): x is string => !!x))];
  if (!images.length && string(product.thumbnail)) images.push(string(product.thumbnail)!);
  const specifications: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...object(root.product_details), ...object(root.item_specifications) })) {
    if (typeof value === 'string' || typeof value === 'number') specifications[key] = String(value);
  }
  const warnings: string[] = [];
  if (!text) warnings.push('The provider did not return an Amazon customer summary for this product.');
  if (!images.length) warnings.push('The provider did not return product images.');
  return {
    product: {
      asin, url, title: string(product.title), price: string(product.price), currency: string(product.currency),
      rating: number(product.rating), ratingCount: number(product.reviews), imageUrl: images[0] || null, images,
      bulletPoints: array(root.about_item).map(string).filter((x): x is string => !!x),
      description: string(product.description) || string(root.product_description) || array(root.product_description).map(v => string(object(v).text)).filter(Boolean).join('\n') || null,
      specifications, availability: string(product.stock),
      customerSummary: text ? { text, source: 'amazon_ai_generated', capturedFrom: 'serpapi', topics } : null,
    },
    reviews: array(info.authors_reviews).slice(0, maxReviews).map(value => {
      const review = object(value);
      return { author: string(review.author), rating: number(review.rating), title: string(review.title), body: string(review.text), date: string(review.date), verifiedPurchase: review.verified_purchase === true, id: string(review.id) };
    }),
    extraction: { fetchedAt: new Date().toISOString(), provider: 'serpapi', reviewSourceUrl: url, reviewScope: 'visible_sample', warnings },
  };
}

export async function lookupProduct(input: string, maxReviews = 10): Promise<ProductLookupResult> {
  const key = getSerpApiKey();
  let resolved: string;
  try { resolved = await resolveRedirect(input); }
  catch { throw new LookupError('LINK_RESOLUTION_FAILED', 'Could not resolve this Amazon link. Try the full product URL.'); }
  const asin = extractAsin(resolved);
  if (!asin) throw new LookupError('INVALID_PRODUCT_URL', 'Use an Amazon product link containing an ASIN.', 400);
  const domain = extractDomain(resolved);
  const endpoint = new URL('https://serpapi.com/search.json');
  endpoint.search = new URLSearchParams({ engine: 'amazon_product', asin, amazon_domain: domain, api_key: key }).toString();
  let response: Response;
  try { response = await fetch(endpoint, { signal: AbortSignal.timeout(60_000), redirect: 'error' }); }
  catch { throw new LookupError('PROVIDER_UNAVAILABLE', 'Could not reach the product provider. Try again later.'); }
  if ([401, 403].includes(response.status)) throw new LookupError('PROVIDER_AUTH_FAILED', 'Check the backend SerpApi key and account access.', 503);
  if (response.status === 429) throw new LookupError('PROVIDER_LIMIT_REACHED', 'The SerpApi account has reached its request limit. Check your account quota.', 503);
  if (!response.ok) throw new LookupError('PROVIDER_UNAVAILABLE', 'The product provider could not complete this request.');
  let data: unknown;
  try { data = await response.json(); }
  catch { throw new LookupError('PROVIDER_INVALID_RESPONSE', 'The product provider returned an unreadable response.'); }
  if (object(data).error || object(object(data).search_metadata).status === 'Error') throw new LookupError('PROVIDER_EXTRACTION_FAILED', 'The provider could not extract this product. Check its search dashboard for details.');
  return normalizeSerpApiResponse(data, asin, buildCanonicalProductUrl(asin, domain), maxReviews);
}
