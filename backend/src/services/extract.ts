import type { Page } from 'playwright';
import type { CustomerSummaryTopic } from '../types/product.types';

/** Runs against rendered markup, also usable with offline HTML fixtures. */
export async function extractPage(page: Page) {
  return page.evaluate(() => {
    const clean = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() || null;
    const text = (selector: string, root: ParentNode = document) => clean(root.querySelector(selector)?.textContent);
    const number = (value: string | null) => {
      const match = value?.match(/\d+(?:[.,]\d+)?/);
      return match ? Number(match[0].replace(',', '.')) : null;
    };
    const image = document.querySelector<HTMLImageElement>('#landingImage, #imgBlkFront');
    let dynamic: string[] = [];
    try { dynamic = Object.keys(JSON.parse(image?.getAttribute('data-a-dynamic-image') || '{}')); } catch { /* optional attribute */ }
    const images = [...new Set([image?.getAttribute('data-old-hires'), ...dynamic, image?.getAttribute('data-src'), image?.src, document.querySelector('meta[property="og:image"]')?.getAttribute('content')].filter((v): v is string => !!v && /^https:\/\//.test(v)))];
    // Amazon's generated summary is separate from individual customer reviews.
    const summaryRoot = document.querySelector('[data-testid="overall-summary"]') || document.querySelector('[data-hook="cr-insights-widget-summary"], #product-summary');
    const summaryText = summaryRoot ? (summaryRoot.matches('[data-testid="overall-summary"]') ? clean(summaryRoot.textContent) : (text('p', summaryRoot) || text('.a-expander-content', summaryRoot) || clean(summaryRoot.textContent))) : null;
    const insights = summaryRoot?.closest('[data-csa-c-slot-id="cr-product-insights-detail-page"]');
    const topics: CustomerSummaryTopic[] = [];
    const seenTopics = new Set<string>();
    insights?.querySelectorAll('[data-testid="aspect-list"] [role="tab"]').forEach(tab => {
      const label = clean(tab.getAttribute('aria-label'));
      const parsed = label?.match(/^(positive|negative|mixed) aspect, (.+), ([\d,]+) mentions?$/i);
      const name = text('[data-testid="aspect-label"]', tab)?.replace(/\s*\([\d,]+\)\s*$/, '').trim() || parsed?.[2];
      if (!name || seenTopics.has(name.toLowerCase())) return;
      seenTopics.add(name.toLowerCase());
      // aria-controls links each topic to its own panel, including hidden panels.
      const panelId = tab.getAttribute('aria-controls');
      const candidate = panelId ? document.getElementById(panelId) : null;
      const panel = candidate && insights.contains(candidate) ? candidate : null;
      const counts = panel ? text('[data-testid="mentions-inline"]', panel) : null;
      const count = (pattern: RegExp): number | null => {
        const match = counts?.match(pattern);
        return match ? Number(match[1].replace(/,/g, '')) : null;
      };
      topics.push({
        name,
        sentiment: parsed ? parsed[1].toLowerCase() as 'positive' | 'negative' | 'mixed' : null,
        mentions: parsed ? Number(parsed[3].replace(/,/g, '')) : count(/([\d,]+) customers mention/i),
        positiveMentions: count(/([\d,]+) positive/i),
        negativeMentions: count(/([\d,]+) negative/i),
        summary: panel ? text('[data-testid="aspect-summary"]', panel) : null,
      });
    });
    const customerSummary = summaryText ? {
      text: summaryText,
      source: 'amazon_ai_generated' as const,
      capturedFrom: 'product_page' as const,
      topics,
    } : null;
    const specifications: Record<string, string> = {};
    document.querySelectorAll('#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr, #productOverview_feature_div tr').forEach(row => {
      const key = text('th, td:first-child', row);
      const value = text('td:last-child', row);
      if (key && value && key !== value) specifications[key] = value;
    });
    document.querySelectorAll('#detailBullets_feature_div li').forEach(row => {
      const key = text('.a-text-bold', row)?.replace(/[:\u200e\u200f]/g, '').trim();
      const full = clean(row.textContent);
      if (key && full) specifications[key] = full.substring(full.indexOf(':') + 1).replace(/[\u200e\u200f]/g, '').trim();
    });
    const reviews = Array.from(document.querySelectorAll('[data-hook="review"]')).map(row => ({
      id: row.id || null,
      author: text('.a-profile-name', row),
      rating: number(text('[data-hook="review-star-rating"], [data-hook="cmps-review-star-rating"]', row)),
      title: text('[data-hook="review-title"] > span:last-child', row) || text('[data-hook="review-title"]', row),
      body: text('[data-hook="review-body"]', row),
      date: text('[data-hook="review-date"]', row),
      verifiedPurchase: !!row.querySelector('[data-hook="avp-badge"]'),
    })).filter(review => review.body);
    const countText = text('#acrCustomerReviewText');
    const countDigits = countText?.replace(/[^0-9]/g, '');
    return {
      title: text('#productTitle'),
      price: text('#corePriceDisplay_desktop_feature_div .a-price .a-offscreen, #corePrice_feature_div .a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice'),
      currency: document.querySelector('meta[itemprop="priceCurrency"]')?.getAttribute('content') || null,
      rating: number(text('#acrPopover .a-icon-alt, #averageCustomerReviews .a-icon-alt')),
      ratingCount: countDigits ? Number(countDigits) : null,
      imageUrl: images[0] || null,
      images,
      bulletPoints: Array.from(document.querySelectorAll('#feature-bullets li .a-list-item')).map(el => clean(el.textContent)).filter((v): v is string => !!v),
      description: text('#productDescription'),
      availability: text('#availability'),
      specifications,
      customerSummary,
      reviews,
      blocked: !!document.querySelector('#captchacharacters, form[action*="validateCaptcha"]') || /robot check|enter the characters you see below|sorry, we just need to make sure/i.test(document.body.innerText),
      signIn: /\/ap\/signin/.test(location.pathname),
    };
  });
}
