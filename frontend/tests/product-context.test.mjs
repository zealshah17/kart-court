import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildProductContext } from '../server/product-context.mjs';
import { generateConversation } from '../server/generate-conversation.mjs';
import { evidenceCards } from '../dist/evidence.js';
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
test('customer summary text is preserved as fallback evidence when direct review text is missing', () => {
  const context = buildProductContext({
    ...row,
    reviews: [],
    product: {
      ...row.product,
      customerSummary: {
        text: 'Customers say the chair is comfortable and easy to assemble.',
        source: 'amazon_ai_generated',
        capturedFrom: 'serpapi',
        topics: [{ name: 'comfort', sentiment: 'positive', mentions: 4, positiveMentions: 4, negativeMentions: 0, summary: 'People like the comfort.' }],
      },
    },
  });
  assert.equal(context.product.customerSummary.text, 'Customers say the chair is comfortable and easy to assemble.');
  assert.equal(context.product.customerSummary.topics[0].name, 'comfort');
  assert.equal(context.reviewCoverage.used, 1);
  assert.equal(context.reviewCoverage.provided, 1);
  assert.match(JSON.stringify(context.reviews[0]), /Amazon customer summary/);
});

test('evidence cards show customer summary wording when that summary is available', () => {
  const cards = evidenceCards({
    product: {
      title: 'Bamboo chair',
      price: '$109.99',
      availability: 'In Stock',
      rating: 4.6,
      ratingCount: 120,
      customerSummary: {
        text: 'Customers say the chair is comfortable and easy to assemble.',
      },
      specifications: { Size: 'PU Leather' },
    },
    conversation: { reviewCoverage: { used: 1 } },
  });
  const reviewCard = cards.find(card => card.title === 'Customer summary' || card.title === 'Customer reviews');
  assert.ok(reviewCard);
  assert.equal(reviewCard.title, 'Customer summary');
  assert.match(reviewCard.body, /Amazon summary included as customer-experience evidence|customer-experience/i);
});

test('both positive and negative excerpts and extraction metadata are sent to GPT', async () => {
  const reviews = [{ rating: 5, body: 'Comfortable for my desk.' }, { rating: 2, body: 'Too firm for my preference.' }];
  await generateConversation({ ...row, reviews }, { apiKey: 'test-only', fetchImpl: async (_, options) => {
    const request = JSON.parse(options.body); const context = JSON.parse(request.input);
    assert.equal(context.reviews[0].body, reviews[0].body);
    assert.equal(context.reviews[1].body, reviews[1].body);
    assert.equal(context.extraction.reviewScope, 'visible_sample');
    assert.doesNotMatch(request.instructions, /What is the exact width|What style and comfort feel|How much clearance do you need/i);
    assert.match(request.instructions, /No user-facing questions should be included|Do not generate any questions|customerSummary/i);
    return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ lines: Array.from({ length: 8 }, (_, index) => ({ speaker: index % 2 ? 'devil' : 'angel', text: 'One reviewer shared their experience.', evidence: [`review:${index % 2}`] })), missingEvidence: [] }) }] }] }));
  } });
});
