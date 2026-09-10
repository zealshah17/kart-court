import test from 'node:test';
import assert from 'node:assert/strict';
import { generateProductSprite, productImageUrl } from '../server/generate-product-sprite.mjs';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64');
const row = { product: { title: 'White chair', imageUrl: 'https://m.media-amazon.com/images/chair.jpg' }, reviews: [] };
test('sprite edit sends original plus style and requests transparent PNG', async () => {
  let calls = 0;
  const result = await generateProductSprite(row, { apiKey: 'test-key', loadStyle: async () => png, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(options.redirect, 'error');
    if (calls === 1) { assert.equal(url, row.product.imageUrl); assert.equal(options.headers, undefined); return new Response(png, { headers: { 'content-type': 'image/png' } }); }
    assert.equal(url, 'https://api.openai.com/v1/images/edits');
    assert.equal(options.body.get('background'), 'transparent');
    assert.equal(options.body.get('output_format'), 'png');
    assert.equal(options.body.getAll('image[]').length, 2);
    assert.match(options.body.get('prompt'), /White chair/);
    assert.match(options.body.get('prompt'), /No white rectangle/);
    return Response.json({ data: [{ b64_json: png.toString('base64') }] });
  } });
  assert.match(result, /^data:image\/png;base64,/);
  assert.equal(calls, 2);
});
test('untrusted hosts cannot reach a network or receive the API key', async () => {
  for (const imageUrl of ['http://localhost/image', 'https://m.media-amazon.com.evil.test/x', 'https://user:pass@m.media-amazon.com/x']) {
    assert.throws(() => productImageUrl({ imageUrl }), /Amazon image host/);
  }
});
test('image failure is sanitized and never returns a fake sprite', async () => {
  let calls = 0;
  await assert.rejects(generateProductSprite(row, { apiKey: 'test-key', loadStyle: async () => png, fetchImpl: async () => ++calls === 1
    ? new Response(png, { headers: { 'content-type': 'image/png' } }) : new Response('secret upstream error', { status: 429 }) }), /quota or rate limit/);
});
