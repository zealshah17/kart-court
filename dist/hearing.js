// Dialogue advances only through explicit input; there are no autoplay timers.
export function createHearing({ onLine, onPause, onEnd }) {
  let lines = [], index = -1, paused = false;
  function stop(completed = false) { const active = index >= 0; index = -1; paused = false; if (active) onEnd(completed); }
  function next() { if (index < 0 || paused) return; index++; if (index >= lines.length) { stop(true); return; } onLine(lines[index], index, lines.length); }
  function pause(value = !paused) { if (index < 0) return; paused = value; onPause(paused); }
  return {
    start(nextLines) { stop(); if (!nextLines.length) return; lines = nextLines; index = 0; paused = false; onPause(false); onLine(lines[index], index, lines.length); },
    next, pause, stop,
    get active() { return index >= 0; },
  };
}
