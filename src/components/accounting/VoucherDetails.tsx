import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Voucher, useAccounting } from "@/contexts/AccountingContext";
import { useAuditTrail } from "@/contexts/AuditTrailContext";
import { useFiscalLock } from "@/contexts/FiscalLockContext";
import { useReceipts } from "@/contexts/ReceiptsContext";
import { formatAmount } from "@/lib/bas-accounts";
import { X, RotateCcw, FileText, Image, ExternalLink, Copy, Upload, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { useRef } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VoucherDetailsProps {
  voucher: Voucher;
  onClose: () => void;
  onEdit?: () => void;
  onDuplicate?: (voucher: Voucher) => void;
}

export function VoucherDetails({ voucher, onClose, onDuplicate }: VoucherDetailsProps) {
  const { createVoucher } = useAccounting();
  const { addEntry } = useAuditTrail();
  const { isYearLocked } = useFiscalLock();
  const { addReceipt, getReceiptsForVoucher, unlinkReceipt } = useReceipts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showReceiptsDialog, setShowReceiptsDialog] = useState(false);

  const voucherYear = new Date(voucher.date).getFullYear();
  const yearLocked = isYearLocked(voucherYear);

  const voucherReceipts = getReceiptsForVoucher(voucher.id);

  const handleRevert = () => {
    if (yearLocked) return;

    const reversalLines = voucher.lines.map(line => ({
      id: crypto.randomUUID(),
      accountNumber: line.accountNumber,
      accountName: line.accountName,
      debit: line.credit,
      credit: line.debit,
    }));

    const reversalVoucher = createVoucher({
      date: new Date().toISOString().split("T")[0],
      description: `Reversal of voucher #${voucher.voucherNumber}: ${voucher.description}`,
      lines: reversalLines,
    });

    if (reversalVoucher) {
      addEntry(`Created voucher #${reversalVoucher.voucherNumber}, revert of voucher #${voucher.voucherNumber}`);
      toast.success(`Reversal voucher #${reversalVoucher.voucherNumber} created`);
      onClose();
    } else {
      toast.error("Failed to create reversal voucher");
    }
  };

  const handleAddReceipt = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const isValid = file.type.startsWith("image/") || file.type === "application/pdf";
      if (!isValid) {
        toast.error(`Invalid file type: ${file.name}. Only images and PDFs are allowed.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const ext = file.name.split(".").pop() || "jpg";
        const newName = `voucher_${voucher.voucherNumber}.${ext}`;
        addReceipt({
          name: newName,
          type: file.type,
          dataUrl: reader.result as string,
          voucherId: voucher.id,
          voucherNumber: voucher.voucherNumber,
        });
        addEntry(`Added receipt to voucher #${voucher.voucherNumber}`);
        toast.success(`Receipt added to voucher #${voucher.voucherNumber}`);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveReceipt = (receiptId: string) => {
    unlinkReceipt(receiptId);
    toast.info("Receipt removed from voucher (still available in Receipts page)");
  };

  const openAttachment = (dataUrl: string) => {
    const newWindow = window.open();
    if (newWindow) {
      if (dataUrl.startsWith("data:application/pdf")) {
        newWindow.document.write(`<iframe src="${dataUrl}" style="width:100%;height:100%;border:none;"></iframe>`);
      } else {
        newWindow.document.write(`<img src="${dataUrl}" style="max-width:100%;height:auto;" />`);
      }
    }
  };

  const totalDebit = voucher.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = voucher.lines.reduce((sum, l) => sum + l.credit, 0);

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-6">
      <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleFileChange} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Voucher #{voucher.voucherNumber}
          </h2>
          <p className="text-sm text-muted-foreground">
            Created {new Date(voucher.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Voucher info */}
      <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
        <div>
          <p className="text-sm text-muted-foreground">Date</p>
          <p className="font-medium">{voucher.date}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Description</p>
          <p className="font-medium">{voucher.description}</p>
        </div>
      </div>

      {/* Receipts indicator */}
      {voucherReceipts.length > 0 && (
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            Receipts ({voucherReceipts.length})
          </p>
          <Button variant="outline" size="sm" onClick={() => setShowReceiptsDialog(true)}>
            <Eye className="h-4 w-4 mr-1" />
            View Receipts
          </Button>
        </div>
      )}

      {/* Voucher lines */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 text-sm">
              <th className="text-left p-3 font-medium">Account</th>
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-right p-3 font-medium w-32">Debit</th>
              <th className="text-right p-3 font-medium w-32">Credit</th>
            </tr>
          </thead>
          <tbody>
            {voucher.lines.map((line) => (
              <tr key={line.id} className="border-t border-border">
                <td className="p-3 font-mono text-secondary">{line.accountNumber}</td>
                <td className="p-3 text-muted-foreground">{line.accountName}</td>
                <td className="p-3 text-right font-mono">
                  {line.debit > 0 ? formatAmount(line.debit) : ""}
                </td>
                <td className="p-3 text-right font-mono">
                  {line.credit > 0 ? formatAmount(line.credit) : ""}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/30">
              <td colSpan={2} className="p-3 font-semibold">Total</td>
              <td className="p-3 text-right font-mono font-semibold">{formatAmount(totalDebit)}</td>
              <td className="p-3 text-right font-mono font-semibold">{formatAmount(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {onDuplicate && (
          <Button variant="outline" onClick={() => onDuplicate(voucher)}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
        )}
        <Button variant="outline" onClick={handleAddReceipt}>
          <Upload className="h-4 w-4 mr-2" />
          Add Receipt
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="destructive"
                onClick={handleRevert}
                disabled={yearLocked}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Revert Voucher
              </Button>
            </span>
          </TooltipTrigger>
          {yearLocked && (
            <TooltipContent>Year is locked</TooltipContent>
          )}
        </Tooltip>
      </div>

      {/* View Receipts Dialog */}
      <Dialog open={showReceiptsDialog} onOpenChange={setShowReceiptsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Receipts for Voucher #{voucher.voucherNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {voucherReceipts.map((receipt) => (
              <div key={receipt.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  {receipt.type.startsWith("image/") ? (
                    <Image className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium truncate max-w-48">{receipt.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openAttachment(receipt.dataUrl)}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleRemoveReceipt(receipt.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {voucherReceipts.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No receipts attached.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
