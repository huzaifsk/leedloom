"use client"

import { useState } from "react"
import { CircleHelpIcon, ExternalLinkIcon, Loader2Icon, MailIcon, ShieldCheckIcon, UnplugIcon } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { isValidWhatsAppSender, normalizedWhatsAppNumber, type GmailConnection, type WhatsAppProfile } from "@/lib/integrations"

type IntegrationChannel = "Email" | "WhatsApp"

export function IntegrationDialog({
  channel,
  onOpenChange,
  gmail,
  refreshGmail,
  whatsappProfile,
  onWhatsAppProfileChange,
}: {
  channel: IntegrationChannel | null
  onOpenChange: (open: boolean) => void
  gmail: GmailConnection
  refreshGmail: () => Promise<void>
  whatsappProfile: WhatsAppProfile
  onWhatsAppProfileChange: (profile: WhatsAppProfile) => void
}) {
  const [busy, setBusy] = useState(false)
  const [whatsappDraft, setWhatsAppDraft] = useState(whatsappProfile)
  const isEmail = channel === "Email"
  const whatsappReady = Boolean(whatsappDraft.name.trim()) && isValidWhatsAppSender(whatsappDraft.phone)

  function connectGmail() {
    if (!gmail.configured) {
      toast.error("Gmail needs Google OAuth credentials first.", {
        description: "Create .env.local from .env.example, add the Google client ID and secret, then restart the server.",
      })
      return
    }
    setBusy(true)
    window.location.assign(new URL("/api/integrations/gmail/connect", window.location.origin))
  }

  async function disconnectGmail() {
    setBusy(true)
    try {
      const response = await fetch("/api/integrations/gmail/disconnect", { method: "POST" })
      if (!response.ok) throw new Error("Could not disconnect Gmail")
      await refreshGmail()
      toast.success("Gmail disconnected.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect Gmail")
    } finally {
      setBusy(false)
    }
  }

  async function sendGmailTest() {
    if (!gmail.email) return
    setBusy(true)
    try {
      const response = await fetch("/api/integrations/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: gmail.email,
          subject: "Leadloom Gmail integration test",
          body: `Hi ${gmail.name || "there"},\n\nYour Leadloom Gmail integration is working. This message was sent through the Gmail API from ${gmail.email}.`,
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || "Test email failed")
      toast.success(`Test email sent from ${gmail.email}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test email failed")
    } finally {
      setBusy(false)
    }
  }

  function openWhatsAppTest() {
    if (!whatsappReady) {
      toast.error("Enter your name and WhatsApp number with country code first.")
      return
    }
    onWhatsAppProfileChange({ name: whatsappDraft.name.trim(), phone: whatsappDraft.phone.trim() })
    const url = `https://wa.me/${normalizedWhatsAppNumber(whatsappDraft.phone)}?text=${encodeURIComponent("Leadloom personal WhatsApp handoff test")}`
    const handoff = window.open(url, "_blank", "noopener,noreferrer")
    if (handoff) handoff.opener = null
    toast.success("WhatsApp profile saved.", {
      description: "Complete the test by pressing Send in WhatsApp.",
    })
  }

  return (
    <Dialog open={channel !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{channel ?? "Channel"} integration</DialogTitle>
          <DialogDescription>
            {isEmail ? "Connect the exact Google account that will send job applications." : "Declare the personal WhatsApp identity you will use for assisted sending."}
          </DialogDescription>
        </DialogHeader>

        {isEmail ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted"><MailIcon className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{gmail.connected ? gmail.name || gmail.email : "Gmail API"}</p>
                <p className="truncate text-sm text-muted-foreground">{gmail.connected ? gmail.email : gmail.configured ? "Ready to authorize" : "Server setup required"}</p>
              </div>
              <Badge variant={gmail.connected ? "default" : gmail.configured ? "secondary" : "destructive"}>{gmail.connected ? "Connected" : gmail.configured ? "Disconnected" : "Not configured"}</Badge>
            </div>

            {!gmail.configured && (
              <Alert variant="destructive">
                <CircleHelpIcon />
                <AlertTitle>Google OAuth environment values are missing</AlertTitle>
                <AlertDescription>Add the values from <code>.env.example</code> to <code>.env.local</code>, then restart the development server.</AlertDescription>
              </Alert>
            )}
            {gmail.configured && !gmail.connected && (
              <Alert>
                <ShieldCheckIcon />
                <AlertTitle>Secure server-side authorization</AlertTitle>
                <AlertDescription>Google will show the account chooser and Gmail send permission. Tokens are encrypted in an HTTP-only cookie and are never exposed to client JavaScript.</AlertDescription>
              </Alert>
            )}
            {gmail.connected && (
              <Alert>
                <ShieldCheckIcon />
                <AlertTitle>Sender identity verified</AlertTitle>
                <AlertDescription>Every Gmail recipient will see <strong>{gmail.name || gmail.email}</strong> from <strong>{gmail.email}</strong>, and replies return to that address.</AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="whatsapp-sender-name">WhatsApp profile name</FieldLabel>
              <Input id="whatsapp-sender-name" value={whatsappDraft.name} onChange={(event) => setWhatsAppDraft({ ...whatsappDraft, name: event.target.value })} placeholder="Your name" />
            </Field>
            <Field data-invalid={Boolean(whatsappDraft.phone) && !isValidWhatsAppSender(whatsappDraft.phone)}>
              <FieldLabel htmlFor="whatsapp-sender-phone">Personal WhatsApp number</FieldLabel>
              <Input id="whatsapp-sender-phone" aria-invalid={Boolean(whatsappDraft.phone) && !isValidWhatsAppSender(whatsappDraft.phone)} value={whatsappDraft.phone} onChange={(event) => setWhatsAppDraft({ ...whatsappDraft, phone: event.target.value })} placeholder="+91 98765 43210" inputMode="tel" />
              <FieldDescription>Include the country code. The actual sender is the account logged into WhatsApp when you press Send.</FieldDescription>
            </Field>
            <Alert>
              <CircleHelpIcon />
              <AlertTitle>Personal assisted mode</AlertTitle>
              <AlertDescription>Leadloom can verify that it opened the recipient and message, but only you can confirm that Send was pressed. WhatsApp delivery and read receipts are not available to this mode.</AlertDescription>
            </Alert>
          </FieldGroup>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          {isEmail && gmail.connected && (
            <Button variant="outline" disabled={busy} onClick={disconnectGmail}>
              <UnplugIcon data-icon="inline-start" />
              Disconnect
            </Button>
          )}
          {isEmail ? (
            gmail.connected ? (
              <Button disabled={busy} onClick={sendGmailTest}>
                {busy ? <Loader2Icon data-icon="inline-start" className="animate-spin" /> : <MailIcon data-icon="inline-start" />}
                Send test to myself
              </Button>
            ) : (
              <Button disabled={busy} onClick={connectGmail}>
                {busy ? <Loader2Icon data-icon="inline-start" className="animate-spin" /> : <ExternalLinkIcon data-icon="inline-start" />}
                {busy ? "Opening Google…" : gmail.configured ? "Connect Gmail" : "Show setup required"}
              </Button>
            )
          ) : (
            <Button disabled={!whatsappReady} onClick={openWhatsAppTest}>
              <ExternalLinkIcon data-icon="inline-start" />
              Save & test handoff
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
