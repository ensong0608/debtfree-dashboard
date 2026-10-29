import {database} from "../../api/household/store";
import { NextResponse } from "next/server";
import { authConfiguration } from "../../auth-config";
import { supabaseServer } from "../../supabase-server";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const config = authConfiguration();
  if (request.headers.get("origin") !== new URL(config.origin).origin) return new Response("Invalid origin", { status: 403 });
  if (!config.enabled) return NextResponse.redirect(new URL("/cdn-cgi/access/logout", config.origin), 303);
  const client = await supabaseServer();
  const form = await request.formData().catch(()=>new FormData());
  const scope = form.get('scope') === 'global' ? 'global' : 'local';
  const { data } = await client.auth.getUser();
  if(data.user?.email){
    const email=data.user.email.trim().toLowerCase(),id=String(form.get('device')??'');
    try{if(scope==='global')await database().prepare('DELETE FROM notification_subscriptions WHERE email=?').bind(email).run();
    else if(/^[a-f0-9-]{36}$/.test(id))await database().prepare('DELETE FROM notification_subscriptions WHERE id=? AND email=?').bind(id,email).run();}catch{return new Response('Could not disable phone reminders. Please try signing out again.',{status:503});}
  }
  const { error } = await client.auth.signOut({ scope });
  if (error) return new Response("Could not sign out. Please try again.", { status: 503 });
  return NextResponse.redirect(new URL("/auth/login", config.origin), 303);
}
