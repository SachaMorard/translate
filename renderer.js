// UI Elements - Translation Mode
const translateTab = document.getElementById('translateTab');
const spellCheckTab = document.getElementById('spellCheckTab');
const translateMode = document.getElementById('translateMode');
const spellCheckMode = document.getElementById('spellCheckMode');

// Translation elements
const sourceText = document.getElementById('sourceText');
const translationOutput = document.getElementById('translationOutput');
const detectedLangBadge = document.getElementById('detectedLangBadge');
const targetLangBadge = document.getElementById('targetLangBadge');
const sourceCount = document.getElementById('sourceCount');
const targetCount = document.getElementById('targetCount');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');
const copyTranslationBtn = document.getElementById('copyTranslationBtn');

// Spell check elements
const spellCheckInput = document.getElementById('spellCheckInput');
const spellCheckOutput = document.getElementById('spellCheckOutput');
const spellCheckInputCount = document.getElementById('spellCheckInputCount');
const spellCheckOutputCount = document.getElementById('spellCheckOutputCount');
const spellCheckLoading = document.getElementById('spellCheckLoading');
const spellCheckError = document.getElementById('spellCheckError');
const copySpellCheckBtn = document.getElementById('copySpellCheckBtn');

// State
let debounceTimer = null;
const DEBOUNCE_DELAY = 1000; // 1 second
let currentMode = 'translate';

// Language display names
const LANG_NAMES = {
  'fr': 'French',
  'en': 'English'
};

// Initialize
function init() {
  // Event listeners - Mode tabs
  translateTab.addEventListener('click', () => switchMode('translate'));
  spellCheckTab.addEventListener('click', () => switchMode('spellcheck'));

  // Event listeners - Translation
  sourceText.addEventListener('input', handleTranslationInput);
  copyTranslationBtn.addEventListener('click', copyTranslationResult);

  // Event listeners - Spell check
  spellCheckInput.addEventListener('input', handleSpellCheckInput);
  copySpellCheckBtn.addEventListener('click', copySpellCheckResult);
}

function switchMode(mode) {
  if (mode === 'translate') {
    currentMode = 'translate';
    translateTab.classList.add('active');
    spellCheckTab.classList.remove('active');
    translateMode.classList.add('active');
    spellCheckMode.classList.remove('active');
  } else {
    currentMode = 'spellcheck';
    spellCheckTab.classList.add('active');
    translateTab.classList.remove('active');
    spellCheckMode.classList.add('active');
    translateMode.classList.remove('active');
  }
}

// ========== TRANSLATION MODE ==========

function handleTranslationInput() {
  const text = sourceText.value;
  updateCharCount(sourceCount, text);

  // Clear previous timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // If text is empty, clear output
  if (text.trim().length === 0) {
    showTranslationPlaceholder();
    updateCharCount(targetCount, '');
    hideLanguageBadges();
    copyTranslationBtn.classList.add('hidden');
    return;
  }

  // Debounce translation
  debounceTimer = setTimeout(() => {
    performAutoTranslation(text);
  }, DEBOUNCE_DELAY);
}

async function performAutoTranslation(text) {
  showTranslationLoading();
  hideTranslationError();

  try {
    const result = await window.electronAPI.autoTranslate(text);

    if (result.success) {
      showTranslation(result.translation);
      updateCharCount(targetCount, result.translation);
      showLanguageBadges(result.detectedLang, result.targetLang);
      copyTranslationBtn.classList.remove('hidden');
    } else {
      showTranslationError(result.error || 'Translation failed');
      showTranslationPlaceholder();
      hideLanguageBadges();
    }
  } catch (error) {
    showTranslationError('Translation failed: ' + error.message);
    showTranslationPlaceholder();
    hideLanguageBadges();
  } finally {
    hideTranslationLoading();
  }
}

function showLanguageBadges(sourceLang, targetLang) {
  detectedLangBadge.textContent = LANG_NAMES[sourceLang];
  detectedLangBadge.className = `lang-badge ${sourceLang === 'fr' ? 'french' : 'english'}`;
  detectedLangBadge.classList.remove('hidden');

  targetLangBadge.textContent = LANG_NAMES[targetLang];
  targetLangBadge.className = `lang-badge ${targetLang === 'fr' ? 'french' : 'english'}`;
  targetLangBadge.classList.remove('hidden');
}

function hideLanguageBadges() {
  detectedLangBadge.classList.add('hidden');
  targetLangBadge.classList.add('hidden');
}

