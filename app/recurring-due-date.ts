/** Resolve the saved day in the current month without rewriting the recurring day. */
export function recurringDueDate(saved: string, month?: string): string {
  const day = Number(/^\d{4}-\d{2}-(\d{2})$/.exec(saved)?.[1]);
  if (!Number.isInteger(day) || day < 1 || day > 31) return "";
  const today = new Date();
  const key = month ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return "";
  const lastDay = new Date(Number(match[1]), Number(match[2]), 0).getDate();
  return `${key}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}
