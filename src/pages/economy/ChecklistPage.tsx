import { useEffect, useRef, useState } from "react";
import { Plus, ChevronDown, Check, Trash2, Pencil, X, Repeat, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useChecklist, ChecklistItem } from "@/contexts/ChecklistContext";
import { SmartRuleInfoDialog } from "@/components/checklist/SmartRuleInfoDialog";
import { SmartRulesSettingsDialog } from "@/components/checklist/SmartRulesSettingsDialog";

const FADE_DELAY_MS = 5000;

export default function ChecklistPage() {
  const { items, addItem, updateItem, deleteItem, toggleDone } = useChecklist();
  const navigate = useNavigate();
  const [activeOpen, setActiveOpen] = useState(true);
  const [finishedOpen, setFinishedOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [pendingRecurring, setPendingRecurring] = useState<ChecklistItem | null>(null);
  const [smartInfoItem, setSmartInfoItem] = useState<ChecklistItem | null>(null);
  const [smartSettingsOpen, setSmartSettingsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const active = items.filter((i) => !i.done);
  const finished = items.filter((i) => i.done);

  const handleAdd = () => {
    if (newText.trim()) {
      addItem(newText);
      setNewText("");
      setAdding(false);
    }
  };

  const handleRecurringYes = () => {
    if (!pendingRecurring?.meta || pendingRecurring.meta.kind !== "recurring-invoice") return;
    const meta = pendingRecurring.meta;
    // Mark item as done so it lands in Finished after invoice creation flow.
    toggleDone(pendingRecurring.id, true);
    navigate("/economy/billing", {
      state: {
        openCreateInvoice: true,
        invoicePrefill: {
          customerId: meta.customerId,
          description: meta.description,
          issueDate: meta.issueDate,
          dueDate: meta.dueDate,
          lines: meta.lines,
        },
      },
    });
    setPendingRecurring(null);
  };

  const handleRecurringNo = () => {
    if (!pendingRecurring) return;
    toggleDone(pendingRecurring.id, true);
    setPendingRecurring(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header — matches BillingPage / other economy pages */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-3xl font-bold text-foreground">Checklist</h1>
          <p className="text-sm text-muted-foreground">
            Hantera saker som behöver göras. Bocka av när de är klara.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSmartSettingsOpen(true)}
            title="Smart-regler"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Smart-regler
          </Button>
          <Button
            size="sm"
            onClick={() => setAdding(true)}
            title="Lägg till"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      <SmartRulesSettingsDialog open={smartSettingsOpen} onOpenChange={setSmartSettingsOpen} />
      <SmartRuleInfoDialog
        item={smartInfoItem}
        onOpenChange={(o) => !o && setSmartInfoItem(null)}
        onMarkDone={(id) => {
          toggleDone(id, true);
          setSmartInfoItem(null);
        }}
      />

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-3 flex items-center gap-2 border-border">
              <Input
                ref={inputRef}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Vad behöver göras?"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") {
                    setAdding(false);
                    setNewText("");
                  }
                }}
              />
              <Button size="sm" onClick={handleAdd}>
                Lägg till
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setAdding(false);
                  setNewText("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Section
        title="Active"
        count={active.length}
        open={activeOpen}
        onOpenChange={setActiveOpen}
        accent="secondary"
      >
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Inga aktiva uppgifter. Lägg till en med plus-knappen.
          </p>
        ) : (
          <motion.div layout className="space-y-2">
            <AnimatePresence initial={false}>
              {active.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  onToggle={(done) => toggleDone(item.id, done)}
                  onUpdate={(text) => updateItem(item.id, text)}
                  onDelete={() => deleteItem(item.id)}
                  onItemClick={
                    item.meta?.kind === "recurring-invoice"
                      ? () => setPendingRecurring(item)
                      : item.meta?.kind === "smart-rule"
                        ? () => setSmartInfoItem(item)
                        : undefined
                  }
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </Section>

      <Section
        title="Finished"
        count={finished.length}
        open={finishedOpen}
        onOpenChange={setFinishedOpen}
        accent="success"
      >
        {finished.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Inga klara uppgifter ännu.
          </p>
        ) : (
          <motion.div layout className="space-y-2">
            <AnimatePresence initial={false}>
              {finished.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  onToggle={(done) => toggleDone(item.id, done)}
                  onUpdate={(text) => updateItem(item.id, text)}
                  onDelete={() => deleteItem(item.id)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </Section>

      {/* Recurring invoice confirmation */}
      <AlertDialog open={!!pendingRecurring} onOpenChange={(o) => !o && setPendingRecurring(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-secondary" />
              Skapa automatisk faktura?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRecurring?.meta?.kind === "recurring-invoice" && (
                <>
                  Vill du skapa invoice <span className="font-semibold">"{pendingRecurring.meta.description}"</span>{" "}
                  till <span className="font-semibold">{pendingRecurring.meta.customerName}</span>
                  {pendingRecurring.meta.customerAddress ? `, ${pendingRecurring.meta.customerAddress}` : ""}?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleRecurringNo}>Nej</AlertDialogCancel>
            <AlertDialogAction onClick={handleRecurringYes}>Ja, öppna fakturan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface SectionProps {
  title: string;
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  accent?: "secondary" | "success";
}

function Section({ title, count, open, onOpenChange, children, accent = "secondary" }: SectionProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card className="border-border bg-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-foreground">{title}</span>
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  accent === "success"
                    ? "bg-success/10 text-success"
                    : "bg-secondary/10 text-secondary"
                )}
              >
                {count}
              </span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="px-4 pb-4 border-t border-border pt-3">{children}</div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface RowProps {
  item: ChecklistItem;
  onToggle: (done: boolean) => void;
  onUpdate: (text: string) => void;
  onDelete: () => void;
  onItemClick?: () => void;
}

function Row({ item, onToggle, onUpdate, onDelete, onItemClick }: RowProps) {
  const [pendingToggle, setPendingToggle] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timerRef.current = null;
    intervalRef.current = null;
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const handleCheckClick = () => {
    // If item is already done (in Finished section), move it back to Active immediately — no timer.
    if (item.done) {
      clearTimers();
      setPendingToggle(false);
      setCountdown(5);
      onToggle(false);
      return;
    }
    if (pendingToggle) {
      // Cancel pending toggle (undo)
      clearTimers();
      setPendingToggle(false);
      setCountdown(5);
      return;
    }
    setPendingToggle(true);
    setCountdown(5);
    intervalRef.current = setInterval(() => {
      setCountdown((c) => (c > 1 ? c - 1 : c));
    }, 1000);
    timerRef.current = setTimeout(() => {
      onToggle(!item.done);
      clearTimers();
      setPendingToggle(false);
      setCountdown(5);
    }, FADE_DELAY_MS);
  };

  const saveEdit = () => {
    const t = editText.trim();
    if (t && t !== item.text) onUpdate(t);
    setEditing(false);
  };

  const isSmart = item.meta?.kind === "smart-rule";
  const isRecurring = item.meta?.kind === "recurring-invoice";
  const RowIcon = isSmart ? Sparkles : Repeat;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-md border border-border bg-card hover:bg-muted/30 transition-colors",
        item.resolvedAt && !item.done && "border-success/40 bg-success/5"
      )}
    >
      <div className="flex-1 min-w-0">
        {editing ? (
          <Input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") {
                setEditText(item.text);
                setEditing(false);
              }
            }}
            className="h-8"
          />
        ) : onItemClick && !item.done ? (
          <button
            type="button"
            onClick={onItemClick}
            className="flex items-center gap-2 text-left text-sm hover:text-secondary transition-colors w-full"
          >
            <RowIcon className={cn("h-3.5 w-3.5 shrink-0", isSmart ? "text-secondary" : "text-secondary")} />
            <span className="break-words font-medium">{item.text}</span>
            {item.resolvedAt && (
              <span className="text-[10px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded bg-success/15 text-success border border-success/30 shrink-0">
                Löst!
              </span>
            )}
          </button>
        ) : (
          <p
            className={cn(
              "text-sm break-words",
              item.done && "line-through text-muted-foreground"
            )}
          >
            {item.text}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!editing && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setEditing(true)}
            title="Redigera"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
          title="Ta bort"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <button
        onClick={handleCheckClick}
        className={cn(
          "h-7 w-7 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
          item.done && !pendingToggle
            ? "bg-gradient-accent border-secondary text-secondary-foreground shadow-sm"
            : "border-muted-foreground/40 hover:border-secondary hover:bg-secondary/5",
          pendingToggle && "border-secondary bg-secondary/15 text-secondary animate-pulse"
        )}
        title={pendingToggle ? "Klicka igen för att ångra" : item.done ? "Markera som aktiv" : "Markera som klar"}
      >
        {pendingToggle ? (
          <span className="text-xs font-bold leading-none">{countdown}</span>
        ) : item.done ? (
          <Check className="h-4 w-4" />
        ) : null}
      </button>
    </motion.div>
  );
}
