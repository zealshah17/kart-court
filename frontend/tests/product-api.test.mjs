import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { extractProduct } from '../server/product-api.mjs';
const url = 'https://www.amazon.com/dp/B0F4Y4XJKK';
function request(body = JSON.stringify({ url })) {
  return Object.assign(Readable.from([body]), { headers: { 'content-type': 'application/json' } });
}
test('forwards the entered link and preserves product, reviews and saved ID', async () => {
  const row = { id: 'saved-id', product: { title: 'Linked chair' }, reviews: [{ body: 'Firm seat' }] };
  const result = await extractProduct(request(), { fetchImpl: async (endpoint, init) => {
    assert.equal(endpoint.href, 'http://127.0.0.1:4000/api/products/extract');
    assert.deepEqual(JSON.parse(init.body), { url, maxReviews: 10 });
    return Response.json(row);
  } });
  assert.deepEqual(result, row);
});
test('invalid and oversized requests never reach the backend', async () => {
  for (const [body, status] of [['{', 400], ['{}', 400], ['x'.repeat(8193), 413]]) {
    await assert.rejects(extractProduct(request(body), { fetchImpl: () => assert.fail('Unexpected request') }), error => error.status === status);
  }
});
test('backend errors and unavailability are actionable', async () => {
  await assert.rejects(extractProduct(request(), { fetchImpl: async () => Response.json({ error: { message: 'Provide a valid HTTPS Amazon product URL.' } }, { status: 400 }) }), error => error.status === 400 && /Amazon/.test(error.message));
  await assert.rejects(extractProduct(request(), { fetchImpl: async () => { throw new Error('connect'); } }), /backend is unavailable/);
  await assert.rejects(extractProduct(request(), { fetchImpl: async () => Response.json({}) }), /no product details/);
});
