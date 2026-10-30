export const LANGUAGES = Object.freeze({ fr: 'French', en: 'English', es: 'Spanish', pt: 'Portuguese' });
export const DEFAULT_PAIR = Object.freeze(['fr', 'en']);

export function validatePair(pair) {
  if (!Array.isArray(pair) || pair.length !== 2 || pair[0] === pair[1] ||
      !pair.every(code => Object.hasOwn(LANGUAGES, code))) {
    throw new Error('Choose two different languages: French, English, Spanish or Portuguese.');
  }
  return [...pair];
}
