import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authConfiguration } from "./app/auth-config";

export async function proxy(request: NextRequest) {
  const config = authConfiguration();
  let response = NextResponse.next({ request });
  if (!config.enabled) return response;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && request.headers.get("origin") !== new URL(config.origin).origin) {
    return new NextResponse("Invalid origin", { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  response.headers.set("Cache-Control", "private, no-store");
  if (!config.url || !config.key) return response;
  const client = createServerClient(config.url, config.key, {
    cookieOptions: { httpOnly: true, secure: new URL(config.origin).protocol === "https:", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: values => {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        response.headers.set("Cache-Control", "private, no-store");
        for (const { name, value, options } of values) response.cookies.set(name, value, options);
      },
    },
  });
  // Refresh short-lived tokens while preserving the browser's long-lived session.
  // Do not call getSession() to authorize users: its contents are client-supplied.
  await client.auth.getUser().catch(() => null);
  return response;
}

export const config = { matcher: ["/", "/auth/:path*", "/api/household/:path*"] };
