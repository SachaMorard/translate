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

    try {
      const response = await this.client.send({
        model: this.model,
        input: {
          messages: [
            {
              role: 'system',
              content: 'You are a professional translator between English and French. Your job is to detect the source language of the given text and then translate it into the opposite target language. A French text becomes an English text and an English text becomes a French text.\n\nGuidelines:\n- Produce a faithful and accurate translation that preserves the original meaning.\n- Maintain the tone and register of the source text (formal, casual, technical, etc.).\n- When possible, improve clarity and phrasing in the target language rather than translating word-for-word. The result should read naturally, as if originally written in the target language.\n- Do not add, remove, or reinterpret information.\n- Return only the translated text, with no explanations, comments, or annotations.'
            },
            {
              role: 'user',
              content: text
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

    const prompt = `Correct the following text. Detect whether it is written in English or French, and return the corrected version in that same language.

Text to correct:
${text}`;

    try {
      const response = await this.client.send({
        model: this.model,
        input: {
          messages: [
            {
              role: 'system',
              content: 'You are a proofreader for English and French texts. Your job is to:\n1. Fix all spelling, grammar, and punctuation errors.\n2. Rephrase sentences that are awkward or unclear to make them easier to understand.\n\nConstraints:\n- Preserve the original language of the text (English or French).\n- Do not reorganize paragraphs, reorder ideas, or rewrite the overall structure.\n- Keep the original tone, intent, and meaning intact.\n- Only make changes where there is a genuine error or where the phrasing is confusing.\n- Return only the corrected text, with no explanations, comments, or annotations.'
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
