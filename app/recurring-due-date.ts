import { householdDate } from "./household-date.ts";
/** Resolve the saved day in the current month without rewriting the recurring day. */
export function recurringDueDate(saved: string, month?: string): string {
  const day = Number(/^\d{4}-\d{2}-(\d{2})$/.exec(saved)?.[1]);
  if (!Number.isInteger(day) || day < 1 || day > 31) return "";
  const key = month ?? householdDate().slice(0, 7);
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return "";
  const lastDay = new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate();
  return `${key}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

/** Next occurrence of the saved recurring day, including today. */
export function nextDueDate(saved: string, today = householdDate()): string {
  const current = recurringDueDate(saved, today.slice(0, 7));
  if (!current || current >= today) return current;
  const next = new Date(today.slice(0, 7) + '-01T12:00:00Z');
  next.setUTCMonth(next.getUTCMonth() + 1);
  return recurringDueDate(saved, next.toISOString().slice(0, 7));
}

/** Display the next occurrence of the recurring day in the household calendar. */
export function formatRecurringDueDate(saved: string, month?: string): string {
  const date = month ? recurringDueDate(saved, month) : nextDueDate(saved);
  if (!date) return "—";
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}
