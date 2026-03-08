import { useState } from "react";
import { Receipt as ReceiptIcon, Trash2, Link2, Link2Off, Image, FileText, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useReceipts } from "@/contexts/ReceiptsContext";
import { useAccounting } from "@/contexts/AccountingContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Lock } from "lucide-react";
import { Link } from "react-router-dom";

export default function ReceiptsPage() {
  const { user } = useAuth();
  const { receipts, removeReceipt, linkReceipt, unlinkReceipt } = useReceipts();
  const { vouchers } = useAccounting();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [relinkDialog, setRelinkDialog] = useState<string | null>(null);
  const [selectedVoucherId, setSelectedVoucherId] = useState("");

  if (!user) {
    return (
      <div className="space-y-12 animate-fade-in">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
              <ReceiptIcon className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Receipts</h1>
              <p className="text-muted-foreground">Manage uploaded receipts</p>
            </div>
          </div>
        </div>
        <section className="bg-primary/5 rounded-xl p-8 border border-primary/10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-2">View Receipts</h3>
              <p className="text-muted-foreground mb-4">Sign in to manage your receipts.</p>
              <Button asChild><Link to="/login">Sign In</Link></Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const filteredReceipts = receipts.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return r.name.toLowerCase().includes(q) || (r.voucherNumber?.toString().includes(q));
  });

  const openAttachment = (dataUrl: string) => {
    const w = window.open();
    if (w) {
      if (dataUrl.startsWith("data:application/pdf")) {
        w.document.write(`<iframe src="${dataUrl}" style="width:100%;height:100%;border:none;"></iframe>`);
      } else {
        w.document.write(`<img src="${dataUrl}" style="max-width:100%;height:auto;" />`);
      }
    }
  };

  const handleDelete = (id: string) => {
    removeReceipt(id);
    setDeleteConfirm(null);
    toast.success("Receipt deleted");
  };

  const handleRelink = () => {
    if (!relinkDialog || !selectedVoucherId) return;
    const v = vouchers.find(v => v.id === selectedVoucherId);
    if (v) {
      linkReceipt(relinkDialog, v.id, v.voucherNumber);
      toast.success(`Receipt linked to voucher #${v.voucherNumber}`);
    }
    setRelinkDialog(null);
    setSelectedVoucherId("");
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
          <ReceiptIcon className="h-6 w-6 text-secondary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Receipts</h1>
          <p className="text-muted-foreground">All uploaded receipts across vouchers</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-foreground">
          All Receipts ({filteredReceipts.length})
        </h2>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search receipts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filteredReceipts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No receipts found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredReceipts.map((receipt) => (
            <Card key={receipt.id}>
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {receipt.type.startsWith("image/") ? (
                    <Image className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{receipt.name}</p>
                    {receipt.voucherId ? (
                      <p className="text-xs text-muted-foreground">
                        Connected to voucher #{receipt.voucherNumber}
                      </p>
                    ) : (
                      <p className="text-xs text-destructive">Not connected to voucher</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openAttachment(receipt.dataUrl)}>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  {receipt.voucherId ? (
                    <Button variant="ghost" size="sm" onClick={() => unlinkReceipt(receipt.id)}>
                      <Link2Off className="h-4 w-4 mr-1" />
                      Unlink
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => { setRelinkDialog(receipt.id); setSelectedVoucherId(""); }}>
                      <Link2 className="h-4 w-4 mr-1" />
                      Link
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteConfirm(receipt.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete receipt?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this receipt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Relink dialog */}
      <Dialog open={!!relinkDialog} onOpenChange={() => setRelinkDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link receipt to voucher</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedVoucherId} onValueChange={setSelectedVoucherId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a voucher..." />
              </SelectTrigger>
              <SelectContent>
                {vouchers.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    #{v.voucherNumber} — {v.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRelinkDialog(null)}>Cancel</Button>
              <Button onClick={handleRelink} disabled={!selectedVoucherId}>Link</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
