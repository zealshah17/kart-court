import './env.mjs';

// Only import this module from server-side code, never from dist/.
// This check uses the models endpoint; it does not generate content.
export async function checkOpenAIConnection({ apiKey = process.env.OPENAI_API_KEY, fetchImpl = fetch } = {}) {
  const key = apiKey?.trim();
  if (!key) throw new Error('Add OPENAI_API_KEY to the project .env file first.');
  let response;
  try {
    response = await fetchImpl('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error('Could not reach OpenAI within 15 seconds. Check your internet connection and retry.');
  }
  // Do not echo upstream errors: they can include credential details.
  if (!response.ok) {
    const messages = {
      401: 'OpenAI rejected the API key. Check OPENAI_API_KEY in .env.',
      403: 'This key cannot list models. Check its project permissions.',
      429: 'OpenAI rate limit reached. Wait and retry.',
    };
    throw new Error(messages[response.status] || `OpenAI connection check failed (HTTP ${response.status}).`);
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('OpenAI returned an unreadable response. Retry the connection check.'); }
  if (!Array.isArray(data.data)) throw new Error('OpenAI returned an unexpected response. Retry the connection check.');
  return { connected: true };
}
