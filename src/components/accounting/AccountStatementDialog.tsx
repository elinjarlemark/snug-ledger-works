import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAccounting, Voucher } from "@/contexts/AccountingContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatAmount, getAccountClassName } from "@/lib/bas-accounts";
import { VoucherDetailsDialog } from "./VoucherDetailsDialog";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface AccountStatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountNumber: string;
}

export function AccountStatementDialog({ 
  open, 
  onOpenChange, 
  accountNumber 
}: AccountStatementDialogProps) {
  const { getAccountStatement, accounts, getVoucherByNumber } = useAccounting();
  const { activeCompany } = useAuth();
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  
  const statement = getAccountStatement(accountNumber);
  const account = accounts.find(a => a.number === accountNumber);

  if (!statement || !account) return null;

  const handleVoucherClick = (voucherNumber: number) => {
    const voucher = getVoucherByNumber(voucherNumber);
    if (voucher) {
      setSelectedVoucher(voucher);
    }
  };

  const handleExportPDF = () => {
    if (!statement || statement.entries.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Account Statement", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    if (activeCompany) {
      doc.text(activeCompany.companyName, pageWidth / 2, 30, { align: "center" });
      doc.text(`Org.nr: ${activeCompany.organizationNumber}`, pageWidth / 2, 37, { align: "center" });
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`${account.number} - ${account.name}`, 14, 50);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(getAccountClassName(account.class), 14, 57);

    autoTable(doc, {
      startY: 63,
      head: [["Date", "Voucher", "Description", "Debit", "Credit", "Balance"]],
      body: [
        ...statement.entries.map(entry => [
          entry.date,
          `#${entry.voucherNumber}`,
          entry.description,
          entry.debit > 0 ? formatAmount(entry.debit) : "",
          entry.credit > 0 ? formatAmount(entry.credit) : "",
          formatAmount(entry.balance),
        ]),
        ["", "", "Total", formatAmount(statement.totalDebit), formatAmount(statement.totalCredit), formatAmount(statement.finalBalance)],
      ],
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 25 },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right", fontStyle: "bold" },
      },
    });

    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toISOString().split("T")[0]}`, 14, footerY);

    doc.save(`account-statement-${account.number}.pdf`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-3">
                  <span className="font-mono text-secondary">{account.number}</span>
                  <span>{account.name}</span>
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {getAccountClassName(account.class)}
                </p>
              </div>
              {statement.entries.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleExportPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {statement.entries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No transactions found for this account
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50 text-sm">
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Voucher</th>
                      <th className="text-left p-3 font-medium">Description</th>
                      <th className="text-right p-3 font-medium">Debit</th>
                      <th className="text-right p-3 font-medium">Credit</th>
                      <th className="text-right p-3 font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.entries.map((entry, index) => (
                      <tr 
                        key={index} 
                        className="border-t hover:bg-muted/20 cursor-pointer transition-colors"
                        onClick={() => handleVoucherClick(entry.voucherNumber)}
                      >
                        <td className="p-3 font-mono text-sm">{entry.date}</td>
                        <td className="p-3 text-secondary hover:underline">
                          #{entry.voucherNumber}
                        </td>
                        <td className="p-3 text-muted-foreground">{entry.description}</td>
                        <td className="p-3 text-right font-mono">
                          {entry.debit > 0 ? formatAmount(entry.debit) : ""}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {entry.credit > 0 ? formatAmount(entry.credit) : ""}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold">
                          {formatAmount(entry.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/30">
                      <td colSpan={3} className="p-3 font-semibold">Total</td>
                      <td className="p-3 text-right font-mono font-semibold">
                        {formatAmount(statement.totalDebit)}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold">
                        {formatAmount(statement.totalCredit)}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-secondary">
                        {formatAmount(statement.finalBalance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <VoucherDetailsDialog
        open={!!selectedVoucher}
        onOpenChange={(open) => !open && setSelectedVoucher(null)}
        voucher={selectedVoucher}
      />
    </>
  );
}
