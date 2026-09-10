import test from 'node:test';
import assert from 'node:assert/strict';
import { generateConversation } from '../server/generate-conversation.mjs';

const row = { product: { title: 'Test chair' }, reviews: [] };
const valid = () => ({ lines: Array.from({ length: 8 }, (_, i) => ({ speaker: i % 2 ? 'devil' : 'angel', text: 'Let us examine the evidence.', evidence: [] })), missingEvidence: ['Dimensions'] });
const response = data => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }] }));
test('rejects invalid evidence or missing credentials before spending tokens', async () => {
  const options = { apiKey: '', fetchImpl: () => assert.fail('Must not request') };
  await assert.rejects(generateConversation({}, options), /product object/);
  await assert.rejects(generateConversation(row, options), /OPENAI_API_KEY/);
  await assert.rejects(generateConversation({ ...row, reviews: {} }, options), /array/);
});
test('uses Responses with strict JSON and strips review author from inputs', async () => {
  const result = await generateConversation({ ...row, reviews: [{ author: 'Private name', body: 'Nice chair' }] }, {
    apiKey: 'test-key', model: 'gpt-6-astra', fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'gpt-6-astra');
      assert.equal(body.reasoning.effort, 'low');
      assert.equal(body.store, false); assert.equal(body.text.format.strict, true);
      assert.doesNotMatch(body.input, /Private name/);
      assert.equal(options.headers.Authorization, 'Bearer test-key');
      return response(valid());
    },
  });
  assert.equal(result.lines.length, 8);
});
test('rejects speaker overlaps, fabricated references, and oversized bubbles', async () => {
  for (const change of [value => value.lines[1].speaker = 'angel', value => value.lines[0].evidence = ['review:99'], value => value.lines[0].text = 'x'.repeat(201)]) {
    const value = valid(); change(value);
    await assert.rejects(generateConversation(row, { apiKey: 'test-key', fetchImpl: async () => response(value) }), /did not meet/);
  }
});
test('handles rate limits and incomplete results without exposing upstream errors', async () => {
  await assert.rejects(generateConversation(row, { apiKey: 'test-key', fetchImpl: async () => new Response('secret', { status: 429 }) }), /quota or rate limit/);
  await assert.rejects(generateConversation(row, { apiKey: 'test-key', fetchImpl: async () => new Response(JSON.stringify({ status: 'incomplete' })) }), /did not complete/);
});

test('distinguishes generation timeout from DNS errors without leaking details', async () => {
  await assert.rejects(generateConversation(row, { apiKey: 'test-key', fetchImpl: async () => { throw new DOMException('secret', 'TimeoutError'); } }), /exceeded 180 seconds/);
  await assert.rejects(generateConversation(row, { apiKey: 'test-key', fetchImpl: async () => { throw Object.assign(new Error('secret'), { cause: { code: 'ENOTFOUND' } }); } }), /Cannot resolve api.openai.com/);
});
test('validates timeout settings before making a request', async () => {
  await assert.rejects(generateConversation(row, { apiKey: 'test-key', timeoutMs: NaN, fetchImpl: () => assert.fail('Unexpected request') }), /OPENAI_TIMEOUT_MS/);
});
