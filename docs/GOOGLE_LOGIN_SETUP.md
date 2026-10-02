# Google login with Supabase

This integration is dormant until `AUTH_PROVIDER=supabase` is configured on the Worker. Existing Cloudflare Access login continues to work until cutover. Household data and roles stay in the existing D1 database; no database migration is required.

## Provider configuration

Use the existing Supabase project `acpderotiyoecmwwyfsu`. Configure a Google OAuth **Web application** with only `openid`, email and profile scopes. Its authorized JavaScript origin is `https://debtfree-dashboard.ensong0608.workers.dev`; its authorized redirect URI is `https://acpderotiyoecmwwyfsu.supabase.co/auth/v1/callback`. Enter the Google client ID and client secret directly in Supabase Authentication > Sign In / Providers > Google. Keep nonce checks enabled and disallow users without email. Do not commit the Google secret.

Set the Supabase Site URL to `https://debtfree-dashboard.ensong0608.workers.dev`. Add the exact redirect URL `https://debtfree-dashboard.ensong0608.workers.dev/auth/callback` to its redirect allow list. Inspect existing redirect URLs before changing them: this project may serve another app.

## Worker configuration and cutover

Set these Worker variables in Cloudflare (or in ignored `.dev.vars` for local testing):

- `AUTH_PROVIDER=supabase`
- `SUPABASE_URL=https://acpderotiyoecmwwyfsu.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY`: the project's publishable key, never a secret or service-role key.
- `APP_ORIGIN=https://debtfree-dashboard.ensong0608.workers.dev`
- `HOUSEHOLD_OWNER_EMAIL`: the verified Google email of the existing owner. This only controls initial owner creation if D1 is empty. Existing D1 memberships remain authoritative.

Deploy and verify the Supabase flow before removing the Cloudflare Access gate. Removing it before the replacement is deployed is unsafe. Removing it afterward still requires a deliberate account configuration change. Confirm signed-out requests cannot read or change household data, the owner's existing household loads, invited admin/viewer roles remain correct, unknown users are denied, refresh survives closing/reopening the browser and access-token expiry, and sign-out clears this browser's session. Check authenticated pages and cookies are never cached by Cloudflare.

## Session behavior and limits

The OAuth code exchange uses PKCE. Only server-confirmed `getUser()` identities with verified email and a Google identity are accepted. HTTP-only, SameSite=Lax cookies persist for up to a year; middleware refreshes the short-lived Supabase token. A new browser has no session cookie and must sign in. Explicit sign-out uses local scope so other devices are not signed out. Google may impose its own security challenges.

This integration does **not** implement custom state/country-based reauthentication or a trusted-device management screen. Those need separate design and tests; persistent login should not be described as suspicious-location detection. Clearing cookies, browser privacy policies, revoked sessions and Supabase project availability can require another sign-in. Supabase's free projects may pause after inactivity.

Do not change production variables or remove Access until OAuth credentials, deployment authentication and live verification are available.
