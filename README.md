# DebtFree Dashboard

A full-stack household budget and debt-payoff dashboard built with vinext and deployed to Cloudflare Workers.

## Development

Requirements: Node.js 22.13 or newer.

- npm install
- npm run dev
- npm run lint
- npm test
- npm run build

The production Worker configuration is stored in wrangler.jsonc. Structured household data is stored in the D1 database bound as DB.

## Personal-email authentication

The production Worker is protected by Cloudflare Access using one-time PIN email authentication.

- app/cloudflare-auth.ts validates the Cf-Access-Jwt-Assertion JWT against the configured team JWKS and audience before trusting the email identity.
- The first verified email creates the household owner.
- Owners can invite an exact personal email as an admin or viewer.
- Admins can update shared household data.
- Viewers can read the dashboard, while API writes and interface controls are disabled.
- Unknown verified emails are denied by the application membership check.

The Access team domain and audience are non-secret Worker variables. The JWT is still validated on every request so forwarded identity headers are never trusted by themselves.

## Data persistence

D1 stores household membership and the shared serialized dashboard payload. Browser storage is retained as a device backup and is copied to an empty owner household on first authenticated use.

Use the private JSON backup export before changing origins or replacing household data.

## Deployment

- npm run deploy:check builds and validates the production Worker bundle without publishing it.
- npm run deploy builds and deploys directly to the production Cloudflare Worker.
- npm run db:generate generates Drizzle migrations after schema changes.
- npm run db:migrate:cloudflare applies committed migrations to the production D1 database; run it only when the schema changed.

## Learn More

- [Cloudflare Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [vinext](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)