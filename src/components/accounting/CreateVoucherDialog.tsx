import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounting, VoucherLine } from "@/contexts/AccountingContext";
import { formatAmount } from "@/lib/bas-accounts";
import { Plus, Trash2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreateVoucherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateVoucherDialog({ open, onOpenChange }: CreateVoucherDialogProps) {
  const { accounts, nextVoucherNumber, createVoucher, validateVoucher } = useAccounting();
  
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<VoucherLine[]>([
    { id: crypto.randomUUID(), accountNumber: "", accountName: "", debit: 0, credit: 0 },
    { id: crypto.randomUUID(), accountNumber: "", accountName: "", debit: 0, credit: 0 },
  ]);

  const validation = validateVoucher(lines);

  const addLine = () => {
    setLines([
      ...lines,
      { id: crypto.randomUUID(), accountNumber: "", accountName: "", debit: 0, credit: 0 },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 2) return;
    setLines(lines.filter(l => l.id !== id));
  };

  const updateLine = (id: string, field: keyof VoucherLine, value: string | number) => {
    setLines(lines.map(l => {
      if (l.id !== id) return l;
      
      if (field === "accountNumber") {
        const account = accounts.find(a => a.number === value);
        return { ...l, accountNumber: value as string, accountName: account?.name || "" };
      }
      
      // Ensure only one of debit/credit is filled
      if (field === "debit" && Number(value) > 0) {
        return { ...l, debit: value as number, credit: 0 };
      }
      if (field === "credit" && Number(value) > 0) {
        return { ...l, credit: value as number, debit: 0 };
      }
      
      return { ...l, [field]: value };
    }));
  };

  const handleSubmit = () => {
    if (!validation.isValid) {
      toast.error("Voucher must be balanced (debit = credit)");
      return;
    }
    
    if (!date || !description.trim()) {
      toast.error("Please fill in date and description");
      return;
    }
    
    const validLines = lines.filter(l => l.accountNumber && (l.debit > 0 || l.credit > 0));
    if (validLines.length < 2) {
      toast.error("Voucher must have at least 2 valid lines");
      return;
    }

    const voucher = createVoucher({
      date,
      description: description.trim(),
      lines: validLines,
    });

    if (voucher) {
      toast.success(`Voucher #${voucher.voucherNumber} created successfully`);
      onOpenChange(false);
      // Reset form
      setDate(new Date().toISOString().split("T")[0]);
      setDescription("");
      setLines([
        { id: crypto.randomUUID(), accountNumber: "", accountName: "", debit: 0, credit: 0 },
        { id: crypto.randomUUID(), accountNumber: "", accountName: "", debit: 0, credit: 0 },
      ]);
    } else {
      toast.error("Failed to create voucher");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Create Voucher</span>
            <span className="text-sm font-normal text-muted-foreground">
              (Verifikation #{nextVoucherNumber})
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header fields */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Transaction description"
              />
            </div>
          </div>

          {/* Voucher lines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Voucher Lines</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" />
                Add Line
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 text-sm">
                    <th className="text-left p-3 font-medium">Account</th>
                    <th className="text-right p-3 font-medium w-32">Debit</th>
                    <th className="text-right p-3 font-medium w-32">Credit</th>
                    <th className="p-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.id} className="border-t">
                      <td className="p-2">
                        <Select
                          value={line.accountNumber}
                          onValueChange={(v) => updateLine(line.id, "accountNumber", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent className="max-h-64">
                            {accounts.map((account) => (
                              <SelectItem key={account.number} value={account.number}>
                                <span className="font-mono">{account.number}</span>
                                <span className="ml-2 text-muted-foreground">{account.name}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="text-right"
                          value={line.debit || ""}
                          onChange={(e) => updateLine(line.id, "debit", parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="text-right"
                          value={line.credit || ""}
                          onChange={(e) => updateLine(line.id, "credit", parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      </td>
                      <td className="p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length <= 2}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td className="p-3 font-semibold">Total</td>
                    <td className="p-3 text-right font-mono font-semibold">
                      {formatAmount(validation.totalDebit)}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold">
                      {formatAmount(validation.totalCredit)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Balance indicator */}
            <div className={cn(
              "flex items-center gap-2 p-3 rounded-lg",
              validation.isValid 
                ? "bg-success/10 text-success" 
                : "bg-destructive/10 text-destructive"
            )}>
              {validation.isValid ? (
                <>
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Voucher is balanced</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">
                    Difference: {formatAmount(validation.difference)} SEK
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!validation.isValid}
            >
              Create Voucher
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
