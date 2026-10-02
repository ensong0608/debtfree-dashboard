import { NextResponse } from "next/server";
import { supabaseServer } from "../../supabase-server";
import { requireSupabaseConfiguration } from "../../auth-config";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const config = requireSupabaseConfiguration();
    if (request.headers.get("origin") !== new URL(config.origin).origin) return new Response("Invalid origin", { status: 403 });
    const client = await supabaseServer();
    const { data, error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: new URL("/auth/callback", config.origin).href, skipBrowserRedirect: true } });
    if (error || !data.url) return NextResponse.redirect(new URL("/auth/login?error=unavailable", config.origin), 303);
    return NextResponse.redirect(data.url, 303);
  } catch { return new Response("Google sign-in is unavailable. Try again later.", { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
