# Mobile appearance proposal — approved for local implementation

## Approval and final Settings correction

Owner approved round2 on October17,2026. This section supersedes the historical proposal/status text below. Settings gear must open the full Settings page directly, without an intermediary popup. The hamburger replaces bottom More and contains a separate Settings section, distinct from Account. Settings owns appearance/fonts/colors and category editing; Account owns household/access, backup/import and paid-off/archived debts. Bottom tabs remain Debts / Transactions / Budget / Account.

Approved presentation is assigned in prompts10–12. Appearance preferences are device-local and must preserve the current default theme; user-selected typography/colors may apply without changing Budget content/layout/math. Seven-day Recently deleted filtering is non-destructive; no physical history purge is authorized. Implementation, integrated tests and APK update are separate pending checks. Workers save reports and finish in their own chats; manager waits for owner's explicit heads-up before inspecting completion.

Owner also requested live shared-household testing with their wife. Current APK is device-only. Read-only environment inventory and the separate connected milestone are recorded in CONNECTED_HOUSEHOLD_TEST_PLAN.md; this UI approval does not constitute a connected test pass.

## Round 2 corrections — latest owner direction

Owner requested another mockup round, not implementation. These corrections supersede conflicting layout ideas below:

- Preserve the current total-debt summary design from owner's image1: total outstanding, reduction badge, category/minimum split with divider, balance-reduction wording/percentage and progress bar. Use illustrative data only in the preview.
- Preserve current debt-card design from image2: card icon, name, balance, chevron, APR/minimum/due date, reduction progress/wording, Record Payment and Balance actions. Preserve category/group presentation; do not substitute the stripped-down cards from round1.
- Keep the Transactions summary at3 cards in one row while restoring original visual treatment from image3: mint Payments with trend icon, rose Interest & fees with percent icon/red amount, mint Net balance change with check badge/teal amount, and transaction counts. Tap explanations remain part of the proposal. Verify readable labels and large amounts on narrow screens before implementation.
- Rename Quick payoff plan to **Quick Payoff Calculator**.
- **Budget content must not change.** The earlier invented Budget preview is withdrawn. Round2 prototype deliberately shows an unchanged-scope notice when Budget is selected rather than inventing a replacement screen. Global header/navigation proposal is separate from Budget contents.
- Keep compact centered headers. Add a left hamburger menu for existing More tools and right Settings gear for account settings/preferences. Remove the bottom More tab; bottom navigation now has4 items: Debts / Transactions / Budget / Account. Keep the Account section the owner liked. No headerless alternative needed now.
- Account paid-off/archive placement, transaction history table and custom Themes to-do remain. Seven-day permanent purge versus visible-list retention remains a separate unresolved decision; no data changes authorized.

Round2 interactive preview: `C:\Users\masil\.codex\visualizations\2026\10\17\01a1489e-837e-7b63-ba04-2911935fe420\debtfree-mobile-proposal-v2.html`. Round1 is preserved separately for comparison. Only mockup/docs changed; app source, APK and private household data remain intact. No worker chat/status checks or assignments.

Round2 prototype QA: visually reviewed the preserved total/card styling and combined3-card transaction colors/icons/counts. Debts/Transactions/Account fit at320,390,736px; menu opens/closes, gear reaches Account settings, Budget opens an unchanged-scope notice, Net change explanation opens, and calculator strategy changes order. Four bottom tabs confirmed; no More tab/headerless variant. Browser console0 errors/0 warnings. Protected app/config hashes and previously inspected APK hash unchanged. These checks validate the proposal only, not an implemented app update.

October17,2026, America/Los_Angeles. Proposal only: no app source, installed APK, data or production changes authorized by this review request. No worker status checks or assignments. Interactive sample preview is stored in this chat's visualization folder; none of the preview numbers/records comes from a real household.

## Proposed layout

