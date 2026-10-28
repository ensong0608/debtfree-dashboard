export function capitalizeWords(value: string) {
  return value.replace(/(^|[\s/(-])([\p{L}][\p{L}\p{N}]*)/gu, (_, prefix: string, word: string) => prefix + (word === 'pt' ? word : word[0].toLocaleUpperCase() + word.slice(1)));
}
