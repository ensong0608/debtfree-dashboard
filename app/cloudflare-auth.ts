import { env } from "cloudflare:workers";
import { createRemoteJWKSet } from "jose";
import { verifyAccessIdentity } from "./verify-access.ts";
import { headers } from "next/headers";

export type DashboardUser = {
  displayName: string;
  email: string;
  fullName: string | null;
};

const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";
const ACCESS_EMAIL_HEADER = "cf-access-authenticated-user-email";

let accessJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export async function getAuthenticatedUser(): Promise<DashboardUser | null> {
  const requestHeaders = await headers();
  const accessToken = requestHeaders.get(ACCESS_JWT_HEADER);
  if (!accessToken) return null;

  try {
    accessJwks ??= createRemoteJWKSet(new URL(env.CF_ACCESS_TEAM_DOMAIN + "/cdn-cgi/access/certs"));
    return await verifyAccessIdentity(accessToken, accessJwks, env.CF_ACCESS_TEAM_DOMAIN, env.CF_ACCESS_AUD, requestHeaders.get(ACCESS_EMAIL_HEADER));
  } catch {
    return null;
  }
}
