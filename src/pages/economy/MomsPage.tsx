import { useMemo, useState } from "react";
import { Calculator, Lock, Unlock, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { YearSelector } from "@/components/ui/year-selector";
import { useAuth } from "@/contexts/AuthContext";
import { useAccounting } from "@/contexts/AccountingContext";
import { useBilling } from "@/contexts/BillingContext";
import { useVat } from "@/contexts/VatContext";
import { useVatPeriodLock } from "@/contexts/VatPeriodLockContext";
import { computeReportBoxes } from "@/lib/vat/report";
import { formatAmount } from "@/lib/bas-accounts";
import { MomskodDropdown } from "@/components/vat/MomskodDropdown";
import { MomsRapportTable } from "@/components/vat/MomsRapportTable";
import { MomsAvstamning } from "@/components/vat/MomsAvstamning";
import { MomsPeriodChip, MomsPeriodStatus } from "@/components/vat/MomsPeriodChip";
import { VarningKort } from "@/components/vat/VarningKort";
import { LasPeriodDialog } from "@/components/vat/LasPeriodDialog";
import { VatWarning } from "@/lib/vat/validation";
import { format, endOfMonth } from "date-fns";
import { toast } from "sonner";

const QUARTER_LABELS = ["Q1 (Jan–Mar)", "Q2 (Apr–Jun)", "Q3 (Jul–Sep)", "Q4 (Okt–Dec)"];
const MONTH_LABELS = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];

