// Types & helpers for the Recurring Billing feature.
//
// A RecurringInvoice describes a recipe for generating invoices on a schedule.
// We keep the data model intentionally small: the actual invoice is created via
// the existing CreateInvoiceDialog (pre-filled), so we don't duplicate VAT logic
// here.

export type RecurrenceFrequency = "weekly" | "monthly" | "quarterly" | "custom";

export type DueDateMode =
  | { kind: "endOfMonth" }
  | { kind: "daysAfterIssue"; days: number }
  | { kind: "fixedDayOfMonth"; day: number };

export interface RecurringInvoiceLine {
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

export interface RecurringInvoice {
  id: string;
  companyId: string;
  name: string; // internal label, e.g. "Hyra Kalle"

  // Recipient
  customerId: string; // refers to BillingContext customer
  customerName: string; // snapshot for display

  // Invoice content
  description: string; // dynamic, e.g. "Hyra Januari" — month auto-bumps
  lines: RecurringInvoiceLine[];

  // Schedule
  frequency: RecurrenceFrequency;
  customIntervalDays?: number; // when frequency === "custom"

  // Dates
  firstIssueDate: string; // YYYY-MM-DD — issue date of #1
  dueDateMode: DueDateMode;

  // Generation control
  leadTimeDays: number; // create N days BEFORE issue date
  totalCount: number; // total number of invoices to generate
  generatedCount: number; // how many have been pushed to checklist already

  createdAt: string;
}

// ---------- Month helpers ----------

const MONTHS_SV = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Detect a month name in the description and return language + index (0-11). */
function detectMonth(description: string): { lang: "sv" | "en"; index: number; matched: string } | null {
  const lower = description.toLowerCase();
  for (let i = 0; i < MONTHS_SV.length; i++) {
    const sv = MONTHS_SV[i].toLowerCase();
    if (lower.includes(sv)) return { lang: "sv", index: i, matched: MONTHS_SV[i] };
  }
  for (let i = 0; i < MONTHS_EN.length; i++) {
    const en = MONTHS_EN[i].toLowerCase();
    if (lower.includes(en)) return { lang: "en", index: i, matched: MONTHS_EN[i] };
  }
  return null;
}

/**
 * Step a description forward by N occurrences of recurrence.
 * For monthly recurrence: replaces a detected month name with the new month.
 * For other frequencies: returns description unchanged (no semantic month meaning).
 */
export function stepDescription(
  baseDescription: string,
  occurrenceIndex: number, // 0-based, so 0 = first invoice (no shift)
  frequency: RecurrenceFrequency,
): string {
  if (occurrenceIndex === 0) return baseDescription;
  if (frequency !== "monthly" && frequency !== "quarterly") return baseDescription;

  const detected = detectMonth(baseDescription);
  if (!detected) return baseDescription;

  const monthsToAdd = frequency === "monthly" ? occurrenceIndex : occurrenceIndex * 3;
  const newIdx = ((detected.index + monthsToAdd) % 12 + 12) % 12;
  const replacement = detected.lang === "sv" ? MONTHS_SV[newIdx] : MONTHS_EN[newIdx];

  // Replace first occurrence (case-insensitive) preserving surrounding text.
  const re = new RegExp(detected.matched, "i");
  return baseDescription.replace(re, replacement);
}

// ---------- Date helpers ----------

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Compute the issue date of the Nth occurrence (0-based). */
export function computeIssueDate(
  firstIssueIso: string,
  occurrenceIndex: number,
  frequency: RecurrenceFrequency,
  customIntervalDays?: number,
): string {
  const [y, m, d] = firstIssueIso.split("-").map(Number);
  const base = new Date(y, m - 1, d);

  if (occurrenceIndex === 0) return firstIssueIso;

  switch (frequency) {
    case "weekly": {
      const next = new Date(base);
      next.setDate(next.getDate() + 7 * occurrenceIndex);
      return toIso(next);
    }
    case "monthly": {
      const next = new Date(base);
      next.setMonth(next.getMonth() + occurrenceIndex);
      // If the original day doesn't exist in the new month (e.g. 31 Jan -> Feb),
      // setMonth will roll over; clamp back to last day of intended month.
      if (next.getDate() !== d) {
        next.setDate(0); // last day of previous month (= intended month)
      }
      return toIso(next);
    }
    case "quarterly": {
      const next = new Date(base);
      next.setMonth(next.getMonth() + 3 * occurrenceIndex);
      if (next.getDate() !== d) next.setDate(0);
      return toIso(next);
    }
    case "custom": {
      const days = customIntervalDays && customIntervalDays > 0 ? customIntervalDays : 30;
      const next = new Date(base);
      next.setDate(next.getDate() + days * occurrenceIndex);
      return toIso(next);
    }
  }
}

/** Compute the due date for a given issue date using the configured mode. */
export function computeDueDate(issueIso: string, mode: DueDateMode): string {
  const [y, m, d] = issueIso.split("-").map(Number);
  switch (mode.kind) {
    case "endOfMonth": {
      const last = new Date(y, m, 0); // day 0 of next month = last day of this month
      return toIso(last);
    }
    case "daysAfterIssue": {
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() + (mode.days ?? 30));
      return toIso(dt);
    }
    case "fixedDayOfMonth": {
      const lastOfMonth = new Date(y, m, 0).getDate();
      const day = Math.min(Math.max(mode.day, 1), lastOfMonth);
      // If the fixed day has already passed in the issue month, push to next month.
      const target = new Date(y, m - 1, day);
      if (target < new Date(y, m - 1, d)) {
        target.setMonth(target.getMonth() + 1);
        const lastOfNext = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
        target.setDate(Math.min(mode.day, lastOfNext));
      }
      return toIso(target);
    }
  }
}

/** Number of days between two YYYY-MM-DD dates (b - a). */
export function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso + "T00:00:00");
  const b = new Date(bIso + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function todayIso(): string {
  return toIso(new Date());
}
