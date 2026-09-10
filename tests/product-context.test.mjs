import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildProductContext } from '../server/product-context.mjs';
import { generateConversation } from '../server/generate-conversation.mjs';
const row = JSON.parse(readFileSync(new URL('../examples/product-row.json', import.meta.url)));

test('Dowinx backend response preserves listing facts and review-unavailability warnings', () => {
  const context = buildProductContext(row);
  assert.equal(context.product.asin, 'B0F4Y4XJKK');
  assert.equal(context.product.price, '$179.99'); assert.equal(context.product.currency, null);
  assert.equal(context.product.ratingCount, 517); assert.equal(context.reviews.length, 0);
  assert.equal(context.product.availability, 'In Stock');
  assert.equal(context.product.specifications.Size, 'PU Leather');
  assert.equal(context.extraction.reviewScope, 'visible_sample');
  assert.ok(context.extraction.warnings.some(warning => warning.includes('does not mean')));
  assert.doesNotMatch(JSON.stringify(context), /merchantId|loggedIn/);
});
test('later review objects enter context with text and stable source references', () => {
  const context = buildProductContext({ ...row, reviews: [
    { rating: 1 },
    { id: 'positive-test', rating: 5, body: 'The armrests adjust to my desk.', author: 'Private Name' },
    { id: 'negative-test', rating: 2, content: 'The footrest was too short for me.' },
  ] });
  assert.equal(context.reviews[0].evidenceId, 'review:1');
  assert.equal(context.reviews[1].body, 'The footrest was too short for me.');
  assert.deepEqual(context.reviewCoverage, { provided: 3, readable: 2, used: 2, omitted: 1, scope: 'visible_sample' });
  assert.doesNotMatch(JSON.stringify(context), /Private Name/);
});
test('review truncation and markdown source URLs are handled explicitly', () => {
  const context = buildProductContext({ ...row, product: { ...row.product, url: '[Amazon](https://www.amazon.com/dp/B0F4Y4XJKK)' }, reviews: Array.from({ length: 45 }, () => ({ body: 'Test review' })) });
  assert.equal(context.product.url, 'https://www.amazon.com/dp/B0F4Y4XJKK');
  assert.equal(context.reviewCoverage.used, 40); assert.equal(context.reviewCoverage.omitted, 5);
  assert.ok(context.extraction.warnings.some(warning => warning.includes('not necessarily a representative sample')));
});
test('both positive and negative excerpts and extraction metadata are sent to GPT', async () => {
  const reviews = [{ rating: 5, body: 'Comfortable for my desk.' }, { rating: 2, body: 'Too firm for my preference.' }];
  await generateConversation({ ...row, reviews }, { apiKey: 'test-only', fetchImpl: async (_, options) => {
    const request = JSON.parse(options.body); const context = JSON.parse(request.input);
    assert.equal(context.reviews[0].body, reviews[0].body);
    assert.equal(context.reviews[1].body, reviews[1].body);
    assert.equal(context.extraction.reviewScope, 'visible_sample');
    assert.match(request.instructions, /NOT readable customer review text/);
    return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ lines: Array.from({ length: 8 }, (_, index) => ({ speaker: index % 2 ? 'devil' : 'angel', text: 'One reviewer shared their experience.', evidence: [`review:${index % 2}`] })), missingEvidence: [] }) }] }] }));
  } });
});
