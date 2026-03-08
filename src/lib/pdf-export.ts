import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { GeneralLedgerEntry } from "@/contexts/AccountingContext";
import { Invoice } from "@/lib/billing/types";
import { formatAmount } from "@/lib/bas-accounts";

interface CompanyInfo {
  companyName: string;
  organizationNumber: string;
}

interface IncomeStatementData {
  revenues: GeneralLedgerEntry[];
  expenses: GeneralLedgerEntry[];
  netResult: number;
}

interface BalanceSheetData {
  assets: GeneralLedgerEntry[];
  equityLiabilities: GeneralLedgerEntry[];
  totalAssets: number;
  totalEquityLiabilities: number;
  isBalanced: boolean;
}

export function exportIncomeStatementPDF(
  data: IncomeStatementData,
  company: CompanyInfo,
  startDate: string,
  endDate: string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Income Statement", pageWidth / 2, 20, { align: "center" });
  doc.text("Resultaträkning", pageWidth / 2, 28, { align: "center" });
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(company.companyName, pageWidth / 2, 38, { align: "center" });
  doc.text(`Org.nr: ${company.organizationNumber}`, pageWidth / 2, 45, { align: "center" });
  doc.text(`Period: ${startDate} - ${endDate}`, pageWidth / 2, 52, { align: "center" });
  
  let yPos = 65;
  
  // Revenue Section
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Revenue (Intäkter)", 14, yPos);
  yPos += 5;
  
  const totalRevenue = data.revenues.reduce((sum, e) => sum + e.balance, 0);
  
  if (data.revenues.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Account", "Name", "Debit", "Credit", "Balance"]],
      body: [
        ...data.revenues.map(entry => [
          entry.accountNumber,
          entry.accountName,
          formatAmount(entry.totalDebit),
          formatAmount(entry.totalCredit),
          formatAmount(entry.balance),
        ]),
        ["", "Total Revenue", "", "", formatAmount(totalRevenue)],
      ],
      theme: "striped",
      headStyles: { fillColor: [34, 197, 94] },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 25 },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right", fontStyle: "bold" },
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("No revenue transactions in this period", 14, yPos + 5);
    yPos += 20;
  }
  
  // Expenses Section
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Expenses (Kostnader)", 14, yPos);
  yPos += 5;
  
  const totalExpenses = data.expenses.reduce((sum, e) => sum + e.balance, 0);
  
  if (data.expenses.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Account", "Name", "Debit", "Credit", "Balance"]],
      body: [
        ...data.expenses.map(entry => [
          entry.accountNumber,
          entry.accountName,
          formatAmount(entry.totalDebit),
          formatAmount(entry.totalCredit),
          formatAmount(entry.balance),
        ]),
        ["", "Total Expenses", "", "", formatAmount(totalExpenses)],
      ],
      theme: "striped",
      headStyles: { fillColor: [239, 68, 68] },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 25 },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right", fontStyle: "bold" },
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("No expense transactions in this period", 14, yPos + 5);
    yPos += 20;
  }
  
  // Net Result
  const resultColor = data.netResult >= 0 ? [34, 197, 94] : [239, 68, 68];
  doc.setFillColor(resultColor[0], resultColor[1], resultColor[2]);
  doc.roundedRect(14, yPos, pageWidth - 28, 25, 3, 3, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Net Result (Årets resultat)", 20, yPos + 10);
  doc.setFontSize(16);
  doc.text(`${formatAmount(data.netResult)} SEK`, pageWidth - 20, yPos + 16, { align: "right" });
  
  doc.setTextColor(0, 0, 0);
  
  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toISOString().split("T")[0]}`, 14, footerY);
  doc.text("Page 1 of 1", pageWidth - 14, footerY, { align: "right" });
  
  doc.save(`income-statement-${startDate}-${endDate}.pdf`);
}

export function exportBalanceSheetPDF(
  data: BalanceSheetData,
  company: CompanyInfo,
  asOfDate: string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Balance Sheet", pageWidth / 2, 20, { align: "center" });
  doc.text("Balansräkning", pageWidth / 2, 28, { align: "center" });
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(company.companyName, pageWidth / 2, 38, { align: "center" });
  doc.text(`Org.nr: ${company.organizationNumber}`, pageWidth / 2, 45, { align: "center" });
  doc.text(`As of: ${asOfDate}`, pageWidth / 2, 52, { align: "center" });
  
  let yPos = 65;
  
  // Assets Section
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Assets (Tillgångar)", 14, yPos);
  yPos += 5;
  
  if (data.assets.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Account", "Name", "Balance"]],
      body: [
        ...data.assets.map(entry => [
          entry.accountNumber,
          entry.accountName,
          formatAmount(entry.balance),
        ]),
        ["", "Total Assets", formatAmount(data.totalAssets)],
      ],
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 25 },
        2: { halign: "right", fontStyle: "bold" },
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("No asset transactions", 14, yPos + 5);
    yPos += 20;
  }
  
  // Equity & Liabilities Section
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Equity & Liabilities (Eget kapital & Skulder)", 14, yPos);
  yPos += 5;
  
  if (data.equityLiabilities.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Account", "Name", "Balance"]],
      body: [
        ...data.equityLiabilities.map(entry => [
          entry.accountNumber,
          entry.accountName,
          formatAmount(entry.balance),
        ]),
        ["", "Total Equity & Liabilities", formatAmount(data.totalEquityLiabilities)],
      ],
      theme: "striped",
      headStyles: { fillColor: [139, 92, 246] },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 25 },
        2: { halign: "right", fontStyle: "bold" },
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("No equity/liability transactions", 14, yPos + 5);
    yPos += 20;
  }
  
  // Balance Check
  const balanceColor = data.isBalanced ? [34, 197, 94] : [239, 68, 68];
  doc.setFillColor(balanceColor[0], balanceColor[1], balanceColor[2]);
  doc.roundedRect(14, yPos, pageWidth - 28, 20, 3, 3, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  const balanceText = data.isBalanced ? "✓ Balance Sheet is Balanced" : "✗ Balance Sheet is NOT Balanced";
  doc.text(balanceText, pageWidth / 2, yPos + 12, { align: "center" });
  
  doc.setTextColor(0, 0, 0);
  
  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toISOString().split("T")[0]}`, 14, footerY);
  doc.text("Page 1 of 1", pageWidth - 14, footerY, { align: "right" });
  
  doc.save(`balance-sheet-${asOfDate}.pdf`);
}

