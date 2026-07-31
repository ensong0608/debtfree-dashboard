# DebtFree Dashboard release notes

## 2026-07-31 - Promo-aware payoff forecasting

- Payoff forecasts now use the card's saved post-promotion APR and actual minimum payment after a 0% offer ends.
- If the future minimum is not known, the forecast keeps the current minimum and says so instead of silently estimating a higher payment.
- The True Cost warning now uses the same payoff forecast for its interest, finish date, and monthly-payment figures.
- Forecasts identify non-amortizing balances and stop presenting a misleading payoff date when payments do not reduce the balance after interest and new charges.
