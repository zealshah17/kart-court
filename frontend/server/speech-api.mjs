import './env.mjs';
export function createSpeechHandler({ fetchImpl = fetch, apiKey = () => process.env.OPENAI_API_KEY } = {}) {
  const cache = new Map();
  let active = 0;
  return async (req, res) => {
    const send = (status, error) => { if (!res.destroyed) res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ error })); };
    if (req.method !== 'POST') return send(405, 'Use POST for voice generation.');
    try { if (new URL(req.headers.origin).host !== req.headers.host || req.headers['sec-fetch-site'] === 'cross-site') return send(403, 'Play voices from the Product Court page.'); }
    catch { return send(403, 'Play voices from the Product Court page.'); }
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return send(415, 'Send JSON.');
    let body = '';
    try {
      for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 4096) return send(413, 'Voice request is too large.'); }
    } catch { return; }
    let input;
    try { input = JSON.parse(body); } catch { return send(400, 'Invalid voice request.'); }
    if (!['angel', 'devil'].includes(input?.speaker) || typeof input.text !== 'string' || !input.text.trim() || input.text.length > 600) return send(400, 'Provide a speaker and an argument under 600 characters.');
    const key = JSON.stringify([input.speaker, input.text]);
    const audio = bytes => { if (!res.destroyed) res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': bytes.length, 'Cache-Control': 'no-store' }).end(bytes); };
    if (cache.has(key)) return audio(cache.get(key));
    if (!apiKey()?.trim()) return send(503, 'Add OPENAI_API_KEY to the project .env to generate voices.');
    if (active >= 2) return send(429, 'Voice generation is busy. Please retry shortly.');
    active++;
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    try {
      const response = await fetchImpl('https://api.openai.com/v1/audio/speech', {
        method: 'POST', redirect: 'error',
        headers: { Authorization: `Bearer ${apiKey().trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: input.speaker === 'angel' ? 'coral' : 'onyx', input: input.text,
          instructions: input.speaker === 'angel' ? 'Perform as Angel, a fierce, persuasive trial lawyer delivering a closing argument. Use a bright, commanding voice with controlled courtroom aggression, conviction, and urgency. Attack weak reasoning with crisp consonants and decisive emphasis on the strongest evidence. Build momentum, pause briefly before the key point, and land the final sentence firmly. Sound passionate and protective of your case, addressing a jury. Keep the words clear and natural; do not scream, add words, or sound like a friendly narrator.' : 'Perform as Devil, a relentless opposing trial lawyer in a heated cross-examination. Use a low, commanding voice with controlled aggression, piercing skepticism, and biting confidence. Deliver short phrases with clipped precision, stress contradictions and weaknesses, and use pointed pauses before the decisive challenge. Questions should sound prosecutorial; final statements should land like a verdict. Sound intensely competitive and confrontational while remaining articulate. Do not scream, growl, add words, or slip into a cartoon villain voice.', response_format: 'mp3' }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]),
      });
      if (!response.ok) {
        await response.body?.cancel();
        return send(502, response.status === 429 ? 'Voice API quota or rate limit reached.' : [401, 403].includes(response.status) ? 'The API key does not have access to voice generation.' : `Voice generation failed (HTTP ${response.status}).`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 2_000_000 || !response.headers.get('content-type')?.startsWith('audio/')) return send(502, 'Voice generation returned invalid audio.');
      if (cache.size >= 32) cache.delete(cache.keys().next().value);
      cache.set(key, bytes); audio(bytes);
    } catch { send(502, 'Could not generate voice audio. Check the connection and retry.'); }
    finally { active--; res.off('close', cancel); }
  };
}
