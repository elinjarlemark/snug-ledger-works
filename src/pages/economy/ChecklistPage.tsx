import { useEffect, useRef, useState } from "react";
import { Plus, ChevronDown, Check, Trash2, Pencil, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useChecklist, ChecklistItem } from "@/contexts/ChecklistContext";

const FADE_DELAY_MS = 5000;

export default function ChecklistPage() {
  const { items, addItem, updateItem, deleteItem, toggleDone } = useChecklist();
  const [activeOpen, setActiveOpen] = useState(true);
  const [finishedOpen, setFinishedOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 w-full"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-3xl font-bold gradient-text">Checklist</h1>
          <p className="text-sm text-muted-foreground">
            Hantera saker som behöver göras. Bocka av när de är klara.
          </p>
        </div>
        <Button
          size="icon"
          onClick={() => setAdding(true)}
          title="Lägg till"
          className="shrink-0 shadow-md hover:shadow-glow transition-shadow"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-3 flex items-center gap-2 shadow-md border-secondary/40">
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
    </motion.div>
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
  const accentClass = accent === "success"
    ? "before:bg-gradient-to-r before:from-success before:to-success/40"
    : "before:bg-gradient-to-r before:from-secondary before:to-accent/40";

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card
        className={cn(
          "relative overflow-hidden border-border/60 shadow-card hover:shadow-md transition-shadow",
          "before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-[2px] before:opacity-70",
          accentClass
        )}
      >
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-foreground">{title}</span>
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
                "h-4 w-4 text-muted-foreground transition-transform duration-300",
                open && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="px-4 pb-4 border-t border-border/60 pt-3">{children}</div>
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
}

function Row({ item, onToggle, onUpdate, onDelete }: RowProps) {
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "group flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-card hover:border-secondary/40 hover:shadow-sm transition-all"
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
