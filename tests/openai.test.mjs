import test from 'node:test';
import assert from 'node:assert/strict';
import { checkOpenAIConnection } from '../server/openai.mjs';

test('missing key fails before any network request', async () => {
  await assert.rejects(checkOpenAIConnection({ apiKey: '', fetchImpl: () => assert.fail('Unexpected request') }), /Add OPENAI_API_KEY/);
});
test('connection uses only official OpenAI endpoint and returns no secrets', async () => {
  const result = await checkOpenAIConnection({ apiKey: 'test-only-key', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/models');
    assert.equal(options.headers.Authorization, 'Bearer test-only-key');
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  } });
  assert.deepEqual(result, { connected: true });
});
test('authentication errors do not expose upstream response content', async () => {
  await assert.rejects(checkOpenAIConnection({ apiKey: 'test-only-key', fetchImpl: async () => new Response('secret upstream details', { status: 401 }) }), error => {
    assert.match(error.message, /rejected the API key/);
    assert.doesNotMatch(error.message, /secret|test-only-key/); return true;
  });
});
test('network errors are sanitized and malformed success is rejected', async () => {
  await assert.rejects(checkOpenAIConnection({ apiKey: 'test-only-key', fetchImpl: async () => { throw new Error('test-only-key'); } }), /Could not reach OpenAI/);
  await assert.rejects(checkOpenAIConnection({ apiKey: 'test-only-key', fetchImpl: async () => new Response('{}') }), /unexpected response/);
});
