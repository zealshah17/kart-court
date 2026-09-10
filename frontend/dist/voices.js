// Generated MP3 speech uses a normal media element, independent of browser TTS.
export function createVoices({ audio = globalThis.document?.getElementById('voice-audio'), fetchImpl = globalThis.fetch, urlApi = URL, onError = () => {}, onStatus = () => {}, onPlayback = () => {} } = {}) {
  const supported = Boolean(audio);
  let enabled = supported, current = null, paused = false, revision = 0, controller = null;
  const cache = new Map();
  function cancel() {
    revision++; controller?.abort(); controller = null;
    onPlayback('stopped', current);
    if (audio) {
      audio.onplaying = audio.onended = audio.onerror = audio.onpause = audio.onwaiting = null;
      audio.pause(); audio.removeAttribute('src'); audio.load(); audio.hidden = true; }
  }
  async function play() {
    cancel();
    if (!current || paused) return;
    if (!enabled) { onPlayback('silent', current); return; }
    onPlayback('loading', current);
    const token = revision, line = current, key = JSON.stringify([line.speaker, line.text]);
    controller = new AbortController();
    onStatus('Generating voice…');
    try {
      let src = cache.get(key);
      if (!src) {
        const response = await fetchImpl('/api/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(line), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65000)]) });
        if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Voice generation failed.'); }
        const blob = await response.blob();
        if (token !== revision) return;
        if (!blob.size || !blob.type.startsWith('audio/')) throw new Error('The server returned no playable audio.');
        src = urlApi.createObjectURL(blob);
        if (cache.size >= 32) { const first = cache.keys().next().value; urlApi.revokeObjectURL(cache.get(first)); cache.delete(first); }
        cache.set(key, src);
      }
      if (token !== revision) return;
      audio.src = src; audio.hidden = false; audio.volume = 1; audio.muted = false;
      audio.onplaying = () => { if (token === revision) { onPlayback('playing', line); onStatus(`${line.speaker === 'angel' ? 'Angel' : 'Devil'} is speaking · AI voice`); } };
      audio.onpause = () => { if (token === revision) onPlayback('paused', line); };
      audio.onwaiting = () => { if (token === revision) { onPlayback('waiting', line); onStatus('Buffering voice…'); } };
      audio.onended = () => { if (token === revision) { onPlayback('ended', line); onStatus('Click to continue.'); } };
      audio.onerror = () => { if (token === revision) { onPlayback('error', line); onStatus('Audio could not play. Mute and unmute to retry.'); onError('Audio could not play. Mute and unmute to retry.'); } };
      onStatus('Ready to play.');
      try { await audio.play(); }
      catch { if (token === revision) { onPlayback('blocked', line); onStatus('Press Play to listen.'); } }
    } catch (error) {
      if (token !== revision) return;
      const message = error.name === 'TimeoutError' ? 'Voice generation timed out. Please retry.' : error.message;
      onPlayback('error', line); onStatus(message); onError(message);
    }
  }
  return {
    supported, get enabled() { return enabled; },
    speak(line) { current = line; return play(); },
    setEnabled(value) { enabled = supported && Boolean(value); const pending = play(); if (!enabled) onStatus('Voice muted.'); return pending; },
    pause(value) { paused = value; if (paused) cancel(); else return play(); },
    stop() { current = null; paused = false; cancel(); onStatus(''); },
    dispose() { current = null; cancel(); for (const src of cache.values()) urlApi.revokeObjectURL(src); cache.clear(); },
  };
}
