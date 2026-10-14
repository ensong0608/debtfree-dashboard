# Payoff engine characterization

The payoff projection was initially extracted into `app/payoff-engine.ts` without intentionally changing its financial behavior. Public-app foundation work corrects monthly cent rounding and restores the requested distinction between Calculator and Plan. The executable tests in `tests/payoff-engine.test.mjs` are the source of truth for the characterized results below.

## Preserved behaviors that may merit later review

- Interest is added before linked card charges. Recurring expenses and first-month purchases therefore do not accrue interest in the same modeled month.
- Recurring linked card expenses are added and paid every month, including after the account's original debt reaches zero. A zero-balance linked card can therefore produce a one-month plan without a paid-off milestone.
- The monthly pool is based on opening effective minimums, recurring card expenses, and extra payment. A saved post-promotion minimum can raise the required monthly amount and peak, but otherwise the original pool remains fixed.
- Rollover and extra money go only to payoff-priority debts. Minimum-only debts continue at their modeled minimum even when part of the monthly pool is left unused.
- An actual statement interest fee calibrates a monthly rate as `interestFee / openingBalance`. That rate continues against declining projected balances, while the account's nominal APR remains displayed. Avalanche ordering uses the effective calibrated rate.
- Automatic minimums are estimated from the account's opening balance and APR. The projected minimum does not recalculate from each future balance; it remains the opening effective minimum, capped by the current projected balance.
- Promotional terms apply only to credit-card accounts with an end date and a positive post-promotion APR. The promotional APR remains active through the end-date month. A missing post-promotion minimum falls back to the opening effective minimum.
- A pending promotional change suppresses the normal stalled-plan exit while the promotion remains active.
- Interest is rounded per account each month. Balances, allocated payments, monthly totals, and cumulative interest are rounded to cents after every operation, so schedules reconcile with displayed balances.
- Non-amortizing plans can stop after the first projected month. Plans that keep shrinking by more than the half-cent tolerance continue until payoff or the 1,200-month limit.
- Exact ordering ties rely on JavaScript's stable array sort, preserving input order.

## Date and floating-point assumptions

- Tests pass a local `Date` fixed to August 15, 2026. Production omits the parameter and uses the current instant with the Pacific household calendar.
- Forecast month keys and promotion dates use the existing Pacific household calendar, independent of the device timezone. Promotion boundaries compare `YYYY-MM-DD` dates and include the saved end date; shorter months clamp the modeled day to their last day.
- Currency display and selected stored balances use the existing `Math.round((value + Number.EPSILON) * 100) / 100` helper. Each money operation is rounded to cents; APR/rate calculations retain rate precision.

## Phase 6 planned-versus-actual correction

Before Phase 6, a linked one-time or recurring card item was added to the first projected payoff-month balance even when a matching actual charge had already been recorded in the ledger. Because the ledger charge was already included in the current balance, the projection could include that purchase twice.

Phase 6 preserves all recurring linked-card behavior for unmatched planned entries. When detailed tracking is enabled and an actual charge explicitly references a planned entry, only the first projected month receives an offset equal to that matched planned amount. Future recurring months are unchanged. The characterized regression proves the old first-month result was exactly one planned purchase higher than the corrected result.

## Public-app forecast contract

- Calculator: the entered amount is the entire monthly scenario payment pool. It is allocated by avalanche or snowball without reserving minimums. A scenario below statement minimums remains a scenario and cannot be applied to the saved Plan when its minimums cannot be funded.
- Plan: the entered amount is the entire monthly payment pool, including minimums. Minimums are reserved first and remaining funds follow the selected strategy. Insufficient current or future promotional minimums return a validation error without raising the saved amount.
- Only avalanche and snowball are exposed. Legacy saved custom settings and ordering data remain readable; current forecasts fall back to avalanche without modifying stored settings.
- Archived debts are excluded from payoff forecasts. Debt-screen visibility alone does not alter forecast membership. Existing house/car LoanTrackers remain separate from these card/other projections; mortgage payment splitting subtracts escrow before calculating principal reduction.
- All projected months remain accessible; a shrinking projection stops at payoff or the 1,200-month limit. A capped or non-amortizing projection has no completed payoff date.
- Existing starting Progress totals, saved dates, and snapshots are not changed by forecast corrections. Monthly cent rounding can change a projected result by cents compared with the previous fractional-cent estimate.

A projection that reaches 1,200 months while still shrinking reports the projection limit, rather than claiming that payments cannot outpace interest. Stopped exports leave months to payoff empty and retain every evaluated schedule row.
