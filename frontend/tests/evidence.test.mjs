import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceCards } from '../dist/evidence.js';
test('empty case contains no invented room, product, or questions', () => {
  assert.deepEqual(evidenceCards({}), []);
});
test('cards use actual facts and questions rather than furniture assumptions', () => {
  const cards = evidenceCards({ product: { title: 'Desk lamp', price: '$20', rating: 4.2 }, conversation: { reviewCoverage: { used: 0 }, lines: [{ speaker: 'angel', text: 'Listing says adjustable.' }], missingEvidence: ['Is the bulb included?'] } });
  assert.equal(cards[0].title, 'Desk lamp');
  assert.ok(cards.some(card => card.title === 'Is the bulb included?'));
  assert.ok(cards.some(card => card.label === 'Missing'));
  assert.ok(!cards.some(card => card.title === 'Space check'));
  assert.ok(!JSON.stringify(cards).includes('sofa'));
});
test('measurements update width comparison and preserve independent photos and notes', () => {
  const input = { width: 60, photos: [{ name: 'Study', url: 'blob:original' }], notes: [{ title: 'Budget', body: 'Under $200' }] };
  assert.equal(evidenceCards(input).find(card => card.title === 'Space check').label, 'Optional');
  const cards = evidenceCards({ ...input, available: 55 });
  assert.equal(cards.find(card => card.title === 'Space check').label, 'Too wide');
  assert.equal(cards.find(card => card.title === 'Study').image, 'blob:original');
  assert.equal(cards.find(card => card.title === 'Budget').body, 'Under $200');
});
