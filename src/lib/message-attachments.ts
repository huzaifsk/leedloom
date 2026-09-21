export const MAX_ATTACHMENT_COUNT = 3
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024
export const MAX_TOTAL_ATTACHMENT_BYTES = 3 * 1024 * 1024

export const MESSAGE_ATTACHMENT_ACCEPT = ".pdf,.doc,.docx,.txt"

const attachmentTypes: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
}

function extension(name: string) {
  const position = name.lastIndexOf(".")
  return position >= 0 ? name.slice(position).toLowerCase() : ""
}

export function attachmentContentType(name: string) {
  return attachmentTypes[extension(name)]
}

export function validateMessageAttachments(files: Array<{ name: string; size: number }>) {
  if (files.length > MAX_ATTACHMENT_COUNT) return `Choose no more than ${MAX_ATTACHMENT_COUNT} attachments.`

  let total = 0
  for (const file of files) {
    if (!attachmentContentType(file.name)) return `${file.name} is not supported. Use PDF, DOC, DOCX, or TXT.`
    if (file.size <= 0) return `${file.name} is empty.`
    if (file.size > MAX_ATTACHMENT_BYTES) return `${file.name} is larger than 2 MB.`
    total += file.size
  }

  if (total > MAX_TOTAL_ATTACHMENT_BYTES) return "Attachments must be 3 MB or less in total."
  return null
}

export function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
