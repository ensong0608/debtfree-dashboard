# DebtFree Dashboard release notes

## 2026-08-11 - Action-focused Home dashboard

- Home now leads with the next recommended payment, debt-free date, remaining debt, progress, and monthly target.
- The next payment action opens a prefilled payment record and updates balances and projections through the existing ledger.
- Upcoming due dates, promotional expirations, missing projection details, and the monthly review are visible together.
- Primary navigation now follows Home, Debts, Payoff Plan, Monthly Plan, Progress, and Settings; detailed tools remain available in the advanced menu.

## 2026-08-04 - Personal-email household accounts

- Cloudflare Access one-time PINs now verify each member's personal email before the app accepts their identity.
- Household owners can invite either admins with edit access or viewers with read-only access.
- Viewer writes are blocked by the API and editing controls are disabled in the dashboard.
- Existing device data is copied into an empty owner household after the first authenticated sign-in.
## 2026-08-04 - One-time credit-card purchase payments

- One-time purchases linked to a credit card are now added to that card's payoff payment in the current month only.
- The payoff schedule labels those purchases as one-time and does not carry them into future months.
- Recurring credit-card expenses continue to be charged and covered by the planned payment every month.

## 2026-07-31 - Promo-aware payoff forecasting

- Payoff forecasts now use the card's saved post-promotion APR and actual minimum payment after a 0% offer ends.
- If the future minimum is not known, the forecast keeps the current minimum and says so instead of silently estimating a higher payment.
- The True Cost warning now uses the same payoff forecast for its interest, finish date, and monthly-payment figures.
- Forecasts identify non-amortizing balances and stop presenting a misleading payoff date when payments do not reduce the balance after interest and new charges.
