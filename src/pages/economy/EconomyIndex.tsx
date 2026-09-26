import { Link } from "react-router-dom";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen,
  FileText,
  Users,
  FileCheck,
  BarChart3,
  Wallet,
  ListChecks,
  ArrowRight,
  LogIn,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, ReferenceLine } from "recharts";
import { useAccounting } from "@/contexts/AccountingContext";
import { useAuth } from "@/contexts/AuthContext";
import { sv } from "date-fns/locale";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

const economyModules = [
  {
    icon: ListChecks,
    name: "Checklista",
    href: "/economy/checklist",
  },
  {
    icon: BookOpen,
    name: "Bokföring",
    href: "/economy/accounting",
  },
  {
    icon: FileText,
    name: "Fakturering",
    href: "/economy/billing",
  },
  {
    icon: Users,
    name: "Löner",
    href: "/economy/salary",
  },
  {
    icon: FileCheck,
    name: "Deklaration",
    href: "/economy/declaration",
  },
  {
    icon: BarChart3,
    name: "Årsredovisning",
    href: "/economy/annual-reports",
  },
  {
    icon: Wallet,
    name: "Konton",
    href: "/economy/accounts",
  },
];

const chartConfig = {
  netResult: {
    label: "Resultat",
    color: "hsl(var(--primary))",
  },
};

export default function EconomyIndex() {
  const { getIncomeStatement } = useAccounting();
  const { user } = useAuth();

  const currentYear = new Date().getFullYear();

  const monthlyData = useMemo(() => {
    const data = [];
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    
    for (let i = 0; i <= currentMonth; i++) {
      const monthDate = new Date(currentYear, i, 1);
      const monthStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");
      
      const { netResult } = getIncomeStatement(monthStart, monthEnd);
      
      data.push({
        month: format(monthDate, "MMM", { locale: sv }),
        fullMonth: format(monthDate, "MMMM yyyy", { locale: sv }),
        netResult: netResult,
      });
    }
    
    return data;
  }, [getIncomeStatement, currentYear]);

  const hasData = monthlyData.some(d => d.netResult !== 0);

  // Year-to-date totals
  const yearTotals = useMemo(() => {
    const yearStart = `${currentYear}-01-01`;
    const yearEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
    const { revenues, expenses, netResult } = getIncomeStatement(yearStart, yearEnd);
    const totalRevenue = revenues.reduce((sum, r) => sum + Math.abs(r.balance), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Math.abs(e.balance), 0);
    return { totalRevenue, totalExpenses, netResult };
  }, [getIncomeStatement, currentYear]);

  // Rolling 12-month net result
  const rolling12 = useMemo(() => {
    const now = new Date();
    const start = format(startOfMonth(subMonths(now, 11)), "yyyy-MM-dd");
    const end = format(endOfMonth(now), "yyyy-MM-dd");
    const { netResult } = getIncomeStatement(start, end);
    return netResult;
  }, [getIncomeStatement]);

  const amount = (value: number) => value.toLocaleString("sv-SE", { minimumFractionDigits: 2 });
  const shortcuts = (
    <section className="space-y-3" aria-labelledby="shortcuts-heading">
      <h2 id="shortcuts-heading" className="text-sm font-semibold">Genvägar</h2>
      <div className="flex flex-wrap gap-2">
        {economyModules.map(({ name, href, icon: Icon }) => (
          <Button key={href} variant="outline" size="sm" asChild>
            <Link to={href}><Icon className="mr-2 h-4 w-4" aria-hidden="true" />{name}<ArrowRight className="ml-3 h-3 w-3" aria-hidden="true" /></Link>
          </Button>
        ))}
      </div>
    </section>
  );

  if (!user) {
    return <div className="space-y-6">
      <h1>Översikt</h1>
      <Card><CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
        <p className="text-sm text-muted-foreground">Logga in för att se företagets ekonomi.</p>
        <Button asChild><Link to="/login"><LogIn className="mr-2 h-4 w-4" />Logga in</Link></Button>
      </CardContent></Card>
      {shortcuts}
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1>Översikt</h1><p className="mt-1 text-sm text-muted-foreground">Företagets ekonomi · {currentYear}</p></div>
        <Button asChild><Link to="/economy/accounting" state={{ openCreateVoucher: true }}><BookOpen className="mr-2 h-4 w-4" />Ny verifikation</Link></Button>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {[
          { label: "Intäkter", value: yearTotals.totalRevenue },
          { label: "Kostnader", value: yearTotals.totalExpenses },
          { label: "Resultat", value: yearTotals.netResult },
        ].map(metric => <Card key={metric.label} className="shadow-none">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{metric.label}</p>
            <p className="mt-2 break-words text-2xl font-semibold tracking-tight tabular-nums">{amount(metric.value)} <span className="text-sm font-normal text-muted-foreground">kr</span></p>
            <p className="mt-1 text-xs text-muted-foreground">Hittills i år</p>
          </CardContent>
        </Card>)}
      </div>
      <Card className="shadow-none">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base font-semibold">Resultat per månad</CardTitle>
          <p className="text-xs text-muted-foreground">{currentYear} · tusen kronor</p>
        </CardHeader>
        <CardContent>
          {hasData ? <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <BarChart accessibilityLayer data={monthlyData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} width={52} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={value => (value / 1000).toLocaleString("sv-SE")} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(label, payload) => payload[0]?.payload?.fullMonth || label} formatter={value => <span className="tabular-nums">{amount(Number(value))} kr</span>} />} />
              <Bar dataKey="netResult" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={32} isAnimationActive={false} />
            </BarChart>
          </ChartContainer> : <div className="flex h-[220px] items-center justify-center px-4 text-center text-sm text-muted-foreground">Inga verifikationer ännu. Skapa en verifikation för att se årets resultat.</div>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
            <p className="text-muted-foreground">Resultat · senaste 12 månaderna</p>
            <p className="font-semibold tabular-nums">{amount(rolling12)} kr</p>
          </div>
        </CardContent>
      </Card>
      {shortcuts}
    </div>
  );
}
