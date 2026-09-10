import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createSpeechHandler } from '../server/speech-api.mjs';
function req(body, origin = 'http://localhost:5173') { return Object.assign(Readable.from([JSON.stringify(body)]), { method: 'POST', headers: { origin, host: 'localhost:5173', 'content-type': 'application/json' } }); }
function res() { return Object.assign(new EventEmitter(), { writeHead(status, headers) { this.status = status; this.headers = headers; return this; }, end(body) { this.body = body; this.writableEnded = true; } }); }
test('generates separate character voices and caches repeated lines', async () => {
  const requests = [];
  const handle = createSpeechHandler({ apiKey: () => 'test-key', fetchImpl: async (url, init) => { assert.equal(url, 'https://api.openai.com/v1/audio/speech'); requests.push(JSON.parse(init.body)); return new Response('MP3', { headers: { 'content-type': 'audio/mpeg' } }); } });
  for (const speaker of ['angel', 'devil', 'angel']) { const response = res(); await handle(req({ speaker, text: 'Hello' }), response); assert.equal(response.status, 200); assert.equal(response.headers['Content-Type'], 'audio/mpeg'); }
  assert.deepEqual(requests.map(x => x.voice), ['coral', 'onyx']);
});
test('rejects cross-origin and invalid input without API calls', async () => {
  const handle = createSpeechHandler({ fetchImpl: () => assert.fail('Unexpected API call') });
  for (const [request, status] of [[req({ speaker: 'angel', text: 'Hi' }, 'https://evil.test'), 403], [req({ speaker: 'other', text: 'Hi' }), 400], [req({ speaker: 'angel', text: 'x'.repeat(601) }), 400]]) { const response = res(); await handle(request, response); assert.equal(response.status, status); }
});
test('upstream error details never leak', async () => {
  const handle = createSpeechHandler({ apiKey: () => 'secret', fetchImpl: async () => new Response('secret', { status: 401 }) });
  const response = res(); await handle(req({ speaker: 'angel', text: 'Hi' }), response);
  assert.equal(response.status, 502); assert.ok(!response.body.includes('secret'));
});
