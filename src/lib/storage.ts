import type { Lead, MessageTemplate } from "@/lib/jobflow"
import { emptyWhatsAppProfile, type WhatsAppProfile } from "@/lib/integrations"

const LEADS_KEY = "leadloom.leads.v1"
const TEMPLATES_KEY = "leadloom.templates.v1"
const SENDER_KEY = "leadloom.sender.v1"
const WHATSAPP_KEY = "leadloom.whatsapp-profile.v1"

export function loadLeads(fallback: Lead[]) {
  try {
    const stored = localStorage.getItem(LEADS_KEY)
    return stored ? (JSON.parse(stored) as Lead[]) : fallback
  } catch {
    return fallback
  }
}

export function saveLeads(leads: Lead[]) {
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads))
}

export function loadTemplates(fallback: MessageTemplate[]) {
  try {
    const stored = localStorage.getItem(TEMPLATES_KEY)
    return stored ? (JSON.parse(stored) as MessageTemplate[]) : fallback
  } catch {
    return fallback
  }
}

export function saveTemplates(templates: MessageTemplate[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
}

export function loadSenderName() {
  return localStorage.getItem(SENDER_KEY) || "Alex Morgan"
}

export function saveSenderName(name: string) {
  localStorage.setItem(SENDER_KEY, name)
}

export function loadWhatsAppProfile() {
  try {
    const stored = localStorage.getItem(WHATSAPP_KEY)
    return stored ? (JSON.parse(stored) as WhatsAppProfile) : emptyWhatsAppProfile
  } catch {
    return emptyWhatsAppProfile
  }
}

export function saveWhatsAppProfile(profile: WhatsAppProfile) {
  localStorage.setItem(WHATSAPP_KEY, JSON.stringify(profile))
}
