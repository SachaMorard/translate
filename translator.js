import Edgee from 'edgee';
import dotenv from 'dotenv';

dotenv.config();

class Translator {
  constructor() {
    this.client = new Edgee({
      apiKey: process.env.EDGEE_API_KEY,
    });
    this.model = process.env.EDGEE_MODEL || 'claude-sonnet-4.5';
  }

  /**
   * Detect if text is French or English using simple heuristics
   * @param {string} text - Text to analyze
   * @returns {string} - 'fr' or 'en'
   */
  detectLanguage(text) {
    if (!text || text.trim().length === 0) {
      return 'en';
    }

    // French-specific characters
    const frenchChars = /[àâäæçéèêëïîôùûüÿœ]/i;

    // French common words
    const frenchWords = /\b(le|la|les|un|une|des|et|est|dans|pour|avec|sur|par|plus|comme|mais|ou|où|ce|qui|que|sont|ont|être|avoir)\b/i;

    // English common words
    const englishWords = /\b(the|is|are|and|or|in|on|at|to|for|with|from|by|about|as|this|that|these|those|be|have|has)\b/i;

    let frenchScore = 0;
    let englishScore = 0;

    // Check for French-specific characters (strong indicator)
    if (frenchChars.test(text)) {
      frenchScore += 3;
    }

    // Count common words
    const frenchMatches = text.match(new RegExp(frenchWords, 'gi'));
    const englishMatches = text.match(new RegExp(englishWords, 'gi'));

    frenchScore += frenchMatches ? frenchMatches.length : 0;
    englishScore += englishMatches ? englishMatches.length : 0;

    return frenchScore > englishScore ? 'fr' : 'en';
  }

  /**
   * Translate text from source language to target language
   * @param {string} text - Text to translate
   * @param {string} sourceLang - Source language code ('fr' or 'en')
   * @param {string} targetLang - Target language code ('fr' or 'en')
   * @returns {Promise<string>} - Translated text
   */
  async translate(text, sourceLang, targetLang) {
    if (!text || text.trim().length === 0) {
      return '';
    }

    const langNames = {
      'fr': 'French',
      'en': 'English'
    };

    const prompt = `Translate the following ${langNames[sourceLang]} text to ${langNames[targetLang]}.

Text to translate:
${text}`;

    try {
      const response = await this.client.send({
        model: this.model,
        input: {
          messages: [
            {
              role: 'system',
              content: 'You are a translator. You are given a text in a source language and you need to translate it to a target language. You must translate the text as accurately as possible, finding the most accurate version of the text in the target language. You are only allowed to return the translation, no explanations or additional text.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          tags: ['translation']
        }
      });

      const translation = response.text?.trim() || '';
      return translation;
    } catch (error) {
      console.error('Translation error:', error);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  /**
   * Auto-detect language and translate to opposite language
   * @param {string} text - Text to translate
   * @returns {Promise<{translation: string, detectedLang: string, targetLang: string}>}
   */
  async autoTranslate(text) {
    const detectedLang = this.detectLanguage(text);
    const targetLang = detectedLang === 'fr' ? 'en' : 'fr';
    const translation = await this.translate(text, detectedLang, targetLang);

    return {
      translation,
      detectedLang,
      targetLang
    };
  }

  /**
   * Spell check and correct text
   * @param {string} text - Text to spell check
   * @returns {Promise<string>} - Corrected text
   */
  async spellCheck(text) {
    if (!text || text.trim().length === 0) {
      return '';
    }

    const prompt = `Check the following text for spelling, grammar, and punctuation errors. If the text is already correct, return it as-is.

Text to check:
${text}`;

    try {
      const response = await this.client.send({
        model: this.model,
        input: {
          messages: [
            {
              role: 'system',
              content: 'You are a spell checker. You are given a text and you need to check it for spelling, grammar, and punctuation errors. You are only allowed to return the corrected text, no explanations or additional text.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          tags: ['translation']
        }        
      });

      const correctedText = response.text?.trim() || text;
      return correctedText;
    } catch (error) {
      console.error('Spell check error:', error);
      throw new Error(`Spell check failed: ${error.message}`);
    }
  }
}

export default Translator;
