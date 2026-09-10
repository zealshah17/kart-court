import type { ProductLookupResult } from '../types/product.types';

export class StorageError extends Error {
  constructor(public code: string, message: string, public status = 502) { super(message); }
}

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  let validUrl = false;
  try {
    const parsed = new URL(url || '');
    validUrl = parsed.protocol === 'https:' && !parsed.username && !parsed.password &&
      !parsed.search && !parsed.hash && parsed.pathname === '/';
  } catch { /* report configuration error below */ }
  if (!validUrl || !key?.startsWith('sb_secret_')) {
    throw new StorageError('SUPABASE_NOT_CONFIGURED', 'Set SUPABASE_URL and a backend SUPABASE_SECRET_KEY (sb_secret_...) in backend/.env.', 503);
  }
  return { url: url!, key: key! };
}

export interface SavedExtraction { id: string; createdAt: string }

export async function saveExtraction(sourceUrl: string, result: ProductLookupResult): Promise<SavedExtraction> {
  const { url, key } = getSupabaseConfig();
  try {
    const response = await fetch(new URL('/rest/v1/product_extractions?select=id,created_at', url), {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        source_url: sourceUrl,
        asin: result.product.asin,
        product: result.product,
        reviews: result.reviews,
        extraction: result.extraction,
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new StorageError('DATABASE_SAVE_FAILED', 'Supabase rejected the save. Check the credentials and product_extractions schema.');
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length !== 1 || typeof rows[0]?.id !== 'string' || typeof rows[0]?.created_at !== 'string') {
      throw new StorageError('DATABASE_SAVE_UNCONFIRMED', 'Supabase did not confirm the saved record. Check the table before retrying.');
    }
    return { id: rows[0].id, createdAt: rows[0].created_at };
  } catch (error) {
    if (error instanceof StorageError) throw error;
    // Never expose response bodies, request headers, or credentials.
    throw new StorageError('DATABASE_SAVE_UNCONFIRMED', 'Could not confirm the Supabase save. Check the table before retrying; the record may have been saved.');
  }
}
