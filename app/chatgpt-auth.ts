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
const SITES_EMAIL_HEADER = "oai-authenticated-user-email";
const SITES_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const SITES_FULL_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";

let accessJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export async function getAuthenticatedUser(): Promise<DashboardUser | null> {
  const requestHeaders = await headers();
  const accessToken = requestHeaders.get(ACCESS_JWT_HEADER);
  if (accessToken) {
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

  // The Cloudflare Worker must never trust client-supplied Sites compatibility headers.
  if (env.CF_ACCESS_AUD || env.CF_ACCESS_TEAM_DOMAIN) return null;

  const sitesEmail = requestHeaders.get(SITES_EMAIL_HEADER);
  if (!sitesEmail) return null;
  const encodedFullName = requestHeaders.get(SITES_FULL_NAME_HEADER);
  const fullName = encodedFullName && requestHeaders.get(SITES_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
    ? safeDecodeURIComponent(encodedFullName)
    : null;
  return { displayName: fullName ?? sitesEmail, email: sitesEmail.trim().toLowerCase(), fullName };
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
