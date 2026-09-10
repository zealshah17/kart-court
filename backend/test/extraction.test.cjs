const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { extractPage } = require('../dist/services/extract');

test('extracts room-product evidence and reviews from HTML, tolerates missing fields, detects CAPTCHA', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <h1 id="productTitle">  Oak Side Table </h1>
      <div id="corePrice_feature_div"><span class="a-price"><span class="a-offscreen">$49.99</span></span></div>
      <meta itemprop="priceCurrency" content="USD">
      <div id="acrPopover"><span class="a-icon-alt">4.5 out of 5 stars</span></div>
      <span id="acrCustomerReviewText">1,234 ratings</span>
      <img id="landingImage" src="https://example.com/table.jpg">
      <div id="feature-bullets"><ul><li><span class="a-list-item">Solid oak</span></li></ul></div>
      <table id="productDetails_techSpec_section_1"><tr><th>Dimensions</th><td>20 x 20 x 24 inches</td></tr></table>
      <div data-hook="review" id="R123"><span class="a-profile-name">A customer</span><i data-hook="review-star-rating">4.0 out of 5 stars</i><a data-hook="review-title"><span>Great fit</span></a><span data-hook="review-body">Fits my small room.</span><span data-hook="review-date">September 1, 2026</span><span data-hook="avp-badge">Verified Purchase</span></div>`);
    const result = await extractPage(page);
    assert.equal(result.title, 'Oak Side Table');
    assert.equal(result.price, '$49.99');
    assert.equal(result.rating, 4.5);
    assert.equal(result.ratingCount, 1234);
    assert.equal(result.specifications.Dimensions, '20 x 20 x 24 inches');
    assert.deepEqual(result.bulletPoints, ['Solid oak']);
    assert.equal(result.reviews[0].body, 'Fits my small room.');
    assert.equal(result.reviews[0].verifiedPurchase, true);
    await page.setContent('<body><h1>Robot Check</h1><input id="captchacharacters"></body>');
    const blocked = await extractPage(page);
    assert.equal(blocked.blocked, true);
    assert.equal(blocked.title, null);
    assert.equal(blocked.ratingCount, null);
    assert.deepEqual(blocked.reviews, []);
  } finally { await browser.close(); }
});

test('extracts Amazon summary without individual reviews and falls back to metadata image', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<meta property="og:image" content="https://example.com/chair.jpg">
      <div data-hook="cr-insights-widget-summary"><h3>Customers say</h3><p>Customers like the roomy seat. Cushioning gets mixed feedback.</p><span>Generated from customer reviews</span></div>`);
    const result = await extractPage(page);
    assert.equal(result.imageUrl, 'https://example.com/chair.jpg');
    assert.deepEqual(result.customerSummary, {
      text: 'Customers like the roomy seat. Cushioning gets mixed feedback.',
      source: 'amazon_ai_generated', capturedFrom: 'product_page', topics: [],
    });
    assert.deepEqual(result.reviews, []);
    await page.setContent('<div id="product-summary"><p>Easy to assemble.</p></div>');
    assert.equal((await extractPage(page)).customerSummary.text, 'Easy to assemble.');
    await page.setContent('<p>No summary available</p>');
    assert.equal((await extractPage(page)).customerSummary, null);
  } finally { await browser.close(); }
});

test('reads overall-summary nested spans without heading, disclosure, or topic text', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<div data-csa-c-slot-id="cr-product-insights-detail-page">
      <h3 data-testid="heading">Customers say</h3>
      <div data-testid="overall-summary"><!-- hydration metadata -->
        <span>Customers find the chair <b>comfortable</b>.</span>
        <span>Cushioning receives mixed feedback.</span>
      </div>
      <span>Generated from the text of customer reviews</span>
      <h4>Select to learn more</h4><button>Assembly (86)</button>
      </div>`);
    assert.equal((await extractPage(page)).customerSummary.text, 'Customers find the chair comfortable. Cushioning receives mixed feedback.');
  } finally { await browser.close(); }
});

test('scrolls to trigger insertion of a delayed customer-summary widget', async () => {
  const { waitForCustomerSummary } = require('../dist/services/browser');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<div style="height:4000px">Product content</div>
      <script>window.addEventListener('scroll', () => {
        if (!document.querySelector('[data-testid="overall-summary"]')) {
          const el = document.createElement('div');
          el.setAttribute('data-csa-c-slot-id', 'cr-product-insights-detail-page');
          el.innerHTML = '<h3>Customers say</h3><div data-testid="overall-summary"><span>Comfortable chair.</span></div>';
          document.body.appendChild(el);
        }
      });</script>`);
    await waitForCustomerSummary(page);
    assert.equal((await extractPage(page)).customerSummary.text, 'Comfortable chair.');
    assert.ok(await page.evaluate(() => scrollY > 0));
  } finally { await browser.close(); }
});

test('extracts all eight topics and hidden panel counts from the supplied Amazon DOM', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.route('**/*', route => route.abort());
    const page = await context.newPage();
    await page.setContent(fs.readFileSync(path.join(__dirname, 'fixtures/amazon-customer-insights.html'), 'utf8'));
    const summary = (await extractPage(page)).customerSummary;
    assert.equal(summary.topics.length, 8);
    assert.match(summary.text, /Customers find this office chair/);
    assert.ok(summary.text.endsWith("others say it's quite firm."));
    assert.ok(!summary.text.includes('Select to learn more'));
    const assembly = summary.topics.find(t => t.name === 'Assembly');
    assert.deepEqual([assembly.mentions, assembly.positiveMentions, assembly.negativeMentions], [86, 68, 18]);
    assert.match(assembly.summary, /directions are easily understood/);
    const cushioning = summary.topics.find(t => t.name === 'Cushioning');
    assert.deepEqual([cushioning.sentiment, cushioning.mentions, cushioning.positiveMentions, cushioning.negativeMentions], ['mixed', 43, 24, 19]);
    assert.equal(summary.topics.find(t => t.name === 'Appearance').negativeMentions, 0);
    for (const topic of summary.topics) assert.equal(topic.mentions, topic.positiveMentions + topic.negativeMentions);
    await page.locator('#rh_controls_aspect_2').evaluate(el => el.remove());
    const missing = (await extractPage(page)).customerSummary.topics.find(t => t.name === 'Assembly');
    assert.equal(missing.mentions, 86);
    assert.equal(missing.positiveMentions, null);
    assert.equal(missing.negativeMentions, null);
    assert.equal(missing.summary, null);
  } finally { await browser.close(); }
});
