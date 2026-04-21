import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAccounting, VoucherLine, Voucher } from "@/contexts/AccountingContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditTrail } from "@/contexts/AuditTrailContext";
import { useReceipts } from "@/contexts/ReceiptsContext";
import { useFiscalLock } from "@/contexts/FiscalLockContext";
import { useVat } from "@/contexts/VatContext";
import { useVatPeriodLock } from "@/contexts/VatPeriodLockContext";
import { getActiveVatCodes, getVatCodeById } from "@/lib/vat/codes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatAmount } from "@/lib/bas-accounts";
import { getBASAccountsForDate } from "@/lib/bas-accounts";
import { Plus, Trash2, Check, AlertCircle, X, Upload, FileText, Image, ChevronDown, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PendingAttachment {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
}

interface VoucherFormProps {
  onCancel: () => void;
  onSuccess: () => void;
  editVoucher?: Voucher;
  duplicateFrom?: Voucher;
}

export function VoucherForm({ onCancel, onSuccess, editVoucher, duplicateFrom }: VoucherFormProps) {
  const sourceVoucher = editVoucher || duplicateFrom;
  const { accounts, nextVoucherNumber, createVoucher, updateVoucher, validateVoucher } = useAccounting();
  const { activeCompany } = useAuth();
  const { addEntry } = useAuditTrail();
  const { addReceipt } = useReceipts();
  const { isDateInLockedYear } = useFiscalLock();
  const { vatCodes } = useVat();
  const { isDateInLockedPeriod } = useVatPeriodLock();
  const activeVatCodes = getActiveVatCodes(vatCodes);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debitInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const creditInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const accountButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  
  const [date, setDate] = useState(editVoucher?.date || "");
  const [description, setDescription] = useState(editVoucher?.description || "");
  const [lines, setLines] = useState<VoucherLine[]>(
    sourceVoucher?.lines.map(l => ({ ...l, id: crypto.randomUUID() })) || [
      { id: crypto.randomUUID(), accountNumber: "", accountName: "", debit: 0, credit: 0 },
      { id: crypto.randomUUID(), accountNumber: "", accountName: "", debit: 0, credit: 0 },
    ]
  );
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [openComboboxes, setOpenComboboxes] = useState<Record<string, boolean>>({});
  const [pendingFocusLineId, setPendingFocusLineId] = useState<string | null>(null);
  const [dateAccounts, setDateAccounts] = useState(accounts);

  useEffect(() => {
    const yearAccounts = getBASAccountsForDate(date, activeCompany?.accountingStandard ?? "");
    if (yearAccounts.length > 0) {
      setDateAccounts(yearAccounts);
      return;
    }
    setDateAccounts(accounts);
  }, [date, accounts, activeCompany?.accountingStandard]);

  useEffect(() => {
    const validAccountNumbers = new Set(dateAccounts.map((account) => account.number));
    setLines((prevLines) =>
      prevLines.map((line) =>
        line.accountNumber && !validAccountNumbers.has(line.accountNumber)
          ? { ...line, accountNumber: "", accountName: "" }
          : line
      )
    );
  }, [dateAccounts]);

  useEffect(() => {
    if (pendingFocusLineId) {
      const debitInput = debitInputRefs.current.get(pendingFocusLineId);
      if (debitInput) {
        setTimeout(() => {
          debitInput.focus();
          debitInput.select();
        }, 50);
      }
      setPendingFocusLineId(null);
    }
  }, [pendingFocusLineId]);

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
        const account = dateAccounts.find(a => a.number === value);
        return { ...l, accountNumber: value as string, accountName: account?.name || "" };
      }
      if (field === "debit" && Number(value) > 0) {
        return { ...l, debit: value as number, credit: 0 };
      }
      if (field === "credit" && Number(value) > 0) {
        return { ...l, credit: value as number, debit: 0 };
      }
      return { ...l, [field]: value };
    }));
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
        const newAttachment: PendingAttachment = {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          dataUrl: reader.result as string,
        };
        setPendingAttachments(prev => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== id));
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
    const today = new Date().toISOString().split("T")[0];
    if (date > today) {
      toast.error("Date cannot be in the future");
      return;
    }
    if (isDateInLockedYear(date)) {
      toast.error("Cannot create vouchers for a locked fiscal year");
      return;
    }
    if (isDateInLockedPeriod(date)) {
      toast.error("Momsperioden är låst. Skapa en rättelseverifikation istället.");
      return;
    }
    const validLines = lines.filter(l => l.accountNumber && (l.debit > 0 || l.credit > 0));
    if (validLines.length < 2) {
      toast.error("Voucher must have at least 2 valid lines");
      return;
    }

    if (editVoucher) {
      const updated = updateVoucher(editVoucher.id, {
        date,
        description: description.trim(),
        lines: validLines,
      });
      if (updated) {
        toast.success(`Voucher #${updated.voucherNumber} updated successfully`);
        onSuccess();
      } else {
        toast.error("Failed to update voucher");
      }
    } else {
      const voucherNum = nextVoucherNumber;
      const voucher = createVoucher({
        date,
        description: description.trim(),
        lines: validLines,
      });

      if (voucher) {
        // Add receipts to the receipts store linked to this voucher
        pendingAttachments.forEach(a => {
          const ext = a.name.split(".").pop() || "jpg";
          addReceipt({
            name: `voucher_${voucher.voucherNumber}.${ext}`,
            type: a.type,
            dataUrl: a.dataUrl,
            voucherId: voucher.id,
            voucherNumber: voucher.voucherNumber,
          });
        });
        addEntry(`Created voucher #${voucher.voucherNumber}`);
        toast.success(`Voucher #${voucher.voucherNumber} created successfully`);
        onSuccess();
      } else {
        toast.error("Failed to create voucher");
      }
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {editVoucher
              ? `Edit Voucher #${editVoucher.voucherNumber}`
              : duplicateFrom
              ? `Duplicate Voucher #${duplicateFrom.voucherNumber}`
              : "Create Voucher"}
          </h2>
          {!editVoucher && (
            <p className="text-sm text-muted-foreground">
              Verifikation #{nextVoucherNumber}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Header fields */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) => setDate(e.target.value)}
            className={isDateInLockedYear(date) ? "border-destructive" : ""}
          />
          {isDateInLockedYear(date) && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              This date falls in a locked fiscal year. You cannot create vouchers for locked years.
            </p>
          )}
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
        <Label>Voucher Lines</Label>

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full table-fixed">
            <thead>
              <tr className="bg-muted/50 text-sm">
                <th className="text-left p-3 font-medium">Account</th>
                <th className="text-right p-3 font-medium w-28">Debit</th>
                <th className="text-right p-3 font-medium w-28">Credit</th>
                <th className="text-left p-3 font-medium w-36">Momskod</th>
                <th className="p-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, lineIndex) => (
                <tr key={line.id} className="border-t border-border">
                  <td className="p-2">
                    <Popover
                      open={openComboboxes[line.id] || false}
                      onOpenChange={(open) => setOpenComboboxes(prev => ({ ...prev, [line.id]: open }))}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          ref={(el) => { if (el) accountButtonRefs.current.set(line.id, el); }}
                          variant="outline"
                          role="combobox"
                          aria-expanded={openComboboxes[line.id] || false}
                          className="w-full justify-between font-normal overflow-hidden"
                        >
                          {line.accountNumber ? (
                            <span className="truncate">
                              <span className="font-mono">{line.accountNumber}</span>
                              <span className="ml-2 text-muted-foreground">{line.accountName}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Select account...</span>
                          )}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search by number or name..." />
                          <CommandList>
                            <CommandEmpty>No account found.</CommandEmpty>
                            <CommandGroup className="max-h-64 overflow-auto">
                              {dateAccounts.map((account) => (
                                <CommandItem
                                  key={account.number}
                                  value={`${account.number} ${account.name}`}
                                  onSelect={() => {
                                    updateLine(line.id, "accountNumber", account.number);
                                    setOpenComboboxes(prev => ({ ...prev, [line.id]: false }));
                                    setPendingFocusLineId(line.id);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", line.accountNumber === account.number ? "opacity-100" : "opacity-0")} />
                                  <span className="font-mono">{account.number}</span>
                                  <span className="ml-2 text-muted-foreground">{account.name}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </td>
                  <td className="p-2">
                    <Input
                      ref={(el) => { if (el) debitInputRefs.current.set(line.id, el); }}
                      type="number"
                      min="0"
                      step="1"
                      className="text-right"
                      value={line.debit || ""}
                      onChange={(e) => updateLine(line.id, "debit", parseFloat(e.target.value) || 0)}
                      onKeyDown={(e) => {
                        if (!/[\d.\-+eE]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                          e.preventDefault();
                        }
                        if (e.key === 'Tab' && !e.shiftKey) {
                          e.preventDefault();
                          const creditInput = creditInputRefs.current.get(line.id);
                          if (creditInput) { creditInput.focus(); creditInput.select(); }
                        }
                      }}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      ref={(el) => { if (el) creditInputRefs.current.set(line.id, el); }}
                      type="number"
                      min="0"
                      step="1"
                      className="text-right"
                      value={line.credit || ""}
                      onChange={(e) => updateLine(line.id, "credit", parseFloat(e.target.value) || 0)}
                      onKeyDown={(e) => {
                        if (!/[\d.\-+eE]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                          e.preventDefault();
                        }
                        if (e.key === 'Tab' && !e.shiftKey) {
                          const nextLineIndex = lineIndex + 1;
                          if (nextLineIndex < lines.length) {
                            e.preventDefault();
                            const nextLine = lines[nextLineIndex];
                            const nextAccountButton = accountButtonRefs.current.get(nextLine.id);
                            if (nextAccountButton) nextAccountButton.focus();
                          }
                        }
                      }}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="p-2">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(line.id)} disabled={lines.length <= 2}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/30">
                <td className="p-3 font-semibold">Balance</td>
                <td className="p-3 text-right font-mono font-semibold">
                  {formatAmount(lines.reduce((s, l) => s + l.debit, 0))}
                </td>
                <td className="p-3 text-right font-mono font-semibold">
                  {formatAmount(lines.reduce((s, l) => s + l.credit, 0))}
                </td>
                <td className="p-3">
                  {validation.isValid ? (
                    <Check className="h-5 w-5 text-success mx-auto" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-destructive mx-auto" />
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          <Plus className="h-4 w-4 mr-1" />
          Add Line
        </Button>
      </div>

      {/* Attachments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Receipts / Attachments</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" />
            Add Receipt
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleFileChange} />
        </div>
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendingAttachments.map((attachment) => (
              <div key={attachment.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-sm">
                {attachment.type.startsWith("image/") ? (
                  <Image className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="max-w-32 truncate">{attachment.name}</span>
                <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeAttachment(attachment.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validation */}
      {!validation.isValid && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>Difference: {formatAmount(validation.difference)} SEK — Voucher must be balanced.</span>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={!validation.isValid}>
          {editVoucher ? "Update Voucher" : "Save Voucher"}
        </Button>
      </div>
    </div>
  );
}
