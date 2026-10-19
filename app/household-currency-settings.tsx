"use client";
import { useState } from 'react';
import { useHouseholdCurrency } from './household-currency-context';
import { HOUSEHOLD_CURRENCIES, resolveHouseholdCurrency, type HouseholdCurrency } from './household-currency';
import styles from './household-currency-settings.module.css';
export default function HouseholdCurrencySettings({ onChange, readOnly = false, onboarding = false }: { onChange: (currency: HouseholdCurrency) => void; readOnly?: boolean; onboarding?: boolean }) {
  const currency = useHouseholdCurrency();
  const [pending, setPending] = useState<HouseholdCurrency | null>(null);
  return <section className={styles.settings} aria-label="Household currency"><label htmlFor={onboarding ? 'onboarding-currency' : 'household-currency'}>Household currency</label><select id={onboarding ? 'onboarding-currency' : 'household-currency'} value={pending ?? currency} disabled={readOnly} onChange={event => { if (readOnly) return; const next = resolveHouseholdCurrency(event.target.value); if (onboarding) onChange(next); else setPending(next === currency ? null : next); }}>{HOUSEHOLD_CURRENCIES.map(code => <option key={code} value={code}>{code}</option>)}</select>{pending && <div className={styles.confirmation} role="group" aria-label="Confirm currency change"><p>Change {currency} to {pending}? Amounts stay the same. No conversion.</p><button type="button" className="secondary" onClick={() => setPending(null)}>Cancel currency change</button><button type="button" className="primary" disabled={readOnly} onClick={() => { if (!readOnly) onChange(pending); setPending(null); }}>Confirm currency change</button></div>}</section>;
}
