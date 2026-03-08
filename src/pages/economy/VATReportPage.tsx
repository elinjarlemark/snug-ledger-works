import { useState, useMemo } from "react";
import { FileCheck, Lock, Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useAccounting } from "@/contexts/AccountingContext";
import { formatAmount } from "@/lib/bas-accounts";
import { Link } from "react-router-dom";
import { YearSelector } from "@/components/ui/year-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

const PERIODS = [
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Yearly", value: "yearly" },
] as const;

const QUARTER_LABELS = ["Q1 (Jan–Mar)", "Q2 (Apr–Jun)", "Q3 (Jul–Sep)", "Q4 (Oct–Dec)"];
const MONTH_LABELS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function VATReportPage() {
  const { user } = useAuth();
  const { vouchers } = useAccounting();
  const [selectedYear, setSelectedYear] = useState<number | undefined>(new Date().getFullYear());
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "yearly">("quarterly");
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(Math.floor(new Date().getMonth() / 3));

  // Calculate VAT from vouchers
  const vatData = useMemo(() => {
    const year = selectedYear || new Date().getFullYear();
    let startDate: Date;
    let endDate: Date;

    if (period === "yearly") {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
    } else if (period === "quarterly") {
      const qStart = selectedPeriodIndex * 3;
      startDate = new Date(year, qStart, 1);
      endDate = endOfMonth(new Date(year, qStart + 2, 1));
    } else {
      startDate = new Date(year, selectedPeriodIndex, 1);
      endDate = endOfMonth(new Date(year, selectedPeriodIndex, 1));
    }

    const startStr = format(startDate, "yyyy-MM-dd");
    const endStr = format(endDate, "yyyy-MM-dd");

    // Filter vouchers in period
    const periodVouchers = vouchers.filter(v => v.date >= startStr && v.date <= endStr);

    // Calculate output VAT (account 26xx) and input VAT (account 26xx)
    // Swedish BAS: 2610-2619 = output VAT, 2640-2649 = input VAT
    let outputVat = 0; // Utgående moms (what you charge customers)
    let inputVat = 0;  // Ingående moms (what you pay suppliers)
    let salesExclVat = 0; // Revenue excl VAT (account 3xxx)
    let purchasesExclVat = 0; // Purchases excl VAT (account 4xxx-7xxx)

    periodVouchers.forEach(v => {
      v.lines.forEach(r => {
        const accNum = parseInt(r.account);
        // Output VAT accounts (2610-2619)
        if (accNum >= 2610 && accNum <= 2619) {
          outputVat += (r.credit || 0) - (r.debit || 0);
        }
        // Input VAT accounts (2640-2649)
        if (accNum >= 2640 && accNum <= 2649) {
          inputVat += (r.debit || 0) - (r.credit || 0);
        }
        // Sales (3xxx)
        if (accNum >= 3000 && accNum <= 3999) {
          salesExclVat += (r.credit || 0) - (r.debit || 0);
        }
        // Purchases (4xxx-7xxx)
        if (accNum >= 4000 && accNum <= 7999) {
          purchasesExclVat += (r.debit || 0) - (r.credit || 0);
        }
      });
    });

    const vatToPay = outputVat - inputVat;

    return {
      outputVat,
      inputVat,
      vatToPay,
      salesExclVat,
      purchasesExclVat,
      periodLabel: period === "yearly" ? `${year}` :
        period === "quarterly" ? `${QUARTER_LABELS[selectedPeriodIndex]} ${year}` :
        `${MONTH_LABELS[selectedPeriodIndex]} ${year}`,
      voucherCount: periodVouchers.length,
    };
  }, [vouchers, selectedYear, period, selectedPeriodIndex]);

  if (!user) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
            <FileCheck className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">VAT Report</h1>
            <p className="text-sm text-muted-foreground">Momsredovisning</p>
          </div>
        </div>
        <section className="bg-primary/5 rounded-xl p-6 border border-primary/10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground mb-1">VAT Reporting</h3>
              <p className="text-sm text-muted-foreground mb-3">Sign in to manage VAT reports.</p>
              <Button size="sm" asChild><Link to="/login">Sign In</Link></Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const periodOptions = period === "quarterly"
    ? QUARTER_LABELS.map((l, i) => ({ label: l, value: i.toString() }))
    : period === "monthly"
    ? MONTH_LABELS.map((l, i) => ({ label: l, value: i.toString() }))
    : [];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
          <FileCheck className="h-5 w-5 text-secondary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">VAT Report (Momsredovisning)</h1>
        </div>
      </div>

      {/* Period selector */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-2">
            <YearSelector value={selectedYear} onChange={setSelectedYear} className="w-[120px]" />
            <Select value={period} onValueChange={(v) => { setPeriod(v as any); setSelectedPeriodIndex(0); }}>
              <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {periodOptions.length > 0 && (
              <Select value={selectedPeriodIndex.toString()} onValueChange={(v) => setSelectedPeriodIndex(parseInt(v))}>
                <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {periodOptions.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* VAT Summary */}
      <Card>
        <CardHeader className="py-3 pb-2">
          <CardTitle className="text-sm">VAT Summary — {vatData.periodLabel}</CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="space-y-3">
            {/* Sales */}
            <div className="bg-muted/30 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left py-2 px-3 font-medium">Description</th>
                    <th className="text-right py-2 px-3 font-medium">Amount (SEK)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-2 px-3">Sales excl. VAT (Försäljning exkl. moms)</td>
                    <td className="py-2 px-3 text-right font-mono">{formatAmount(vatData.salesExclVat)}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 px-3">Output VAT (Utgående moms)</td>
                    <td className="py-2 px-3 text-right font-mono">{formatAmount(vatData.outputVat)}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 px-3">Purchases excl. VAT (Inköp exkl. moms)</td>
                    <td className="py-2 px-3 text-right font-mono">{formatAmount(vatData.purchasesExclVat)}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 px-3">Input VAT (Ingående moms)</td>
                    <td className="py-2 px-3 text-right font-mono">{formatAmount(vatData.inputVat)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className={vatData.vatToPay >= 0 ? "bg-destructive/10" : "bg-success/10"}>
                    <td className="py-2 px-3 font-semibold">
                      {vatData.vatToPay >= 0 ? "VAT to pay (Moms att betala)" : "VAT to reclaim (Moms att få tillbaka)"}
                    </td>
                    <td className={`py-2 px-3 text-right font-mono font-bold ${vatData.vatToPay >= 0 ? "text-destructive" : "text-success"}`}>
                      {formatAmount(Math.abs(vatData.vatToPay))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              Based on {vatData.voucherCount} voucher(s) in this period.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Output VAT (Utgående moms)</strong> — VAT you charge customers on sales (accounts 2610–2619).</p>
              <p><strong>Input VAT (Ingående moms)</strong> — VAT you pay on purchases (accounts 2640–2649).</p>
              <p><strong>VAT to pay</strong> = Output VAT − Input VAT. If negative, you have a VAT refund.</p>
              <p>Report VAT to Skatteverket via their e-service. Standard reporting periods are monthly (turnover &gt; 40 MSEK), quarterly, or yearly (turnover &lt; 1 MSEK).</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
