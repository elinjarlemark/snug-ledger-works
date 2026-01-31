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
  ArrowRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from "recharts";
import { useAccounting } from "@/contexts/AccountingContext";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

const economyModules = [
  {
    icon: BookOpen,
    name: "Accounting",
    description:
      "Core double-entry bookkeeping with full Swedish BAS compliance. Create balanced vouchers, manage accounts, and maintain accurate records.",
    href: "/economy/accounting",
    features: ["Voucher management", "BAS chart of accounts", "Balance validation"],
  },
  {
    icon: FileText,
    name: "Billing",
    description:
      "Create, send, and track invoices. Manage customer payments and maintain a clear overview of receivables.",
    href: "/economy/billing",
    features: ["Invoice creation", "Payment tracking", "Customer management"],
  },
  {
    icon: Users,
    name: "Salary",
    description:
      "Handle payroll processing, employee records, and salary-related bookkeeping entries.",
    href: "/economy/salary",
    features: ["Payroll processing", "Employee records", "Tax calculations"],
  },
  {
    icon: FileCheck,
    name: "Declaration",
    description:
      "Prepare and submit tax declarations with confidence. Generate required reports and ensure compliance.",
    href: "/economy/declaration",
    features: ["VAT declarations", "Tax reporting", "Compliance checks"],
  },
  {
    icon: BarChart3,
    name: "Annual Reports",
    description:
      "Generate income statements, balance sheets, and complete annual reports for statutory compliance.",
    href: "/economy/annual-reports",
    features: ["Income statements", "Balance sheets", "Year-end closing"],
  },
  {
    icon: Wallet,
    name: "Accounts",
    description:
      "Manage your chart of accounts. View, add, and configure bookkeeping accounts based on the BAS standard.",
    href: "/economy/accounts",
    features: ["Account listing", "BAS compliance", "Account configuration"],
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

  const monthlyData = useMemo(() => {
    const data = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(now, i);
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
  }, [getIncomeStatement]);

  const currentMonthResult = monthlyData[monthlyData.length - 1]?.netResult || 0;
  const hasData = monthlyData.some(d => d.netResult !== 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Economy Overview</h1>
        <p className="text-lg text-muted-foreground">
          A complete suite of tools for Swedish business accounting. Explore each module to learn more.
        </p>
      </div>

      {/* Monthly Net Result Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Monthly Net Result</CardTitle>
            <div className="flex items-center gap-2">
              {currentMonthResult >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-destructive" />
              )}
              <span className={`text-lg font-bold ${currentMonthResult >= 0 ? "text-green-500" : "text-destructive"}`}>
                {currentMonthResult >= 0 ? "+" : ""}{currentMonthResult.toLocaleString("sv-SE", { minimumFractionDigits: 2 })} SEK
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Last 12 months income minus expenses</p>
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
              <p>No voucher data yet. Create vouchers to see your monthly results.</p>
            </div>
          )}
        </CardContent>
      </Card>

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
              
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {module.name}
              </h3>
              
              <p className="text-muted-foreground text-sm mb-4">
                {module.description}
              </p>
              
              <ul className="space-y-2 mb-6">
                {module.features.map((feature) => (
                  <li
                    key={feature}
                    className="text-sm text-muted-foreground flex items-center gap-2"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    {feature}
                  </li>
                ))}
              </ul>
              
              <Button variant="outline" className="w-full" asChild>
                <Link to={module.href}>
                  Learn More
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