export function exportInvoicePDF(
  invoice: Invoice,
  company?: CompanyInfo
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const isQuote = invoice.documentType === "quote";
  const docLabel = isQuote ? "Quote" : "Invoice";

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(docLabel, 14, 22);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`#${invoice.invoiceNumber}`, 14, 30);

  if (company) {
    doc.setFont("helvetica", "bold");
    doc.text(company.companyName, pageWidth - 14, 22, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(`Org.nr: ${company.organizationNumber}`, pageWidth - 14, 28, { align: "right" });
  }

  // Customer info
  let yPos = 42;
  doc.setFont("helvetica", "bold");
  doc.text("Customer:", 14, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.customerName, 14, yPos + 6);
  doc.text(invoice.customerAddress, 14, yPos + 12);

  // Dates
  doc.text(`Issue Date: ${invoice.issueDate}`, pageWidth - 14, yPos, { align: "right" });
  doc.text(`${isQuote ? "Valid Until" : "Due Date"}: ${invoice.dueDate}`, pageWidth - 14, yPos + 6, { align: "right" });
  doc.text(`Status: ${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}`, pageWidth - 14, yPos + 12, { align: "right" });

  yPos += 24;

  // Line items table
  autoTable(doc, {
    startY: yPos,
    head: [["Product", "Qty", "Unit Price", "VAT %", "Total excl. VAT", "Total incl. VAT"]],
    body: invoice.lines.map(line => [
      line.productName + (line.description ? `\n${line.description}` : ""),
      line.quantity.toString(),
      formatAmount(line.unitPrice),
      `${line.vatRate}%`,
      formatAmount(line.totalExclVat),
      formatAmount(line.totalInclVat),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [51, 51, 51] },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || yPos + 40;

  // Totals
  const totalsY = finalY + 10;
  doc.setFontSize(10);
  doc.text("Subtotal (excl. VAT):", pageWidth - 80, totalsY);
  doc.text(`${formatAmount(invoice.subtotal)} SEK`, pageWidth - 14, totalsY, { align: "right" });

  doc.text("Total VAT:", pageWidth - 80, totalsY + 7);
  doc.text(`${formatAmount(invoice.totalVat)} SEK`, pageWidth - 14, totalsY + 7, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total (incl. VAT):", pageWidth - 80, totalsY + 16);
  doc.text(`${formatAmount(invoice.total)} SEK`, pageWidth - 14, totalsY + 16, { align: "right" });

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toISOString().split("T")[0]}`, 14, footerY);
  doc.text("Page 1 of 1", pageWidth - 14, footerY, { align: "right" });

  doc.save(`${docLabel.toLowerCase()}-${invoice.invoiceNumber}.pdf`);
}
