# Kart Court backend

The API uses SerpApi's Amazon Product engine to fetch product details, images, Amazon's “Customers say” summary and topic sentiment. It saves the normalized response in Supabase before returning success.

## Setup

Run commands from `backend/`. Install dependencies with `npm install`. Set these values in `backend/.env`:

```dotenv
PORT=4000
CORS_ORIGIN=http://localhost:3000
SERPAPI_API_KEY=your_serpapi_key
SUPABASE_URL=https://your_project.supabase.co
SUPABASE_SECRET_KEY=your_backend_secret
```

Keep keys server-side and `.env` out of Git. Use the existing SQL under `supabase/` to create `public.product_extractions`. No new columns are needed for SerpApi: the product and extraction columns are JSONB.

Start with `npm run dev`. For compiled production execution use `npm run build` and `npm start`.

## Postman

POST `http://localhost:4000/api/products/extract`, Body → raw → JSON:

```json
{
  "url": "https://www.amazon.com/dp/B0F4Y4XJKK",
  "maxReviews": 5
}
```

The response includes:

- `id`, `createdAt`: saved Supabase row.
- `product.customerSummary.text`: Amazon's summary, when returned by the provider.
- `product.customerSummary.topics`: topic names, sentiment, mention counts and summaries. Unknown counts stay null; zero stays zero.
- `product.images`, `product.imageUrl`: image URLs, not uploaded image files.
- `product`: title, price, rating, specifications, availability and other details.
- `reviews`: at most `maxReviews` individual reviews if supplied (not required for the summary).
- `extraction.provider`: `serpapi`; `warnings`: missing summary/images.

Missing summaries return null with a warning, never fabricated text. Availability varies by product, region and provider response. SerpApi may serve cached results; `fetchedAt` is when our backend received the result, not a guarantee of a fresh Amazon crawl. Provider quotas apply. The default request allows SerpApi caching.

`GET /health` only checks that the server responds. A successful extraction confirms a database insert. Check `product_extractions` by the returned `id` to inspect stored data.

Common failures: `PROVIDER_NOT_CONFIGURED`, `PROVIDER_AUTH_FAILED`, `PROVIDER_LIMIT_REACHED`, `PROVIDER_UNAVAILABLE`, `PROVIDER_EXTRACTION_FAILED`, and database save errors. Provider failures do not create a new extraction row. An unconfirmed database response may have committed; check Supabase before retrying.

## Code

- `src/app.ts`: request validation, endpoint, errors and concurrency limit.
- `src/services/amazon.ts`: resolves Amazon links, calls SerpApi and normalizes data.
- `src/services/supabase.ts`: saves product, reviews and extraction metadata.
- `src/types/product.types.ts`: response types.
- `src/utils/amazonUrl.ts`: URL allowlist, ASIN parsing and safe short-link resolution.
- `src/services/extract.ts`, `browser.ts`: retained HTML parser and browser utilities; the live endpoint uses SerpApi.
- `test/`: HTTP, provider, storage and HTML parser tests.

Run `npm test`. The retained HTML tests need Chromium (`npm run setup:browser`); normal SerpApi extraction does not need a browser.

Provider documentation: https://serpapi.com/amazon-product-api
