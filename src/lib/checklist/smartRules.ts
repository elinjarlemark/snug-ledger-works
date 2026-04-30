/**
 * Smart Checklist Rules
 *
 * Each rule evaluates the current accounting/receipts/vat state and decides
 * whether it should produce an active checklist item, and (later) whether
 * an existing item is now "resolved" because the underlying condition
 * has been satisfied.
 *
 * Rule items are pure data; the SmartChecklistContext is responsible for
 * persistence and for syncing with the user-facing ChecklistContext.
 */

import type { Voucher } from "@/contexts/AccountingContexts";
import type { Receipt } from "@/contexts/ReceiptsContext";

// ---------- Types ----------

export type SmartRuleId =
  | "vat-not-filed"
  | "salary-missing"
  | "recurring-account-missing"
  | "bank-not-reconciled"
  | "unallocated-receipts"
  | "year-end-closing"
  | `custom:${string}`;

export type SmartRuleKind = "template" | "custom-account";

export interface SmartRuleConfig {
  id: SmartRuleId;
  kind: SmartRuleKind;
  /** Built-in templates have a stable templateId; custom rules don't. */
  templateId?: BuiltInTemplateId;
  enabled: boolean;
  /** For custom-account rules. */
  custom?: {
    accountNumber: string;
    label: string; // user-facing description
    /** "year" = current fiscal year, "month" = current month, "days:N" = last N days */
    period: "year" | "month" | `days:${number}`;
    /** "missing" = trigger when account NOT used; "present" = trigger when used (rare). */
    triggerWhen: "missing" | "present";
  };
}

export type BuiltInTemplateId =
  | "vat-not-filed"
  | "salary-missing"
  | "recurring-account-missing"
  | "bank-not-reconciled"
  | "unallocated-receipts"
  | "year-end-closing";

export interface SmartRuleEvaluation {
  /** Stable per-occurrence key, e.g. "vat-not-filed:2025-Q1" — used to dedupe items. */
  occurrenceKey: string;
  ruleId: SmartRuleId;
  templateId?: BuiltInTemplateId;
  /** Short text shown in the checklist row. */
  text: string;
  /** Longer explanation shown in the info dialog. */
  explanation: string;
  /** Optional account to pre-select if user wants to create a voucher. */
  suggestedAccountNumber?: string;
  /** When true, the underlying condition is satisfied — render a "Resolved!" badge. */
  resolved: boolean;
}

export interface EvaluationContext {
  vouchers: Voucher[];
  receipts: Receipt[];
  /** Current date (injectable for tests). */
  now: Date;
  /** Fiscal year start (defaults to Jan 1 of current calendar year). */
  fiscalYearStart: Date;
  /** Configurable thresholds. */
  unallocatedReceiptDays: number;
  bankReconcileDays: number;
}

// ---------- Built-in templates ----------

export interface BuiltInTemplateMeta {
  id: BuiltInTemplateId;
  title: string;
  description: string;
}

export const BUILT_IN_TEMPLATES: BuiltInTemplateMeta[] = [
  {
    id: "vat-not-filed",
    title: "Moms-deklaration ej inlämnad",
    description:
      "Påminner när en momsperiod är slut men ingen moms-rapport finns för perioden.",
  },
  {
    id: "salary-missing",
    title: "Lön ej bokad denna månad",
    description:
      "Om konto 7210 (löner) bokades förra månaden men inte denna — påminn om att köra lön.",
  },
  {
    id: "recurring-account-missing",
    title: "Återkommande konton från förra året saknas",
    description:
      "Om ett konto användes minst 3 gånger förra året men inte alls i år — flagga det.",
  },
  {
    id: "bank-not-reconciled",
    title: "Bank (1930) ej avstämd",
    description: "Påminn när bankkontot inte använts på över 30 dagar.",
  },
  {
    id: "unallocated-receipts",
    title: "Oallokerade kvitton",
    description: "Kvitton i Receipts som inte kopplats till en voucher på över 14 dagar.",
  },
  {
    id: "year-end-closing",
    title: "Årsbokslut för förra året",
    description:
      "I januari–mars påminn om årsbokslut, avskrivningar och årsavslut för föregående år.",
  },
];

// ---------- Helpers ----------

const monthName = (m: number) =>
  ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"][m];

function inRange(date: Date, from: Date, to: Date): boolean {
  return date >= from && date <= to;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}

