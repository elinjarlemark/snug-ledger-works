import { Link } from "react-router-dom";
import { useMemo, useEffect } from "react";
import { motion } from "framer-motion";
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
import { cn } from "@/lib/utils";
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
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-8"
      >
        <div className="space-y-1">
          <h1 className="text-3xl font-bold gradient-text">Economy Overview</h1>
          <p className="text-sm text-muted-foreground">Allt du behöver för att sköta företagets ekonomi.</p>
        </div>

        {/* Call to action for login */}
        <Card className="relative overflow-hidden border-secondary/30 bg-gradient-to-br from-secondary/10 via-card to-card shadow-md">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-secondary/10 blur-3xl" />
          <CardContent className="relative py-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">Ready to get started?</h3>
                <p className="text-muted-foreground">Log in to access all features and manage your company's finances.</p>
              </div>
              <Button asChild size="lg" className="shadow-md hover:shadow-glow">
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
              <motion.div
                key={module.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                whileHover={{ y: -4 }}
                className="feature-card"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-accent flex items-center justify-center shadow-md">
                    <Icon className="h-6 w-6 text-accent-foreground" />
                  </div>
                </div>

                <h3 className="text-base font-semibold text-foreground mb-6">
                  {module.name}
                </h3>

                <Button variant="outline" className="w-full group" asChild>
                  <Link to={module.href}>
                    Open
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="space-y-1">
        <h1 className="text-3xl font-bold gradient-text">Economy Overview</h1>
        <p className="text-sm text-muted-foreground">Översikt över företagets ekonomi.</p>
      </div>

      {/* Year Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Revenue", value: yearTotals.totalRevenue, accent: "secondary" as const, sign: false },
          { label: "Total Expenses", value: yearTotals.totalExpenses, accent: "warning" as const, sign: false },
          { label: "Net Result", value: yearTotals.netResult, accent: yearTotals.netResult >= 0 ? "success" as const : "destructive" as const, sign: true },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.06 }}
            whileHover={{ y: -2 }}
            className={cn(
              "relative overflow-hidden rounded-xl border border-border/60 bg-gradient-card p-5 shadow-card hover:shadow-md transition-shadow",
              "before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-[3px]",
              card.accent === "secondary" && "before:bg-gradient-to-r before:from-secondary before:to-accent",
              card.accent === "warning" && "before:bg-gradient-to-r before:from-warning before:to-warning/40",
              card.accent === "success" && "before:bg-gradient-success",
              card.accent === "destructive" && "before:bg-gradient-destructive",
            )}
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{card.label}</p>
            <p className={cn(
              "text-2xl font-bold mt-1.5 tabular-nums",
              card.accent === "success" && "text-success",
              card.accent === "destructive" && "text-destructive",
            )}>
              {card.sign ? (card.value >= 0 ? "+" : "") : ""}
              {card.value.toLocaleString("sv-SE", { minimumFractionDigits: 2 })} <span className="text-sm text-muted-foreground font-medium">SEK</span>
            </p>
          </motion.div>
        ))}
      </div>

      {/* This Year's Net Result Chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <Card className="border-border/60 shadow-card overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-subtle">
            <CardTitle className="text-lg font-semibold">{currentYear} Net Result</CardTitle>
            <p className="text-sm text-muted-foreground">Monthly income minus expenses for {currentYear}</p>
          </CardHeader>
          <CardContent className="pt-4">
            {hasData ? (
              <ChartContainer config={chartConfig} className="h-[220px] w-full">
                <AreaChart data={monthlyData} margin={{ top: 20, right: 20, left: 20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillPositive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
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
                            <span className={Number(value) >= 0 ? "text-success" : "text-destructive"}>
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
                    stroke="hsl(var(--success))"
                    strokeWidth={2.5}
                    fill="url(#fillPositive)"
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                <p>No voucher data yet. Create vouchers to see your {currentYear} results.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Rolling 12-month Net Result */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="rounded-xl border border-border/60 bg-gradient-card p-5 shadow-card hover:shadow-md transition-shadow"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Net Result — Last 12 Months</p>
            <p className={cn(
              "text-2xl font-bold mt-1.5 tabular-nums",
              rolling12 >= 0 ? "text-success" : "text-destructive"
            )}>
              {rolling12 >= 0 ? "+" : ""}{rolling12.toLocaleString("sv-SE", { minimumFractionDigits: 2 })} <span className="text-sm text-muted-foreground font-medium">SEK</span>
            </p>
          </div>
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center",
            rolling12 >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {rolling12 >= 0 ? (
              <TrendingUp className="h-6 w-6" />
            ) : (
              <TrendingDown className="h-6 w-6" />
            )}
          </div>
        </div>
      </motion.div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {economyModules.map((module, index) => {
          const Icon = module.icon;
          return (
            <motion.div
              key={module.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.25 + index * 0.05 }}
              whileHover={{ y: -4 }}
              className="feature-card"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-accent flex items-center justify-center shadow-md">
                  <Icon className="h-6 w-6 text-accent-foreground" />
                </div>
              </div>

              <h3 className="text-base font-semibold text-foreground mb-6">
                {module.name}
              </h3>

              <Button variant="outline" className="w-full group" asChild>
                <Link to={module.href}>
                  Open
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
