import { jwtVerify, type JWTVerifyGetKey } from "jose";

export async function verifyAccessIdentity(token: string, key: JWTVerifyGetKey, issuer: string, audience: string, forwardedEmail: string | null) {
  try {
    const { payload } = await jwtVerify(token, key, { issuer, audience, algorithms: ["RS256"] });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email || (forwardedEmail && forwardedEmail.trim().toLowerCase() !== email)) return null;
    return { displayName: email.split("@")[0] || email, email, fullName: null };
  } catch { return null; }
}