function accountUsedInRange(
  vouchers: Voucher[],
  accountNumberPrefix: string,
  from: Date,
  to: Date,
): boolean {
  return vouchers.some((v) => {
    const d = new Date(v.date);
    if (!inRange(d, from, to)) return false;
    return v.lines.some((l) => l.accountNumber.startsWith(accountNumberPrefix));
  });
}

function accountUseCount(
  vouchers: Voucher[],
  accountNumber: string,
  from: Date,
  to: Date,
): number {
  let n = 0;
  for (const v of vouchers) {
    const d = new Date(v.date);
    if (!inRange(d, from, to)) continue;
    if (v.lines.some((l) => l.accountNumber === accountNumber)) n++;
  }
  return n;
}

// ---------- Evaluators ----------

function evaluateVatNotFiled(ctx: EvaluationContext): SmartRuleEvaluation | null {
  // Quarterly check: if previous quarter has ended >30 days ago and no voucher
  // touches account 2650 (momsredovisningskonto) within the quarter or after.
  const now = ctx.now;
  const q = Math.floor(now.getMonth() / 3); // current quarter index 0..3
  const prevQ = q === 0 ? 3 : q - 1;
  const prevQYear = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const prevQStart = new Date(prevQYear, prevQ * 3, 1);
  const prevQEnd = new Date(prevQYear, prevQ * 3 + 3, 0, 23, 59, 59);
  // Only fire when at least 30 days into the new quarter
  const daysSinceQEnd = Math.floor((+now - +prevQEnd) / (1000 * 60 * 60 * 24));
  if (daysSinceQEnd < 30) return null;

  // Look for a 2650 entry filed for that quarter (typically dated within prevQ or slightly after)
  const filed = ctx.vouchers.some((v) => {
    const d = new Date(v.date);
    if (d < prevQStart || d > new Date(prevQEnd.getTime() + 60 * 24 * 60 * 60 * 1000)) return false;
    return v.lines.some((l) => l.accountNumber === "2650");
  });

  const occurrenceKey = `vat-not-filed:${prevQYear}-Q${prevQ + 1}`;
  return {
    occurrenceKey,
    ruleId: "vat-not-filed",
    templateId: "vat-not-filed",
    text: `Moms ej inlämnad för Q${prevQ + 1} ${prevQYear}`,
    explanation: `Momsperioden ${prevQYear} kvartal ${prevQ + 1} (${prevQStart.toLocaleDateString("sv-SE")} – ${prevQEnd.toLocaleDateString("sv-SE")}) är slut sedan ${daysSinceQEnd} dagar. Ingen voucher med konto 2650 (momsredovisning) har bokförts för perioden. Lämna in momsdeklarationen och bokför momsskulden.`,
    suggestedAccountNumber: "2650",
    resolved: filed,
  };
}

function evaluateSalaryMissing(ctx: EvaluationContext): SmartRuleEvaluation | null {
  const now = ctx.now;
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const prevMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const prevMonthEnd = endOfMonth(prevMonthStart);

  const usedPrev = accountUsedInRange(ctx.vouchers, "7210", prevMonthStart, prevMonthEnd);
  if (!usedPrev) return null; // only relevant if salary was a habit

  // Don't nag in the very first days of a new month
  if (now.getDate() < 5) return null;

  const usedThis = accountUsedInRange(ctx.vouchers, "7210", thisMonthStart, thisMonthEnd);

  const monthLabel = monthName(now.getMonth());
  const occurrenceKey = `salary-missing:${now.getFullYear()}-${now.getMonth() + 1}`;
  return {
    occurrenceKey,
    ruleId: "salary-missing",
    templateId: "salary-missing",
    text: `Lön ej bokad i ${monthLabel}`,
    explanation: `Du bokade lön (konto 7210) i ${monthName(prevMonthStart.getMonth())} men ingen lönevoucher finns ännu för ${monthLabel}. Skapa lönevouchern eller bocka av om lön inte ska betalas i månaden.`,
    suggestedAccountNumber: "7210",
    resolved: usedThis,
  };
}

