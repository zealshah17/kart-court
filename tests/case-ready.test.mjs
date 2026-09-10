import test from 'node:test';
import assert from 'node:assert/strict';
import { caseReady } from '../dist/case-ready.js';
test('generation requires both a valid link and decoded photo', () => {
  assert.equal(caseReady('', 0), false);
  assert.equal(caseReady('https://amazon.com/dp/B0F4Y4XJKK', 0), false);
  assert.equal(caseReady('', 1), false);
  assert.equal(caseReady('invalid', 1), false);
  assert.equal(caseReady('javascript:alert(1)', 1), false);
  assert.equal(caseReady('https://amazon.com/dp/B0F4Y4XJKK', 1), true);
  assert.equal(caseReady('https://amazon.com/dp/B0F4Y4XJKK', 1, true), false);
});
