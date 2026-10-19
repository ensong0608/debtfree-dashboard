"use client";
import { createContext, useContext, type ReactNode } from 'react';
import { createHouseholdMoneyFormatter, householdCurrencySymbol, resolveHouseholdCurrency, type HouseholdCurrency } from './household-currency';
const CurrencyContext = createContext<HouseholdCurrency>('USD');
export function HouseholdCurrencyProvider({ currency, children }: { currency: HouseholdCurrency; children: ReactNode }) {
  return <CurrencyContext.Provider value={resolveHouseholdCurrency(currency)}>{children}</CurrencyContext.Provider>;
}
export function useHouseholdCurrency(): HouseholdCurrency { return useContext(CurrencyContext); }
export function useHouseholdMoney() {
  const currency = useHouseholdCurrency();
  return { currency, symbol: householdCurrencySymbol(currency), money: createHouseholdMoneyFormatter(currency, { maximumFractionDigits: 0 }), moneyPrecise: createHouseholdMoneyFormatter(currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };
}
