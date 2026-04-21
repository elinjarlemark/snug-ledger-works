import { useEffect, useRef, useState } from "react";
import { Plus, ChevronDown, Check, Trash2, Pencil, X } from "lucide-react";
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
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground">Checklist</h1>
          <p className="text-sm text-muted-foreground">
            Hantera saker som behöver göras. Bocka av när de är klara.
          </p>
        </div>
        <Button size="icon" onClick={() => setAdding(true)} title="Lägg till">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {adding && (
        <Card className="p-3 flex items-center gap-2 animate-fade-in">
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
      )}

      <Section
        title="Active"
        count={active.length}
        open={activeOpen}
        onOpenChange={setActiveOpen}
      >
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Inga aktiva uppgifter. Lägg till en med plus-knappen.
          </p>
        ) : (
          <div className="space-y-2">
            {active.map((item) => (
              <Row
                key={item.id}
                item={item}
                onToggle={(done) => toggleDone(item.id, done)}
                onUpdate={(text) => updateItem(item.id, text)}
                onDelete={() => deleteItem(item.id)}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Finished"
        count={finished.length}
        open={finishedOpen}
        onOpenChange={setFinishedOpen}
      >
        {finished.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Inga klara uppgifter ännu.
          </p>
        ) : (
          <div className="space-y-2">
            {finished.map((item) => (
              <Row
                key={item.id}
                item={item}
                onToggle={(done) => toggleDone(item.id, done)}
                onUpdate={(text) => updateItem(item.id, text)}
                onDelete={() => deleteItem(item.id)}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

interface SectionProps {
  title: string;
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Section({ title, count, open, onOpenChange, children }: SectionProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-foreground">{title}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
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
    <div
      className={cn(
        "group flex items-center gap-3 p-3 rounded-md border border-border bg-background transition-colors"
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
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
          title="Ta bort"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <button
        onClick={handleCheckClick}
        className={cn(
          "h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
          item.done
            ? "bg-secondary border-secondary text-secondary-foreground"
            : "border-muted-foreground/40 hover:border-secondary",
          pendingToggle && "border-secondary bg-secondary/20"
        )}
        title={pendingToggle ? "Klicka igen för att ångra" : item.done ? "Markera som aktiv" : "Markera som klar"}
      >
        {(item.done || pendingToggle) && <Check className="h-4 w-4" />}
      </button>

      {pendingToggle && (
        <button
          onClick={handleCheckClick}
          className="h-6 w-6 rounded-md border-2 border-secondary bg-secondary/10 flex items-center justify-center text-xs font-bold text-secondary shrink-0 animate-fade-in"
          title="Klicka för att ångra"
        >
          {countdown}
        </button>
      )}
    </div>
  );
}
