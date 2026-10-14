/** The existing household calendar is Pacific time, independent of device timezone. */
const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" });

export function householdDate(now = new Date()) {
  return formatter.format(now);
}

export function householdMonthOffset(month: number, now = new Date()) {
  const [year, value] = householdDate(now).split("-").map(Number);
  return new Date(Date.UTC(year, value - 1 + month, 1)).toISOString().slice(0, 7);
}
