import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2, Repeat, Edit, Pencil } from "lucide-react";
import { format } from "date-fns";
import { useBilling } from "@/contexts/BillingContext";
import { useRecurringBilling } from "@/contexts/RecurringBillingContext";
import {
  RecurringInvoice,
  DueDateMode,
  computeIssueDate,
  computeDueDate,
  stepDescription,
} from "@/lib/billing/recurring";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type RecurringFrequency = "weekly" | "monthly" | "quarterly" | "custom";

interface ManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Top-level manager: lists recurring invoices, with "New" button + edit/delete actions. */
export function RecurringInvoiceManager({ open, onOpenChange }: ManagerProps) {
  const { recurring, deleteRecurring } = useRecurringBilling();
  const [editing, setEditing] = useState<RecurringInvoice | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5" /> Recurring invoices
            </DialogTitle>
            <DialogDescription>
              Skapa fakturor som upprepas automatiskt. Varje gång det är dags hamnar fakturan i Checklist
              under <span className="font-semibold">Active</span> så du kan granska och skicka den.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> New recurring invoice
            </Button>
          </div>

          {recurring.length === 0 ? (
            <Card className="mt-3">
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Du har inga återkommande fakturor ännu.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 mt-3">
              {recurring.map((rec) => (
                <Card key={rec.id} className="border-border/60">
                  <CardContent className="p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{rec.name}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-medium">
                          {labelFreq(rec.frequency, rec.customIntervalDays)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {rec.customerName} · "{rec.description}"
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {rec.generatedCount}/{rec.totalCount} skapade · första {rec.firstIssueDate} · skapas{" "}
                        {rec.leadTimeDays === 0 ? "samma dag" : `${rec.leadTimeDays} d innan`} issue date
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditing(rec);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-destructive/10"
                        onClick={() => {
                          deleteRecurring(rec.id);
                          toast.success("Recurring invoice deleted");
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <RecurringInvoiceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
      />
    </>
  );
}

function labelFreq(f: RecurringFrequency, customDays?: number) {
  switch (f) {
    case "weekly":
      return "Varje vecka";
    case "monthly":
      return "Varje månad";
    case "quarterly":
      return "Varje kvartal";
    case "custom":
      return `Var ${customDays ?? 30}:e dag`;
  }
}

interface FormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: RecurringInvoice | null;
}

export function RecurringInvoiceFormDialog({ open, onOpenChange, editing }: FormProps) {
  const { customers } = useBilling();
  const { addRecurring, updateRecurring } = useRecurringBilling();

  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [customDays, setCustomDays] = useState<number>(30);
  const [firstIssueDate, setFirstIssueDate] = useState<Date>(new Date());
  const [dueMode, setDueMode] = useState<DueDateMode["kind"]>("daysAfterIssue");
  const [dueDays, setDueDays] = useState<number>(30);
  const [dueFixedDay, setDueFixedDay] = useState<number>(28);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(5);
  const [totalCount, setTotalCount] = useState<number>(12);

  // Single line for simplicity (most common: rent / subscription).
  const [lineName, setLineName] = useState("");
  const [lineQty, setLineQty] = useState(1);
  const [linePrice, setLinePrice] = useState<number>(0);
  const [lineVat, setLineVat] = useState<number>(25);

  // Reset / hydrate when dialog opens.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setCustomerId(editing.customerId);
      setDescription(editing.description);
      setFrequency(editing.frequency);
      setCustomDays(editing.customIntervalDays ?? 30);
      const [y, m, d] = editing.firstIssueDate.split("-").map(Number);
      setFirstIssueDate(new Date(y, m - 1, d));
      setDueMode(editing.dueDateMode.kind);
      if (editing.dueDateMode.kind === "daysAfterIssue") setDueDays(editing.dueDateMode.days);
      if (editing.dueDateMode.kind === "fixedDayOfMonth") setDueFixedDay(editing.dueDateMode.day);
      setLeadTimeDays(editing.leadTimeDays);
      setTotalCount(editing.totalCount);
      const first = editing.lines[0];
      if (first) {
        setLineName(first.productName);
        setLineQty(first.quantity);
        setLinePrice(first.unitPrice);
        setLineVat(first.vatRate);
      }
    } else {
      setName("");
      setCustomerId("");
      setDescription("");
      setFrequency("monthly");
      setCustomDays(30);
      setFirstIssueDate(new Date());
      setDueMode("daysAfterIssue");
      setDueDays(30);
      setDueFixedDay(28);
      setLeadTimeDays(5);
      setTotalCount(12);
      setLineName("");
      setLineQty(1);
      setLinePrice(0);
      setLineVat(25);
    }
  }, [open, editing]);

  const handleSubmit = () => {
    if (!name.trim()) return toast.error("Ge schemat ett namn");
    if (!customerId) return toast.error("Välj en kund");
    if (!description.trim()) return toast.error("Skriv en beskrivning");
    if (!lineName.trim()) return toast.error("Skriv vad som ska faktureras");
    if (linePrice <= 0) return toast.error("Pris måste vara > 0");
    if (totalCount < 1) return toast.error("Antal måste vara minst 1");

    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return toast.error("Kunden hittades inte");

    const dueDateMode: DueDateMode =
      dueMode === "endOfMonth"
        ? { kind: "endOfMonth" }
        : dueMode === "daysAfterIssue"
        ? { kind: "daysAfterIssue", days: dueDays }
        : { kind: "fixedDayOfMonth", day: dueFixedDay };

    const data = {
      name: name.trim(),
      customerId,
      customerName: customer.name,
      description: description.trim(),
      lines: [
        {
          productName: lineName.trim(),
          description: undefined,
          quantity: lineQty,
          unitPrice: linePrice,
          vatRate: lineVat,
        },
      ],
      frequency,
      customIntervalDays: frequency === "custom" ? customDays : undefined,
      firstIssueDate: format(firstIssueDate, "yyyy-MM-dd"),
      dueDateMode,
      leadTimeDays,
      totalCount,
    };

    if (editing) {
      updateRecurring({ ...editing, ...data });
      toast.success("Recurring invoice updated");
    } else {
      addRecurring(data);
      toast.success("Recurring invoice created");
    }
    onOpenChange(false);
  };

  // Preview the next 3 invoices.
  const previews = Array.from({ length: Math.min(3, totalCount) }, (_, i) => {
    const issueDate = computeIssueDate(
      format(firstIssueDate, "yyyy-MM-dd"),
      i,
      frequency,
      customDays,
    );
    const dueDateMode: DueDateMode =
      dueMode === "endOfMonth"
        ? { kind: "endOfMonth" }
        : dueMode === "daysAfterIssue"
        ? { kind: "daysAfterIssue", days: dueDays }
        : { kind: "fixedDayOfMonth", day: dueFixedDay };
    return {
      idx: i + 1,
      issueDate,
      dueDate: computeDueDate(issueDate, dueDateMode),
      description: stepDescription(description || "(beskrivning)", i, frequency),
    };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit recurring invoice" : "New recurring invoice"}</DialogTitle>
          <DialogDescription>
            Fakturor skapas inte automatiskt utan hamnar i din Checklist för granskning innan de skickas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Schemats namn *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hyra Kalle K." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Kund *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Välj kund..." /></SelectTrigger>
                <SelectContent>
                  {customers.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Inga kunder ännu — lägg till en först.</div>
                  ) : (
                    customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Beskrivning *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Hyra Januari"
            />
            <p className="text-[10px] text-muted-foreground">
              Tips: skriv ett månadsnamn (t.ex. "Hyra Januari") så stegas det automatiskt vid månadsvis fakturering.
            </p>
          </div>

          {/* Line item */}
          <div className="border border-border/60 rounded-lg p-3 bg-muted/20 space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Vad ska faktureras</Label>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-5 space-y-1">
                <Label className="text-[10px]">Namn *</Label>
                <Input value={lineName} onChange={(e) => setLineName(e.target.value)} placeholder="Hyra" className="h-9" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-[10px]">Antal</Label>
                <Input
                  type="number"
                  min={1}
                  value={lineQty}
                  onChange={(e) => setLineQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-9"
                />
              </div>
              <div className="col-span-3 space-y-1">
                <Label className="text-[10px]">Pris (exkl. moms)</Label>
                <Input
                  type="number"
                  min={0}
                  value={linePrice || ""}
                  onChange={(e) => setLinePrice(parseFloat(e.target.value) || 0)}
                  onFocus={(e) => { if (e.target.value === "0") e.target.value = ""; }}
                  placeholder="0"
                  className="h-9"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-[10px]">Moms</Label>
                <Select value={String(lineVat)} onValueChange={(v) => setLineVat(parseInt(v))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="6">6%</SelectItem>
                    <SelectItem value="12">12%</SelectItem>
                    <SelectItem value="25">25%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Intervall</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as RecurringFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Varje vecka</SelectItem>
                  <SelectItem value="monthly">Varje månad</SelectItem>
                  <SelectItem value="quarterly">Varje kvartal</SelectItem>
                  <SelectItem value="custom">Anpassat (dagar)</SelectItem>
                </SelectContent>
              </Select>
              {frequency === "custom" && (
                <Input
                  type="number"
                  min={1}
                  value={customDays}
                  onChange={(e) => setCustomDays(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="Antal dagar"
                  className="mt-1"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Första issue date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal h-10">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(firstIssueDate, "yyyy-MM-dd")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={firstIssueDate}
                    onSelect={(d) => d && setFirstIssueDate(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Due date config */}
          <div className="border border-border/60 rounded-lg p-3 bg-muted/20 space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Due date</Label>
            <Select value={dueMode} onValueChange={(v) => setDueMode(v as DueDateMode["kind"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daysAfterIssue">N dagar efter issue date</SelectItem>
                <SelectItem value="endOfMonth">Sista dagen i månaden</SelectItem>
                <SelectItem value="fixedDayOfMonth">Specifik dag varje månad</SelectItem>
              </SelectContent>
            </Select>
            {dueMode === "daysAfterIssue" && (
              <div className="space-y-1">
                <Label className="text-[10px]">Antal dagar</Label>
                <Input
                  type="number"
                  min={0}
                  value={dueDays}
                  onChange={(e) => setDueDays(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
            )}
            {dueMode === "fixedDayOfMonth" && (
              <div className="space-y-1">
                <Label className="text-[10px]">Dag i månaden (1–31)</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={dueFixedDay}
                  onChange={(e) => setDueFixedDay(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Skapa fakturan så här många dagar innan issue date</Label>
              <Input
                type="number"
                min={0}
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Antal fakturor totalt</Label>
              <Input
                type="number"
                min={1}
                value={totalCount}
                onChange={(e) => setTotalCount(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-3 space-y-1">
            <p className="text-xs font-semibold text-secondary">Förhandsvisning (första 3)</p>
            <ul className="text-xs space-y-0.5">
              {previews.map((p) => (
                <li key={p.idx} className="font-mono">
                  #{p.idx} · {p.issueDate} → due {p.dueDate} · "{p.description}"
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
            <Button onClick={handleSubmit}>{editing ? "Save changes" : "Create recurring"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
