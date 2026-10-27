"use client";

import { useMemo, useState } from "react";
import type { paymentActivity } from "./payments";
import { createHouseholdMoneyFormatter } from "./household-currency";
import { useHouseholdCurrency } from "./household-currency-context";
import OutlineIcon from "./outline-icon";
import styles from "./payments-mobile.module.css";

type ActivityRow = ReturnType<typeof paymentActivity>[number];

function monthLabel(month: string) {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function kindLabel(kind: ActivityRow["kind"]) {
  switch (kind) {
    case "payment": return "Payment";
    case "credit": return "Credit";
    case "purchase": return "Purchase";
    case "interest": return "Interest";
    case "fee": return "Fee";
    default: return "Balance adjustment";
  }
}

/** Debt-wide display only. Uses existing ledger activity; never posts or replays money. */
export default function DebtActivityHistory({ entries, accountId, accountName, currentEntryId, compact = false }: {
  entries: ReturnType<typeof paymentActivity>;
  accountId: string;
  accountName: string;
  currentEntryId: string; compact?: boolean;
}) {
  const money = createHouseholdMoneyFormatter(useHouseholdCurrency(), {
    style: "currency", minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const related = useMemo(() => {
    const current = entries.find(entry => entry.id === currentEntryId);
    if (!current) return [];
    return entries.filter(entry => entry.accountId === accountId && (
      entry.date < current.date || (entry.date === current.date && entry.createdAt <= current.createdAt)
    ));
  }, [entries, accountId, currentEntryId]);
  // Entries are already restricted to the selected period by the parent.
  const recent = related.slice(0, 20);
  const shown = showAll ? related : recent;
  const groups = shown.reduce<{ month: string; rows: ActivityRow[] }[]>((result, entry) => {
    const month = entry.date.slice(0, 7);
    const last = result[result.length - 1];
    if (last?.month === month) last.rows.push(entry);
    else result.push({ month, rows: [entry] });
    return result;
  }, []);

  return <details className="transaction-secondary" onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary>{compact && <OutlineIcon name="history"/>}{compact ? "History" : "Debt history"}{compact && <OutlineIcon name="chevron"/>}</summary>
    {expanded && <div className={styles.debtActivityHistory} aria-label={`Transaction activity for ${accountName}`}>
    <div className={styles.debtHistoryIntro}>
      <strong>{accountName} history</strong>
      <small>{related.length} {related.length === 1 ? "entry" : "entries"}</small>
    </div>
    {groups.map(group => <section key={group.month} className={styles.debtHistoryMonth}>
      <h3>{monthLabel(group.month)}</h3>
      <ol>{group.rows.map(entry => {
        const kind = kindLabel(entry.kind);
        const noMovement = entry.difference === 0;
        const balance = typeof entry.after === "number" && Number.isFinite(entry.after) ? entry.after : undefined;
        return <li key={entry.id} className={styles.debtHistoryRow} data-current={entry.id === currentEntryId ? "true" : undefined}>
          <div className={styles.debtHistoryDetails}>
            <time dateTime={entry.date}>{dateLabel(entry.date)}</time>
            <strong>{entry.title}</strong>
            {entry.title.trim().toLowerCase() !== kind.toLowerCase() && <small>{kind}</small>}
            {balance !== undefined && <small>Balance: {money.format(balance)}</small>}
          </div>
          <b className={noMovement ? styles.debtHistoryIncluded : entry.difference < 0 ? styles.debtHistoryDecrease : styles.debtHistoryIncrease}>
            {noMovement ? "Included" : `${entry.difference < 0 ? "−" : "+"}${money.format(Math.abs(entry.difference))}`}
          </b>
        </li>;
      })}</ol>
    </section>)}
    {!related.length && <p>No activity recorded for this debt.</p>}
    {related.length > recent.length && <button type="button" className={styles.debtHistoryMore} onClick={() => setShowAll(value => !value)}>
      {showAll ? "Show recent activity" : `Show all ${related.length} entries`}
    </button>}
  </div>}
  </details>;
}
