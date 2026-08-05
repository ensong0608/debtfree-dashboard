# Payoff engine characterization

Phase 2 extracts the existing payoff projection into `app/payoff-engine.ts` without intentionally changing its financial behavior. The executable tests in `tests/payoff-engine.test.mjs` are the source of truth for the characterized results below.

## Preserved behaviors that may merit later review

- Interest is added before linked card charges. Recurring expenses and first-month purchases therefore do not accrue interest in the same modeled month.
- Recurring linked card expenses are added and paid every month, including after the account's original debt reaches zero. A zero-balance linked card can therefore produce a one-month plan without a paid-off milestone.
- The monthly pool is based on opening effective minimums, recurring card expenses, and extra payment. A saved post-promotion minimum can raise the required monthly amount and peak, but otherwise the original pool remains fixed.
- Rollover and extra money go only to payoff-priority debts. Minimum-only debts continue at their modeled minimum even when part of the monthly pool is left unused.
- An actual statement interest fee calibrates a monthly rate as `interestFee / openingBalance`. That rate continues against declining projected balances, while the account's APR remains the value used for ordering and display.
- Automatic minimums are estimated from the account's opening balance and APR. The projected minimum does not recalculate from each future balance; it remains the opening effective minimum, capped by the current projected balance.
- Promotional terms apply only to credit-card accounts with an end date and a positive post-promotion APR. The promotional APR remains active through the end-date month. A missing post-promotion minimum falls back to the opening effective minimum.
- A pending promotional change suppresses the normal stalled-plan exit while the promotion remains active.
- The plan can treat a positive remainder of at most half a cent as paid off. Stored per-account balances are rounded to cents, while interest, total interest, paid amounts, and aggregate remaining balances retain JavaScript floating-point values.
- Non-amortizing plans can stop after the first projected month. Plans that keep shrinking by more than the half-cent tolerance continue until payoff or the 1,200-month limit.
- Exact ordering ties rely on JavaScript's stable array sort, preserving input order.

## Date and floating-point assumptions

- Tests pass a local `Date` fixed to August 15, 2026. Production omits the parameter and retains `new Date()` as the default.
- Forecast month keys use the calculation date's local year and month. Promotion boundaries compare `YYYY-MM` strings and are inclusive of the saved end month.
- Currency display and selected stored balances use the existing `Math.round((value + Number.EPSILON) * 100) / 100` helper. The engine intentionally does not round every intermediate calculation.
