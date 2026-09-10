import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import { lookupProduct, LookupError } from './services/amazon';
import { saveExtraction, StorageError } from './services/supabase';
import { extractAsin, isAmazonUrl } from './utils/amazonUrl';

export function createApp(lookup = lookupProduct, save = saveExtraction) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
  app.use(express.json({ limit: '8kb' }));
  app.get('/health', (_req, res) => { res.json({ status: 'ok', service: 'kart-court' }); });
  let active = 0;
  app.post('/api/products/extract', async (req, res, next) => {
    const { url, maxReviews = 10 } = req.body || {};
    if (typeof url !== 'string' || url.length > 2048 || !isAmazonUrl(url)) {
      res.status(400).json({ error: { code: 'INVALID_URL', message: 'Provide a valid HTTPS Amazon product URL.' } }); return;
    }
    if (!['amzn.to', 'a.co'].includes(new URL(url).hostname) && !extractAsin(url)) {
      res.status(400).json({ error: { code: 'INVALID_PRODUCT_URL', message: 'Provide a product URL containing an ASIN (/dp/… or /gp/product/…).' } }); return;
    }
    if (!Number.isInteger(maxReviews) || maxReviews < 1 || maxReviews > 20) {
      res.status(400).json({ error: { code: 'INVALID_REVIEW_LIMIT', message: 'maxReviews must be an integer from 1 to 20.' } }); return;
    }
    if (active >= 2) {
      res.set('Retry-After', '10').status(429).json({ error: { code: 'BUSY', message: 'Two extractions are already running. Please retry shortly.' } }); return;
    }
    active++;
    try {
      const result = await lookup(url, maxReviews);
      const saved = await save(url, result);
      res.json({ ...result, id: saved.id, createdAt: saved.createdAt });
    }
    catch (error) { next(error); }
    finally { active--; }
  });
  const onError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof LookupError || error instanceof StorageError) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
      res.status(error.type === 'entity.too.large' ? 413 : 400).json({ error: { code: 'INVALID_BODY', message: 'Send a valid JSON body smaller than 8 KB.' } }); return;
    }
    console.error('Product extraction failed:', error instanceof Error ? error.message : 'Unknown error');
    res.status(502).json({ error: { code: 'EXTRACTION_FAILED', message: 'Could not extract this product. Check browser setup and try again later.' } });
  };
  app.use(onError);
  return app;
}
