import { LANGUAGES } from './languages.js';
import { AudioController } from './audio-renderer.js';
const $ = id => document.getElementById(id);
const names = { ...LANGUAGES, other: 'Other' };
let pair = ['fr', 'en'];
let savingPair = false;
let audioLocked = false;
let settingsReady = false;
let translationVersion = 0;
let spellingVersion = 0;
let translationTimer;
let spellingTimer;

function error(id, message = '') {
  $(id).textContent = message;
  $(id).classList.toggle('hidden', !message);
}
function count(id, text) { $(id).textContent = `${text.length} characters`; }
function lockLanguages() {
  for (const id of ['languageA', 'languageB']) $(id).disabled = audioLocked || savingPair || !settingsReady;
  $('startAudio').disabled = audioLocked || savingPair || !settingsReady;
}
const audio = new AudioController(locked => { audioLocked = locked; lockLanguages(); });
for (const [tab, mode] of [['translateTab','translateMode'], ['spellCheckTab','spellCheckMode'], ['audioTab','audioMode']]) {
  $(tab).addEventListener('click', () => {
    document.querySelectorAll('.mode-tab, .mode-content').forEach(el => el.classList.remove('active'));
    $(tab).classList.add('active'); $(mode).classList.add('active');
  });
}
for (const id of ['languageA', 'languageB']) {
  for (const [code, name] of Object.entries(LANGUAGES)) $(id).add(new Option(name, code));
  $(id).addEventListener('change', savePair);
}
function displayPair() { $('languageA').value = pair[0]; $('languageB').value = pair[1]; }
async function savePair() {
  const next = [$('languageA').value, $('languageB').value];
  if (next[0] === next[1]) {
    error('settingsError', 'Choose two different languages.'); displayPair(); return;
  }
  savingPair = true; lockLanguages();
  // Invalidate requests made with the previous pair before the setting is saved.
  ++translationVersion; clearTimeout(translationTimer);
  try {
    const result = await window.electronAPI.setLanguagePair(next);
    if (!result.success) throw new Error(result.error);
    pair = result.pair; error('settingsError');
  } catch (e) { error('settingsError', e.message); }
  finally { displayPair(); savingPair = false; lockLanguages(); scheduleTranslation(); }
}
function clearTranslation() {
  $('translationOutput').textContent = '';
  count('targetCount', '');
  for (const id of ['copyTranslationBtn', 'swapTranslationBtn', 'detectedLangBadge', 'targetLangBadge']) $(id).classList.add('hidden');
}
function scheduleTranslation({ immediate = false } = {}) {
  const version = ++translationVersion;
  clearTimeout(translationTimer);
  const text = $('sourceText').value;
  count('sourceCount', text); error('errorMessage');
  $('loadingIndicator').classList.add('hidden');
  clearTranslation();
  if (!text.trim() || !settingsReady || savingPair) return;
  translationTimer = setTimeout(async () => {
    $('loadingIndicator').classList.remove('hidden');
    try {
      const result = await window.electronAPI.autoTranslate(text);
      if (version !== translationVersion) return;
      if (!result.success) throw new Error(result.error);
      $('translationOutput').textContent = result.translation;
      count('targetCount', result.translation);
      $('detectedLangBadge').textContent = names[result.detectedLang];
      $('targetLangBadge').textContent = names[result.targetLang];
      for (const id of ['copyTranslationBtn','swapTranslationBtn','detectedLangBadge','targetLangBadge']) $(id).classList.remove('hidden');
    } catch (e) { if (version === translationVersion) error('errorMessage', e.message); }
    finally { if (version === translationVersion) $('loadingIndicator').classList.add('hidden'); }
  }, immediate ? 0 : 700);
}
$('sourceText').addEventListener('input', scheduleTranslation);
$('swapTranslationBtn').addEventListener('click', () => {
  const translation = $('translationOutput').textContent;
  if (!settingsReady || savingPair || !translation.trim() || $('swapTranslationBtn').classList.contains('hidden')) return;
  $('sourceText').value = translation;
  $('sourceText').focus();
  $('sourceText').scrollTop = 0;
  scheduleTranslation({ immediate: true });
});
$('spellCheckInput').addEventListener('input', () => {
  const version = ++spellingVersion;
  clearTimeout(spellingTimer);
  const text = $('spellCheckInput').value;
  count('spellCheckInputCount', text); count('spellCheckOutputCount', '');
  error('spellCheckError'); $('spellCheckOutput').textContent = '';
  $('copySpellCheckBtn').classList.add('hidden'); $('spellCheckLoading').classList.add('hidden');
  if (!text.trim()) return;
  spellingTimer = setTimeout(async () => {
    $('spellCheckLoading').classList.remove('hidden');
    try {
      const result = await window.electronAPI.spellCheck(text);
      if (version !== spellingVersion) return;
      if (!result.success) throw new Error(result.error);
      $('spellCheckOutput').textContent = result.correctedText;
      count('spellCheckOutputCount', result.correctedText);
      $('copySpellCheckBtn').classList.remove('hidden');
    } catch (e) { if (version === spellingVersion) error('spellCheckError', e.message); }
    finally { if (version === spellingVersion) $('spellCheckLoading').classList.add('hidden'); }
  }, 700);
});
for (const [button, output, errorId] of [['copyTranslationBtn','translationOutput','errorMessage'], ['copySpellCheckBtn','spellCheckOutput','spellCheckError']]) {
  $(button).addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($(output).textContent);
      $(button).textContent = 'Copied!';
      setTimeout(() => { $(button).textContent = 'Copy'; }, 1500);
    } catch { error(errorId, 'Could not copy to clipboard.'); }
  });
}
displayPair(); lockLanguages();
try {
  const settings = await window.electronAPI.getSettings();
  pair = settings.pair; displayPair(); settingsReady = true; lockLanguages();
  if (!settings.audioConfigured) audio.showError('Add OPENAI_API_KEY to .env and restart the app to enable live audio.');
  scheduleTranslation();
} catch (e) { error('settingsError', e.message); }
window.addEventListener('beforeunload', () => audio.dispose());
