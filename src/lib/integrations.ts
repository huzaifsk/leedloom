import { parsePhoneNumberFromString } from "libphonenumber-js"

export type GmailConnection = {
  configured: boolean
  connected: boolean
  email?: string
  name?: string
  picture?: string
  expiresAt?: number
}

export type WhatsAppProfile = {
  name: string
  phone: string
}

export const emptyWhatsAppProfile: WhatsAppProfile = { name: "", phone: "" }

export function normalizedWhatsAppNumber(phone: string) {
  const parsed = parsePhoneNumberFromString(phone)
  return parsed?.isValid() ? parsed.number.slice(1) : phone.replace(/\D/g, "")
}

export function isValidWhatsAppSender(phone: string) {
  const parsed = parsePhoneNumberFromString(phone)
  return phone.trim().startsWith("+") && Boolean(parsed?.isValid())
}

export function normalizedWhatsAppRecipient(phone: string, senderPhone: string) {
  const sender = parsePhoneNumberFromString(senderPhone)
  if (!sender?.isValid() || !sender.country) return null
  const recipient = parsePhoneNumberFromString(phone, sender.country)
  return recipient?.isValid() ? recipient.number.slice(1) : null
}
