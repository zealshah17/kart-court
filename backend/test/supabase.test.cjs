const { test } = require('node:test');
const assert = require('node:assert/strict');
const { saveExtraction, getSupabaseConfig, StorageError } = require('../dist/services/supabase');
const { createApp } = require('../dist/app');

const fixture = {
  product: { asin: 'B012345678', title: 'Lamp', price: '$49.99', images: ['https://example.com/lamp.jpg'], specifications: { Material: 'Oak' } },
  reviews: [{ id: 'R1', body: 'Fits my room', rating: 4 }],
  extraction: { fetchedAt: '2026-09-10T16:00:00Z', warnings: [], reviewScope: 'visible_sample' },
};

test('Supabase stores full JSON and returns generated fields; handles missing config and failed saves', async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SECRET_KEY;
  const originalFetch = global.fetch;
  try {
    delete process.env.SUPABASE_SECRET_KEY;
    assert.throws(getSupabaseConfig, { code: 'SUPABASE_NOT_CONFIGURED' });
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'sb_publishable_test';
    assert.throws(getSupabaseConfig, { code: 'SUPABASE_NOT_CONFIGURED' });
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
    global.fetch = async (url, options) => {
      assert.equal(url.href, 'https://example.supabase.co/rest/v1/product_extractions?select=id,created_at');
      assert.equal(options.headers.apikey, 'sb_secret_test');
      assert.equal(options.headers.Prefer, 'return=representation');
      const body = JSON.parse(options.body);
      assert.deepEqual(body, { source_url: 'https://amzn.to/example', asin: 'B012345678', ...fixture });
      assert.equal(body.id, undefined);
      return Response.json([{ id: 'generated-id', created_at: '2026-09-10T16:00:00Z' }]);
    };
    assert.deepEqual(await saveExtraction('https://amzn.to/example', fixture), { id: 'generated-id', createdAt: '2026-09-10T16:00:00Z' });
    global.fetch = async () => new Response('sensitive upstream details', { status: 403 });
    await assert.rejects(saveExtraction('url', fixture), { code: 'DATABASE_SAVE_FAILED' });
    global.fetch = async () => { throw new Error('sensitive network details'); };
    await assert.rejects(saveExtraction('url', fixture), { code: 'DATABASE_SAVE_UNCONFIRMED' });
    global.fetch = async () => Response.json([]);
    await assert.rejects(saveExtraction('url', fixture), { code: 'DATABASE_SAVE_UNCONFIRMED' });
  } finally {
    global.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = previousKey;
  }
});

test('API does not report success when database save fails', async () => {
  let saved = 0;
  const app = createApp(async () => fixture, async (_url, result) => {
    assert.deepEqual(result, fixture);
    saved++;
    throw new StorageError('DATABASE_SAVE_FAILED', 'Could not save');
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/products/extract`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://amazon.com/dp/B012345678' }),
    });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, 'DATABASE_SAVE_FAILED');
    assert.equal(saved, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
