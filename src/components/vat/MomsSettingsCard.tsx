import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVat } from "@/contexts/VatContext";
import { getActiveVatCodes, getOutgoingCodes, getIncomingCodes } from "@/lib/vat/codes";
import { Receipt } from "lucide-react";

export function MomsSettingsCard() {
  const { vatSettings, setVatSettings, vatCodes } = useVat();
  const outgoing = getOutgoingCodes(vatCodes);
  const incoming = getIncomingCodes(vatCodes);

  const update = (patch: Partial<typeof vatSettings>) => setVatSettings({ ...vatSettings, ...patch });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          Momsinställningar
        </CardTitle>
        <CardDescription>Inställningar för moms, redovisningsperiod och momskoder.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Företaget är momsregistrerat</Label>
            <p className="text-xs text-muted-foreground">Stäng av om företaget inte ska redovisa moms.</p>
          </div>
          <Switch
            checked={vatSettings.registered}
            onCheckedChange={(v) => update({ registered: v })}
          />
        </div>

        {vatSettings.registered && (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Momsregistrering gäller från</Label>
                <Input
                  type="date"
                  value={vatSettings.registrationDate || ""}
                  onChange={(e) => update({ registrationDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Redovisningsperiod</Label>
                <Select
                  value={vatSettings.reportingPeriod}
                  onValueChange={(v) => update({ reportingPeriod: v as any })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manad">Månad</SelectItem>
                    <SelectItem value="kvartal">Kvartal</SelectItem>
                    <SelectItem value="ar">År</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Redovisningsmetod</Label>
              <Select
                value={vatSettings.reportingMethod}
                onValueChange={(v) => update({ reportingMethod: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fakturering">Faktureringsmetoden</SelectItem>
                  <SelectItem value="bokslut">Bokslutsmetoden (kontantmetoden)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Faktureringsmetoden bokför moms när faktura skapas. Bokslutsmetoden bokför moms när betalning sker.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Standardmomskod försäljning</Label>
                <Select
                  value={vatSettings.defaultSalesCodeId || ""}
                  onValueChange={(v) => update({ defaultSalesCodeId: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Välj kod..." /></SelectTrigger>
                  <SelectContent>
                    {outgoing.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="font-mono mr-2">{c.code}</span>{c.namn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Standardmomskod inköp</Label>
                <Select
                  value={vatSettings.defaultPurchaseCodeId || ""}
                  onValueChange={(v) => update({ defaultPurchaseCodeId: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Välj kod..." /></SelectTrigger>
                  <SelectContent>
                    {incoming.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="font-mono mr-2">{c.code}</span>{c.namn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Label className="text-sm font-medium">Företaget säljer även</Label>
              <div className="space-y-2">
                <label className="flex items-center justify-between rounded-md border p-2.5 text-sm cursor-pointer">
                  <span>Momsfri försäljning</span>
                  <Switch checked={vatSettings.sellsVatFree} onCheckedChange={(v) => update({ sellsVatFree: v })} />
                </label>
                <label className="flex items-center justify-between rounded-md border p-2.5 text-sm cursor-pointer">
                  <span>Inom EU</span>
                  <Switch checked={vatSettings.sellsEU} onCheckedChange={(v) => update({ sellsEU: v })} />
                </label>
                <label className="flex items-center justify-between rounded-md border p-2.5 text-sm cursor-pointer">
                  <span>Utanför EU (export)</span>
                  <Switch checked={vatSettings.sellsOutsideEU} onCheckedChange={(v) => update({ sellsOutsideEU: v })} />
                </label>
                <label className="flex items-center justify-between rounded-md border p-2.5 text-sm cursor-pointer">
                  <span>Omvänd skattskyldighet</span>
                  <Switch checked={vatSettings.usesReverseCharge} onCheckedChange={(v) => update({ usesReverseCharge: v })} />
                </label>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
