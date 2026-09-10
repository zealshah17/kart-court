// The browser talks to this server; backend credentials remain in the backend.
export class ProductApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export async function extractProduct(req, { signal, fetchImpl = fetch, backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:4000' } = {}) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new ProductApiError(415, 'Send the product link as JSON.');
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 8192) throw new ProductApiError(413, 'The product request is too large.');
  }
  let input;
  try { input = JSON.parse(body); } catch { throw new ProductApiError(400, 'Send a valid JSON body.'); }
  if (typeof input?.url !== 'string' || !input.url.trim() || input.url.length > 2048) throw new ProductApiError(400, 'Enter an Amazon product link.');
  if (typeof input.roomContext === 'string' && input.roomContext.trim()) req._kartCourtContext = input.roomContext.trim();
  let response;
  try {
    response = await fetchImpl(new URL('/api/products/extract', backendUrl), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: input.url.trim(), maxReviews: input.maxReviews ?? 10 }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ProductApiError(502, error.name === 'TimeoutError' ? 'Product lookup timed out. Please try again.' : 'The product backend is unavailable. Start the backend and try again.');
  }
  const data = await response.json().catch(() => { throw new ProductApiError(502, 'The product backend returned an invalid response.'); });
  if (!response.ok) throw new ProductApiError(response.status, data?.error?.message || 'Could not extract this product.');
  if (!data?.product?.title) throw new ProductApiError(502, 'The product backend returned no product details.');
  if (typeof input.roomContext === 'string' && input.roomContext.trim()) return { ...data, roomContext: input.roomContext.trim() };
  return data;
}
