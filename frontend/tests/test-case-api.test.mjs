import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createTestCaseHandler } from '../server/test-case-api.mjs';
import { productDimensions } from '../server/case-input.mjs';

function request(origin = 'http://localhost:5173', method = 'POST') {
  return { method, headers: { origin, host: 'localhost:5173' } };
}
function response() {
  return Object.assign(new EventEmitter(), {
    writeHead(status) { this.status = status; return this; },
    end(body) { this.data = JSON.parse(body); this.writableEnded = true; },
  });
}
const row = { product: { title: 'Test chair', specifications: { 'Product Dimensions': '20.1"D x 22.8"W x 45.3"H' } }, reviews: [] };
test('test API reloads fixture and sends new reviews to generator', async () => {
  let calls = 0;
  const handler = createTestCaseHandler({ generateSprite: async () => "data:image/png;base64,c3ByaXRl", loadRow: async () => ({ ...row, reviews: calls ? [{ body: 'Firm seat' }] : [] }),
    generate: async (input, { signal }) => { assert.equal(input.reviews.length, calls++); assert.ok(signal); return { lines: [] }; } });
  for (let i = 0; i < 2; i++) {
    const res = response(); await handler(request(), res);
    assert.equal(res.status, 200); assert.equal(res.data.dimensions.widthCm, 57.91);
    assert.equal(res.data.source, 'examples/product-row.json');
  }
});
test('foreign origins and GET cannot trigger paid generation', async () => {
  const handler = createTestCaseHandler({ generateSprite: async () => "data:image/png;base64,c3ByaXRl", generate: () => assert.fail('Unexpected API call') });
  for (const [req, status] of [[request('https://elsewhere.test'), 403], [request(undefined, 'GET'), 405]]) {
    const res = response(); await handler(req, res); assert.equal(res.status, status);
  }
});
test('duplicate generation is rejected and failed requests can be retried', async () => {
  let release;
  const handler = createTestCaseHandler({ generateSprite: async () => "data:image/png;base64,c3ByaXRl", loadRow: async () => row, generate: () => new Promise((resolve, reject) => { release = () => reject(new Error('OpenAI quota or rate limit reached.')); }) });
  const first = response(); const pending = handler(request(), first);
  await Promise.resolve();
  const second = response(); await handler(request(), second); assert.equal(second.status, 429);
  release(); await pending; assert.equal(first.status, 502); assert.match(first.data.error, /quota/);
  const third = response(); const retry = handler(request(), third); await Promise.resolve(); release(); await retry;
  assert.equal(third.status, 502);
});
test('only explicit labelled product dimensions become measurements', () => {
  assert.deepEqual(productDimensions(row.product), { widthCm: 57.91, depthCm: 51.05, heightCm: 115.06, source: '20.1"D x 22.8"W x 45.3"H', kind: 'overall product dimensions' });
  assert.equal(productDimensions({}).widthCm, null);
});

test('sprite failures preserve dialogue and do not substitute an original photo', async () => {
  const handler = createTestCaseHandler({ loadRow: async () => row, generate: async () => ({ lines: [] }), generateSprite: async () => { throw new Error('Sprite unavailable'); } });
  const res = response(); await handler(request(), res);
  assert.equal(res.status, 200); assert.equal(res.data.spriteImage, null);
  assert.equal(res.data.spriteError, 'Sprite unavailable');
  assert.deepEqual(res.data.conversation, { lines: [] });
});
