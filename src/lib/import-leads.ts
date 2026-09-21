import { makeLead, requiredHeaders, type Lead } from "@/lib/jobflow"

const MAX_IMPORT_BYTES = 10 * 1024 * 1024
const SUPPORTED_EXTENSIONS = new Set(["csv", "xls", "xlsx"])

export const leadImportAccept = [
  ".csv",
  ".xls",
  ".xlsx",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",")

function extensionOf(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? ""
}

export async function parseLeadFile(file: File): Promise<Lead[]> {
  const extension = extensionOf(file.name)
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error("Choose a CSV, XLS, or XLSX file.")
  }
  if (!file.size) throw new Error("The selected file is empty.")
  if (file.size > MAX_IMPORT_BYTES) throw new Error("The file is larger than the 10 MB import limit.")

  const { read, utils } = await import("xlsx")
  const workbook = read(await file.arrayBuffer(), {
    type: "array",
    cellDates: false,
    dense: true,
  })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) throw new Error("The file does not contain a worksheet.")

  const rows = utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  })
  const headers = (rows[0] ?? []).map((cell) => String(cell ?? "").replace(/^\uFEFF/, "").trim())
  const missing = requiredHeaders.filter((header) => !headers.includes(header))
  if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}`)

  const imported = rows.slice(1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row, index) => {
      const record = Object.fromEntries(headers.map((header, cellIndex) => [header, row[cellIndex] ?? ""]))
      return makeLead(record, index)
    })

  if (!imported.length) throw new Error("The file contains no data rows.")
  return imported
}