function evaluateRecurringAccountMissing(ctx: EvaluationContext): SmartRuleEvaluation[] {
  const now = ctx.now;
  const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
  const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
  const thisYearStart = new Date(now.getFullYear(), 0, 1);

  // Only meaningful from April onward — give the user a quarter to ramp up
  if (now.getMonth() < 3) return [];

  // Tally accounts used >=3 times last year
  const lastYearCounts = new Map<string, { count: number; name: string }>();
  for (const v of ctx.vouchers) {
    const d = new Date(v.date);
    if (!inRange(d, lastYearStart, lastYearEnd)) continue;
    for (const l of v.lines) {
      // Only flag class 5/6 (overhead) accounts to avoid noise
      const firstDigit = l.accountNumber[0];
      if (firstDigit !== "5" && firstDigit !== "6") continue;
      const cur = lastYearCounts.get(l.accountNumber) || { count: 0, name: l.accountName };
      cur.count++;
      lastYearCounts.set(l.accountNumber, cur);
    }
  }

  const results: SmartRuleEvaluation[] = [];
  for (const [acc, info] of lastYearCounts) {
    if (info.count < 3) continue;
    const usedThisYear = accountUseCount(ctx.vouchers, acc, thisYearStart, now) > 0;
    results.push({
      occurrenceKey: `recurring-account-missing:${now.getFullYear()}:${acc}`,
      ruleId: "recurring-account-missing",
      templateId: "recurring-account-missing",
      text: `Konto ${acc} (${info.name}) saknas i år`,
      explanation: `Förra året (${now.getFullYear() - 1}) bokfördes konto ${acc} – ${info.name} ${info.count} gånger, men i år (${now.getFullYear()}) finns inga vouchers på det kontot. Är något återkommande missat? Glöm inte hyra, försäkringar, abonnemang m.m.`,
      suggestedAccountNumber: acc,
      resolved: usedThisYear,
    });
  }
  return results;
}

function evaluateBankNotReconciled(ctx: EvaluationContext): SmartRuleEvaluation | null {
  const now = ctx.now;
  const cutoff = new Date(now.getTime() - ctx.bankReconcileDays * 24 * 60 * 60 * 1000);
  let mostRecent: Date | null = null;
  for (const v of ctx.vouchers) {
    if (!v.lines.some((l) => l.accountNumber === "1930")) continue;
    const d = new Date(v.date);
    if (!mostRecent || d > mostRecent) mostRecent = d;
  }
  if (!mostRecent) return null; // no bank activity at all — don't nag
  const stale = mostRecent < cutoff;
  if (!stale) return null;

  const days = Math.floor((+now - +mostRecent) / (1000 * 60 * 60 * 24));
  return {
    occurrenceKey: `bank-not-reconciled:${mostRecent.toISOString().slice(0, 10)}`,
    ruleId: "bank-not-reconciled",
    templateId: "bank-not-reconciled",
    text: `Bank (1930) ej avstämd på ${days} dagar`,
    explanation: `Senaste vouchern på konto 1930 (företagskonto) är från ${mostRecent.toLocaleDateString("sv-SE")} — det är ${days} dagar sedan. Stäm av banken mot bokföringen och bokför nya transaktioner.`,
    suggestedAccountNumber: "1930",
    // Resolved when there's a newer 1930 voucher (i.e. the rule wouldn't trigger again)
    resolved: false,
  };
}

function evaluateUnallocatedReceipts(ctx: EvaluationContext): SmartRuleEvaluation | null {
  const cutoff = new Date(ctx.now.getTime() - ctx.unallocatedReceiptDays * 24 * 60 * 60 * 1000);
  const stale = ctx.receipts.filter(
    (r) => !r.voucherId && new Date(r.createdAt) <= cutoff,
  );
  if (stale.length === 0) return null;

  return {
    occurrenceKey: `unallocated-receipts:${stale.length}`,
    ruleId: "unallocated-receipts",
    templateId: "unallocated-receipts",
    text: `${stale.length} kvitto${stale.length === 1 ? "" : "n"} oallokerad${stale.length === 1 ? "t" : "e"} > ${ctx.unallocatedReceiptDays} dagar`,
    explanation: `Det finns ${stale.length} kvitto(n) i Receipts som laddats upp för mer än ${ctx.unallocatedReceiptDays} dagar sedan men ännu inte kopplats till någon voucher. Bokför dem så att kvittona inte glöms bort.`,
    resolved: false,
  };
}

