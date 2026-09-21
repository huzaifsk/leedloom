import { NextRequest, NextResponse } from "next/server"

import {
  exchangeAuthorizationCode,
  fetchGoogleIdentity,
  GMAIL_OAUTH_COOKIE,
  GMAIL_SESSION_COOKIE,
  gmailIsConfigured,
  googleRedirectUri,
  seal,
  secureCookieOptions,
  type GmailSession,
  type OAuthState,
  unseal,
} from "@/lib/gmail"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const resultUrl = new URL("/", request.url)
  const oauthCookie = request.cookies.get(GMAIL_OAUTH_COOKIE)?.value
  let session: GmailSession | null = null

  try {
    if (!gmailIsConfigured()) throw new Error("Gmail is not configured")
    const error = request.nextUrl.searchParams.get("error")
    if (error) throw new Error(error)
    const code = request.nextUrl.searchParams.get("code")
    const state = request.nextUrl.searchParams.get("state")
    const saved = oauthCookie ? unseal<OAuthState>(oauthCookie) : null
    if (!code || !state || !saved || state !== saved.state || Date.now() - saved.createdAt > 10 * 60 * 1000) {
      throw new Error("The OAuth state is invalid or expired")
    }

    const tokens = await exchangeAuthorizationCode(code, saved.verifier, googleRedirectUri(request.nextUrl.origin))
    const identity = await fetchGoogleIdentity(tokens.access_token)
    session = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      email: identity.email,
      name: identity.name || identity.email.split("@")[0],
      picture: identity.picture,
      scope: tokens.scope || "",
    }
    resultUrl.searchParams.set("gmail", "connected")
  } catch (error) {
    resultUrl.searchParams.set("gmail", "error")
    resultUrl.searchParams.set("reason", error instanceof Error ? error.message.slice(0, 160) : "OAuth failed")
  }
  const response = NextResponse.redirect(resultUrl)
  response.cookies.delete(GMAIL_OAUTH_COOKIE)
  if (session) response.cookies.set(GMAIL_SESSION_COOKIE, seal(session), secureCookieOptions(60 * 60 * 24 * 30))
  return response
}
