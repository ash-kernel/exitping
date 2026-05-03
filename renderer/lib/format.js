export function getFlagUrl(countryCode) {
  const map = {
    'maa': 'in',
    'sin': 'sg',
    'fra': 'de',
    'nrt': 'jp',
    'lhr': 'gb'
  };
  const code = map[countryCode.toLowerCase()] || 'un';
  return `https://flagcdn.com/w40/${code}.png`;
}