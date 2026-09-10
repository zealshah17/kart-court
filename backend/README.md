# Kart Court backend

Extract Amazon product details and customer reviews as evidence for the two pixel lawyers debating a purchase for the user's room. This first backend step does not yet generate the debate, analyze room images, or render animation.

## Run locally

Requires Node.js 20 or newer.

```sh
cd backend
npm ci
npm run setup:browser
cp .env.example .env
npm run dev
```

The server listens on `http://localhost:4000`. Set `CORS_ORIGIN` in `.env` to your frontend origin. `SCRAPER_HEADFUL=true` opens the extraction browser for local debugging. Browser setup uses [Playwright's Chromium installation](https://playwright.dev/docs/browsers).

## Extract a product

```sh
curl -X POST http://localhost:4000/api/products/extract \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.amazon.com/dp/REPLACE_ME","maxReviews":10}'
```

Replace `REPLACE_ME` with the product's ten-character ASIN, or paste its full Amazon link. HTTPS product links (`/dp/`, `/gp/product/`, `/product/`, or `?asin=`) and `amzn.to`/`a.co` short links are supported. `maxReviews` is optional, defaults to 10, and accepts integers from 1 to 20.

Response fields:

- `product`: ASIN, canonical URL, title, displayed price, currency when explicitly present, average rating, rating count, main image, images, bullet points, description, availability, Amazon customer summary, and specifications (including dimensions/materials when available).
- `reviews`: available author, rating, title, body, date text, verified-purchase flag, and review ID.
- `extraction`: fetch timestamp, review source URL, `reviewScope: "visible_sample"`, and warnings about unavailable reviews.

Missing fields are `null`, empty arrays, or empty objects. Price and review date preserve Amazon's displayed text. Images are remote URLs. Specifications and reviews are untrusted source text; downstream debate prompts should treat them as evidence, not instructions.

### Frontend usage

```js
const response = await fetch('http://localhost:4000/api/products/extract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: amazonLink, maxReviews: 10 }),
});
const data = await response.json();
if (!response.ok) throw new Error(data.error.message);
// Feed data.product and data.reviews into the future lawyer-debate step.
// Show data.extraction.warnings when evidence is incomplete.
```

`GET /health` returns service liveness. Errors have shape `{ "error": { "code": "...", "message": "..." } }`: 400 invalid input, 404 missing product, 413 oversized JSON, 429 extraction capacity reached, or 502 upstream/browser failure (`AMAZON_BLOCKED`, `LINK_RESOLUTION_FAILED`, `EXTRACTION_FAILED`).

## Limits

This is a best-effort, local prototype using public Amazon HTML. Amazon can block automated access, change markup, or require sign-in for reviews. The service does not bypass those restrictions. Only reviews already visible on the product page are sampled; it does not fetch all reviews or guarantee the requested count. A successful product response may contain zero reviews with a warning. Prices/availability vary by location and session; some localized fields may not parse. For dependable production coverage, replace the lookup service with a licensed product/reviews data provider.

Each request uses an isolated browser with bounded navigation timeouts and closes it afterward. At most two extractions run concurrently. Only supported Amazon HTTPS hosts are fetched, including during redirects; Amazon scripts and requests are enabled for summary rendering; image, media, and font downloads are blocked. The server binds to loopback for local use. Before exposing it publicly, add authentication, per-user rate limits, and deployment-specific network controls.

## Check and build

```sh
npm test
npm run build
npm start
```

Tests cover URL safety, short-link redirect rejection, API validation/error handling, and HTML extraction using a local browser fixture. They require Chromium (`npm run setup:browser`) and do not depend on live Amazon responses.

## Supabase persistence

Run `supabase/schema.sql` in your project's SQL Editor (the same schema provided during setup), then set these in `backend/.env`:

```env
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SECRET_KEY=sb_secret_your_backend_key
```

Copy your project URL from Connect, and a secret key from Settings → API Keys. Never use `NEXT_PUBLIC_` for the secret. Existing `.env` values must be kept when adding these settings. The server validates configuration at startup.

`src/services/supabase.ts` uses the Supabase REST API to insert a row into `product_extractions` after each successful extraction. It saves the original submitted URL, ASIN, the **entire** product JSON, reviews array, and extraction metadata. Supabase generates `id` and `created_at`; the API returns them as top-level `id` and `createdAt` alongside `product`, `reviews`, and `extraction`. Each submission creates a separate history record.

Database errors return `DATABASE_SAVE_FAILED` (502), missing configuration returns `SUPABASE_NOT_CONFIGURED` (503), and a network timeout or unexpected response returns `DATABASE_SAVE_UNCONFIRMED` (502). An unconfirmed request may already have committed; check the table before retrying. Inserts are not automatically retried. No credentials or raw database errors are returned to the frontend.

The tests mock Supabase; they do not insert test data into your project. To verify a real save, submit an actual Amazon product link and look for the returned `id` in Table Editor → product_extractions.

## Customer summary

The primary review evidence is now `product.customerSummary`: `{ text, source: "amazon_ai_generated", capturedFrom: "product_page" }`. It stores Amazon's “Customers say” text, not a new AI-generated interpretation. It is `null` with a warning when absent. This field is saved automatically inside the existing `product` JSONB column; no SQL migration is needed. Historical rows are not automatically refreshed. Individual reviews are optional; the service no longer visits the separate sign-in-gated reviews page. Image fields are remote URLs, not uploaded files.

The customer summary now includes `topics`: each has `name`, Amazon's `sentiment` label, `mentions`, `positiveMentions`, `negativeMentions`, and its own `summary`. The parser reads `[data-testid="overall-summary"]`, topic tabs in `[data-testid="aspect-list"]`, and the panels linked by `aria-controls`. Hidden panels already present in the DOM are included; unavailable counts remain `null`, while an explicit zero stays `0`. These fields require no database migration. The supplied DOM is retained as a sanitized offline regression fixture, without scripts or external requests. Fixture success verifies parsing, not whether Amazon will deliver the widget to an automated request.