1. Keep a compact centered page title (about44px total header,18px title) rather than the current large title/account/status block. Show a no-header alternative for comparison. Remove the account bubble and persistent Saved on device text from all top headers. Keep save errors actionable when they occur; successful save/storage information belongs in Account. Preserve mint/teal, current paper/ink colors, Helvetica and subtle8px corners. No dark/blue payoff panel copied from the older product.
2. Bottom navigation becomes Debts / Transactions / Budget / More / Account, with Account at far right. Account holds current settings, categories, data/backup controls and archived debts. Avoid duplicate Settings entry under More after adding Account. Preserve accessible labels and usable touch targets despite the fifth tab.
3. Remove Detailed debt view & import and Auditable debt activity from the Debts surface. Preserve underlying data, history/correction controls in Transactions, and backup/import in Account. Verify any unique CSV/import controls and custom ordering remain reachable before removing their current surface. Do not remove accounting/audit data because a display section is removed.
4. Put a Quick payoff plan after active debt cards: extra monthly payment, Avalanche/Snowball choices, estimated debt-free month, monthly total, estimated interest/total paid, payoff order with dates, and expandable first-six-month schedule. Reuse the app's existing payoff engine and saved settings for implementation, not the independent illustrative preview calculation. Clarify card/other versus house/car scope; preserve loan separation, minimum reservations and existing all-in/extra budget semantics. Estimates remain estimates; no manufactured actual progress. All-category plan scope should stay explicit when debt list filters are active.
5. Move archived debts to Account → Paid off & archived. Show PAID OFF only when the balance is zero; nonzero archived debts retain ARCHIVED. Keep Restore as a secondary action with confirmation for accidental archive, corrections or later balances. Paid-off history must continue to count correctly in Progress; reactivation must not invent repayment or overwrite the starting baseline.
6. Transactions: compact OCT2026 month label with full month/year picker still available; account filter ALL. Keep summary cards and move their explanatory text into tap-accessible popovers/dialogs on Payments, Interest & fees and Net balance change. Remove the duplicate Payments this month explanation section.
7. Each transaction's History becomes a concise table with one row per recorded event: When / Action / Change / Balance. Offer full timestamps/original/effective-date/account/correction details on row selection where needed, rather than permanently displaying long paragraphs. Preserve correction events that make no additional balance movement; do not reapply them or count them twice. Mobile table must remain legible at320px and accessible to keyboard/screen-reader users.

## Seven-day deleted-list decision

Owner requested deleted transactions disappear after7 days. Recommended proposal: show a Recently deleted list and allow normal restore for7 days from deletedAt, then remove entries from that visible list while retaining internal tombstones/audit/backup relationships needed for reconciliation and history. This recommendation has NOT been approved or implemented. It differs from physical deletion of historical records. If owner instead requires permanent purge, first agree the accounting-safe retention/recovery behavior and whether the same policy covers balance adjustments, corrected/replaced transactions, backups and connected devices. No automated purge or destructive data operation in this proposal round.

## References and review

Owner supplied five screenshots and the older planner URL. Anonymous request to https://debtfree-payoff-planner.ensong608.chatgpt.site/ required sign-in, so use the supplied screenshots as visual reference; do not claim the live planner was inspected or authenticate to it automatically. The reference's quick plan convenience is retained in the proposal, while styling follows the current DebtFree theme.

Review the Compact header versus No header variants; try Debts strategy/extra input, Transactions summary explanations/history, and Account archive placement. All prototype interactions are local illustrative state. No real financial file is accessed; current phone app contains private imported data and must not be captured/read for mockup fixtures.

Prototype QA: reviewed Debts, Transactions and Account captures; checked those views fit at320/390/736px without horizontal overflow; extra payment updates the illustrative forecast, Snowball changes order, summary explanation opens/closes, Account paid-off/restore sample and no-header carousel work. Final browser console has0 errors/0 warnings. These are prototype checks only. Source/config fingerprints and the inspected APK hash remained unchanged. Closed the separate QA browser/server and moved task-only browser logs out of the repository. Existing local app/demo browser tabs were not navigated or modified.

## Scope after approval

Treat this as a mobile appearance slice first. Confirm desired shared-web coverage before changing common desktop layout. Implement approved presentation changes separately from any transaction-retention/purge policy. Rebuild/inspect APK and update using the same development package/signature without clearing the owner's imported data. Preserve original backup, real local household, production, theme, category settings, Progress starting baseline and full financial history. Actual feature tests/builds remain necessary after implementation; prototype QA is not an app test pass.
