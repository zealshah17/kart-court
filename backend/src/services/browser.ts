import type { Browser, Page } from 'playwright';
import { isAmazonUrl } from '../utils/amazonUrl';

export function isAmazonAsset(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['media-amazon.com', 'ssl-images-amazon.com'].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch { return false; }
}

export async function createAmazonContext(browser: Browser) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const req = route.request();
    // Allow Amazon's scripts/XHR to render reviews; keep navigation on Amazon.
    const allowed = isAmazonUrl(req.url()) || (!req.isNavigationRequest() && isAmazonAsset(req.url()));
    return allowed && !['media', 'font', 'image'].includes(req.resourceType()) ? route.continue() : route.abort();
  });
  return context;
}

export async function waitForCustomerSummary(page: Page) {
  const sectionSelector = '[data-csa-c-slot-id="cr-product-insights-detail-page"], [data-testid="overall-summary"], #customer-reviews_feature_div, #customerReviews, #reviewsMedley, #cm-cr-dp-review-list, #cm_cr-review_list';
  // The section itself can be lazy-loaded: waiting only for an existing anchor
  // never scrolls pages where Amazon has not inserted the reviews widget yet.
  const deadline = Date.now() + 12_000;
  for (let step = 0; step < 20 && Date.now() < deadline; step++) {
    if (await page.locator('#captchacharacters, form[action*="validateCaptcha"]').count()) return;
    const section = page.locator(sectionSelector).first();
    if (await section.count()) {
      await section.scrollIntoViewIfNeeded({ timeout: 2_000 }).catch(() => {});
      break;
    }
    await page.evaluate(() => window.scrollBy(0, Math.max(window.innerHeight * 0.85, 600)));
    await page.locator(sectionSelector).first().waitFor({ state: 'attached', timeout: 400 }).catch(() => {});
  }
  await page.waitForFunction(() => {
    const explicit = document.querySelector('[data-testid="overall-summary"], [data-hook="cr-insights-widget-summary"], #product-summary');
    return !!explicit?.textContent?.trim() || Array.from(document.querySelectorAll('h2, h3')).some(el => el.textContent?.trim() === 'Customers say');
  }, {}, { timeout: 5_000 }).catch(() => {});
}
