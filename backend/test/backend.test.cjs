const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../dist/app');
const { isAmazonUrl, extractAsin, resolveRedirect } = require('../dist/utils/amazonUrl');
const { LookupError } = require('../dist/services/amazon');

test('accepts supported product URLs and rejects unsafe destinations', () => {
  for (const url of ['https://www.amazon.com/dp/B012345678', 'https://amazon.in/gp/product/B012345678', 'https://amzn.to/example']) assert.equal(isAmazonUrl(url), true);
  for (const url of ['http://amazon.com/dp/B012345678', 'https://amazon.com.evil.test/dp/B012345678', 'https://amazon.fake/dp/B012345678', 'https://user:pass@amazon.com/dp/B012345678', 'https://amazon.com:8443', 'https://localhost/', 'file:///etc/passwd']) assert.equal(isAmazonUrl(url), false);
  assert.equal(extractAsin('https://amazon.com/dp/b012345678?tag=test'), 'B012345678');
  assert.equal(extractAsin('https://amazon.com/dp/B0123456789'), null);
  assert.equal(extractAsin('https://amazon.com/?x=/dp/B012345678'), null);
});

test('short-link redirects are checked before following them', async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls++; return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }); };
  try { await assert.rejects(resolveRedirect('https://amzn.to/example'), /unsupported destination/); assert.equal(calls, 1); }
  finally { global.fetch = originalFetch; }
});

test('HTTP API validates input, returns extraction data, and handles provider failures', async () => {
  let calls = 0;
  const app = createApp(async (url, maxReviews) => {
    calls++;
    if (maxReviews === 2) throw new LookupError('AMAZON_BLOCKED', 'Blocked');
    return { product: { url }, reviews: [], extraction: { warnings: ['No reviews available'] } };
  }, async () => ({ id: 'saved-id', createdAt: '2026-09-10T16:00:00Z' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = body => fetch(`${base}/api/products/extract`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(`${base}/health`)).status, 200);
    for (const body of [{}, { url: 'https://localhost/' }, { url: 'https://amazon.com/' }, { url: 'https://amazon.com/dp/B012345678', maxReviews: 21 }]) assert.equal((await post(body)).status, 400);
    assert.equal(calls, 0);
    const success = await post({ url: 'https://amazon.com/dp/B012345678' });
    assert.equal(success.status, 200);
    const data = await success.json();
    assert.equal(data.product.url, 'https://amazon.com/dp/B012345678');
    assert.equal(data.id, 'saved-id');
    const blocked = await post({ url: 'https://amazon.com/dp/B012345678', maxReviews: 2 });
    assert.equal(blocked.status, 502);
    assert.equal((await blocked.json()).error.code, 'AMAZON_BLOCKED');
    const malformed = await fetch(`${base}/api/products/extract`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
