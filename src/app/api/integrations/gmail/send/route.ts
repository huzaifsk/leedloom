import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import {
  getGmailSession,
  GmailAuthError,
  GMAIL_SESSION_COOKIE,
  refreshGmailSession,
  sameOrigin,
  seal,
  secureCookieOptions,
  sendGmailMessage,
} from "@/lib/gmail"

export const runtime = "nodejs"

const sentRequests = new Map<string, { providerMessageId: string; threadId?: string; sender: string; createdAt: number }>()
const lastSendByAccount = new Map<string, number>()

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 })
  try {
    const current = await getGmailSession()
    if (!current) return NextResponse.json({ error: "Connect Gmail before sending." }, { status: 401 })
    const input = await request.json() as { to?: string; subject?: string; body?: string; idempotencyKey?: string }
    const idempotencyKey = String(input.idempotencyKey || "")
    if (!/^[a-zA-Z0-9:_-]{8,180}$/.test(idempotencyKey)) {
      return NextResponse.json({ error: "A valid idempotency key is required" }, { status: 400 })
    }
    const previous = sentRequests.get(idempotencyKey)
    if (previous) return NextResponse.json(previous)
    const { session, refreshed } = await refreshGmailSession(current)
    const lastSentAt = lastSendByAccount.get(session.email) || 0
    if (Date.now() - lastSentAt < 750) {
      return NextResponse.json({ error: "Please wait briefly before sending the next email." }, { status: 429 })
    }
    const result = await sendGmailMessage(session, {
      to: String(input.to || ""),
      subject: String(input.subject || ""),
      body: String(input.body || ""),
    })
    if (refreshed) {
      (await cookies()).set(GMAIL_SESSION_COOKIE, seal(session), secureCookieOptions(60 * 60 * 24 * 30))
    }
    const receipt = { providerMessageId: result.id, threadId: result.threadId, sender: session.email, createdAt: Date.now() }
    sentRequests.set(idempotencyKey, receipt)
    lastSendByAccount.set(session.email, Date.now())
    if (sentRequests.size > 500) {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000
      for (const [key, value] of sentRequests) if (value.createdAt < cutoff) sentRequests.delete(key)
    }
    return NextResponse.json(receipt)
  } catch (error) {
    if (error instanceof GmailAuthError) {
      (await cookies()).delete(GMAIL_SESSION_COOKIE)
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Email sending failed" }, { status: 400 })
  }
}
