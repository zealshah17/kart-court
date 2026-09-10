import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoices } from '../dist/voices.js';
function setup(fetchImpl = async () => new Response('MP3', { headers: { 'Content-Type': 'audio/mpeg' } })) {
  const audio = { pause() {}, removeAttribute() { this.src = ''; }, load() {}, async play() { this.onplaying(); } };
  const statuses = [];
  let count = 0;
  const voices = createVoices({ audio, fetchImpl: (...args) => { count++; return fetchImpl(...args); }, urlApi: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, onStatus: message => statuses.push(message) });
  return { voices, audio, statuses, get count() { return count; } };
}
test('argument audio works without browser speech and replay uses cached MP3', async () => {
  const s = setup(); await s.voices.speak({ speaker: 'angel', text: 'The evidence speaks for itself.' });
  assert.equal(s.audio.src, 'blob:test'); assert.equal(s.audio.hidden, false);
  assert.match(s.statuses.at(-1), /Angel is speaking/);
  await s.voices.speak({ speaker: 'angel', text: 'The evidence speaks for itself.' }); assert.equal(s.count, 1); s.voices.dispose();
});
test('blocked autoplay preserves the native Play control', async () => {
  const s = setup(); s.audio.play = async () => { throw new Error('NotAllowed'); };
  await s.voices.speak({ speaker: 'angel', text: 'The evidence speaks for itself.' }); assert.equal(s.audio.hidden, false); assert.match(s.statuses.at(-1), /Press Play/); s.voices.dispose();
});
test('mute cancels pending playback and stale responses cannot start audio', async () => {
  let release;
  const s = setup(() => new Promise(resolve => { release = resolve; }));
  const pending = s.voices.speak({ speaker: 'angel', text: 'The evidence speaks for itself.' }); await s.voices.setEnabled(false);
  release(new Response('MP3', { headers: { 'Content-Type': 'audio/mpeg' } })); await pending;
  assert.equal(s.audio.hidden, true); assert.equal(s.audio.src, ''); s.voices.dispose();
});
test('API errors appear as actionable status', async () => {
  const s = setup(async () => Response.json({ error: 'Voice API quota reached.' }, { status: 502 }));
  await s.voices.speak({ speaker: 'angel', text: 'The evidence speaks for itself.' }); assert.equal(s.statuses.at(-1), 'Voice API quota reached.'); s.voices.dispose();
});
test('visual playback signals wait for actual audio and track pauses, buffering and completion', async () => {
  let release;
  const phases = [];
  const audio = { pause() {}, removeAttribute() {}, load() {}, async play() {} };
  const voices = createVoices({ audio,
    fetchImpl: () => new Promise(resolve => { release = resolve; }),
    urlApi: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    onPlayback: (phase, line) => phases.push([phase, line]),
  });
  const line = { speaker: 'devil', text: 'Objection.' };
  const pending = voices.speak(line);
  assert.equal(phases.at(-1)[0], 'loading');
  assert.ok(!phases.some(([phase]) => phase === 'playing'));
  release(new Response('MP3', { headers: { 'Content-Type': 'audio/mpeg' } }));
  await pending;
  assert.ok(!phases.some(([phase]) => phase === 'playing'));
  audio.onplaying(); assert.deepEqual(phases.at(-1), ['playing', line]);
  audio.onpause(); assert.equal(phases.at(-1)[0], 'paused');
  audio.onwaiting(); assert.equal(phases.at(-1)[0], 'waiting');
  audio.onplaying(); assert.equal(phases.at(-1)[0], 'playing');
  audio.onended(); assert.equal(phases.at(-1)[0], 'ended');
  const stalePlaying = audio.onplaying;
  voices.stop(); const count = phases.length;
  stalePlaying(); assert.equal(phases.length, count);
  voices.dispose();
});
test('muted arguments reveal text immediately without fetching audio', async () => {
  const phases = [];
  const audio = { pause() {}, removeAttribute() {}, load() {} };
  const voices = createVoices({ audio, fetchImpl: () => assert.fail('Muted audio should not generate'), onPlayback: phase => phases.push(phase) });
  await voices.setEnabled(false);
  await voices.speak({ speaker: 'angel', text: 'Evidence matters.' });
  assert.equal(phases.at(-1), 'silent');
  voices.dispose();
});
