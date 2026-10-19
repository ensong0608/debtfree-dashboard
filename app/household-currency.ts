export type HouseholdCurrency = 'USD' | 'PHP' | 'EUR' | 'GBP' | 'CAD' | 'AUD';
export const HOUSEHOLD_CURRENCIES: readonly HouseholdCurrency[] = ['USD', 'PHP', 'EUR', 'GBP', 'CAD', 'AUD'];
export function resolveHouseholdCurrency(value: unknown): HouseholdCurrency {
  if (value === undefined) return 'USD';
  if (typeof value === 'string' && HOUSEHOLD_CURRENCIES.includes(value as HouseholdCurrency)) return value as HouseholdCurrency;
  throw new RangeError('Choose a supported household currency.');
}
export function createHouseholdMoneyFormatter(currency: HouseholdCurrency, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  return new Intl.NumberFormat('en-US', { ...options, style: 'currency', currency: resolveHouseholdCurrency(currency) });
}
export function householdCurrencySymbol(currency: HouseholdCurrency): string {
  return createHouseholdMoneyFormatter(currency).formatToParts(0).find(part => part.type === 'currency')!.value;
}
