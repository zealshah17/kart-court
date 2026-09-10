import { createHearing } from './hearing.js';
const $ = (id) => document.getElementById(id);
const state = { name: 'Sage lounge chair', link: '', width: null, available: null, photos: [], notes: [] };
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4000); }
export function parseMeasurement(value) {
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(cm|centimeters?|centimetres?|in|inches?|inch|"|m|meters?|metres?|ft|feet|foot|')?$/i);
  if (!match) return null;
  const amount = Number(match[1]); const unit = (match[2] || 'cm').toLowerCase();
  const cm = amount * (/^(in|inch|inches|")$/.test(unit) ? 2.54 : /^(ft|feet|foot|')$/.test(unit) ? 30.48 : /^(m|meters?|metres?)$/.test(unit) ? 100 : 1);
  return cm > 0 && cm <= 10000 ? Math.round(cm * 100) / 100 : null;
}
function fit() { return state.available && state.width ? state.available >= state.width + 10 ? 'fits' : state.available >= state.width ? 'tight' : 'small' : 'unknown'; }
function renderFit() {
  $('exhibit-name').textContent = state.name;
  document.querySelector('.board').classList.add('updated');
  const result = fit(); const badge = $('fit-badge');
  badge.className = 'badge ' + (result === 'fits' ? 'resolved' : 'unresolved');
  badge.textContent = { fits: 'Fits', tight: 'Tight fit', small: 'Too wide', unknown: 'Unresolved' }[result];
  $('fit-subtitle').textContent = result === 'unknown' ? state.available ? 'Product width needed' : 'Measurements needed' : result === 'fits' ? 'Room to get comfortable' : result === 'tight' ? 'Allow more clearance' : 'Objection sustained';
  $('fit-description').textContent = state.available ? `${state.available} cm available${state.width ? ` · ${state.width} cm chair` : '. Add the chair’s width to compare.'}` : 'Check the available space in your room.';
}
function setMeasurement(value) {
  const cm = parseMeasurement(value);
  if (!cm) throw new Error('Enter a positive width, such as 110 cm or 44 in.');
  state.available = cm; $('measurement').value = String(value); $('measurement-feedback').textContent = `${cm} cm entered. ${state.width ? 'The evidence board has been updated.' : 'Add the chair’s width to check the fit.'}`; renderFit(); return { availableCm: cm, fit: fit() };
}
$('measurement').addEventListener('change', () => {
  if (!$('measurement').value.trim()) { state.available = null; $('measurement-feedback').textContent = ''; renderFit(); return; }
  try { setMeasurement($('measurement').value); } catch (error) { state.available = null; renderFit(); $('measurement-feedback').textContent = error.message; }
});
$('measurement').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); $('measurement').dispatchEvent(new Event('change')); } });
$('product-link').addEventListener('change', () => {
  const input = $('product-link'); const value = input.value.trim(); input.setCustomValidity('');
  if (!value) { state.link = ''; $('product-description').textContent = 'The chair in question.'; return; }
  try { const url = new URL(value); if (!['https:', 'http:'].includes(url.protocol)) throw new Error(); state.link = url.href; $('product-description').textContent = `Linked from ${url.hostname.replace(/^www\./, '')}`; toast('Product link added. Add its name and width to complete the evidence.'); }
  catch { state.link = ''; $('product-description').textContent = 'The chair in question.'; input.setCustomValidity('Enter a valid http or https product link.'); input.reportValidity(); }
});
$('product-link').addEventListener('input', () => $('product-link').setCustomValidity(''));
function changeEvidenceType() { for (const type of ['note','product','measurement']) $(`${type}-fields`).hidden = $('evidence-type').value !== type; $('form-error').textContent = ''; }
function openEvidence(type = 'note') { hearing.stop(); $('evidence-type').value = type; $('edit-name').value = state.name; $('chair-width').value = state.width || ''; $('edit-measurement').value = state.available ? `${state.available} cm` : ''; changeEvidenceType(); $('evidence-dialog').showModal(); }
$('evidence-type').addEventListener('change', changeEvidenceType);
$('add-evidence').addEventListener('click', () => openEvidence());
$('product-card').addEventListener('click', () => openEvidence('product'));
$('fit-card').addEventListener('click', () => state.available && !state.width ? openEvidence('product') : $('measurement').focus());
function addNote(title, body) {
  if (!title.trim() || !body.trim()) throw new Error('Add a title and a note for the court.');
  document.querySelector('.board').classList.add('updated');
  const note = { title: title.trim().slice(0,65), body: body.trim().slice(0,500) }; state.notes.push(note);
  const card = document.createElement('button'); card.type = 'button'; card.className = 'evidence-card';
  const copy = document.createElement('span'); copy.className = 'card-copy'; const heading = document.createElement('strong'); heading.textContent = note.title; const text = document.createElement('span'); text.textContent = note.body; copy.append(heading,text); card.append(copy);
  card.addEventListener('click', () => { $('verdict-title').textContent = note.title; $('verdict-body').textContent = note.body; document.querySelector('.arguments').hidden = true; $('resolve').textContent = 'Back to court'; $('resolve').dataset.action = 'close'; $('verdict-dialog').showModal(); });
  $('cards').append(card); card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return { added: true, title: note.title };
}
$('evidence-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const type = $('evidence-type').value;
    if (type === 'note') { addNote($('note-title').value, $('note-body').value); $('note-title').value = ''; $('note-body').value = ''; }
    if (type === 'product') { const name = $('edit-name').value.trim(); const raw = $('chair-width').value; const width = raw === '' ? null : Number(raw); if (!name) throw new Error('Enter the product’s name.'); if (width !== null && (!Number.isFinite(width) || width <= 0 || width > 1000)) throw new Error('Enter a chair width between 1 and 1000 cm.'); state.name = name; state.width = width; $('product-name').textContent = name; renderFit(); }
    if (type === 'measurement') setMeasurement($('edit-measurement').value);
    $('evidence-dialog').close(); toast('Evidence added to the court.');
  } catch (error) { $('form-error').textContent = error.message; }
});
for (const close of document.querySelectorAll('dialog .close')) close.addEventListener('click', () => close.closest('dialog').close());
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', (event) => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
$('upload-trigger').addEventListener('click', () => $('room-photos').click());
$('room-card').addEventListener('click', () => $('room-photos').click());
$('room-photos').addEventListener('change', async (event) => {
  const files = Array.from(event.target.files || []); if (!files.length) return;
  const valid = files.filter(file => ['image/png','image/jpeg','image/webp'].includes(file.type) && file.size <= 10 * 1024 * 1024).slice(0,5);
  if (!valid.length) { toast('Choose PNG, JPG, or WebP images under 10 MB.'); event.target.value = ''; return; }
  const loaded = [];
  for (const file of valid) { const url = URL.createObjectURL(file); const img = new Image(); img.src = url; try { await img.decode(); loaded.push({ name: file.name, url }); } catch { URL.revokeObjectURL(url); } }
  if (!loaded.length) { toast('These images could not be opened. Please choose another photo.'); return; }
  state.photos.forEach(photo => URL.revokeObjectURL(photo.url)); state.photos = loaded;
  document.querySelector('.board').classList.add('updated');
  const first = state.photos[0]; $('room-thumb').style.backgroundImage = `url("${first.url}")`; $('room-thumb').style.backgroundSize = 'cover'; $('room-thumb').style.backgroundPosition = 'center';
  $('room-name').textContent = 'Your room photos'; $('room-subtitle').textContent = `${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} added as evidence`; $('room-description').textContent = 'Review the colors, materials, and available space.';
  $('upload-trigger').textContent = `▧  ${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} added`;
  const image = new Image(); image.src = first.url; image.alt = `Your room: ${first.name}`; $('room-preview').replaceChildren(image); $('room-preview').hidden = false;
  toast(loaded.length === files.length ? 'Room photos entered into evidence.' : 'Valid photos added (up to 5, under 10 MB each).'); event.target.value = '';
});
function openVerdict(side) {
  const result = fit(); const title = { fits: 'Objection overruled — it fits!', tight: 'A close call, counselor.', small: 'Objection sustained!', unknown: 'The court needs more evidence.' }[result];
  $('verdict-title').textContent = side === 'angel' ? 'A case for getting cozy.' : title;
  $('verdict-body').textContent = { fits: `${state.name} fits in the measured space with at least 10 cm of clearance. Check depth, doorways, and walking room before deciding.`, tight: 'The chair fits the width, but leaves less than 10 cm of clearance. Check access and walking space.', small: 'The chair is wider than the available space. Consider a smaller chair or a different spot.', unknown: !state.available ? 'How wide is the available space? Add a room measurement and the chair’s actual width to hear the fit verdict.' : 'Your room measurement is on the record. Add the chair’s actual width from its product listing.' }[result];
  $('angel-case').textContent = state.photos.length ? 'Your room photos are on the board. Compare the chair’s color and texture with your existing furniture.' : 'The sage upholstery and warm wood in the example room make a cozy pairing.';
  $('devil-case').textContent = result === 'unknown' ? 'A good-looking chair still needs room. We cannot confirm fit without both measurements.' : `${state.available} cm of space − ${state.width} cm of chair = ${Math.round((state.available - state.width)*100)/100} cm of clearance.`;
  document.querySelector('.arguments').hidden = false; $('resolve').textContent = result === 'unknown' ? 'Add missing evidence' : 'Back to court'; $('resolve').dataset.action = result === 'unknown' ? 'evidence' : 'close'; $('verdict-dialog').showModal();
}
const scene = document.querySelector('.scene');
const hearing = createHearing({
  onLine(line) {
    document.body.classList.add('court-conversation');
    scene.classList.add('hearing'); scene.dataset.speaker = line.speaker;
    for (const side of ['angel', 'devil']) {
      const speaking = side === line.speaker;
      $(side).hidden = !speaking;
      $(side).querySelector('span').textContent = speaking ? line.text : '';
      $(side).setAttribute('aria-label', speaking ? `${side}: ${line.text}` : `${side} is listening`);
    }
    $('hearing-announcement').textContent = `${line.speaker === 'angel' ? 'Angel' : 'Devil'}: ${line.text} Click anywhere, or press Enter or Space, to continue.`;
  },
  onPause(paused) { scene.classList.toggle('hearing-paused', paused); },
  onEnd(completed) {
    document.body.classList.remove('court-conversation');
    scene.classList.remove('hearing', 'hearing-paused'); delete scene.dataset.speaker;
    for (const side of ['angel', 'devil']) {
      $(side).hidden = true;
      $(side).querySelector('span').textContent = '';
      $(side).removeAttribute('aria-label');
    }
    $('hearing-announcement').textContent = '';
    if (completed) openVerdict();
  },
});
function startHearing(first = 'angel') {
  if (hearing.active) return;
  const result = fit();
  const angelOpening = state.photos.length ? 'Room photos! Let’s compare the colors.' : 'Sage and warm wood look cozy together!';
  const devilOpening = 'Objection! Looking good isn’t enough.';
  const angelReply = result === 'fits' ? 'The measurements leave room to spare!' : result === 'unknown' ? 'Let’s get the measurements on record.' : 'Could another spot work for this chair?';
  const devilReply = result === 'unknown' ? !state.available ? 'How wide is the space? We need a number.' : 'Now we need the chair’s actual width.' : result === 'fits' ? 'Width checks out. Check depth and access!' : result === 'tight' ? 'Too tight! Allow 10 cm of clearance.' : 'It’s wider than the space. Objection!';
  const opening = [{ speaker: 'angel', text: angelOpening }, { speaker: 'devil', text: devilOpening }];
  if (first === 'devil') opening.reverse();
  const replies = { angel: angelReply, devil: devilReply };
  hearing.start([...opening, ...opening.map(line => ({ speaker: line.speaker, text: replies[line.speaker] }))]);
}
$('objection').addEventListener('click', () => startHearing());
for (const side of ['angel', 'devil']) $(`${side}-character`).addEventListener('click', () => startHearing(side));
// Capture before app buttons so a dialogue click never also opens a form.
// The initiating click reaches its target normally because no hearing is active yet.
document.addEventListener('pointerdown', event => {
  if (hearing.active && event.button === 0 && !event.target.closest('dialog')) event.preventDefault();
}, true);
document.addEventListener('click', event => {
  if (!hearing.active || event.target.closest('dialog')) return;
  event.preventDefault(); event.stopImmediatePropagation(); hearing.next();
}, true);
document.addEventListener('keydown', event => {
  if (!hearing.active || event.target.closest('dialog') || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (!event.repeat) hearing.next();
}, true);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && hearing.active) { hearing.stop(); $('objection').focus(); } });
document.addEventListener('visibilitychange', () => hearing.pause(document.hidden));
// Editing evidence cancels the old case so its pending verdict cannot interrupt a form.
for (const id of ['measurement', 'product-link', 'upload-trigger', 'room-card', 'cards']) {
  $(id).addEventListener('focusin', () => hearing.stop());
  $(id).addEventListener('click', () => hearing.stop());
}
window.addEventListener('pagehide', () => hearing.stop());
$('resolve').addEventListener('click', () => { $('verdict-dialog').close(); if ($('resolve').dataset.action === 'evidence') { if (!state.available) $('measurement').focus(); else openEvidence('product'); } });
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  Promise.resolve(document.modelContext.registerTool({ name: 'record_room_measurement', description: 'Record the available width and update the visible furniture fit evidence.', inputSchema: { type: 'object', properties: { measurement: { type: 'string' } }, required: ['measurement'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input) { if (typeof input?.measurement !== 'string') throw new Error('A measurement string is required.'); return setMeasurement(input.measurement); } }, { signal: lifecycle.signal })).catch(() => {});
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
