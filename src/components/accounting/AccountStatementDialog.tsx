import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAccounting, Voucher } from "@/contexts/AccountingContext";
import { formatAmount, getAccountClassName } from "@/lib/bas-accounts";
import { VoucherDetailsDialog } from "./VoucherDetailsDialog";

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="font-mono text-secondary">{account.number}</span>
              <span>{account.name}</span>
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {getAccountClassName(account.class)}
            </p>
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
