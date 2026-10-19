"use client";
import { Fragment, useState } from "react";
import type { BalanceAdjustment, LedgerTransaction } from "./dashboard-data";
import { entryHistory } from "./entry-history";
import styles from "./payments-mobile.module.css";

import { useHouseholdCurrency } from "./household-currency-context";
import { createHouseholdMoneyFormatter } from "./household-currency";
function shortDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Presentation only: revisions are metadata, never additional financial movements. */
export default function TransactionHistoryTable({ entry, names }: { entry: LedgerTransaction | BalanceAdjustment; names: Map<string, string> }) {
  const money = createHouseholdMoneyFormatter(useHouseholdCurrency());
  const signed = (value: number) => `${value < 0 ? "\u2212" : value > 0 ? "+" : ""}${money.format(Math.abs(value))}`;
  const moneyCell = (value: number, withSign = false) => <span className={styles.historyMoney}>{(withSign ? signed(value) : money.format(value)).split(",").map((part, index, parts) => <span className={styles.moneySegment} key={index}>{part}{index < parts.length - 1 ? "," : ""}</span>)}</span>;
  const history = entryHistory(entry);
  const [selected, setSelected] = useState<string | null>(null);
  const rows: { id: string; date: string; action: string; change?: number; balance?: number; accountId?: string; recordedAt?: string; effectiveDate: string; note?: string }[] = [];
  const original = history.original;
  // A creation event can already contain the original captured movement. Don't repeat it.
  const originalInEvents = original && history.events.slice(0, 1).some(event => event.action === "save" && event.recordedAt === entry.createdAt && event.effectiveDate === original.date && event.movement.some(movement => movement.accountId === original.accountId && movement.before === original.before && movement.after === original.after));
  if (original && !originalInEvents) rows.push({ id: "original", date: original.date, action: "Original", change: original.amount, balance: original.after, accountId: original.accountId, recordedAt: entry.createdAt, effectiveDate: original.date });
  history.events.forEach((event, index) => {
    const action = event.action === "save" ? "Saved" : event.action === "delete" ? "Deleted" : event.action === "restore" ? "Restored" : event.action === "undo" ? "Undone" : event.action;
    if (!event.movement.length) rows.push({ id: `event-${index}`, date: event.recordedAt, action, change: 0, recordedAt: event.recordedAt, effectiveDate: event.effectiveDate, note: "No additional balance change" });
    event.movement.forEach((movement, movementIndex) => rows.push({ id: `event-${index}-${movementIndex}`, date: event.recordedAt, action, change: movement.after - movement.before, balance: movement.after, accountId: movement.accountId, recordedAt: event.recordedAt, effectiveDate: event.effectiveDate, note: movement.before === movement.after ? "No additional balance change" : `${money.format(movement.before)} → ${money.format(movement.after)}` }));
  });
  if (!rows.length) rows.push({ id: "recorded", date: entry.createdAt, action: "Recorded", recordedAt: entry.createdAt, effectiveDate: entry.date, note: "Historical balances unavailable." });
  return <div className={styles.history}>
    {rows.length > 0 ? <table aria-label="Transaction history"><caption className="sr-only">Recorded balance events. Select a date for full details.</caption><thead><tr><th scope="col">When</th><th scope="col">Action</th><th scope="col">Change</th><th scope="col">Balance</th></tr></thead><tbody>{rows.map(row => <Fragment key={row.id}><tr data-history-event={row.id}><td><button type="button" aria-label={`Details for ${row.action} ${row.date}`} aria-expanded={selected === row.id} onClick={() => setSelected(selected === row.id ? null : row.id)}>{shortDate(row.date)}</button></td><td className={styles.historyAction}>{row.action}</td><td>{typeof row.change === "number" ? moneyCell(row.change, true) : <span aria-label="Balance change unavailable">—</span>}{row.change === 0 && <span className="sr-only"> · No additional balance change</span>}</td><td>{typeof row.balance === "number" ? moneyCell(row.balance) : <span aria-label="Balance unavailable">—</span>}</td></tr>{selected === row.id && <tr><td colSpan={4}><dl className={styles.metadata}><dt>Recorded</dt><dd>{row.recordedAt || "Unavailable"}</dd><dt>Entry date</dt><dd>{row.effectiveDate || "Unavailable"}</dd>{row.accountId && <><dt>Account</dt><dd>{names.get(row.accountId) ?? "Removed account"}</dd></>}{row.note && <><dt>Balance movement</dt><dd>{row.note}</dd></>}{history.revisions.length > 0 && <><dt>Corrections</dt><dd>{history.revisions.map((revision, index) => <div key={index}>{String(revision.correctedAt ?? "Time unavailable")} · {String(revision.title ?? "Untitled")} · {String(revision.date ?? "Date unavailable")}</div>)}</dd></>}</dl></td></tr>}</Fragment>)}</tbody></table> : <p>Historical balances unavailable.</p>}

  </div>;
}