export default function MomsPage() {
  const { user, activeCompany } = useAuth();
  const { vouchers } = useAccounting();
  const { invoices } = useBilling();
  const { vatCodes, vatSettings, setVatSettings } = useVat();
  const { lockPeriod, unlockPeriod, isPeriodLocked, periodKeyForDate } = useVatPeriodLock();

  const [year, setYear] = useState<number | undefined>(new Date().getFullYear());
  const [periodIdx, setPeriodIdx] = useState(Math.floor(new Date().getMonth() / 3));
  const [reviewMarked, setReviewMarked] = useState<Record<string, boolean>>({});
  const [lockOpen, setLockOpen] = useState(false);

  const reportingPeriod = vatSettings.reportingPeriod;

  const { startDate, endDate, periodLabel, periodKey } = useMemo(() => {
    const y = year || new Date().getFullYear();
    let s: Date, e: Date, label: string, key: string;
    if (reportingPeriod === "ar") {
      s = new Date(y, 0, 1);
      e = new Date(y, 11, 31);
      label = `${y}`;
      key = `${y}`;
    } else if (reportingPeriod === "kvartal") {
      const qStart = periodIdx * 3;
      s = new Date(y, qStart, 1);
      e = endOfMonth(new Date(y, qStart + 2, 1));
      label = `${QUARTER_LABELS[periodIdx]} ${y}`;
      key = `${y}-Q${periodIdx + 1}`;
    } else {
      s = new Date(y, periodIdx, 1);
      e = endOfMonth(new Date(y, periodIdx, 1));
      label = `${MONTH_LABELS[periodIdx]} ${y}`;
      key = `${y}-${String(periodIdx + 1).padStart(2, "0")}`;
    }
    return { startDate: format(s, "yyyy-MM-dd"), endDate: format(e, "yyyy-MM-dd"), periodLabel: label, periodKey: key };
  }, [year, reportingPeriod, periodIdx]);

  const results = useMemo(
    () => computeReportBoxes({ invoices, vouchers, codes: vatCodes, startDate, endDate }),
    [invoices, vouchers, vatCodes, startDate, endDate]
  );

  const sumBoxes = (nums: string[]) => results.filter((r) => nums.includes(r.box)).reduce((s, r) => s + r.amount, 0);
  const utgaende = sumBoxes(["10", "11", "12", "30", "31", "32", "60", "61", "62"]);
  const ingaende = sumBoxes(["48"]);
  const attBetala = utgaende - ingaende;

  const locked = isPeriodLocked(periodKey);
  const status: MomsPeriodStatus = locked ? "last" : reviewMarked[periodKey] ? "klar" : "pagaende";

  // Varningar
  const warnings: VatWarning[] = useMemo(() => {
    const w: VatWarning[] = [];
    const periodInvoices = invoices.filter(
      (i) => i.documentType === "invoice" && ["sent", "paid", "overdue"].includes(i.status) && i.issueDate >= startDate && i.issueDate <= endDate
    );
    const missing = periodInvoices.flatMap((i) => i.lines.filter((l) => !(l as any).vatCodeId).map(() => i));
    if (missing.length > 0) {
      w.push({ severity: "warning", message: `${missing.length} fakturarad(er) saknar momskod i denna period.` });
    }
    if (!vatSettings.registered && (utgaende > 0 || ingaende > 0)) {
      w.push({ severity: "error", message: "Företaget är inte momsregistrerat men momsbelopp finns i perioden." });
    }
    const periodVouchers = vouchers.filter((v) => v.date >= startDate && v.date <= endDate);
    const voucherLinesMissingCode = periodVouchers.reduce((acc, v) => {
      v.lines.forEach((l) => {
        const acc2 = parseInt(l.accountNumber, 10);
        if ((acc2 >= 2610 && acc2 <= 2649) && !(l as any).vatCodeId) acc++;
      });
      return acc;
    }, 0);
    if (voucherLinesMissingCode > 0) {
      w.push({ severity: "info", message: `${voucherLinesMissingCode} verifikationsrad(er) på momskonto saknar momskod.` });
    }
    return w;
  }, [invoices, vouchers, startDate, endDate, vatSettings.registered, utgaende, ingaende]);

  const periodOptions =
    reportingPeriod === "kvartal"
      ? QUARTER_LABELS.map((l, i) => ({ label: l, value: i.toString() }))
      : reportingPeriod === "manad"
      ? MONTH_LABELS.map((l, i) => ({ label: l, value: i.toString() }))
      : [];

  if (!user || !activeCompany) {
    return (
      <div className="p-6 text-center text-muted-foreground">Logga in och välj ett bolag för att se momsrapporten.</div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
          <Calculator className="h-5 w-5 text-secondary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Moms</h1>
          <p className="text-sm text-muted-foreground">Svensk momsmodul – översikt, rapport och avstämning</p>
        </div>
        <MomsPeriodChip status={status} />
      </div>

      {/* Period picker */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-2">
            <YearSelector value={year} onChange={setYear} className="w-[120px]" />
            <Select
              value={reportingPeriod}
              onValueChange={(v) => {
                setVatSettings({ ...vatSettings, reportingPeriod: v as any });
                setPeriodIdx(0);
              }}
            >
              <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manad">Månad</SelectItem>
                <SelectItem value="kvartal">Kvartal</SelectItem>
                <SelectItem value="ar">Helår</SelectItem>
              </SelectContent>
            </Select>
            {periodOptions.length > 0 && (
              <Select value={periodIdx.toString()} onValueChange={(v) => setPeriodIdx(parseInt(v))}>
                <SelectTrigger className="w-[200px] h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {periodOptions.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="flex-1" />
            {!locked ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReviewMarked({ ...reviewMarked, [periodKey]: !reviewMarked[periodKey] });
                    toast.success(reviewMarked[periodKey] ? "Markering borttagen" : "Markerad som granskad");
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  {reviewMarked[periodKey] ? "Avmarkera" : "Markera granskad"}
                </Button>
                <Button size="sm" onClick={() => setLockOpen(true)}>
                  <Lock className="h-4 w-4 mr-1.5" />
                  Lås period
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => { unlockPeriod(periodKey); toast.success("Perioden är nu olåst"); }}>
                <Unlock className="h-4 w-4 mr-1.5" />
                Lås upp
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {locked && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-800 flex items-start gap-2">
          <Lock className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <strong>Perioden är låst.</strong> Skapa rättelseverifikation eller kreditfaktura för att korrigera något i {periodLabel}.
          </div>
        </div>
      )}

      <Tabs defaultValue="oversikt" className="w-full">
        <TabsList>
          <TabsTrigger value="oversikt">Översikt</TabsTrigger>
          <TabsTrigger value="rapport">Momsrapport</TabsTrigger>
          <TabsTrigger value="avstamning">Avstämning</TabsTrigger>
          <TabsTrigger value="installningar">Inställningar</TabsTrigger>
        </TabsList>

        <TabsContent value="oversikt" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Card>
              <CardHeader className="py-3 pb-1"><CardTitle className="text-xs text-muted-foreground font-normal">Utgående moms</CardTitle></CardHeader>
              <CardContent className="pb-3"><div className="text-2xl font-bold font-mono">{formatAmount(utgaende)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="py-3 pb-1"><CardTitle className="text-xs text-muted-foreground font-normal">Ingående moms</CardTitle></CardHeader>
              <CardContent className="pb-3"><div className="text-2xl font-bold font-mono">{formatAmount(ingaende)}</div></CardContent>
            </Card>
            <Card className={attBetala >= 0 ? "border-destructive/40" : "border-success/40"}>
              <CardHeader className="py-3 pb-1">
                <CardTitle className="text-xs text-muted-foreground font-normal">
                  {attBetala >= 0 ? "Att betala" : "Att få tillbaka"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <div className={`text-2xl font-bold font-mono ${attBetala >= 0 ? "text-destructive" : "text-success"}`}>
                  {formatAmount(Math.abs(attBetala))}
                </div>
              </CardContent>
            </Card>
          </div>

          <VarningKort warnings={warnings} title={`Varningar för ${periodLabel}`} />

          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Period</CardTitle></CardHeader>
            <CardContent className="pb-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Period</span><span>{periodLabel}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Datumintervall</span><span className="font-mono">{startDate} – {endDate}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Redovisningsmetod</span><span>{vatSettings.reportingMethod === "fakturering" ? "Faktureringsmetoden" : "Bokslutsmetoden"}</span></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rapport">
          <MomsRapportTable results={results} />
        </TabsContent>

        <TabsContent value="avstamning">
          <MomsAvstamning results={results} startDate={startDate} endDate={endDate} />
        </TabsContent>

        <TabsContent value="installningar" className="space-y-4">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Momsinställningar</CardTitle></CardHeader>
            <CardContent className="pb-3 space-y-3 text-sm">
              <label className="flex items-center justify-between">
                <span>Företaget är momsregistrerat</span>
                <input
                  type="checkbox"
                  checked={vatSettings.registered}
                  onChange={(e) => setVatSettings({ ...vatSettings, registered: e.target.checked })}
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Redovisningsperiod</label>
                  <Select value={vatSettings.reportingPeriod} onValueChange={(v) => setVatSettings({ ...vatSettings, reportingPeriod: v as any })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manad">Månad</SelectItem>
                      <SelectItem value="kvartal">Kvartal</SelectItem>
                      <SelectItem value="ar">Helår</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Redovisningsmetod</label>
                  <Select value={vatSettings.reportingMethod} onValueChange={(v) => setVatSettings({ ...vatSettings, reportingMethod: v as any })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fakturering">Faktureringsmetoden</SelectItem>
                      <SelectItem value="bokslut">Bokslutsmetoden / Kontantmetoden</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Standardmomskod – försäljning</label>
                  <MomskodDropdown
                    value={vatSettings.defaultSalesCodeId}
                    onChange={(v) => setVatSettings({ ...vatSettings, defaultSalesCodeId: v })}
                    filter="utgaende"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Standardmomskod – inköp</label>
                  <MomskodDropdown
                    value={vatSettings.defaultPurchaseCodeId}
                    onChange={(v) => setVatSettings({ ...vatSettings, defaultPurchaseCodeId: v })}
                    filter="ingaende"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {[
                  { key: "sellsVatFree", label: "Säljer momsfritt" },
                  { key: "sellsEU", label: "Säljer inom EU" },
                  { key: "sellsOutsideEU", label: "Säljer utanför EU" },
                  { key: "usesReverseCharge", label: "Använder omvänd skattskyldighet" },
                ].map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(vatSettings as any)[opt.key]}
                      onChange={(e) => setVatSettings({ ...vatSettings, [opt.key]: e.target.checked } as any)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Momskoder och rapportrutor är konfigurerbara. Ändra inställningarna efter hur ditt företag säljer och köper – momssatser och rutor kan justeras utan att UI behöver göras om.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <LasPeriodDialog
        open={lockOpen}
        onOpenChange={setLockOpen}
        periodLabel={periodLabel}
        onConfirm={() => {
          lockPeriod(periodKey);
          setLockOpen(false);
          toast.success(`Momsperioden ${periodLabel} är nu låst`);
        }}
      />
    </div>
  );
}
