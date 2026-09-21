"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type * as React from "react"
import {
  ArrowRightIcon,
  BriefcaseBusinessIcon,
  CheckCircle2Icon,
  CircleHelpIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FileSpreadsheetIcon,
  InboxIcon,
  LayoutDashboardIcon,
  Loader2Icon,
  MailIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  Settings2Icon,
  SparklesIcon,
  UploadIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { IntegrationDialog } from "@/components/integration-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  defaultTemplates,
  demoLeads,
  isValidContact,
  renderTemplate,
  safeSourceUrl,
  type Lead,
  type MessageTemplate,
} from "@/lib/jobflow"
import { leadImportAccept, parseLeadFile } from "@/lib/import-leads"
import { emptyWhatsAppProfile, isValidWhatsAppSender, normalizedWhatsAppRecipient, type GmailConnection, type WhatsAppProfile } from "@/lib/integrations"
import { formatAttachmentSize, MESSAGE_ATTACHMENT_ACCEPT, validateMessageAttachments } from "@/lib/message-attachments"
import { loadLeads, loadSenderName, loadTemplates, loadWhatsAppProfile, saveLeads, saveSenderName, saveTemplates, saveWhatsAppProfile } from "@/lib/storage"
import { cn } from "@/lib/utils"

type View = "leads" | "templates" | "campaigns" | "settings"
type ChannelFilter = "All" | "Email" | "WhatsApp" | "Research"

const navItems: { value: View; label: string; icon: typeof UsersIcon }[] = [
  { value: "leads", label: "Lead inbox", icon: InboxIcon },
  { value: "templates", label: "Templates", icon: SparklesIcon },
  { value: "campaigns", label: "Send history", icon: SendIcon },
  { value: "settings", label: "Workspace", icon: Settings2Icon },
]

const placeholders = ["{{name}}", "{{company}}", "{{role}}", "{{sender_name}}", "{{contact}}"]

function statusVariant(status: Lead["status"]): "default" | "secondary" | "destructive" | "outline" {
  if (status === "sent" || status === "replied") return "default"
  if (status === "invalid") return "destructive"
  if (status === "ready" || status === "queued" || status === "opened") return "secondary"
  return "outline"
}

function initials(value: string) {
  const clean = value.replace(/[^a-zA-Z ]/g, " ").trim()
  return clean ? clean.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() : "HR"
}

function contactLabel(lead: Lead) {
  if (lead.label) return lead.label
  if (lead.type === "Email") return lead.value.split("@")[0].replace(/[._-]/g, " ")
  if (lead.type === "WhatsApp") return `WhatsApp ${lead.value.slice(-4)}`
  return lead.value || "Untitled lead"
}

function capturedAtLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value || "—" : date.toISOString().slice(0, 16).replace("T", " ")
}

