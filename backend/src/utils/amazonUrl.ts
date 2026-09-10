const DOMAINS = new Set(['amazon.com', 'amazon.ca', 'amazon.com.mx', 'amazon.com.br', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.it', 'amazon.es', 'amazon.nl', 'amazon.se', 'amazon.pl', 'amazon.com.be', 'amazon.ie', 'amazon.in', 'amazon.co.jp', 'amazon.com.au', 'amazon.sg', 'amazon.ae', 'amazon.sa', 'amazon.com.tr', 'amazon.eg', 'amazon.co.za']);
const SHORT_HOSTS = new Set(['amzn.to', 'a.co']);

export function isAmazonUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (SHORT_HOSTS.has(host) || DOMAINS.has(host.replace(/^(www|m|smile)\./, '')));
  } catch { return false; }
}

export function extractAsin(value: string): string | null {
  try {
    const url = new URL(value);
    const path = url.pathname.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})(?:\/|$)/i);
    const asin = path?.[1] ?? url.searchParams.get('asin');
    return asin && /^[A-Z0-9]{10}$/i.test(asin) ? asin.toUpperCase() : null;
  } catch { return null; }
}

/** Validate every redirect before requesting it; never fetch arbitrary user URLs. */
export async function resolveRedirect(value: string): Promise<string> {
  if (!isAmazonUrl(value)) throw new Error('Unsupported Amazon URL');
  if (!SHORT_HOSTS.has(new URL(value).hostname)) return value;
  let current = value;
  const signal = AbortSignal.timeout(10_000);
  for (let hop = 0; hop < 5; hop++) {
    const response = await fetch(current, { redirect: 'manual', signal });
    await response.body?.cancel();
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Short link returned no destination');
      current = new URL(location, current).href;
      if (!isAmazonUrl(current)) throw new Error('Short link has an unsupported destination');
      if (extractAsin(current)) return current;
    } else {
      if (!response.ok) throw new Error('Short link could not be resolved');
      return current;
    }
  }
  throw new Error('Too many short-link redirects');
}

export function extractDomain(value: string): string {
  return new URL(value).hostname.replace(/^(www|m|smile)\./, '');
}
export function buildCanonicalProductUrl(asin: string, domain = 'amazon.com'): string {
  return `https://www.${domain}/dp/${asin}`;
}
export function buildReviewsUrl(asin: string, domain = 'amazon.com'): string {
  return `https://www.${domain}/product-reviews/${asin}`;
}