function evaluateYearEndClosing(ctx: EvaluationContext): SmartRuleEvaluation | null {
  // Active Jan–March each year (closing of previous year)
  const now = ctx.now;
  if (now.getMonth() > 2) return null;
  const prevYear = now.getFullYear() - 1;

  // Heuristic: consider it "resolved" if a voucher dated 31 dec prevYear with description containing
  // "bokslut" / "avskrivning" exists.
  const yearEndStart = new Date(prevYear, 11, 25);
  const yearEndEnd = new Date(prevYear, 11, 31, 23, 59, 59);
  const hasYearEnd = ctx.vouchers.some((v) => {
    const d = new Date(v.date);
    if (!inRange(d, yearEndStart, yearEndEnd)) return false;
    return /(bokslut|avskrivn|årsavslut)/i.test(v.description);
  });

  return {
    occurrenceKey: `year-end-closing:${prevYear}`,
    ruleId: "year-end-closing",
    templateId: "year-end-closing",
    text: `Årsbokslut för ${prevYear}`,
    explanation: `Det är dags att färdigställa årsbokslutet för räkenskapsåret ${prevYear}: bokför avskrivningar, periodisera kostnader/intäkter och gör årsavslut. Ingen voucher med "bokslut" eller "avskrivning" hittades i slutet av ${prevYear}.`,
    resolved: hasYearEnd,
  };
}

function evaluateCustomAccountRule(
  rule: SmartRuleConfig,
  ctx: EvaluationContext,
): SmartRuleEvaluation | null {
  if (!rule.custom) return null;
  const { accountNumber, label, period, triggerWhen } = rule.custom;

  let from: Date;
  let to: Date = ctx.now;
  let periodLabel: string;
  if (period === "year") {
    from = ctx.fiscalYearStart;
    periodLabel = `år ${ctx.fiscalYearStart.getFullYear()}`;
  } else if (period === "month") {
    from = startOfMonth(ctx.now);
    to = endOfMonth(ctx.now);
    periodLabel = monthName(ctx.now.getMonth());
  } else {
    const days = parseInt(period.split(":")[1] || "30", 10);
    from = new Date(ctx.now.getTime() - days * 24 * 60 * 60 * 1000);
    periodLabel = `senaste ${days} dagar`;
  }

  const used = accountUseCount(ctx.vouchers, accountNumber, from, to) > 0;
  const triggers = triggerWhen === "missing" ? !used : used;
  if (!triggers) return null;

  return {
    occurrenceKey: `${rule.id}:${period}:${ctx.now.getFullYear()}-${ctx.now.getMonth()}`,
    ruleId: rule.id,
    text: label || `Konto ${accountNumber} ${triggerWhen === "missing" ? "saknas" : "använd"} ${periodLabel}`,
    explanation:
      triggerWhen === "missing"
        ? `Den smarta regeln "${label}" kontrollerar konto ${accountNumber} under ${periodLabel}. Inga vouchers med detta konto hittades. Skapa en voucher om något missats, eller markera som klar.`
        : `Den smarta regeln "${label}" kontrollerar konto ${accountNumber} under ${periodLabel}. En voucher med detta konto har bokförts.`,
    suggestedAccountNumber: accountNumber,
    resolved: triggerWhen === "missing" ? used : !used,
  };
}

// ---------- Public API ----------

export function evaluateAllRules(
  rules: SmartRuleConfig[],
  ctx: EvaluationContext,
): SmartRuleEvaluation[] {
  const out: SmartRuleEvaluation[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.kind === "custom-account") {
      const r = evaluateCustomAccountRule(rule, ctx);
      if (r) out.push(r);
      continue;
    }
    switch (rule.templateId) {
      case "vat-not-filed": {
        const r = evaluateVatNotFiled(ctx);
        if (r) out.push(r);
        break;
      }
      case "salary-missing": {
        const r = evaluateSalaryMissing(ctx);
        if (r) out.push(r);
        break;
      }
      case "recurring-account-missing": {
        out.push(...evaluateRecurringAccountMissing(ctx));
        break;
      }
      case "bank-not-reconciled": {
        const r = evaluateBankNotReconciled(ctx);
        if (r) out.push(r);
        break;
      }
      case "unallocated-receipts": {
        const r = evaluateUnallocatedReceipts(ctx);
        if (r) out.push(r);
        break;
      }
      case "year-end-closing": {
        const r = evaluateYearEndClosing(ctx);
        if (r) out.push(r);
        break;
      }
    }
  }
  return out;
}

export function defaultRuleConfigs(): SmartRuleConfig[] {
  return BUILT_IN_TEMPLATES.map((t) => ({
    id: t.id,
    kind: "template" as const,
    templateId: t.id,
    enabled: true,
  }));
}
