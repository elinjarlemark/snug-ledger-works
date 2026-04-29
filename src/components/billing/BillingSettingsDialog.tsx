import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBilling } from "@/contexts/BillingContext";
import { toast } from "sonner";
import { AlertCircle, Hash } from "lucide-react";

interface BillingSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Billing → Settings.
 *
 * Shows the current "next invoice number" and lets the user raise it.
 * Lowering is rejected (with an explanatory error) to avoid duplicate invoice numbers.
 *
 * Note: there is also a separate first-time prompt (FirstInvoiceNumberPrompt)
 * that asks the user — on their very first invoice — whether they want to start at 1
 * or import from an existing series.
 */
export function BillingSettingsDialog({ open, onOpenChange }: BillingSettingsDialogProps) {
  const { nextInvoiceNumber, setNextInvoiceNumber } = useBilling();
  const [value, setValue] = useState(String(nextInvoiceNumber));

  // Re-sync when dialog re-opens.
  const handleOpenChange = (o: boolean) => {
    if (o) setValue(String(nextInvoiceNumber));
    onOpenChange(o);
  };

  const handleSave = () => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Fakturanumret måste vara ett positivt heltal");
      return;
    }
    if (n < nextInvoiceNumber) {
      toast.error(
        `Du kan inte sänka fakturanumret (risk för dubbletter). Numret är fortfarande ${nextInvoiceNumber}.`,
      );
      setValue(String(nextInvoiceNumber));
      return;
    }
    if (n === nextInvoiceNumber) {
      toast.info("Inget att ändra");
      onOpenChange(false);
      return;
    }
    const ok = setNextInvoiceNumber(n, { markFirstSet: true });
    if (ok) {
      toast.success(`Nästa faktura får nummer ${n}`);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Billing settings</DialogTitle>
          <DialogDescription>
            Inställningar som påverkar hur fakturor skapas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="nextInvoice" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Nästa fakturanummer
            </Label>
            <Input
              id="nextInvoice"
              type="number"
              min={nextInvoiceNumber}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={(e) => {
                if (e.target.value === "0") e.target.value = "";
              }}
            />
            <p className="text-xs text-muted-foreground">
              Nuvarande nästa nummer: <span className="font-mono font-semibold text-foreground">{nextInvoiceNumber}</span>.
              Du kan höja det (t.ex. om du importerat tidigare fakturor) men inte sänka det.
            </p>
          </div>

          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 flex gap-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Att sänka fakturanumret kan skapa dubbletter mot redan skickade fakturor och är därför inte
              tillåtet.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
            <Button onClick={handleSave}>Spara</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface FirstInvoiceNumberPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the user has confirmed; parent should then proceed to actually create the invoice. */
  onConfirmed: () => void;
}

/** First-time-only prompt asked before the user creates their first invoice for a company. */
export function FirstInvoiceNumberPrompt({ open, onOpenChange, onConfirmed }: FirstInvoiceNumberPromptProps) {
  const { setNextInvoiceNumber } = useBilling();
  const [mode, setMode] = useState<"one" | "custom">("one");
  const [custom, setCustom] = useState("1");

  const handleConfirm = () => {
    if (mode === "one") {
      setNextInvoiceNumber(1, { allowLower: true, markFirstSet: true });
      onOpenChange(false);
      onConfirmed();
      return;
    }
    const n = parseInt(custom, 10);
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Skriv ett positivt heltal");
      return;
    }
    setNextInvoiceNumber(n, { allowLower: true, markFirstSet: true });
    onOpenChange(false);
    onConfirmed();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Första fakturan</DialogTitle>
          <DialogDescription>
            Vill du börja med faktura nummer 1, eller har du importerat från en tidigare bokföring?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={() => setMode("one")}
            className={`w-full text-left rounded-lg border p-3 transition-colors ${
              mode === "one" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
            }`}
          >
            <p className="font-medium">Börja med nummer 1</p>
            <p className="text-xs text-muted-foreground">Standardalternativet för nya bolag.</p>
          </button>

          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`w-full text-left rounded-lg border p-3 transition-colors ${
              mode === "custom" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
            }`}
          >
            <p className="font-medium">Börja från ett annat nummer</p>
            <p className="text-xs text-muted-foreground mb-2">
              Använd om du tidigare skickat fakturor och vill fortsätta serien.
            </p>
            {mode === "custom" && (
              <Input
                type="number"
                min={1}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="t.ex. 10"
              />
            )}
          </button>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
            <Button onClick={handleConfirm}>Fortsätt</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
