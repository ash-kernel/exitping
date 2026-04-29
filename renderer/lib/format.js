/**
 * Converts a country code or emoji to a Flag CDN URL
 * Uses https://flagcdn.com/
 */
export function getFlagUrl(countryCode) {
  // If the input is 'IN', 'maa', or the emoji itself, 
  // we want to ensure we have a clean 2-letter code.
  // For this example, we'll map your specific IDs to country codes.
  const map = {
    'maa': 'in',
    'sin': 'sg',
    'fra': 'de',
    'nrt': 'jp',
    'lhr': 'gb'
  };

  const code = map[countryCode.toLowerCase()] || 'un'; // 'un' is a fallback globe
  return `https://flagcdn.com/w40/${code}.png`;
}