function showTranslationLoading() {
  loadingIndicator.classList.remove('hidden');
  translationOutput.style.opacity = '0.5';
}

function hideTranslationLoading() {
  loadingIndicator.classList.add('hidden');
  translationOutput.style.opacity = '1';
}

function showTranslation(text) {
  translationOutput.textContent = text;
  translationOutput.querySelector('.placeholder')?.remove();
}

function showTranslationPlaceholder() {
  translationOutput.innerHTML = '<div class="placeholder">Translation will appear here automatically...</div>';
}

function showTranslationError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
}

function hideTranslationError() {
  errorMessage.classList.add('hidden');
}

async function copyTranslationResult() {
  const text = translationOutput.textContent;

  try {
    await navigator.clipboard.writeText(text);

    // Visual feedback
    const originalText = copyTranslationBtn.innerHTML;
    copyTranslationBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Copied!
    `;
    copyTranslationBtn.style.backgroundColor = '#4caf50';

    setTimeout(() => {
      copyTranslationBtn.innerHTML = originalText;
      copyTranslationBtn.style.backgroundColor = '#0066ff';
    }, 2000);
  } catch (error) {
    console.error('Failed to copy:', error);
    showTranslationError('Failed to copy to clipboard');
  }
}

// ========== SPELL CHECK MODE ==========

function handleSpellCheckInput() {
  const text = spellCheckInput.value;
  updateCharCount(spellCheckInputCount, text);

  // Clear previous timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // If text is empty, clear output
  if (text.trim().length === 0) {
    showSpellCheckPlaceholder();
    updateCharCount(spellCheckOutputCount, '');
    copySpellCheckBtn.classList.add('hidden');
    return;
  }

  // Debounce spell check
  debounceTimer = setTimeout(() => {
    performSpellCheck(text);
  }, DEBOUNCE_DELAY);
}

async function performSpellCheck(text) {
  showSpellCheckLoading();
  hideSpellCheckError();

  try {
    const result = await window.electronAPI.spellCheck(text);

    if (result.success) {
      showSpellCheckResult(result.correctedText);
      updateCharCount(spellCheckOutputCount, result.correctedText);
      copySpellCheckBtn.classList.remove('hidden');

      // Highlight if there were changes
      if (result.correctedText !== text) {
        spellCheckOutput.style.backgroundColor = '#e8f5e9';
        setTimeout(() => {
          spellCheckOutput.style.backgroundColor = 'transparent';
        }, 1000);
      }
    } else {
      showSpellCheckError(result.error || 'Spell check failed');
      showSpellCheckPlaceholder();
    }
  } catch (error) {
    showSpellCheckError('Spell check failed: ' + error.message);
    showSpellCheckPlaceholder();
  } finally {
    hideSpellCheckLoading();
  }
}

function showSpellCheckLoading() {
  spellCheckLoading.classList.remove('hidden');
  spellCheckOutput.style.opacity = '0.5';
}

function hideSpellCheckLoading() {
  spellCheckLoading.classList.add('hidden');
  spellCheckOutput.style.opacity = '1';
}

function showSpellCheckResult(text) {
  spellCheckOutput.textContent = text;
  spellCheckOutput.querySelector('.placeholder')?.remove();
}

function showSpellCheckPlaceholder() {
  spellCheckOutput.innerHTML = '<div class="placeholder">Corrected text will appear here...</div>';
  copySpellCheckBtn.classList.add('hidden');
}

function showSpellCheckError(message) {
  spellCheckError.textContent = message;
  spellCheckError.classList.remove('hidden');
}

function hideSpellCheckError() {
  spellCheckError.classList.add('hidden');
}

async function copySpellCheckResult() {
  const text = spellCheckOutput.textContent;

  try {
    await navigator.clipboard.writeText(text);

    // Visual feedback
    const originalText = copySpellCheckBtn.innerHTML;
    copySpellCheckBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Copied!
    `;
    copySpellCheckBtn.style.backgroundColor = '#4caf50';

    setTimeout(() => {
      copySpellCheckBtn.innerHTML = originalText;
      copySpellCheckBtn.style.backgroundColor = '#0066ff';
    }, 2000);
  } catch (error) {
    console.error('Failed to copy:', error);
    showSpellCheckError('Failed to copy to clipboard');
  }
}

// ========== SHARED UTILITIES ==========

function updateCharCount(element, text) {
  const count = text.length;
  element.textContent = `${count} character${count !== 1 ? 's' : ''}`;
}

// Initialize app
init();
