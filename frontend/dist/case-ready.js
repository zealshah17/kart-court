export function caseReady(link, photoCount, busy = false) {
  if (busy || photoCount < 1) return false;
  try {
    const url = new URL(String(link).trim());
    return ['https:', 'http:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}
