import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseConfiguration } from "./auth-config";

export async function supabaseServer(readOnly = false) {
  const config = requireSupabaseConfiguration();
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    // Auth runs entirely on the server; client JavaScript does not need tokens.
    cookieOptions: { httpOnly: true, secure: new URL(config.origin).protocol === "https:", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: values => {
        // Middleware refreshes the session before read-only Server Components.
        if (readOnly) return;
        for (const { name, value, options } of values) cookieStore.set(name, value, options);
      },
    },
  });
}
