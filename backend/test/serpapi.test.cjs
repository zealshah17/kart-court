const { test } = require('node:test');
const assert = require('node:assert/strict');
const { lookupProduct, normalizeSerpApiResponse } = require('../dist/services/amazon');
const url = 'https://www.amazon.com/dp/B0F4Y4XJKK';
const fixture = {
  product_results: { title: 'Chair', thumbnails: ['https://example.com/chair.jpg'], rating: 4.5, reviews: 517 },
  item_specifications: { color: 'White' },
  reviews_information: { summary: { text: 'Customers like the chair.', insights: [{ title: 'Appearance', sentiment: 'positive', mentions: { total: 52, positive: 52, negative: 0 }, summary: 'Looks good.' }] }, authors_reviews: [{ text: 'Comfortable', rating: 5 }] },
};
test('maps provider summary, images, and zero sentiment counts; missing summaries stay null', () => {
  const result = normalizeSerpApiResponse(fixture, 'B0F4Y4XJKK', url, 1);
  assert.equal(result.product.customerSummary.topics[0].negativeMentions, 0);
  assert.equal(result.product.customerSummary.capturedFrom, 'serpapi');
  assert.equal(result.product.images.length, 1);
  assert.equal(result.reviews[0].body, 'Comfortable');
  const missing = normalizeSerpApiResponse({ product_results: { title: 'Other product' } }, 'B0F4Y4XJKK', url);
  assert.equal(missing.product.customerSummary, null);
  assert.equal(missing.extraction.warnings.length, 2);
  assert.throws(() => normalizeSerpApiResponse({}, 'B0F4Y4XJKK', url), /readable product details/);
});
test('provider request uses the ASIN and marketplace; errors never expose the key or raw provider errors', async () => {
  const originalFetch = global.fetch, originalKey = process.env.SERPAPI_API_KEY;
  process.env.SERPAPI_API_KEY = 'test-private-key';
  try {
    global.fetch = async input => {
      const request = new URL(input);
      assert.equal(request.searchParams.get('asin'), 'B0F4Y4XJKK');
      assert.equal(request.searchParams.get('amazon_domain'), 'amazon.com');
      assert.equal(request.hostname, 'serpapi.com');
      return Response.json(fixture);
    };
    assert.equal((await lookupProduct(url)).product.title, 'Chair');
    for (const status of [401, 429, 500]) {
      global.fetch = async () => new Response('test-private-key', { status });
      await assert.rejects(lookupProduct(url), error => !error.message.includes('test-private-key') && error.status >= 500);
    }
    global.fetch = async () => Response.json({ error: 'test-private-key' });
    await assert.rejects(lookupProduct(url), error => error.code === 'PROVIDER_EXTRACTION_FAILED' && !error.message.includes('test-private-key'));
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SERPAPI_API_KEY; else process.env.SERPAPI_API_KEY = originalKey;
  }
});
