import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { getGmailSession, GMAIL_SESSION_COOKIE, sameOrigin } from "@/lib/gmail"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 })
  const session = await getGmailSession()
  if (session) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(session.refreshToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store",
    }).catch(() => undefined)
  }
  (await cookies()).delete(GMAIL_SESSION_COOKIE)
  return NextResponse.json({ disconnected: true })
}
