export type HouseholdSessionScope = { identity: string; householdId: string };
type SessionContext = { user: { email: string }; member: { household_id: string } };

export function householdSessionHeaders(scope: HouseholdSessionScope) {
  return { "x-debtfree-identity": scope.identity, "x-debtfree-household": scope.householdId };
}

/** Expected scope can only restrict verified access; it never selects a household. */
export function checkHouseholdSession(request: Request | undefined, context: SessionContext, requireScope = false): Response | null {
  const identity = request?.headers.get("x-debtfree-identity");
  const householdId = request?.headers.get("x-debtfree-household");
  if (!identity && !householdId && !requireScope) return null;
  if (!identity || !householdId) return Response.json({ code: "session_required", error: "Reopen this dashboard before saving." }, { status: 409, headers: { "cache-control": "private, no-store" } });
  if (identity !== context.user.email || householdId !== context.member.household_id) {
    return Response.json({ code: "session_changed", error: "Account changed. Reopen this dashboard. Your pending changes are kept." }, { status: 403, headers: { "cache-control": "private, no-store" } });
  }
  return null;
}
