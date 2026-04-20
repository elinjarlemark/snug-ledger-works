import { Voucher } from "@/contexts/AccountingContexts";
import { Invoice } from "@/lib/billing/types";
import { VatCode } from "./codes";
import { REPORT_BOXES } from "./reportBoxes";

export interface BoxResult {
  box: string;
  label: string;
  amount: number;
  sources: Array<{
    type: "invoice" | "voucher";
    id: string;
    label: string;
    date: string;
    amount: number;
  }>;
}

/**
 * Compute amount per Skatteverket-ruta from invoices + vouchers (using vatCodeId mapping).
 * - For invoice lines mapped to a code: the totalExclVat goes to base-rutor (05/06/07/35/36/...),
 *   and the vatAmount goes to the moms-rutor (10/11/12/30/31/32).
 * - For voucher lines mapped to a code: similar split. Account class determines whether amount is base or VAT.
 */
export function computeReportBoxes(params: {
  invoices: Invoice[];
  vouchers: Voucher[];
  codes: VatCode[];
  startDate: string;
  endDate: string;
}): BoxResult[] {
  const { invoices, vouchers, codes, startDate, endDate } = params;

  const map = new Map<string, BoxResult>();
  for (const b of REPORT_BOXES) {
    map.set(b.number, { box: b.number, label: b.label, amount: 0, sources: [] });
  }

  const inRange = (d: string) => d >= startDate && d <= endDate;
  const findCode = (id?: string) => (id ? codes.find((c) => c.id === id) : undefined);

  // Invoices (only sent/paid count toward VAT)
  for (const inv of invoices) {
    if (inv.documentType !== "invoice") continue;
    if (!["sent", "paid", "overdue"].includes(inv.status)) continue;
    if (!inRange(inv.issueDate)) continue;

    for (const line of inv.lines) {
      const code = findCode((line as any).vatCodeId);
      if (!code) continue;

      // First box(es): base box (sales/turnover/EU/export) — use 05/06/07/35/36/39/41/42 if listed
      // Convention: rapportRutor = [baseBox, momsBox]. We push base = totalExclVat, moms = vatAmount.
      const [baseBox, momsBox] = code.rapportRutor;
      if (baseBox) {
        const entry = map.get(baseBox);
        if (entry) {
          entry.amount += line.totalExclVat;
          entry.sources.push({
            type: "invoice",
            id: inv.id,
            label: `Faktura #${inv.invoiceNumber} – ${inv.customerName}`,
            date: inv.issueDate,
            amount: line.totalExclVat,
          });
        }
      }
      if (momsBox && code.sats > 0) {
        const entry = map.get(momsBox);
        if (entry) {
          entry.amount += line.vatAmount;
          entry.sources.push({
            type: "invoice",
            id: inv.id,
            label: `Faktura #${inv.invoiceNumber} – moms ${code.sats}%`,
            date: inv.issueDate,
            amount: line.vatAmount,
          });
        }
      }
    }
  }

  // Vouchers
  for (const v of vouchers) {
    if (!inRange(v.date)) continue;
    for (const line of v.lines) {
      const code = findCode((line as any).vatCodeId);
      if (!code) continue;
      const amount = (line.debit || 0) + (line.credit || 0);
      const accNum = parseInt(line.accountNumber, 10);
      const isVatAccount = accNum >= 2610 && accNum <= 2649;

      const [baseBox, momsBox] = code.rapportRutor;
      const targetBox = isVatAccount ? momsBox || baseBox : baseBox;
      if (!targetBox) continue;
      const entry = map.get(targetBox);
      if (entry) {
        entry.amount += amount;
        entry.sources.push({
          type: "voucher",
          id: v.id,
          label: `Verifikation #${v.voucherNumber} – ${v.description}`,
          date: v.date,
          amount,
        });
      }
    }
  }

  // Compute box 49 (Moms att betala/få tillbaka) = (10+11+12+30+31+32) - 48
  const sumBoxes = (nums: string[]) => nums.reduce((s, n) => s + (map.get(n)?.amount || 0), 0);
  const utg = sumBoxes(["10", "11", "12", "30", "31", "32", "60", "61", "62"]);
  const ing = sumBoxes(["48"]);
  const r49 = map.get("49");
  if (r49) r49.amount = utg - ing;

  return REPORT_BOXES.map((b) => map.get(b.number)!).filter(Boolean);
}
