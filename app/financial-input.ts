/** Parse drafts without coercing blanks, truncating decimals, or rounding money. */
export function parseFinancialInput(text: string, { min = 0, max, decimals = 2, emptyValue = NaN }: { min?: number; max?: number; decimals?: number; emptyValue?: number } = {}) {
  const raw = text.trim();
  if (!raw) return { value: emptyValue, error: Number.isNaN(emptyValue) ? 'Enter a number.' : '' };
  if (raw.length > 100) return { value: NaN, error: 'This number is too large.' };
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) return { value: NaN, error: 'Enter a valid number.' };
  const fraction = raw.split('.')[1] ?? '';
  if (fraction.length > decimals) return { value: NaN, error: decimals === 0 ? 'Enter a whole number.' : `Use up to ${decimals} decimal places.` };
  const value = Number(raw);
  // Check integer cents before conversion into the existing numeric model.
  const scale = Math.min(2, decimals);
  const units = BigInt(raw.replace(/^[+-]/, '').split('.')[0] || '0') * BigInt(10) ** BigInt(scale) + BigInt(fraction.slice(0, scale).padEnd(scale, '0') || '0');
  if (!Number.isFinite(value) || units > BigInt(Number.MAX_SAFE_INTEGER)) return { value: NaN, error: 'This number is too large.' };
  if (value < min || max !== undefined && value > max) return { value: NaN, error: max === undefined ? `Enter ${min} or more.` : `Enter a number from ${min} to ${max}.` };
  return { value, error: '' };
}

/** Only normalize unambiguous currency/grouping on paste; ordinary typing is untouched. */
export function financialPaste(text: string) {
  const raw = text.trim().replace(/^[\s$€£¥₱]+/, '').replace(/−/g, '-');
  return /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?$/.test(raw) ? raw.replace(/,/g, '') : raw;
}


/** Digit entry is integer cents. Explicit decimals remain supported for replacement/accessibility. */
export function currencyDigits(text: string, symbol = '$') {
  if(!text.trim())return '';
  const formatted=text.includes(symbol) || text.includes(',');
  const raw=text.replaceAll(symbol,'').replaceAll(',','').trim();
  if(!formatted && raw.includes('.'))return raw;
  const units=formatted?raw.replace('.',''):raw;
  if(!/^\d+$/.test(units))return raw;
  const digits=units.replace(/^0+(?=\d)/,'').padStart(3,'0');
  return digits.slice(0,-2)+'.'+digits.slice(-2);
}
