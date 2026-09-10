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

test('drops listing, review, and product-spec prompts and asks no questions at all', async () => {
  const result = await generateConversation({ ...row, product: { title: 'Test chair' }, reviews: [] }, {
    apiKey: 'test-key',
    fetchImpl: async () => response({
      lines: Array.from({ length: 8 }, (_, i) => ({ speaker: i % 2 ? 'devil' : 'angel', text: 'Short answer only.', evidence: [] })),
      missingEvidence: ['Readable customer review text', 'What is the exact width?', 'How much clearance do you need?', 'Are you okay with assembly?', 'Is the armrest height enough?', 'What style and comfort feel do you want in this chair?', 'What matters most in daily use: comfort, look, or easy care?'],
    }),
  });
  assert.deepEqual(result.missingEvidence, []);
});

test('asks no questions at all, even when the model tries to generate preference prompts', async () => {
  const result = await generateConversation({ ...row, product: { title: 'Test chair' }, reviews: [] }, {
    apiKey: 'test-key',
    fetchImpl: async () => response({
      lines: Array.from({ length: 8 }, (_, i) => ({ speaker: i % 2 ? 'devil' : 'angel', text: 'Short answer only.', evidence: [] })),
      missingEvidence: [
        'Does the cushion size and oval shape suit your papasan frame?',
        'What are the full hand-washing and drying instructions?',
        'What do readable customer reviews report about comfort and shape retention over time?',
        'What style and comfort feel do you want in this chair?',
        'What matters most in daily use: comfort, look, or easy care?',
      ],
    }),
  });
  assert.deepEqual(result.missingEvidence, []);
});

test('rejects unsupported "unavailable" mentions in the argument text', async () => {
  await assert.rejects(generateConversation(row, {
    apiKey: 'test-key',
    fetchImpl: async () => response({
      lines: Array.from({ length: 8 }, (_, i) => ({ speaker: i % 2 ? 'devil' : 'angel', text: i === 0 ? 'No readable review text was available.' : 'Short answer only.', evidence: [] })),
      missingEvidence: ['What style and comfort feel do you want in this chair?'],
    }),
  }), /did not meet/);
});

test('distinguishes generation timeout from DNS errors without leaking details', async () => {
  await assert.rejects(generateConversation(row, { apiKey: 'test-key', fetchImpl: async () => { throw new DOMException('secret', 'TimeoutError'); } }), /exceeded 180 seconds/);
  await assert.rejects(generateConversation(row, { apiKey: 'test-key', fetchImpl: async () => { throw Object.assign(new Error('secret'), { cause: { code: 'ENOTFOUND' } }); } }), /Cannot resolve api.openai.com/);
});
test('validates timeout settings before making a request', async () => {
  await assert.rejects(generateConversation(row, { apiKey: 'test-key', timeoutMs: NaN, fetchImpl: () => assert.fail('Unexpected request') }), /OPENAI_TIMEOUT_MS/);
});
