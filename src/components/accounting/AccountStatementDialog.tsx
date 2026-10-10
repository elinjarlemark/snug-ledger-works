import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccounting, Voucher } from "@/contexts/AccountingContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  calculateAccountBalance,
  formatAmount,
  getAccountClassName,
} from "@/lib/bas-accounts";
import { VoucherDetailsDialog } from "./VoucherDetailsDialog";
import { Download, RotateCcw } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface AccountStatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountNumber: string;
}

const roundToOre = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function AccountStatementDialog({
  open,
  onOpenChange,
  accountNumber,
}: AccountStatementDialogProps) {
  const { getAccountStatement, accounts, getVoucherById } = useAccounting();
  const { activeCompany } = useAuth();
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    setStartDate("");
    setEndDate("");
    setSelectedVoucher(null);
  }, [accountNumber]);

  const account = accounts.find((entry) => entry.number === accountNumber);
  const invalidRange = Boolean(startDate && endDate && startDate > endDate);

  const statement = invalidRange
    ? null
    : getAccountStatement(
        accountNumber,
        startDate || undefined,
        endDate || undefined
      );

  const openingBalance = useMemo(() => {
    if (!statement) return 0;

    const periodMovement = statement.entries.reduce(
      (sum, entry) =>
        sum +
        calculateAccountBalance(
          accountNumber,
          entry.debit,
          entry.credit
        ),
      0
    );

    return roundToOre(statement.finalBalance - periodMovement);
  }, [statement, accountNumber]);

  if (!account) return null;

  const handleVoucherClick = (voucherId: string) => {
    const voucher = getVoucherById(voucherId);
    if (voucher) {
      setSelectedVoucher(voucher);
    }
  };

  const voucherReference = (series: string | undefined, voucherNumber: number) =>
    `${(series || "A").toUpperCase()}${voucherNumber}`;

  const resetPeriod = () => {
    setStartDate("");
    setEndDate("");
  };

  const periodText = () => {
    if (startDate && endDate) return `${startDate} – ${endDate}`;
    if (startDate) return `Från ${startDate}`;
    if (endDate) return `Till ${endDate}`;
    return "Alla datum";
  };

  const handleExportPDF = () => {
    if (!statement) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Kontoutdrag", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    if (activeCompany) {
      doc.text(activeCompany.companyName, pageWidth / 2, 30, { align: "center" });
      doc.text(
        `Org.nr: ${activeCompany.organizationNumber}`,
        pageWidth / 2,
        37,
        { align: "center" }
      );
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`${account.number} - ${account.name}`, 14, 50);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(getAccountClassName(account.class), 14, 57);
    doc.text(`Period: ${periodText()}`, 14, 63);

    autoTable(doc, {
      startY: 69,
      head: [["Datum", "Verifikation", "Beskrivning", "Debet", "Kredit", "Saldo"]],
      body: [
        ["", "", "Ingående saldo", "", "", formatAmount(openingBalance)],
        ...statement.entries.map((entry) => [
          entry.date,
          voucherReference(entry.series, entry.voucherNumber),
          entry.description,
          entry.debit > 0 ? formatAmount(entry.debit) : "",
          entry.credit > 0 ? formatAmount(entry.credit) : "",
          formatAmount(entry.balance),
        ]),
        [
          "",
          "",
          "Periodsumma",
          formatAmount(statement.totalDebit),
          formatAmount(statement.totalCredit),
          "",
        ],
        ["", "", "Utgående saldo", "", "", formatAmount(statement.finalBalance)],
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
    doc.text(
      `Skapad: ${new Date().toISOString().split("T")[0]}`,
      14,
      footerY
    );

    const suffix =
      startDate || endDate
        ? `-${startDate || "start"}-${endDate || "slut"}`
        : "";

    doc.save(`kontoutdrag-${account.number}${suffix}.pdf`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <DialogTitle className="flex items-center gap-3">
                  <span className="font-mono text-secondary">{account.number}</span>
                  <span>{account.name}</span>
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {getAccountClassName(account.class)}
                </p>
              </div>

              {statement && (
                <Button variant="outline" size="sm" onClick={handleExportPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportera PDF
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="account-statement-start-date">Från datum</Label>
                  <Input
                    id="account-statement-start-date"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account-statement-end-date">Till datum</Label>
                  <Input
                    id="account-statement-end-date"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={resetPeriod}
                  disabled={!startDate && !endDate}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Återställ
                </Button>
              </div>

              {invalidRange && (
                <p className="mt-3 text-sm text-destructive">
                  Från-datum kan inte vara senare än till-datum.
                </p>
              )}
            </div>

            {statement && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Ingående saldo</div>
                  <div className="mt-1 font-mono font-semibold">
                    {formatAmount(openingBalance)}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Periodens debet</div>
                  <div className="mt-1 font-mono font-semibold">
                    {formatAmount(statement.totalDebit)}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Periodens kredit</div>
                  <div className="mt-1 font-mono font-semibold">
                    {formatAmount(statement.totalCredit)}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Utgående saldo</div>
                  <div className="mt-1 font-mono font-semibold text-secondary">
                    {formatAmount(statement.finalBalance)}
                  </div>
                </div>
              </div>
            )}

            {!invalidRange && statement && statement.entries.length === 0 ? (
              <div className="rounded-lg border py-8 text-center text-muted-foreground">
                Inga transaktioner hittades för den valda perioden.
                {openingBalance !== 0 && (
                  <div className="mt-2 text-sm">
                    Kontot har ändå ett ingående och utgående saldo på{" "}
                    <span className="font-mono font-medium text-foreground">
                      {formatAmount(statement.finalBalance)}
                    </span>
                    .
                  </div>
                )}
              </div>
            ) : statement ? (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead>
                    <tr className="bg-muted/50 text-sm">
                      <th className="text-left p-3 font-medium">Datum</th>
                      <th className="text-left p-3 font-medium">Verifikation</th>
                      <th className="text-left p-3 font-medium">Beskrivning</th>
                      <th className="text-right p-3 font-medium">Debet</th>
                      <th className="text-right p-3 font-medium">Kredit</th>
                      <th className="text-right p-3 font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t bg-muted/20">
                      <td colSpan={5} className="p-3 font-medium">
                        Ingående saldo
                      </td>
                      <td className="p-3 text-right font-mono font-semibold">
                        {formatAmount(openingBalance)}
                      </td>
                    </tr>

                    {statement.entries.map((entry, index) => (
                      <tr
                        key={`${entry.voucherId}-${entry.date}-${entry.voucherNumber}-${index}`}
                        className="border-t hover:bg-muted/20 cursor-pointer transition-colors"
                        onClick={() => handleVoucherClick(entry.voucherId)}
                      >
                        <td className="p-3 font-mono text-sm">{entry.date}</td>
                        <td className="p-3 text-secondary hover:underline font-mono">
                          {voucherReference(entry.series, entry.voucherNumber)}
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
                      <td colSpan={3} className="p-3 font-semibold">
                        Periodsumma
                      </td>
                      <td className="p-3 text-right font-mono font-semibold">
                        {formatAmount(statement.totalDebit)}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold">
                        {formatAmount(statement.totalCredit)}
                      </td>
                      <td className="p-3" />
                    </tr>
                    <tr className="border-t bg-muted/40">
                      <td colSpan={5} className="p-3 font-semibold">
                        Utgående saldo
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-secondary">
                        {formatAmount(statement.finalBalance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <VoucherDetailsDialog
        open={!!selectedVoucher}
        onOpenChange={(isOpen) => !isOpen && setSelectedVoucher(null)}
        voucher={selectedVoucher}
      />
    </>
  );
}
