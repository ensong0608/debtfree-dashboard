import { householdContext } from "../household/store";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const context = await householdContext();
    if (!context) return Response.json({ error: "Sign in required" }, { status: 401 });
    await context.db.prepare("SELECT 1 AS healthy").first();
    return Response.json({ status: "ok", dataVersion: 6 }, { headers: { "cache-control": "no-store" } });
  } catch {
    console.error(JSON.stringify({ event: "household_health_failed" }));
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
