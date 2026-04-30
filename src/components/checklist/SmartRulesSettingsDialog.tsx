import { useState } from "react";
import { Sparkles, Trash2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
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
import { useSmartChecklist } from "@/contexts/SmartChecklistContext";
import { BUILT_IN_TEMPLATES } from "@/lib/checklist/smartRules";
import { toast } from "sonner";

interface SmartRulesSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Settings UI for smart checklist rules.
 *
 * - All built-in templates can be toggled on/off individually.
 * - Custom account-based rules can be added (account number, label, period, trigger).
 */
export function SmartRulesSettingsDialog({ open, onOpenChange }: SmartRulesSettingsDialogProps) {
  const { rules, setRuleEnabled, addCustomRule, removeCustomRule } = useSmartChecklist();

  const [accountNumber, setAccountNumber] = useState("");
  const [label, setLabel] = useState("");
  const [period, setPeriod] = useState<"year" | "month" | "days:30">("year");
  const [triggerWhen, setTriggerWhen] = useState<"missing" | "present">("missing");

  const builtIns = rules.filter((r) => r.kind === "template");
  const customs = rules.filter((r) => r.kind === "custom-account");

  const findTemplate = (id?: string) => BUILT_IN_TEMPLATES.find((t) => t.id === id);

  const handleAddCustom = () => {
    const acc = accountNumber.trim();
    if (!/^\d{4}$/.test(acc)) {
      toast.error("Kontonummer måste vara 4 siffror (BAS-format)");
      return;
    }
    const lbl = label.trim() || `Kontroll av konto ${acc}`;
    addCustomRule({ accountNumber: acc, label: lbl, period, triggerWhen });
    setAccountNumber("");
    setLabel("");
    setPeriod("year");
    setTriggerWhen("missing");
    toast.success("Smart regel skapad");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-secondary" />
            Smart Checklist — regler
          </DialogTitle>
          <DialogDescription>
            Aktivera eller inaktivera färdiga kontroller, eller skapa egna regler för specifika konton.
            Aktiva regler genererar automatiskt påminnelser i din Checklist.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Built-in templates */}
          <section>
            <h3 className="text-sm font-semibold mb-3 text-foreground">Inbyggda regler</h3>
            <div className="space-y-2">
              {builtIns.map((rule) => {
                const meta = findTemplate(rule.templateId);
                if (!meta) return null;
                return (
                  <div
                    key={rule.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{meta.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                    </div>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(v) => setRuleEnabled(rule.id, v)}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {/* Custom rules */}
          <section>
            <h3 className="text-sm font-semibold mb-3 text-foreground">Egna kontoregler</h3>
            {customs.length === 0 ? (
              <p className="text-xs text-muted-foreground mb-3">Inga egna regler ännu.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {customs.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm flex items-center gap-2">
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-secondary/10 text-secondary">
                          {rule.custom?.accountNumber}
                        </span>
                        {rule.custom?.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Triggar när konto är{" "}
                        <span className="font-medium">
                          {rule.custom?.triggerWhen === "missing" ? "ej använd" : "använd"}
                        </span>{" "}
                        ({rule.custom?.period === "year"
                          ? "innevarande år"
                          : rule.custom?.period === "month"
                            ? "innevarande månad"
                            : `senaste ${rule.custom?.period.split(":")[1]} dagar`})
                      </p>
                    </div>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(v) => setRuleEnabled(rule.id, v)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeCustomRule(rule.id)}
                      title="Ta bort regel"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add custom form */}
            <div className="rounded-md border border-dashed border-border p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">Lägg till ny regel</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="acc-num" className="text-xs">Kontonummer (BAS, 4 siffror)</Label>
                  <Input
                    id="acc-num"
                    placeholder="t.ex. 2510"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rule-label" className="text-xs">Beskrivning</Label>
                  <Input
                    id="rule-label"
                    placeholder="t.ex. Skattekonto bokfört i år"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Period</Label>
                  <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="year">Innevarande år</SelectItem>
                      <SelectItem value="month">Innevarande månad</SelectItem>
                      <SelectItem value="days:30">Senaste 30 dagarna</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Triggervillkor</Label>
                  <Select value={triggerWhen} onValueChange={(v) => setTriggerWhen(v as typeof triggerWhen)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="missing">När konto INTE använts</SelectItem>
                      <SelectItem value="present">När konto har använts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleAddCustom}>
                  <Plus className="h-4 w-4 mr-2" />
                  Lägg till regel
                </Button>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
