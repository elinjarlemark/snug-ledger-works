import { Sparkles, Plus, Check, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChecklistItem } from "@/contexts/ChecklistContext";

interface SmartRuleInfoDialogProps {
  item: ChecklistItem | null;
  onOpenChange: (open: boolean) => void;
  onMarkDone: (id: string) => void;
}

export function SmartRuleInfoDialog({ item, onOpenChange, onMarkDone }: SmartRuleInfoDialogProps) {
  const navigate = useNavigate();
  const open = !!item && item.meta?.kind === "smart-rule";
  const meta = item?.meta?.kind === "smart-rule" ? item.meta : null;

  const handleCreateVoucher = () => {
    if (!meta) return;
    navigate("/economy/accounting", {
      state: meta.suggestedAccountNumber
        ? { prefillAccountNumber: meta.suggestedAccountNumber }
        : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-secondary" />
            {item?.text}
          </DialogTitle>
          <DialogDescription>Smart kontrollpunkt</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="flex gap-2 rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
            <BookOpen className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <p className="text-foreground/90 leading-relaxed">{meta?.explanation}</p>
          </div>

          {meta?.suggestedAccountNumber && (
            <div className="text-xs text-muted-foreground">
              Föreslaget konto:{" "}
              <span className="font-mono font-semibold text-foreground">
                {meta.suggestedAccountNumber}
              </span>
            </div>
          )}

          {item?.resolvedAt && (
            <div className="rounded-md border border-success/40 bg-success/5 p-3 text-sm text-success flex items-center gap-2">
              <Check className="h-4 w-4" />
              Villkoret är nu uppfyllt — du kan markera regeln som klar.
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Stäng</Button>
            <Button variant="outline" onClick={handleCreateVoucher}>
              <Plus className="h-4 w-4 mr-2" />
              Skapa voucher
            </Button>
            <Button onClick={() => item && onMarkDone(item.id)}>
              <Check className="h-4 w-4 mr-2" />
              Markera som klar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
