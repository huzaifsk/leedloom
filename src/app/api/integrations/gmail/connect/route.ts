import { randomBytes } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

import { createPkce, gmailIsConfigured, GMAIL_OAUTH_COOKIE, googleRedirectUri, seal, secureCookieOptions } from "@/lib/gmail"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  if (!gmailIsConfigured()) {
    return NextResponse.redirect(new URL("/?gmail=not-configured", request.url))
  }

  const state = randomBytes(24).toString("base64url")
  const { verifier, challenge } = createPkce()
  const redirectUri = googleRedirectUri(request.nextUrl.origin)
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  authorization.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile https://www.googleapis.com/auth/gmail.send",
    access_type: "offline",
    prompt: "consent select_account",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString()

  const response = NextResponse.redirect(authorization)
  response.cookies.set(GMAIL_OAUTH_COOKIE, seal({ state, verifier, createdAt: Date.now() }), secureCookieOptions(10 * 60))
  return response
}
