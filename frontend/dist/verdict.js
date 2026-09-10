export function verdictFor(choice) {
  if (choice === 'yes') return { title: 'Purchase approved!', text: 'This court finds you guilty of excellent taste. Your wallet is sentenced to community service. Case closed!', label: 'You chose to buy' };
  if (choice === 'no') return { title: 'Purchase dismissed!', text: 'This court acquits your wallet of all charges. The product is sentenced to remain in somebody else’s cart. Case closed!', label: 'You chose to pass' };
  throw new Error('Choose yes or no.');
}
export function createVerdict({ scene, panel, title, text, label, done }) {
  let speech;
  function reset() {
    if (speech) window.speechSynthesis?.cancel();
    speech = null;
    panel.hidden = true;
    scene.classList.remove('verdict-active');
  }
  function show(choice) {
    const verdict = verdictFor(choice);
    reset();
    title.textContent = verdict.title;
    text.textContent = verdict.text;
    label.textContent = verdict.label;
    panel.hidden = false;
    scene.classList.add('verdict-active');
    done.focus({ preventScroll: true });
    if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      speech = new SpeechSynthesisUtterance(`${verdict.title} ${verdict.text}`);
      speech.rate = 0.9;
      window.speechSynthesis.speak(speech);
    }
  }
  return { show, reset };
}
