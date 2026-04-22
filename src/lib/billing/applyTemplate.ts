import { Invoice, VoucherTemplate, VoucherTemplateLine } from "./types";

export interface BuiltVoucherLine {
  id: string;
  accountNumber: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface BuiltVoucher {
  date: string;
  description: string;
  lines: BuiltVoucherLine[];
}

function amountFor(invoice: Invoice, line: VoucherTemplateLine): number {
  switch (line.amountSource) {
    case "total": return Math.round(invoice.total * 100) / 100;
    case "subtotal": return Math.round(invoice.subtotal * 100) / 100;
    case "totalVat": return Math.round(invoice.totalVat * 100) / 100;
    case "fixed": return line.fixedAmount ?? 0;
    default: return 0;
  }
}

export function buildVoucherFromTemplate(
  invoice: Invoice,
  template: VoucherTemplate,
  paidDate?: string,
): BuiltVoucher {
  return {
    date: paidDate || invoice.paidDate || new Date().toISOString().split("T")[0],
    description: `Invoice #${invoice.invoiceNumber} - ${invoice.customerName}`,
    lines: template.lines.map((l) => {
      const amt = amountFor(invoice, l);
      return {
        id: crypto.randomUUID(),
        accountNumber: l.accountNumber,
        accountName: l.accountName,
        debit: l.side === "debit" ? amt : 0,
        credit: l.side === "credit" ? amt : 0,
      };
    }),
  };
}

export function isTemplateBalanced(invoice: Invoice, template: VoucherTemplate): boolean {
  const built = buildVoucherFromTemplate(invoice, template);
  const debit = built.lines.reduce((s, l) => s + l.debit, 0);
  const credit = built.lines.reduce((s, l) => s + l.credit, 0);
  return Math.abs(debit - credit) < 0.01 && debit > 0;
}
