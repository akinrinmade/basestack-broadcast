import type { CsvPreview, CsvRow } from '@/lib/types'
import { checkEmailsExist } from '@/lib/subscribers'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function parseCsv(text: string): { name: string; email: string }[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) return []

  const header = lines[0].toLowerCase()
  const hasHeader = header.includes('name') || header.includes('email')
  const dataStart = hasHeader ? 1 : 0
  const cols = hasHeader ? header.split(',').map((h) => h.trim()) : []

  const nameIdx = cols.indexOf('name')
  const emailIdx = cols.indexOf('email')

  const rows: { name: string; email: string }[] = []

  for (let i = dataStart; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i])
    let name = ''
    let email = ''

    if (hasHeader && nameIdx >= 0 && emailIdx >= 0) {
      name = (parts[nameIdx] ?? '').trim()
      email = (parts[emailIdx] ?? '').trim()
    } else if (hasHeader && emailIdx >= 0) {
      email = (parts[emailIdx] ?? '').trim()
      name = (parts.find((p, idx) => idx !== emailIdx) ?? '').trim()
    } else {
      if (parts.length >= 2) {
        name = parts[0].trim()
        email = parts[1].trim()
      } else if (parts.length === 1) {
        email = parts[0].trim()
      }
    }

    rows.push({ name, email })
  }

  return rows
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

export async function validateCsv(
  rows: { name: string; email: string }[],
): Promise<CsvPreview> {
  const validRows: CsvRow[] = []
  const invalidRows: CsvRow[] = []
  const seenEmails = new Map<string, number>()
  const duplicateInCsv: number[] = []

  rows.forEach((row, idx) => {
    const rowNumber = idx + 1
    const email = row.email.trim()
    const name = row.name.trim()
    const emailLower = email.toLowerCase()

    if (!email) {
      invalidRows.push({ rowNumber, name, email, valid: false, reason: 'Missing email' })
      return
    }
    if (!EMAIL_RE.test(email)) {
      invalidRows.push({ rowNumber, name, email, valid: false, reason: 'Invalid email format' })
      return
    }
    if (!name) {
      invalidRows.push({ rowNumber, name, email, valid: false, reason: 'Missing name' })
      return
    }

    if (seenEmails.has(emailLower)) {
      duplicateInCsv.push(rowNumber)
      invalidRows.push({
        rowNumber,
        name,
        email,
        valid: false,
        reason: 'Duplicate email within CSV',
      })
      return
    }

    seenEmails.set(emailLower, rowNumber)
    validRows.push({ rowNumber, name, email, valid: true })
  })

  const emailsToCheck = validRows.map((r) => r.email.toLowerCase())
  const dbDuplicates = await checkEmailsExist(emailsToCheck)

  const finalValid: CsvRow[] = []
  const dbDupEmails: string[] = []

  for (const row of validRows) {
    if (dbDuplicates.has(row.email.toLowerCase())) {
      dbDupEmails.push(row.email)
      invalidRows.push({
        rowNumber: row.rowNumber,
        name: row.name,
        email: row.email,
        valid: false,
        reason: 'Email already exists in database',
      })
    } else {
      finalValid.push(row)
    }
  }

  return {
    validRows: finalValid,
    invalidRows,
    duplicateEmailsInCsv: duplicateInCsv,
    duplicateEmailsInDb: dbDupEmails,
    totalValid: finalValid.length,
    totalInvalid: invalidRows.length,
  }
}
