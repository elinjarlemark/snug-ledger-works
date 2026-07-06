import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Voucher, useAccounting } from "@/contexts/AccountingContext";
import { useComments } from "@/contexts/CommentsContext";
import { formatAmount } from "@/lib/bas-accounts";
import { RotateCcw, Trash2, Edit, FileText, Image, ExternalLink, MessageSquare } from "lucide-react";
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
  const { reverseVoucher, deleteVoucher, updateVoucher } = useAccounting();
  const { addComment, getCommentsForTarget, deleteComment } = useComments();
  const [isEditing, setIsEditing] = useState(false);
  const [commentText, setCommentText] = useState("");

  if (!voucher) return null;

  const handleRevert = () => {
    const reversalVoucher = reverseVoucher(voucher);

    if (reversalVoucher) {
      updateVoucher(voucher.id, {
        reversedByVoucherId: reversalVoucher.id,
        reversedByVoucherNumber: reversalVoucher.voucherNumber,
      });
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
  const voucherComments = getCommentsForTarget("voucher", voucher.id);

  const handleAddComment = () => {
    const text = commentText.trim();
    if (!text) return;

    const added = addComment({
      targetType: "voucher",
      targetId: voucher.id,
      targetLabel: `Verifikation #${voucher.voucherNumber} · ${voucher.description}`,
      text,
    });

    if (added) {
      setCommentText("");
      toast.success("Kommentar sparad");
    }
  };

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
          {(voucher.reversesVoucherNumber || voucher.reversedByVoucherNumber) && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {voucher.reversesVoucherNumber
                ? `Den här verifikationen vänder verifikation #${voucher.reversesVoucherNumber}.`
                : `Den här verifikationen har vänts av verifikation #${voucher.reversedByVoucherNumber}.`}
            </div>
          )}

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

          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Kommentarer</h3>
              <span className="text-xs text-muted-foreground">({voucherComments.length})</span>
            </div>
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Skriv en kommentar om den här verifikationen..."
              rows={3}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleAddComment} disabled={!commentText.trim()}>
                Lägg till kommentar
              </Button>
            </div>
            {voucherComments.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                {voucherComments.map((comment) => (
                  <div key={comment.id} className="rounded-md bg-muted/30 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <p className="whitespace-pre-wrap text-foreground">{comment.text}</p>
                      <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => deleteComment(comment.id)}>
                        Ta bort
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleString()}
                      {comment.createdBy ? ` · ${comment.createdBy}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
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
