import { Link } from "react-router-dom";
import { useMemo, useEffect } from "react";
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
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, ReferenceLine } from "recharts";
import { useAccounting } from "@/contexts/AccountingContext";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

const economyModules = [
  {
    icon: ListChecks,
    name: "Checklist",
    href: "/economy/checklist",
  },
  {
    icon: BookOpen,
    name: "Accounting",
    href: "/economy/accounting",
  },
  {
    icon: FileText,
    name: "Billing",
    href: "/economy/billing",
  },
  {
    icon: Users,
    name: "Salary",
    href: "/economy/salary",
  },
  {
    icon: FileCheck,
    name: "Declaration",
    href: "/economy/declaration",
  },
  {
    icon: BarChart3,
    name: "Annual Reports",
    href: "/economy/annual-reports",
  },
  {
    icon: Wallet,
    name: "Accounts",
    href: "/economy/accounts",
  },
];

const chartConfig = {
  netResult: {
    label: "Net Result",
    color: "hsl(var(--secondary))",
  },
};

export default function EconomyIndex() {
  const { getIncomeStatement } = useAccounting();
  const { user } = useAuth();

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

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
        month: format(monthDate, "MMM"),
        fullMonth: format(monthDate, "MMMM yyyy"),
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

  // Not logged in - show informational overview
  if (!user) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground">Economy Overview</h1>
        </div>

        {/* Call to action for login */}
        <Card className="bg-secondary/5 border-secondary/20">
          <CardContent className="py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">Ready to get started?</h3>
                <p className="text-muted-foreground">Log in to access all features and manage your company's finances.</p>
              </div>
              <Button asChild>
                <Link to="/login">
                  <LogIn className="mr-2 h-4 w-4" />
                  Log In
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Module overview cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {economyModules.map((module, index) => {
            const Icon = module.icon;
            return (
              <div
                key={module.name}
                className="feature-card animate-fade-in-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-secondary" />
                  </div>
                </div>

                <h3 className="text-base font-semibold text-foreground mb-6">
                  {module.name}
                </h3>

                <Button variant="outline" className="w-full" asChild>
                  <Link to={module.href}>
                    Open
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-foreground">Economy Overview</h1>
      </div>

      {/* Year Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="text-xl font-bold mt-1 text-foreground">
            {yearTotals.totalRevenue.toLocaleString("sv-SE", { minimumFractionDigits: 2 })} SEK
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Expenses</p>
          <p className="text-xl font-bold mt-1 text-foreground">
            {yearTotals.totalExpenses.toLocaleString("sv-SE", { minimumFractionDigits: 2 })} SEK
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Net Result</p>
          <p className={`text-xl font-bold mt-1 ${yearTotals.netResult >= 0 ? "text-green-600" : "text-destructive"}`}>
            {yearTotals.netResult >= 0 ? "+" : ""}{yearTotals.netResult.toLocaleString("sv-SE", { minimumFractionDigits: 2 })} SEK
          </p>
        </div>
      </div>

      {/* This Year's Net Result Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">{currentYear} Net Result</CardTitle>
          <p className="text-sm text-muted-foreground">Monthly income minus expenses for {currentYear}</p>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <AreaChart data={monthlyData} margin={{ top: 20, right: 20, left: 20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillPositive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillNegative" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="month" 
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <YAxis 
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <ChartTooltip 
                  content={
                    <ChartTooltipContent 
                      formatter={(value, name) => (
                        <div className="flex items-center gap-2">
                          <span className={Number(value) >= 0 ? "text-green-500" : "text-destructive"}>
                            {Number(value) >= 0 ? "+" : ""}{Number(value).toLocaleString("sv-SE", { minimumFractionDigits: 2 })} SEK
                          </span>
                        </div>
                      )}
                      labelFormatter={(label, payload) => payload[0]?.payload?.fullMonth || label}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="netResult"
                  stroke="hsl(var(--secondary))"
                  strokeWidth={2}
                  fill="url(#fillPositive)"
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              <p>No voucher data yet. Create vouchers to see your {currentYear} results.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rolling 12-month Net Result */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Net Result — Last 12 Months</p>
            <p className={`text-xl font-bold mt-1 ${rolling12 >= 0 ? "text-green-600" : "text-destructive"}`}>
              {rolling12 >= 0 ? "+" : ""}{rolling12.toLocaleString("sv-SE", { minimumFractionDigits: 2 })} SEK
            </p>
          </div>
          {rolling12 >= 0 ? (
            <TrendingUp className="h-5 w-5 text-green-600" />
          ) : (
            <TrendingDown className="h-5 w-5 text-destructive" />
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {economyModules.map((module, index) => {
          const Icon = module.icon;
          return (
            <div
              key={module.name}
              className="feature-card animate-fade-in-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Icon className="h-6 w-6 text-secondary" />
                </div>
              </div>

              <h3 className="text-base font-semibold text-foreground mb-6">
                {module.name}
              </h3>

              <Button variant="outline" className="w-full" asChild>
                <Link to={module.href}>
                  Open
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
