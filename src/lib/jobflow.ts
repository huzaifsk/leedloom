export type LeadChannel = "Email" | "WhatsApp" | "LinkedIn profile" | "Company page" | "Job link" | "Other"

export type LeadStatus = "new" | "ready" | "queued" | "opened" | "sent" | "replied" | "invalid"

export type Lead = {
  id: string
  type: LeadChannel
  value: string
  label: string
  link: string
  section: string
  context: string
  pageTitle: string
  pageUrl: string
  capturedAt: string
  status: LeadStatus
  sentAt?: string
  senderIdentity?: string
  providerMessageId?: string
  sendMode?: "gmail_api" | "whatsapp_personal"
}

export type MessageTemplate = {
  id: string
  name: string
  channel: "Email" | "WhatsApp"
  subject: string
  body: string
}

export const requiredHeaders = [
  "Type",
  "Value",
  "Label",
  "Link",
  "Section",
  "Context",
  "Page title",
  "Page URL",
  "Captured at",
] as const

export const demoLeads: Lead[] = [
  {
    id: "demo-email-1",
    type: "Email",
    value: "shashikantlal.lal@gmail.com",
    label: "",
    link: "",
    section: "Feed post",
    context: "Feel free to mail with your updated resume and the role you’re interested in.",
    pageTitle: "Search | LinkedIn",
    pageUrl: "https://www.linkedin.com/search/results/content/?keywords=QA%20automation%20tester%20jobs",
    capturedAt: "2026-09-20T11:28:26.108Z",
    status: "ready",
  },
  {
    id: "demo-whatsapp-1",
    type: "WhatsApp",
    value: "7042189707",
    label: "",
    link: "",
    section: "Feed post",
    context: "QA automation hiring contact captured from a LinkedIn post.",
    pageTitle: "Search | LinkedIn",
    pageUrl: "https://www.linkedin.com/search/results/content/?keywords=QA%20automation%20tester%20jobs",
    capturedAt: "2026-09-20T11:28:26.108Z",
    status: "ready",
  },
  {
    id: "demo-profile-1",
    type: "LinkedIn profile",
    value: "Deep Patel • 2nd",
    label: "Recruitment manager",
    link: "https://www.linkedin.com/in/deep-patel-444265310/",
    section: "Feed post",
    context: "Recruitment manager @ Havion Global | Staffing and software solutions.",
    pageTitle: "Search | LinkedIn",
    pageUrl: "https://www.linkedin.com/search/results/content/?keywords=QA%20automation%20tester%20jobs",
    capturedAt: "2026-09-20T11:28:26.108Z",
    status: "new",
  },
  {
    id: "demo-job-1",
    type: "Job link",
    value: "QA Lead & Automation Engineer",
    label: "Deutsche Bank · Birmingham (Hybrid)",
    link: "https://www.linkedin.com/jobs/view/4469500790/",
    section: "Feed post",
    context: "QA Lead & Automation Engineer — verified job at Deutsche Bank.",
    pageTitle: "Search | LinkedIn",
    pageUrl: "https://www.linkedin.com/search/results/content/?keywords=QA%20automation%20tester%20jobs",
    capturedAt: "2026-09-20T11:28:26.108Z",
    status: "new",
  },
  {
    id: "demo-company-1",
    type: "Company page",
    value: "Hive Quality Engineering Limited",
    label: "Quality engineering consultancy",
    link: "https://www.linkedin.com/company/hivequalityengineering/",
    section: "Feed post",
    context: "A quality engineering company in the payments industry.",
    pageTitle: "Search | LinkedIn",
    pageUrl: "https://www.linkedin.com/search/results/content/?keywords=QA%20automation%20tester%20jobs",
    capturedAt: "2026-09-20T11:28:26.108Z",
    status: "new",
  },
  {
    id: "demo-invalid-1",
    type: "WhatsApp",
    value: "11697148",
    label: "",
    link: "",
    section: "Feed post",
    context: "Short number captured from page chrome; requires review.",
    pageTitle: "Search | LinkedIn",
    pageUrl: "https://www.linkedin.com/search/results/content/?keywords=QA%20automation%20tester%20jobs",
    capturedAt: "2026-09-20T11:28:26.108Z",
    status: "invalid",
  },
]

export const defaultTemplates: MessageTemplate[] = [
  {
    id: "email-qa-application",
    name: "QA role application",
    channel: "Email",
    subject: "Application for {{role}} — {{sender_name}}",
    body: "Hi {{name}},\n\nI came across the {{role}} opportunity at {{company}} and would love to be considered. My experience in QA automation, API testing, and reliable release workflows aligns well with the role.\n\nI’ve attached my resume for context. I’d be happy to share relevant project examples or speak at a convenient time.\n\nBest,\n{{sender_name}}",
  },
  {
    id: "email-follow-up",
    name: "Friendly follow-up",
    channel: "Email",
    subject: "Following up — {{role}} application",
    body: "Hi {{name}},\n\nJust following up on my application for the {{role}} opportunity at {{company}}. I’m still very interested and would be glad to share anything else that helps with your review.\n\nThank you,\n{{sender_name}}",
  },
  {
    id: "whatsapp-intro",
    name: "WhatsApp introduction",
    channel: "WhatsApp",
    subject: "",
    body: "Hi {{name}}, I found the {{role}} opening at {{company}} and wanted to express my interest. I’m a QA automation professional with experience across UI and API testing. May I share my resume here? — {{sender_name}}",
  },
]

export function normalizeChannel(value: string): LeadChannel {
  const normalized = value.trim().toLowerCase()
  if (normalized === "email") return "Email"
  if (normalized === "whatsapp") return "WhatsApp"
  if (normalized === "linkedin profile") return "LinkedIn profile"
  if (normalized === "company page") return "Company page"
  if (normalized === "job link") return "Job link"
  return "Other"
}

export function isValidContact(type: LeadChannel, value: string) {
  if (type === "Email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  if (type === "WhatsApp") return value.replace(/\D/g, "").length >= 10 && value.replace(/\D/g, "").length <= 15
  return false
}

export function makeLead(row: Record<string, unknown>, index: number): Lead {
  const text = (key: string) => String(row[key] ?? "").trim()
  const type = normalizeChannel(text("Type"))
  const value = text("Value")
  const contact = type === "Email" || type === "WhatsApp"

  return {
    id: `import-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    value,
    label: text("Label"),
    link: text("Link"),
    section: text("Section"),
    context: text("Context"),
    pageTitle: text("Page title"),
    pageUrl: text("Page URL"),
    capturedAt: text("Captured at"),
    status: contact ? (isValidContact(type, value) ? "ready" : "invalid") : "new",
  }
}

export function templateData(lead: Lead, senderName: string) {
  const context = `${lead.label} ${lead.context}`
  const roleMatch = context.match(/(?:QA|Quality|Test|Automation)[^.|•]{0,55}/i)
  const companyMatch = context.match(/(?:at|@)\s+([A-Z][^|,.•]{2,40})/)
  const rawName = lead.label || (lead.type === "LinkedIn profile" ? lead.value : "")
  const name = rawName.split(/[•|,-]/)[0]?.trim().split(" ")[0] || "there"

  return {
    name,
    company: companyMatch?.[1]?.trim() || "your company",
    role: roleMatch?.[0]?.trim() || "QA opportunity",
    sender_name: senderName.trim() || "Your name",
    contact: lead.value,
  }
}

export function renderTemplate(content: string, lead: Lead, senderName: string) {
  const values = templateData(lead, senderName)
  return content.replace(/{{\s*(name|company|role|sender_name|contact)\s*}}/g, (_, key: keyof typeof values) => values[key])
}