export function JobflowApp() {
  const [view, setView] = useState<View>("leads")
  const [leads, setLeads] = useState<Lead[]>(demoLeads)
  const [templates, setTemplates] = useState<MessageTemplate[]>(defaultTemplates)
  const [senderName, setSenderName] = useState("Alex Morgan")
  const [whatsappProfile, setWhatsAppProfile] = useState<WhatsAppProfile>(emptyWhatsAppProfile)
  const [gmail, setGmail] = useState<GmailConnection>({ configured: false, connected: false })
  const [selected, setSelected] = useState<string[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [integrationOpen, setIntegrationOpen] = useState<"Email" | "WhatsApp" | null>(null)
  const [queueOpen, setQueueOpen] = useState(false)
  const [queueIds, setQueueIds] = useState<string[]>([])
  const [queueRunId, setQueueRunId] = useState("")
  const [queueIndex, setQueueIndex] = useState(0)
  const [activeTemplateId, setActiveTemplateId] = useState(defaultTemplates[0].id)
  const [attachments, setAttachments] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement>(null)

  const refreshGmailStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/integrations/gmail/status", { cache: "no-store" })
      if (!response.ok) throw new Error("Could not read Gmail status")
      setGmail(await response.json() as GmailConnection)
    } catch {
      setGmail({ configured: false, connected: false })
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLeads(loadLeads(demoLeads))
      setTemplates(loadTemplates(defaultTemplates))
      setSenderName(loadSenderName())
      setWhatsAppProfile(loadWhatsAppProfile())
      setHydrated(true)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshGmailStatus()
      const url = new URL(window.location.href)
      const result = url.searchParams.get("gmail")
      if (result) {
        setIntegrationOpen("Email")
        if (result === "connected") toast.success("Gmail connected successfully.")
        if (result === "error") toast.error(url.searchParams.get("reason") || "Gmail connection failed.")
        if (result === "not-configured") toast.error("Add the Google OAuth values to .env.local first.")
        url.searchParams.delete("gmail")
        url.searchParams.delete("reason")
        window.history.replaceState({}, "", url)
      }
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [refreshGmailStatus])

  useEffect(() => {
    if (hydrated) saveLeads(leads)
  }, [hydrated, leads])

  useEffect(() => {
    if (hydrated) saveTemplates(templates)
  }, [hydrated, templates])

  useEffect(() => {
    if (hydrated) saveSenderName(senderName)
  }, [hydrated, senderName])

  useEffect(() => {
    if (hydrated) saveWhatsAppProfile(whatsappProfile)
  }, [hydrated, whatsappProfile])

  const readyCount = leads.filter((lead) => lead.status === "ready").length
  const sentCount = leads.filter((lead) => lead.status === "sent").length
  const replyCount = leads.filter((lead) => lead.status === "replied").length
  const queueLeads = queueIds.map((id) => leads.find((lead) => lead.id === id)).filter(Boolean) as Lead[]
  const currentQueueLead = queueLeads[queueIndex]

  function clearAttachments() {
    setAttachments([])
    if (attachmentInputRef.current) attachmentInputRef.current.value = ""
  }

  function selectAttachments(event: React.ChangeEvent<HTMLInputElement>) {
    const next = Array.from(event.currentTarget.files || [])
    const error = validateMessageAttachments(next)
    if (error) {
      event.currentTarget.value = ""
      setAttachments([])
      toast.error(error)
      return
    }
    setAttachments(next)
  }

  function removeAttachment(index: number) {
    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))
    if (attachmentInputRef.current) attachmentInputRef.current.value = ""
  }

  function startQueue() {
    const sendable = selected.filter((id) => {
      const lead = leads.find((item) => item.id === id)
      return lead && isValidContact(lead.type, lead.value)
    })
    if (!sendable.length) {
      toast.error("Select at least one valid email or WhatsApp contact.")
      return
    }
    setQueueIds(sendable)
    clearAttachments()
    setQueueRunId(crypto.randomUUID())
    setQueueIndex(0)
    const first = leads.find((lead) => lead.id === sendable[0])
    const matching = templates.find((template) => template.channel === first?.type)
    if (matching) setActiveTemplateId(matching.id)
    setLeads((current) => current.map((lead) => sendable.includes(lead.id) ? { ...lead, status: "queued" } : lead))
    setQueueOpen(true)
  }

  function advanceQueue(markSent: boolean, receipt?: Partial<Lead>) {
    if (!currentQueueLead) return
    if (markSent) {
      setLeads((current) => current.map((lead) => lead.id === currentQueueLead.id ? { ...lead, ...receipt, status: "sent", sentAt: new Date().toISOString() } : lead))
    } else {
      setLeads((current) => current.map((lead) => lead.id === currentQueueLead.id ? { ...lead, status: "ready" } : lead))
    }
    if (queueIndex >= queueLeads.length - 1) {
      setQueueOpen(false)
      setSelected([])
      clearAttachments()
      toast.success(markSent ? "Send queue complete." : "Queue closed.")
      return
    }
    const next = queueLeads[queueIndex + 1]
    const matching = templates.find((template) => template.channel === next.type)
    if (matching) setActiveTemplateId(matching.id)
    setQueueIndex((index) => index + 1)
  }

  const activeTemplate = templates.find((template) => template.id === activeTemplateId) ?? templates[0]
  const resolvedSenderName = currentQueueLead?.type === "Email" ? gmail.name || senderName : whatsappProfile.name || senderName
  const subject = currentQueueLead && activeTemplate ? renderTemplate(activeTemplate.subject, currentQueueLead, resolvedSenderName) : ""
  const body = currentQueueLead && activeTemplate ? renderTemplate(activeTemplate.body, currentQueueLead, resolvedSenderName) : ""

  function openWhatsAppDraft() {
    if (!currentQueueLead || !activeTemplate) return
    const phone = normalizedWhatsAppRecipient(currentQueueLead.value, whatsappProfile.phone)
    if (!phone) {
      toast.error("This recipient number cannot be converted to a valid international WhatsApp number.")
      return
    }
    setLeads((current) => current.map((lead) => lead.id === currentQueueLead.id ? { ...lead, status: "opened" } : lead))
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer")
  }

  async function shareWhatsAppAttachments() {
    if (!attachments.length) return
    const shareData: ShareData = { files: attachments, title: `Application files for ${contactLabel(currentQueueLead!)}` }
    if (!navigator.share || !navigator.canShare?.(shareData)) {
      toast.error("This browser cannot hand these files to WhatsApp. Use WhatsApp’s paperclip button to attach them manually.")
      return
    }
    try {
      await navigator.share(shareData)
      toast.success("Files shared. Choose the correct WhatsApp conversation, then confirm only after sending.")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      toast.error("The files could not be shared. Attach them from WhatsApp instead.")
    }
  }

  async function sendCurrentEmail() {
    if (!currentQueueLead || currentQueueLead.type !== "Email" || !gmail.connected) return
    setSending(true)
    try {
      const form = new FormData()
      form.set("to", currentQueueLead.value)
      form.set("subject", subject)
      form.set("body", body)
      form.set("idempotencyKey", `${queueRunId}:${currentQueueLead.id}`)
      attachments.forEach((file) => form.append("attachments", file, file.name))
      const response = await fetch("/api/integrations/gmail/send", { method: "POST", body: form })
      const result = await response.json() as { error?: string; providerMessageId?: string }
      if (!response.ok || !result.providerMessageId) throw new Error(result.error || "Gmail did not accept the message")
      toast.success(`Email sent from ${gmail.email}.`, { description: `${attachments.length ? `${attachments.length} attachment${attachments.length === 1 ? "" : "s"} · ` : ""}Gmail message ID: ${result.providerMessageId}` })
      advanceQueue(true, { senderIdentity: gmail.email, providerMessageId: result.providerMessageId, sendMode: "gmail_api", attachmentNames: attachments.map((file) => file.name) })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Email sending failed")
      await refreshGmailStatus()
    } finally {
      setSending(false)
    }
  }

  return (
    <SidebarProvider className="overflow-x-clip">
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
          <button className="flex items-center gap-3 text-left" onClick={() => setView("leads")}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BriefcaseBusinessIcon className="size-4" />
            </span>
            <span className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="font-heading text-sm font-semibold">Leadloom</span>
              <span className="text-xs text-muted-foreground">Job outreach</span>
            </span>
          </button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.value}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={view === item.value}
                      onClick={() => setView(item.value)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {item.value === "leads" && <SidebarMenuBadge>{readyCount}</SidebarMenuBadge>}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Channels</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setIntegrationOpen("Email")} tooltip="Email integration">
                    <MailIcon />
                    <span>Email</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setIntegrationOpen("WhatsApp")} tooltip="WhatsApp integration">
                    <MessageCircleIcon />
                    <span>WhatsApp</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-2 rounded-lg p-2 group-data-[collapsible=icon]:justify-center">
            <Avatar className="size-8">
              <AvatarFallback>{initials(senderName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium">{senderName || "Your workspace"}</p>
              <p className="truncate text-xs text-muted-foreground">Personal plan</p>
            </div>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="max-w-full overflow-x-clip">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-6">
          <SidebarTrigger />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-sm text-muted-foreground">Workspace</span>
            <span className="text-muted-foreground">/</span>
            <span className="truncate text-sm font-medium">{navItems.find((item) => item.value === view)?.label}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <UploadIcon data-icon="inline-start" />
            Import list
          </Button>
          <Button size="sm" disabled={!selected.length} onClick={startQueue}>
            <SendIcon data-icon="inline-start" />
            Send <span className="hidden sm:inline">selected</span>{selected.length ? ` (${selected.length})` : ""}
          </Button>
        </header>

        {view === "leads" && (
          <LeadsView
            leads={leads}
            setLeads={setLeads}
            selected={selected}
            setSelected={setSelected}
            onImport={() => setImportOpen(true)}
            onSend={startQueue}
          />
        )}
        {view === "templates" && <TemplatesView templates={templates} setTemplates={setTemplates} />}
        {view === "campaigns" && <HistoryView leads={leads} sentCount={sentCount} replyCount={replyCount} />}
        {view === "settings" && <SettingsView senderName={senderName} setSenderName={setSenderName} onOpenIntegration={setIntegrationOpen} gmail={gmail} whatsappProfile={whatsappProfile} />}
      </SidebarInset>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={(items) => {
        setLeads(items)
        setSelected([])
        setView("leads")
      }} />

      <IntegrationDialog
        key={integrationOpen ?? "closed"}
        channel={integrationOpen}
        onOpenChange={(open) => !open && setIntegrationOpen(null)}
        gmail={gmail}
        refreshGmail={refreshGmailStatus}
        whatsappProfile={whatsappProfile}
        onWhatsAppProfileChange={setWhatsAppProfile}
      />

      <Dialog open={queueOpen} onOpenChange={(open) => {
        if (!open && currentQueueLead) {
          setLeads((current) => current.map((lead) => queueIds.slice(queueIndex).includes(lead.id) && (lead.status === "queued" || lead.status === "opened") ? { ...lead, status: "ready" } : lead))
        }
        if (!open) clearAttachments()
        setQueueOpen(open)
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Send one-by-one</DialogTitle>
            <DialogDescription>Review every personalized message before opening it in your connected app.</DialogDescription>
          </DialogHeader>
          {currentQueueLead && activeTemplate && (
            <div className="flex flex-col gap-4">
              <Progress value={queueIndex + 1} max={queueLeads.length}>
                <ProgressLabel>Recipient {queueIndex + 1} of {queueLeads.length}</ProgressLabel>
                <ProgressValue />
              </Progress>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Avatar className="size-9"><AvatarFallback>{initials(contactLabel(currentQueueLead))}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{contactLabel(currentQueueLead)}</p>
                  <p className="truncate text-xs text-muted-foreground">{currentQueueLead.value}</p>
                </div>
                <Badge variant="secondary">{currentQueueLead.type}</Badge>
              </div>
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">From</p>
                  <p className="truncate font-medium">
                    {currentQueueLead.type === "Email"
                      ? gmail.connected ? `${gmail.name || gmail.email} <${gmail.email}>` : "Gmail not connected"
                      : isValidWhatsAppSender(whatsappProfile.phone) ? `${whatsappProfile.name || "Personal WhatsApp"} · ${whatsappProfile.phone}` : "Personal WhatsApp not configured"}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">To</p>
                  <p className="truncate font-medium">{currentQueueLead.value}</p>
                </div>
              </div>
              {currentQueueLead.type === "WhatsApp" && (
                <Alert>
                  <CircleHelpIcon />
                  <AlertTitle>Manual confirmation required</AlertTitle>
                  <AlertDescription>
                    Leadloom can prefill the message, but WhatsApp does not let a web link pre-attach local files. Open WhatsApp, then use Share attachments or WhatsApp’s paperclip button. Only confirm after pressing Send.
                  </AlertDescription>
                </Alert>
              )}
              <FieldGroup>
                <Field>
                  <FieldLabel>Template</FieldLabel>
                  <Select value={activeTemplateId} onValueChange={(value) => value && setActiveTemplateId(String(value))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {templates.filter((template) => template.channel === currentQueueLead.type).map((template) => (
                          <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                {currentQueueLead.type === "Email" && (
                  <Field>
                    <FieldLabel>Subject</FieldLabel>
                    <Input value={subject} readOnly />
                  </Field>
                )}
                <Field>
                  <FieldLabel>Message preview</FieldLabel>
                  <Textarea value={body} readOnly className="min-h-44 resize-none" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="message-attachments">Attachments</FieldLabel>
                  <Input
                    ref={attachmentInputRef}
                    id="message-attachments"
                    type="file"
                    accept={MESSAGE_ATTACHMENT_ACCEPT}
                    multiple
                    onChange={selectAttachments}
                  />
                  <FieldDescription>Optional. Add up to 3 PDF, DOC, DOCX, or TXT files; 2 MB each and 3 MB total. They stay selected for this send queue.</FieldDescription>
                  {attachments.length > 0 && (
                    <div className="grid gap-2" aria-label="Selected attachments">
                      {attachments.map((file, index) => (
                        <div key={`${file.name}-${file.lastModified}-${index}`} className="flex min-w-0 items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                          <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{file.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatAttachmentSize(file.size)}</span>
                          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${file.name}`} onClick={() => removeAttachment(index)}>
                            <XIcon />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Field>
              </FieldGroup>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => advanceQueue(false)}>Skip</Button>
            {currentQueueLead?.type === "Email" ? (
              gmail.connected ? (
                <Button disabled={sending} onClick={sendCurrentEmail}>
                  {sending ? <Loader2Icon data-icon="inline-start" className="animate-spin" /> : <MailIcon data-icon="inline-start" />}
                  {sending ? "Sending…" : "Send email & next"}
                </Button>
              ) : (
                <Button onClick={() => {
                  setLeads((current) => current.map((lead) => queueIds.slice(queueIndex).includes(lead.id) ? { ...lead, status: "ready" } : lead))
                  setQueueOpen(false)
                  setSelected([])
                  setIntegrationOpen("Email")
                }}>
                  Connect Gmail
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              )
            ) : (
              <>
                {attachments.length > 0 && (
                  <Button variant="outline" disabled={currentQueueLead.status !== "opened"} onClick={() => void shareWhatsAppAttachments()}>
                    <PaperclipIcon data-icon="inline-start" />
                    Share attachments
                  </Button>
                )}
                <Button variant="outline" disabled={!isValidWhatsAppSender(whatsappProfile.phone)} onClick={openWhatsAppDraft}>
                  <ExternalLinkIcon data-icon="inline-start" />
                  Open WhatsApp
                </Button>
                <Button disabled={currentQueueLead?.status !== "opened"} onClick={() => advanceQueue(true, { senderIdentity: `${whatsappProfile.name} <${whatsappProfile.phone}>`, sendMode: "whatsapp_personal", attachmentNames: attachments.map((file) => file.name) })}>
                  I sent it & next
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}

function LeadsView({ leads, setLeads, selected, setSelected, onImport, onSend }: {
  leads: Lead[]
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>
  selected: string[]
  setSelected: React.Dispatch<React.SetStateAction<string[]>>
  onImport: () => void
  onSend: () => void
}) {
  const [query, setQuery] = useState("")
  const [channel, setChannel] = useState<ChannelFilter>("All")
  const sendable = leads.filter((lead) => isValidContact(lead.type, lead.value))
  const visible = useMemo(() => leads.filter((lead) => {
    const matchesQuery = `${lead.value} ${lead.label} ${lead.context} ${lead.type} ${lead.sourceType} ${lead.confidence} ${lead.section} ${lead.pageTitle}`.toLowerCase().includes(query.toLowerCase())
    const matchesChannel = channel === "All" || lead.type === channel || (channel === "Research" && !["Email", "WhatsApp"].includes(lead.type))
    return matchesQuery && matchesChannel
  }), [channel, leads, query])
  const visibleSendable = visible.filter((lead) => isValidContact(lead.type, lead.value))
  const allVisibleSelected = visibleSendable.length > 0 && visibleSendable.every((lead) => selected.includes(lead.id))

  function toggleAll(checked: boolean) {
    const ids = visibleSendable.map((lead) => lead.id)
    setSelected((current) => checked ? Array.from(new Set([...current, ...ids])) : current.filter((id) => !ids.includes(id)))
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="mb-1">Personal outreach workspace</Badge>
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">Turn job leads into conversations.</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">Import your captured list, review contact quality, and send tailored drafts one HR at a time.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onImport}>
            <FileSpreadsheetIcon data-icon="inline-start" />
            Replace list
          </Button>
          <Button disabled={!selected.length} onClick={onSend}>
            <SendIcon data-icon="inline-start" />
            Review queue
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Imported records" value={leads.length} helper="Across all captured types" icon={UsersIcon} />
        <MetricCard label="Ready to contact" value={sendable.filter((lead) => lead.status !== "sent").length} helper="Validated email or phone" icon={CheckCircle2Icon} />
        <MetricCard label="Sent" value={leads.filter((lead) => lead.status === "sent").length} helper="Marked complete by you" icon={SendIcon} />
        <MetricCard label="Needs review" value={leads.filter((lead) => lead.status === "invalid").length} helper="Invalid or incomplete contact" icon={CircleHelpIcon} />
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Lead inbox</CardTitle>
          <CardDescription>{visible.length} records shown · {selected.length} selected</CardDescription>
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}><MoreHorizontalIcon /><span className="sr-only">Lead actions</span></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setSelected(sendable.map((lead) => lead.id))}>Select all valid contacts</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelected([])}>Clear selection</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLeads((current) => current.map((lead) => lead.status === "invalid" ? { ...lead, status: "new" } : lead))}>Reset review flags</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-4 px-0">
          <div className="flex flex-col gap-2 px-4 sm:flex-row">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search contacts, roles, or context…" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <Select value={channel} onValueChange={(value) => value && setChannel(value as ChannelFilter)}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(["All", "Email", "WhatsApp", "Research"] as ChannelFilter[]).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="h-[min(55vh,36rem)] min-w-0 max-w-full border-y">
            <Table className="table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-10"><Checkbox aria-label="Select all valid visible leads" checked={allVisibleSelected} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead className="w-[46%] md:w-[34%] lg:w-[24%]">Lead</TableHead>
                  <TableHead className="hidden w-40 md:table-cell">Type</TableHead>
                  <TableHead className="hidden lg:table-cell">Source details</TableHead>
                  <TableHead className="hidden w-36 xl:table-cell">Captured</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead className="w-20 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((lead) => {
                  const canSend = isValidContact(lead.type, lead.value)
                  const actionUrl = safeSourceUrl(lead.link)
                  return (
                    <TableRow key={lead.id} data-state={selected.includes(lead.id) ? "selected" : undefined}>
                      <TableCell className="w-10"><Checkbox aria-label={`Select ${contactLabel(lead)}`} disabled={!canSend} checked={selected.includes(lead.id)} onCheckedChange={(checked) => setSelected((current) => checked ? [...current, lead.id] : current.filter((id) => id !== lead.id))} /></TableCell>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar className="hidden size-8 shrink-0 sm:flex"><AvatarFallback>{initials(contactLabel(lead))}</AvatarFallback></Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium capitalize">{contactLabel(lead)}</p>
                            <p className="truncate text-xs text-muted-foreground">{lead.value}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex min-w-0 flex-col items-start gap-1">
                          <Badge variant={lead.type === "Email" || lead.type === "WhatsApp" ? "secondary" : "outline"}>{lead.sourceType || lead.type}</Badge>
                          <span className="truncate text-xs capitalize text-muted-foreground">{lead.confidence || "No confidence"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="min-w-0">
                          <p className="truncate text-muted-foreground" title={lead.context}>{lead.context || "No context captured"}</p>
                          <p className="truncate text-xs text-muted-foreground" title={[lead.section, lead.pageTitle].filter(Boolean).join(" · ")}>{[lead.section, lead.pageTitle].filter(Boolean).join(" · ") || "No page details"}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell"><span className="text-xs text-muted-foreground">{capturedAtLabel(lead.capturedAt)}</span></TableCell>
                      <TableCell><Badge variant={statusVariant(lead.status)} className="capitalize">{lead.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        {actionUrl ? (
                          <Button nativeButton={false} variant="ghost" size="sm" render={<a href={actionUrl} target="_blank" rel="noopener noreferrer" title="Open imported link" />}>
                            Open
                            <ExternalLinkIcon data-icon="inline-end" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
        <CardFooter className="justify-between gap-3">
          <p className="text-xs text-muted-foreground">The Open action appears only when the imported Link column contains a valid URL.</p>
          <Button size="sm" disabled={!selected.length} onClick={onSend}>Review {selected.length || ""} selected <ArrowRightIcon data-icon="inline-end" /></Button>
        </CardFooter>
      </Card>
    </div>
  )
}

function MetricCard({ label, value, helper, icon: Icon }: { label: string; value: number; helper: string; icon: typeof UsersIcon }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardAction><span className="flex size-8 items-center justify-center rounded-lg bg-muted"><Icon className="size-4" /></span></CardAction>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent><p className="text-xs text-muted-foreground">{helper}</p></CardContent>
    </Card>
  )
}

function ImportDialog({ open, onOpenChange, onImport }: { open: boolean; onOpenChange: (open: boolean) => void; onImport: (leads: Lead[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function importFile() {
    if (!file) return
    setLoading(true)
    setError("")
    try {
      const imported = await parseLeadFile(file)
      onImport(imported)
      onOpenChange(false)
      setFile(null)
      toast.success(`Imported ${imported.length} records.`, { description: `${imported.filter((lead) => lead.status === "ready").length} are ready to contact.` })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not read this workbook.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import lead list</DialogTitle>
          <DialogDescription>Upload a CSV, XLS, or XLSX using the supplied Jobhunter export format. Processing stays in this browser.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="lead-file">Spreadsheet</FieldLabel>
            <button type="button" className="flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/30 p-6 text-center hover:bg-muted/60" onClick={() => inputRef.current?.click()}>
              <span className="flex size-10 items-center justify-center rounded-lg bg-background ring-1 ring-foreground/10"><FileSpreadsheetIcon className="size-5" /></span>
              <span className="font-medium">{file ? file.name : "Choose a CSV, XLS, or XLSX file"}</span>
              <span className="text-xs text-muted-foreground">Expected columns: Type, Value, Label, Link, Section, Context, Confidence, Page title, Page URL, Post URL (optional), Captured at</span>
            </button>
            <Input ref={inputRef} id="lead-file" type="file" accept={leadImportAccept} className="sr-only" onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
              setError("")
            }} />
            <FieldDescription>Existing leads will be replaced after a successful import.</FieldDescription>
          </Field>
        </FieldGroup>
        {error && <Alert variant="destructive"><CircleHelpIcon /><AlertTitle>Import failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!file || loading} onClick={importFile}>
            <UploadIcon data-icon="inline-start" />
            {loading ? "Reading file…" : "Import records"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TemplatesView({ templates, setTemplates }: { templates: MessageTemplate[]; setTemplates: React.Dispatch<React.SetStateAction<MessageTemplate[]>> }) {
  const [activeId, setActiveId] = useState(templates[0]?.id ?? "")
  const active = templates.find((template) => template.id === activeId) ?? templates[0]

  function update(patch: Partial<MessageTemplate>) {
    if (!active) return
    setTemplates((current) => current.map((template) => template.id === active.id ? { ...template, ...patch } : template))
  }

  function addTemplate() {
    const template: MessageTemplate = { id: `template-${Date.now()}`, name: "Untitled template", channel: "Email", subject: "Application for {{role}}", body: "Hi {{name}},\n\nI’m interested in the {{role}} opportunity at {{company}}.\n\nBest,\n{{sender_name}}" }
    setTemplates((current) => [...current, template])
    setActiveId(template.id)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1"><h1 className="font-heading text-2xl font-semibold">Message templates</h1><p className="text-sm text-muted-foreground">Create reusable drafts with personalized fields.</p></div>
        <Button onClick={addTemplate}><PlusIcon data-icon="inline-start" />New template</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle>Library</CardTitle><CardDescription>{templates.length} saved templates</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {templates.map((template) => (
              <button key={template.id} className={cn("flex items-start gap-3 rounded-lg border p-3 text-left transition-colors", active?.id === template.id ? "border-primary bg-primary/5" : "hover:bg-muted/50")} onClick={() => setActiveId(template.id)}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">{template.channel === "Email" ? <MailIcon className="size-4" /> : <MessageCircleIcon className="size-4" />}</span>
                <span className="min-w-0"><span className="block truncate font-medium">{template.name}</span><span className="text-xs text-muted-foreground">{template.channel}</span></span>
              </button>
            ))}
          </CardContent>
        </Card>
        {active && (
          <Card>
            <CardHeader><CardTitle>Edit template</CardTitle><CardDescription>Changes save automatically in this browser.</CardDescription><CardAction><Badge variant="secondary">{active.channel}</Badge></CardAction></CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field><FieldLabel htmlFor="template-name">Template name</FieldLabel><Input id="template-name" value={active.name} onChange={(event) => update({ name: event.target.value })} /></Field>
                  <Field><FieldLabel>Channel</FieldLabel><Select value={active.channel} onValueChange={(value) => value && update({ channel: value as MessageTemplate["channel"] })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="Email">Email</SelectItem><SelectItem value="WhatsApp">WhatsApp</SelectItem></SelectGroup></SelectContent></Select></Field>
                </div>
                {active.channel === "Email" && <Field><FieldLabel htmlFor="template-subject">Subject</FieldLabel><Input id="template-subject" value={active.subject} onChange={(event) => update({ subject: event.target.value })} /></Field>}
                <Field><FieldLabel htmlFor="template-body">Message</FieldLabel><Textarea id="template-body" className="min-h-64 resize-y" value={active.body} onChange={(event) => update({ body: event.target.value })} /><FieldDescription>Available fields are replaced for each recipient.</FieldDescription></Field>
                <Field><FieldLabel>Personalization fields</FieldLabel><div className="flex flex-wrap gap-2">{placeholders.map((placeholder) => <Button key={placeholder} variant="outline" size="xs" onClick={() => update({ body: `${active.body}${active.body.endsWith(" ") ? "" : " "}${placeholder}` })}>{placeholder}</Button>)}</div></Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-between"><p className="text-xs text-muted-foreground">Preview appears when you start a send queue.</p><Badge variant="outline">Saved locally</Badge></CardFooter>
          </Card>
        )}
      </div>
    </div>
  )
}

function HistoryView({ leads, sentCount, replyCount }: { leads: Lead[]; sentCount: number; replyCount: number }) {
  const sent = leads.filter((lead) => lead.status === "sent" || lead.status === "replied")
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-1"><h1 className="font-heading text-2xl font-semibold">Send history</h1><p className="text-sm text-muted-foreground">A lightweight record of drafts you marked as sent.</p></div>
      <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Sent" value={sentCount} helper="Email and WhatsApp" icon={SendIcon} /><MetricCard label="Replies" value={replyCount} helper="Marked manually" icon={MessageCircleIcon} /><MetricCard label="Reply rate" value={sentCount ? Math.round((replyCount / sentCount) * 100) : 0} helper="Percentage of sent leads" icon={LayoutDashboardIcon} /></div>
      <Card><CardHeader><CardTitle>Recent outreach</CardTitle><CardDescription>{sent.length ? `${sent.length} completed contacts` : "Nothing sent yet"}</CardDescription></CardHeader><CardContent>
        {sent.length ? <div className="flex flex-col gap-2">{sent.map((lead) => <div key={lead.id} className="flex items-center gap-3 rounded-lg border p-3"><Avatar className="size-8"><AvatarFallback>{initials(contactLabel(lead))}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate font-medium">{contactLabel(lead)}</p><p className="truncate text-xs text-muted-foreground">{lead.value}</p>{lead.attachmentNames?.length ? <p className="truncate text-xs text-muted-foreground"><PaperclipIcon className="mr-1 inline size-3" />{lead.attachmentNames.join(", ")}</p> : null}</div><Badge variant={statusVariant(lead.status)}>{lead.status}</Badge></div>)}</div> : <Alert><SparklesIcon /><AlertTitle>Your history is ready</AlertTitle><AlertDescription>Select validated contacts in the lead inbox and complete the one-by-one send queue.</AlertDescription></Alert>}
      </CardContent></Card>
    </div>
  )
}

function SettingsView({ senderName, setSenderName, onOpenIntegration, gmail, whatsappProfile }: { senderName: string; setSenderName: (name: string) => void; onOpenIntegration: (channel: "Email" | "WhatsApp") => void; gmail: GmailConnection; whatsappProfile: WhatsAppProfile }) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-1"><h1 className="font-heading text-2xl font-semibold">Workspace</h1><p className="text-sm text-muted-foreground">Personalize drafts and understand the current integration mode.</p></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Sender profile</CardTitle><CardDescription>Used by the <code>{"{{sender_name}}"}</code> template field.</CardDescription></CardHeader><CardContent><FieldGroup><Field><FieldLabel htmlFor="sender-name">Your name</FieldLabel><Input id="sender-name" value={senderName} onChange={(event) => setSenderName(event.target.value)} /><FieldDescription>Saved only in this browser.</FieldDescription></Field></FieldGroup></CardContent></Card>
        <Card>
          <CardHeader><CardTitle>Connected channels</CardTitle><CardDescription>Open either channel to review or test its single-user handoff.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <MailIcon className="size-5" />
              <div className="min-w-0 flex-1"><p className="font-medium">Gmail API</p><p className="truncate text-xs text-muted-foreground">{gmail.connected ? gmail.email : gmail.configured ? "Ready to connect" : "OAuth setup required"}</p></div>
              <Badge variant={gmail.connected ? "default" : gmail.configured ? "secondary" : "destructive"}>{gmail.connected ? "Connected" : gmail.configured ? "Disconnected" : "Setup required"}</Badge>
              <Button variant="outline" size="sm" onClick={() => onOpenIntegration("Email")}>Manage</Button>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <MessageCircleIcon className="size-5" />
              <div className="min-w-0 flex-1"><p className="font-medium">WhatsApp Web / app</p><p className="truncate text-xs text-muted-foreground">One wa.me conversation at a time</p></div>
              <Badge variant={isValidWhatsAppSender(whatsappProfile.phone) ? "secondary" : "outline"}>{isValidWhatsAppSender(whatsappProfile.phone) ? "Assisted" : "Setup required"}</Badge>
              <Button variant="outline" size="sm" onClick={() => onOpenIntegration("WhatsApp")}>Manage</Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Alert><CircleHelpIcon /><AlertTitle>Production API sending</AlertTitle><AlertDescription>Automatic background delivery needs provider credentials and consent controls (for example Gmail/Microsoft OAuth and the WhatsApp Business Cloud API). The review queue is intentionally client-side until those are configured.</AlertDescription></Alert>
    </div>
  )
}
