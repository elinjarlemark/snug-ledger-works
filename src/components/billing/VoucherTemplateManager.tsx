import { useState } from "react";
import { Plus, Trash2, Edit, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useBilling } from "@/contexts/BillingContext";
import { useAccounting } from "@/contexts/AccountingContext";
import { VoucherTemplate, VoucherTemplateLine, TemplateAmountSource } from "@/lib/billing/types";
import { toast } from "sonner";

const SOURCE_LABEL: Record<TemplateAmountSource, string> = {
  total: "Total (incl. VAT)",
  subtotal: "Subtotal (excl. VAT)",
  totalVat: "VAT amount",
  fixed: "Fixed amount",
};

interface FormProps {
  initial?: VoucherTemplate;
  onSubmit: (data: Omit<VoucherTemplate, "id" | "companyId" | "createdAt">) => void;
  onCancel: () => void;
}

/** Account selector matching the voucher form: popover + searchable command list. */
function AccountSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (number: string, name: string) => void;
}) {
  const { accounts } = useAccounting();
  const [open, setOpen] = useState(false);
  const selected = accounts.find((a) => a.number === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal overflow-hidden"
        >
          {value ? (
            <span className="truncate">
              <span className="font-mono">{value}</span>
              {selected && <span className="ml-2 text-muted-foreground">{selected.name}</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">Select account...</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by number or name..." />
          <CommandList>
            <CommandEmpty>No account found.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {accounts.map((account) => (
                <CommandItem
                  key={account.number}
                  value={`${account.number} ${account.name}`}
                  onSelect={() => {
                    onChange(account.number, account.name);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === account.number ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="font-mono">{account.number}</span>
                  <span className="ml-2 text-muted-foreground">{account.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TemplateForm({ initial, onSubmit, onCancel }: FormProps) {
  const { accounts } = useAccounting();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [automaticBooking, setAutomaticBooking] = useState(initial?.automaticBooking ?? true);
  const [lines, setLines] = useState<VoucherTemplateLine[]>(
    initial?.lines ?? [
      { id: crypto.randomUUID(), accountNumber: "", accountName: "", side: "debit", amountSource: "total" },
      { id: crypto.randomUUID(), accountNumber: "", accountName: "", side: "credit", amountSource: "subtotal" },
    ]
  );

  const updateLine = (id: string, patch: Partial<VoucherTemplateLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        accountNumber: "",
        accountName: "",
        side: "credit",
        amountSource: "subtotal",
      },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 2) {
      toast.error("A template needs at least 2 lines");
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (automaticBooking) {
      for (const l of lines) {
        if (!l.accountNumber.trim()) {
          toast.error("All voucher lines need an account number");
          return;
        }
        if (l.amountSource === "fixed" && (!l.fixedAmount || l.fixedAmount <= 0)) {
          toast.error("Fixed amount must be greater than 0");
          return;
        }
      }
    }
    const cleaned = lines.map((l) => {
      const account = accounts.find((a) => a.number === l.accountNumber);
      return { ...l, accountName: account?.name ?? l.accountName };
    });
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      automaticBooking,
      lines: cleaned,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tplName">Template Name *</Label>
        <Input id="tplName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard sales invoice" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tplDesc">Description</Label>
        <Input id="tplDesc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <p className="text-sm font-medium">Automatic voucher booking</p>
          <p className="text-xs text-muted-foreground">
            When on, voucher lines below are used to auto-book paid invoices linked to this template.
          </p>
        </div>
        <Switch checked={automaticBooking} onCheckedChange={setAutomaticBooking} />
      </div>

      {automaticBooking && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Voucher Lines</Label>
            <Button type="button" size="sm" variant="outline" onClick={addLine}>
              <Plus className="h-3 w-3 mr-1" /> Add line
            </Button>
          </div>
          <div className="space-y-2">
            {lines.map((line) => (
              <div key={line.id} className="grid grid-cols-[1fr_120px_140px_32px] gap-2 items-center">
                <AccountSelect
                  value={line.accountNumber}
                  onChange={(num, accName) => updateLine(line.id, { accountNumber: num, accountName: accName })}
                />
                <Select value={line.side} onValueChange={(v) => updateLine(line.id, { side: v as "debit" | "credit" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
                <div className="space-y-1">
                  <Select
                    value={line.amountSource}
                    onValueChange={(v) => updateLine(line.id, { amountSource: v as TemplateAmountSource })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SOURCE_LABEL) as TemplateAmountSource[]).map((s) => (
                        <SelectItem key={s} value={s}>{SOURCE_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {line.amountSource === "fixed" && (
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={line.fixedAmount ?? ""}
                      onChange={(e) => updateLine(line.id, { fixedAmount: parseFloat(e.target.value) || 0 })}
                      placeholder="Amount"
                    />
                  )}
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLine(line.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Tip: pick which invoice amount fills each line. Debit and credit must balance per voucher.
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="submit" className="flex-1">{initial ? "Save Changes" : "Create Template"}</Button>
      </div>
    </form>
  );
}

interface VoucherTemplateManagerProps {
  /** When provided, the manager opens directly into editing this template, no list view. */
  editTemplateId?: string;
  /** When provided, called after a save (create/update) so the parent can close itself. */
  onSaved?: () => void;
  /** When true, hides the outer "New Template" button (used inside a controlled dialog). */
  hideHeaderButton?: boolean;
  /** When provided, used as the controlled "create new" trigger so the parent dialog can close. */
  onRequestCreate?: () => void;
}

export function VoucherTemplateManager({
  editTemplateId,
  onSaved,
  hideHeaderButton,
  onRequestCreate,
}: VoucherTemplateManagerProps = {}) {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useBilling();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VoucherTemplate | undefined>(
    editTemplateId ? templates.find((t) => t.id === editTemplateId) : undefined,
  );

  const handleSubmit = (data: Omit<VoucherTemplate, "id" | "companyId" | "createdAt">) => {
    if (editing) {
      updateTemplate({ ...editing, ...data });
      toast.success("Template updated");
    } else {
      addTemplate(data);
      toast.success("Template created");
    }
    setOpen(false);
    setEditing(undefined);
    onSaved?.();
  };

  return (
    <div className="space-y-4">
      {!hideHeaderButton && (
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">Voucher Templates</h2>
            <p className="text-sm text-muted-foreground">
              Define how vouchers are created automatically when an invoice is marked as paid.
            </p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(undefined); }}>
            <DialogTrigger asChild>
              <Button onClick={onRequestCreate}><Plus className="h-4 w-4 mr-2" />New Template</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Template" : "New Voucher Template"}</DialogTitle>
              </DialogHeader>
              <TemplateForm
                initial={editing}
                onSubmit={handleSubmit}
                onCancel={() => { setOpen(false); setEditing(undefined); }}
              />
            </DialogContent>
          </Dialog>
        </div>
      )}

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No templates yet. Create one to enable automatic voucher creation when marking invoices as paid.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map((tpl) => (
            <Card key={tpl.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{tpl.name}</p>
                    {tpl.description && (
                      <p className="text-xs text-muted-foreground truncate">{tpl.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(tpl); setOpen(true); }}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { deleteTemplate(tpl.id); toast.success("Template deleted"); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>

                {tpl.automaticBooking !== false && (
                  <div className="rounded-md border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="text-left py-1.5 px-2 font-medium">Account</th>
                          <th className="text-left py-1.5 px-2 font-medium w-16">Side</th>
                          <th className="text-left py-1.5 px-2 font-medium">Amount from</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tpl.lines.map((l) => (
                          <tr key={l.id} className="border-t border-border/50">
                            <td className="py-1.5 px-2">
                              <span className="font-mono">{l.accountNumber}</span>
                              <span className="text-muted-foreground ml-1 truncate">{l.accountName}</span>
                            </td>
                            <td className="py-1.5 px-2 capitalize">{l.side}</td>
                            <td className="py-1.5 px-2 text-muted-foreground">
                              {l.amountSource === "fixed"
                                ? `Fixed ${l.fixedAmount ?? 0} kr`
                                : SOURCE_LABEL[l.amountSource]}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Hidden dialog used to launch a "Create new" flow from outside (inline list). */}
      {hideHeaderButton && (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(undefined); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Template" : "New Voucher Template"}</DialogTitle>
            </DialogHeader>
            <TemplateForm
              initial={editing}
              onSubmit={handleSubmit}
              onCancel={() => { setOpen(false); setEditing(undefined); }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/**
 * Dedicated dialog form for creating/editing a single template, decoupled from the list.
 * Used by the "Template" button on the Invoices tab.
 */
export function TemplateFormDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: VoucherTemplate;
}) {
  const { addTemplate, updateTemplate } = useBilling();

  const handleSubmit = (data: Omit<VoucherTemplate, "id" | "companyId" | "createdAt">) => {
    if (template) {
      updateTemplate({ ...template, ...data });
      toast.success("Template updated");
    } else {
      addTemplate(data);
      toast.success("Template created");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Edit Template" : "New Voucher Template"}</DialogTitle>
        </DialogHeader>
        <TemplateForm
          initial={template}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Dialog listing existing templates with edit + delete actions.
 * Used by the "Template → Edit existing" flow on the Invoices tab.
 */
export function ExistingTemplatesDialog({
  open,
  onOpenChange,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (template: VoucherTemplate) => void;
}) {
  const { templates, deleteTemplate } = useBilling();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit existing template</DialogTitle>
        </DialogHeader>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No templates yet. Create one first.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((tpl) => (
              <div key={tpl.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{tpl.name}</p>
                  {tpl.description && (
                    <p className="text-xs text-muted-foreground truncate">{tpl.description}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => { onEdit(tpl); onOpenChange(false); }}>
                    <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { deleteTemplate(tpl.id); toast.success("Template deleted"); }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
