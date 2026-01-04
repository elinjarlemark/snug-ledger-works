import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Voucher, useAccounting } from "@/contexts/AccountingContext";
import { formatAmount } from "@/lib/bas-accounts";
import { RotateCcw, Trash2, Edit, FileText, Image, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { VoucherForm } from "./VoucherForm";

interface VoucherDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voucher: Voucher | null;
}

export function VoucherDetailsDialog({ 
  open, 
  onOpenChange, 
  voucher 
}: VoucherDetailsDialogProps) {
  const { createVoucher, updateVoucher, deleteVoucher } = useAccounting();
  const [isEditing, setIsEditing] = useState(false);

  if (!voucher) return null;

  const handleRevert = () => {
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
      toast.success(`Reversal voucher #${reversalVoucher.voucherNumber} created`);
      onOpenChange(false);
    } else {
      toast.error("Failed to create reversal voucher");
    }
  };

  const handleDelete = () => {
    deleteVoucher(voucher.id);
    toast.success(`Voucher #${voucher.voucherNumber} deleted`);
    onOpenChange(false);
  };

  const handleEditComplete = () => {
    setIsEditing(false);
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
    <Dialog open={open} onOpenChange={(open) => { if (!open) setIsEditing(false); onOpenChange(open); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit Voucher #${voucher.voucherNumber}` : `Voucher #${voucher.voucherNumber}`}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Created {new Date(voucher.createdAt).toLocaleDateString()}
          </p>
        </DialogHeader>

        {isEditing ? (
          <VoucherForm 
            editVoucher={voucher}
            onSuccess={handleEditComplete}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <div className="space-y-6">
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

          {/* Attachments */}
          {voucher.attachments && voucher.attachments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Attachments</p>
              <div className="flex flex-wrap gap-2">
                {voucher.attachments.map((attachment) => (
                  <Button
                    key={attachment.id}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => openAttachment(attachment.dataUrl)}
                  >
                    {attachment.type.startsWith("image/") ? (
                      <Image className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    <span className="max-w-32 truncate">{attachment.name}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                ))}
              </div>
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
                  <td className="p-3 text-right font-mono font-semibold">
                    {formatAmount(totalDebit)}
                  </td>
                  <td className="p-3 text-right font-mono font-semibold">
                    {formatAmount(totalCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Voucher
            </Button>
            <Button variant="outline" onClick={handleRevert}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Revert Voucher
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Voucher
            </Button>
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
