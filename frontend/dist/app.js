import { caseReady } from './case-ready.js';
import { evidenceCards } from './evidence.js';
import { createHearing } from './hearing.js';
const $ = (id) => document.getElementById(id);
const state = { name: '', link: '', width: null, available: null, photos: [], notes: [] };
let caseData = null;
let toastTimer;
let generatedConversation = null;
let generating = false;
let generationController;
function updateTestButton() {
  const ready = caseReady($('product-link').value, state.photos.length, generating);
  $('test-case').disabled = !ready;
  if (!caseData && !generating) {
    $('board-summary').textContent = !$('product-link').value.trim()
      ? 'Add an Amazon product link to start your case.'
      : state.photos.length < 1 ? 'Link entered. Add a room photo to enable Test case.'
      : ready ? 'Ready. Click Test case to look up your product.' : 'Enter a valid product link to continue.';
  }
  $('test-case').title = ready ? 'Look up your Amazon product and generate its case' : generating ? 'Generating conversation…' : 'Add an Amazon product link and a room photo first';
}
function toast(message, duration = 4000) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, duration); }
export function parseMeasurement(value) {
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(cm|centimeters?|centimetres?|in|inches?|inch|"|m|meters?|metres?|ft|feet|foot|')?$/i);
  if (!match) return null;
  const amount = Number(match[1]); const unit = (match[2] || 'cm').toLowerCase();
  const cm = amount * (/^(in|inch|inches|")$/.test(unit) ? 2.54 : /^(ft|feet|foot|')$/.test(unit) ? 30.48 : /^(m|meters?|metres?)$/.test(unit) ? 100 : 1);
  return cm > 0 && cm <= 10000 ? Math.round(cm * 100) / 100 : null;
}
function fit() { return state.available && state.width ? state.available >= state.width + 10 ? 'fits' : state.available >= state.width ? 'tight' : 'small' : 'unknown'; }
function showDetail(card) {
  hearing.stop();
  $('verdict-title').textContent = card.title;
  $('verdict-body').textContent = card.detail || card.body;
  document.querySelector('.arguments').hidden = true;
  $('resolve').textContent = 'Back to court'; $('resolve').dataset.action = 'close';
  $('verdict-dialog').showModal();
}
function renderFit() {
  $('exhibit-name').textContent = caseData ? state.name : '';
  $('exhibit-name').hidden = !caseData;
  $('exhibit-name').title = caseData ? state.name : '';
  const cards = evidenceCards({ ...state, product: caseData?.product, dimensions: caseData?.dimensions, conversation: generatedConversation });
  $('cards').replaceChildren();
  $('board-summary').textContent = cards.length ? `${cards.length} evidence cards · Select a card to explore` : 'Your case evidence will appear here.';
  for (const item of cards) {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'case-card';
    const label = document.createElement('span'); label.className = 'case-card-label'; label.textContent = item.label;
    const title = document.createElement('strong'); title.textContent = item.title;
    const body = document.createElement('span'); body.className = 'case-card-body'; body.textContent = item.body;
    if (item.label === 'Product' && caseData?.imageUrl) {
      try {
        const raw = caseData.imageUrl.match(/^\[.*\]\((https?:\/\/[^\s]+)\)$/)?.[1] || caseData.imageUrl;
        const url = new URL(raw);
        if (url.protocol === 'https:' && ['m.media-amazon.com', 'images-na.ssl-images-amazon.com', 'images-eu.ssl-images-amazon.com'].includes(url.hostname)) item.image = url.href;
      } catch {}
    }
    if (item.image) { const image = new Image(); image.src = item.image; image.alt = item.title; card.append(image); }
    card.append(label, title, body);
    card.addEventListener('click', () => {
      if (item.action === 'product' || item.action === 'measurement') openEvidence(item.action);
      else if (item.action === 'note') { openEvidence('note'); $('note-title').value = item.title.slice(0,65); }
      else showDetail(item);
    });
    $('cards').append(card);
  }
}
function setMeasurement(value) {
  const cm = parseMeasurement(value);
  if (!cm) throw new Error('Enter a positive width, such as 110 cm or 44 in.');
  state.available = cm; renderFit(); return { availableCm: cm, fit: fit() };
}
$('product-link').addEventListener('change', () => {
  const input = $('product-link'); const value = input.value.trim(); input.setCustomValidity('');
  if (!value) { state.link = '';  return; }
  try { const url = new URL(value); if (!['https:', 'http:'].includes(url.protocol)) throw new Error(); state.link = url.href;  toast('Link ready. Click Test case to look up this product.'); }
  catch { state.link = '';  input.setCustomValidity('Enter a valid http or https product link.'); input.reportValidity(); }
});
$('product-link').addEventListener('input', () => { $('product-link').setCustomValidity(''); updateTestButton(); });
function changeEvidenceType() { for (const type of ['note','product','measurement']) $(`${type}-fields`).hidden = $('evidence-type').value !== type; $('form-error').textContent = ''; }
function openEvidence(type = 'note') { hearing.stop(); $('evidence-type').value = type; $('edit-name').value = state.name; $('chair-width').value = state.width || ''; $('edit-measurement').value = state.available ? `${state.available} cm` : ''; changeEvidenceType(); $('evidence-dialog').showModal(); }
$('evidence-type').addEventListener('change', changeEvidenceType);
$('add-evidence').addEventListener('click', () => openEvidence());
function addNote(title, body) {
  if (!title.trim() || !body.trim()) throw new Error('Add a title and a note for the court.');
  state.notes.push({ title: title.trim().slice(0,65), body: body.trim().slice(0,500) });
  renderFit(); return { added: true, title: title.trim() };
}
$('evidence-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const type = $('evidence-type').value;
    if (type === 'note') { addNote($('note-title').value, $('note-body').value); $('note-title').value = ''; $('note-body').value = ''; }
    if (type === 'product') { const name = $('edit-name').value.trim(); const raw = $('chair-width').value; const width = raw === '' ? null : Number(raw); if (!name) throw new Error('Enter the product’s name.'); if (width !== null && (!Number.isFinite(width) || width <= 0 || width > 1000)) throw new Error('Enter a chair width between 1 and 1000 cm.'); state.name = name; state.width = width;  renderFit(); }
    if (type === 'measurement') setMeasurement($('edit-measurement').value);
    $('evidence-dialog').close(); toast('Evidence added to the court.');
  } catch (error) { $('form-error').textContent = error.message; }
});
for (const close of document.querySelectorAll('dialog .close')) close.addEventListener('click', () => close.closest('dialog').close());
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', (event) => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
$('upload-trigger').addEventListener('click', () => $('room-photos').click());

$('room-photos').addEventListener('change', async (event) => {
  const files = Array.from(event.target.files || []); if (!files.length) return;
  const valid = files.filter(file => ['image/png','image/jpeg','image/webp'].includes(file.type) && file.size <= 10 * 1024 * 1024).slice(0,5);
  if (!valid.length) { toast('Choose PNG, JPG, or WebP images under 10 MB.'); event.target.value = ''; return; }
  const loaded = [];
  for (const file of valid) { const url = URL.createObjectURL(file); const img = new Image(); img.src = url; try { await img.decode(); loaded.push({ name: file.name, url }); } catch { URL.revokeObjectURL(url); } }
  if (!loaded.length) { toast('These images could not be opened. Please choose another photo.'); return; }
  state.photos.forEach(photo => URL.revokeObjectURL(photo.url)); state.photos = loaded; updateTestButton();
  document.querySelector('.board').classList.add('updated');
  const first = state.photos[0]; renderFit();
  $('upload-trigger').textContent = `▧  ${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} added`;
  const image = new Image(); image.src = first.url; image.alt = `Your room: ${first.name}`; $('room-preview').replaceChildren(image); $('room-preview').hidden = false;
  toast(loaded.length === files.length ? 'Room photos entered into evidence.' : 'Valid photos added (up to 5, under 10 MB each).'); event.target.value = '';
});
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
    if (completed && generatedConversation) {
      $('verdict-title').textContent = 'The court needs your verdict.';
      $('verdict-body').textContent = generatedConversation.missingEvidence.length
        ? 'Still to check: ' + generatedConversation.missingEvidence.join('; ')
        : 'Review the evidence before deciding.';
      document.querySelector('.arguments').hidden = true;
      $('resolve').textContent = 'Back to court'; $('resolve').dataset.action = 'close';
      $('verdict-dialog').showModal();
    }
  },
});
function startHearing() {
  if (hearing.active || generating) return;
  if (!generatedConversation) { toast('Click Test case to look up your product and generate dialogue.'); return; }
  hearing.start(generatedConversation.lines);
}
$('test-case').addEventListener('click', async () => {
  if (!caseReady($('product-link').value, state.photos.length, generating)) { updateTestButton(); return; }
  const productLink = $('product-link').value.trim();
  state.link = productLink;
  $('product-link').disabled = true;
  caseData = null;
  state.name = '';
  state.width = null;
  generating = true;
  hearing.stop();
  generatedConversation = null;
  $('objection').disabled = true;
  $('test-case').disabled = true;
  $('test-case').textContent = 'Creating case…';
  document.querySelector('.center-product').hidden = true;
  document.querySelector('.board').classList.add('empty');
  $('board-summary').textContent = 'Gathering evidence for the case…';
  generationController = new AbortController();
  let failureMessage = '';
  try {
    const response = await fetch('/api/product-case', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: productLink }), signal: AbortSignal.any([generationController.signal, AbortSignal.timeout(740000)]) });
    const data = await response.json().catch(() => { throw new Error('The API route is unavailable. Restart Product Court using Start Product Court.command.'); });
    if (!response.ok) throw new Error(data.error || 'Generation failed. Please retry.');
    caseData = data;
    generatedConversation = data.conversation;
    state.name = data.product.title;
    state.width = data.dimensions.widthCm;
    const oldProduct = document.querySelector('.center-product');
    oldProduct.hidden = true;
    oldProduct.removeAttribute('src');
    if (typeof data.spriteImage === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data.spriteImage)) {
      const center = new Image(); center.className = 'center-product test-product pixel-product';
      center.alt = `Pixel-art illustration of ${state.name}`; center.hidden = true;
      center.addEventListener('load', () => { center.hidden = false; }, { once: true });
      center.addEventListener('error', () => { center.hidden = true; toast('The pixel-art product could not be displayed.'); }, { once: true });
      oldProduct.replaceWith(center);
      center.src = data.spriteImage;
    }
    if (data.spriteError) toast(`Dialogue ready. ${data.spriteError}`, 12000);

    document.querySelector('.board').classList.remove('empty');
    renderFit();
    $('objection').disabled = false;
    hearing.start(generatedConversation.lines);
  } catch (error) {
    document.querySelector('.board').classList.remove('empty');
    renderFit();
    failureMessage = error.name === 'TimeoutError' ? 'Generation timed out. Try again.' : error.message;
    toast(failureMessage, 12000);
  } finally {
    generating = false;
    $('product-link').disabled = false;
    updateTestButton();
    $('test-case').textContent = 'Test again';
    if (failureMessage) $('board-summary').textContent = failureMessage;
  }
});
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
for (const id of ['product-link', 'upload-trigger', 'cards']) {
  $(id).addEventListener('focusin', () => hearing.stop());
  $(id).addEventListener('click', () => hearing.stop());
}
window.addEventListener('pagehide', () => { hearing.stop(); generationController?.abort(); });
$('resolve').addEventListener('click', () => { $('verdict-dialog').close(); if ($('resolve').dataset.action === 'evidence') { openEvidence('measurement'); } });
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  Promise.resolve(document.modelContext.registerTool({ name: 'record_room_measurement', description: 'Record the available width and update the visible furniture fit evidence.', inputSchema: { type: 'object', properties: { measurement: { type: 'string' } }, required: ['measurement'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input) { if (typeof input?.measurement !== 'string') throw new Error('A measurement string is required.'); return setMeasurement(input.measurement); } }, { signal: lifecycle.signal })).catch(() => {});
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}

renderFit();

updateTestButton();
