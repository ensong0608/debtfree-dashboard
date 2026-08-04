import { env } from "cloudflare:workers";
import { createRemoteJWKSet, jwtVerify } from "jose";
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
    const { payload } = await jwtVerify(accessToken, accessJwks, {
      issuer: env.CF_ACCESS_TEAM_DOMAIN,
      audience: env.CF_ACCESS_AUD,
    });
    const verifiedEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const forwardedEmail = (requestHeaders.get(ACCESS_EMAIL_HEADER) ?? "").trim().toLowerCase();
    if (!verifiedEmail || (forwardedEmail && forwardedEmail !== verifiedEmail)) return null;
    return { displayName: verifiedEmail.split("@")[0] || verifiedEmail, email: verifiedEmail, fullName: null };
  } catch {
    return null;
  }
}
