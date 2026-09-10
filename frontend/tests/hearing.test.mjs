import test from 'node:test';
import assert from 'node:assert/strict';
import { createHearing } from '../dist/hearing.js';

function setup() {
  const spoken = [], endings = [], pauses = [];
  const hearing = createHearing({
    onLine: (line, index, count) => spoken.push({ ...line, index, count }),
    onPause: paused => pauses.push(paused), onEnd: completed => endings.push(completed),
  });
  return { hearing, spoken, endings, pauses };
}
const lines = [{ speaker: 'angel', text: 'A cozy match.' }, { speaker: 'devil', text: 'Will it fit?' }];

test('starting shows only the first line; input advances and completes once', () => {
  const s = setup(); s.hearing.start(lines);
  assert.equal(s.spoken.length, 1); assert.equal(s.spoken[0].speaker, 'angel');
  assert.deepEqual(s.endings, []);
  s.hearing.next(); assert.equal(s.spoken[1].speaker, 'devil');
  assert.deepEqual(s.endings, []);
  s.hearing.next(); s.hearing.next();
  assert.deepEqual(s.endings, [true]); assert.equal(s.hearing.active, false);
});
test('dialogue never schedules automatic advancement', t => {
  let timerCalls = 0;
  t.mock.method(globalThis, 'setTimeout', () => { timerCalls++; return 1; });
  const s = setup(); s.hearing.start(lines); s.hearing.next();
  assert.equal(timerCalls, 0); assert.equal(s.hearing.active, true);
  assert.deepEqual(s.endings, []);
});
test('hiding and returning to the page keeps the same line until input', () => {
  const s = setup(); s.hearing.start(lines); s.hearing.pause(true); s.hearing.next();
  assert.equal(s.spoken.length, 1);
  s.hearing.pause(false); assert.equal(s.spoken.length, 1);
  s.hearing.next(); assert.equal(s.spoken[1].speaker, 'devil');
});
test('cancellation never shows a verdict or accepts further advancement', () => {
  const s = setup(); s.hearing.start(lines); s.hearing.stop(); s.hearing.next();
  assert.deepEqual(s.endings, [false]); assert.equal(s.spoken.length, 1);
});
test('restarting replaces the old case and an empty case stays inactive', () => {
  const s = setup(); s.hearing.start(lines); s.hearing.next(); s.hearing.start(lines);
  assert.deepEqual(s.endings, [false]); assert.equal(s.spoken.at(-1).index, 0);
  s.hearing.start([]); assert.equal(s.hearing.active, false);
});
