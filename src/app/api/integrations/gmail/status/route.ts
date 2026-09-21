import { NextResponse } from "next/server"

import { getGmailSession, gmailIsConfigured } from "@/lib/gmail"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const configured = gmailIsConfigured()
  const session = configured ? await getGmailSession() : null
  return NextResponse.json({
    configured,
    connected: Boolean(session),
    email: session?.email,
    name: session?.name,
    picture: session?.picture,
    expiresAt: session?.expiresAt,
  }, { headers: { "Cache-Control": "no-store" } })
}
