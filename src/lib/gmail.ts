import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { cookies } from "next/headers"

export const GMAIL_SESSION_COOKIE = "leadloom_gmail_session"
export const GMAIL_OAUTH_COOKIE = "leadloom_gmail_oauth"

export type GmailSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  email: string
  name: string
  picture?: string
  scope: string
}

export type OAuthState = {
  state: string
  verifier: string
  createdAt: number
}

type GoogleTokenResponse = {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  error?: string
  error_description?: string
}

export class GmailAuthError extends Error {}

export function gmailIsConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.INTEGRATION_ENCRYPTION_KEY)
}

function encryptionKey() {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY
  if (!secret) throw new Error("INTEGRATION_ENCRYPTION_KEY is not configured")
  return createHash("sha256").update(secret).digest()
}

export function seal(value: unknown) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("base64url")
}

export function unseal<T>(value: string): T | null {
  try {
    const payload = Buffer.from(value, "base64url")
    const iv = payload.subarray(0, 12)
    const tag = payload.subarray(12, 28)
    const encrypted = payload.subarray(28)
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv)
    decipher.setAuthTag(tag)
    return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")) as T
  } catch {
    return null
  }
}

export function secureCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  }
}

export function createPkce() {
  const verifier = randomBytes(48).toString("base64url")
  const challenge = createHash("sha256").update(verifier).digest("base64url")
  return { verifier, challenge }
}

export function googleRedirectUri(origin: string) {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/integrations/gmail/callback`
}

export async function exchangeAuthorizationCode(code: string, verifier: string, redirectUri: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
  })
  const tokens = await response.json() as GoogleTokenResponse
  if (!response.ok || !tokens.access_token || !tokens.refresh_token) {
    throw new Error(tokens.error_description || tokens.error || "Google did not return the required tokens")
  }
  return tokens as GoogleTokenResponse & { access_token: string; refresh_token: string; expires_in: number }
}

export async function fetchGoogleIdentity(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!response.ok) throw new Error("Could not read the connected Google identity")
  return response.json() as Promise<{ email: string; name?: string; picture?: string }>
}

export async function getGmailSession() {
  if (!gmailIsConfigured()) return null
  const value = (await cookies()).get(GMAIL_SESSION_COOKIE)?.value
  return value ? unseal<GmailSession>(value) : null
}

export async function refreshGmailSession(session: GmailSession) {
  if (session.expiresAt > Date.now() + 60_000) return { session, refreshed: false }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: session.refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  })
  const tokens = await response.json() as GoogleTokenResponse
  if (!response.ok || !tokens.access_token) throw new GmailAuthError("The Gmail connection expired. Reconnect Gmail and try again.")
  return {
    session: {
      ...session,
      accessToken: tokens.access_token,
      expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
      scope: tokens.scope || session.scope,
    },
    refreshed: true,
  }
}

function safeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim()
}

export async function sendGmailMessage(session: GmailSession, input: { to: string; subject: string; body: string }) {
  const to = safeHeader(input.to)
  const subject = safeHeader(input.subject)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("The recipient email address is invalid")
  if (!subject || subject.length > 998) throw new Error("The email subject is invalid")
  if (!input.body.trim() || input.body.length > 100_000) throw new Error("The email body is empty or too large")

  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`
  const mime = [
    `To: ${to}`,
    `From: ${safeHeader(session.name)} <${safeHeader(session.email)}>`,
    `Reply-To: ${safeHeader(session.email)}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.body,
  ].join("\r\n")

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: Buffer.from(mime, "utf8").toString("base64url") }),
    cache: "no-store",
  })
  const result = await response.json() as { id?: string; threadId?: string; error?: { message?: string } }
  if (response.status === 401) throw new GmailAuthError("Google no longer authorizes this connection. Reconnect Gmail and try again.")
  if (!response.ok || !result.id) throw new Error(result.error?.message || "Gmail rejected the message")
  return { id: result.id, threadId: result.threadId }
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  return !origin || origin === new URL(request.url).origin
}
