import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdictFor } from '../dist/verdict.js';
test('purchase and pass produce distinct verdicts and reject unknown decisions', () => {
  assert.match(verdictFor('yes').title, /approved/);
  assert.match(verdictFor('no').title, /dismissed/);
  assert.notEqual(verdictFor('yes').text, verdictFor('no').text);
  assert.throws(() => verdictFor('maybe'));
});
