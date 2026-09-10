import { chromium } from 'playwright';
import { createAmazonContext, waitForCustomerSummary } from './browser';
import { extractPage } from './extract';
import { buildCanonicalProductUrl, extractAsin, extractDomain, resolveRedirect } from '../utils/amazonUrl';
import type { ProductLookupResult } from '../types/product.types';

export class LookupError extends Error {
  constructor(public code: string, message: string, public status = 502) { super(message); }
}

export async function lookupProduct(input: string, maxReviews = 10): Promise<ProductLookupResult> {
  let resolved: string;
  try { resolved = await resolveRedirect(input); }
  catch { throw new LookupError('LINK_RESOLUTION_FAILED', 'Could not resolve this Amazon link. Try the full product URL.'); }
  const asin = extractAsin(resolved);
  if (!asin) throw new LookupError('INVALID_PRODUCT_URL', 'Use an Amazon product link containing an ASIN, such as /dp/B012345678.', 400);
  const domain = extractDomain(resolved);
  const url = buildCanonicalProductUrl(asin, domain);
  const browser = await chromium.launch({ headless: process.env.SCRAPER_HEADFUL !== 'true', timeout: 15_000 });
  try {
    const context = await createAmazonContext(browser);
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(20_000);
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    await waitForCustomerSummary(page);
    const details = await extractPage(page);
    if (details.blocked || details.signIn || [403, 429, 503].includes(response?.status() || 0)) {
      throw new LookupError('AMAZON_BLOCKED', 'Amazon blocked automated access or requires sign-in. Try again later.');
    }
    if (response?.status() === 404) throw new LookupError('PRODUCT_NOT_FOUND', 'Amazon could not find this product.', 404);
    if (!response?.ok() || !details.title) throw new LookupError('EXTRACTION_FAILED', 'Amazon did not return readable product details.');
    const { reviews: initialReviews, blocked, signIn, ...product } = details;
    const warnings: string[] = [];
    if (!product.customerSummary) warnings.push('Amazon customer summary was not available on this page.');
    if (!product.imageUrl) warnings.push('No product image URL was available on this page.');
    return {
      product: { asin, url, ...product },
      reviews: initialReviews.slice(0, maxReviews),
      extraction: { fetchedAt: new Date().toISOString(), reviewSourceUrl: url, reviewScope: 'visible_sample', warnings },
    };
  } finally { await browser.close(); }
}
