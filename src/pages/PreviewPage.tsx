import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const sampleOverviewData = {
  cards: [
    { label: "Total Revenue", value: "SEK 284,500" },
    { label: "Total Expenses", value: "SEK 156,200" },
    { label: "Net Result", value: "SEK 128,300", positive: true },
  ],
  chartMonths: [
    { month: "Jan", value: 45 },
    { month: "Feb", value: 52 },
    { month: "Mar", value: 38 },
    { month: "Apr", value: 61 },
    { month: "May", value: 55 },
    { month: "Jun", value: 70 },
    { month: "Jul", value: 48 },
    { month: "Aug", value: 65 },
    { month: "Sep", value: 72 },
    { month: "Oct", value: 58 },
    { month: "Nov", value: 80 },
    { month: "Dec", value: 90 },
  ],
};

const sampleVouchers = [
  { id: 1, date: "2026-01-15", desc: "Office supplies", debit: "6100", credit: "1930", amount: "1,250" },
  { id: 2, date: "2026-01-18", desc: "Client invoice payment", debit: "1930", credit: "1510", amount: "45,000" },
  { id: 3, date: "2026-01-22", desc: "Monthly rent", debit: "5010", credit: "1930", amount: "12,000" },
  { id: 4, date: "2026-02-01", desc: "Software subscription", debit: "6540", credit: "1930", amount: "2,400" },
];

const sampleInvoices = [
  { num: "2026-001", customer: "TechCorp AB", amount: "45,000", status: "Paid", statusColor: "bg-green-500/10 text-green-600" },
  { num: "2026-002", customer: "Design Studio HB", amount: "18,500", status: "Sent", statusColor: "bg-blue-500/10 text-blue-600" },
  { num: "2026-003", customer: "Nordic Solutions AB", amount: "32,000", status: "Draft", statusColor: "bg-muted text-muted-foreground" },
  { num: "2026-004", customer: "Startup Innovations", amount: "8,750", status: "Overdue", statusColor: "bg-destructive/10 text-destructive" },
];

const sampleEmployees = [
  { name: "Anna Svensson", title: "CEO", type: "Full-time", salary: "52,000" },
  { name: "Erik Johansson", title: "Developer", type: "Full-time", salary: "45,000" },
  { name: "Maria Lindberg", title: "Designer", type: "Part-time", salary: "28,000" },
  { name: "Johan Karlsson", title: "Sales", type: "Seasonal", salary: "35,000" },
];

const sampleFinancials = {
  income: [
    { account: "3000", name: "Revenue", balance: "284,500" },
    { account: "3740", name: "Öres/kronorsutjämning", balance: "12" },
  ],
  expenses: [
    { account: "5010", name: "Office rent", balance: "-144,000" },
    { account: "6100", name: "Office supplies", balance: "-3,750" },
    { account: "6540", name: "IT costs", balance: "-8,450" },
  ],
};

export default function PreviewPage() {
  const maxVal = Math.max(...sampleOverviewData.chartMonths.map(m => m.value));

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 relative">
        {/* Sign-in overlay */}
        <div className="sticky top-[var(--header-height,57px)] z-20 bg-primary/5 border-b border-primary/10 backdrop-blur-sm">
          <div className="container py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Preview Mode</h2>
                <p className="text-xs text-muted-foreground">Sign in to access the full economy dashboard</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/login">Create Account</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="container py-6 space-y-8 pointer-events-none select-none" aria-hidden="true">
          {/* SECTION: Economy Overview */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">Economy Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {sampleOverviewData.cards.map((card) => (
                <div key={card.label} className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className={`text-xl font-bold mt-1 ${card.positive ? "text-green-600" : "text-foreground"}`}>
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
            {/* Mini chart */}
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium text-foreground mb-3">Monthly Net Result</p>
              <div className="flex items-end gap-1 h-24">
                {sampleOverviewData.chartMonths.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-secondary/60"
                      style={{ height: `${(m.value / maxVal) * 100}%` }}
                    />
                    <span className="text-[9px] text-muted-foreground">{m.month}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION: Accounting */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">Accounting</h2>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left py-2 px-3 font-medium">Voucher</th>
                    <th className="text-left py-2 px-3 font-medium">Date</th>
                    <th className="text-left py-2 px-3 font-medium">Description</th>
                    <th className="text-right py-2 px-3 font-medium">Debit</th>
                    <th className="text-right py-2 px-3 font-medium">Credit</th>
                    <th className="text-right py-2 px-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleVouchers.map((v) => (
                    <tr key={v.id} className="border-b border-border/50">
                      <td className="py-2 px-3 font-mono text-secondary">#{v.id}</td>
                      <td className="py-2 px-3 text-muted-foreground">{v.date}</td>
                      <td className="py-2 px-3 text-foreground">{v.desc}</td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">{v.debit}</td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">{v.credit}</td>
                      <td className="py-2 px-3 text-right font-mono font-medium">{v.amount} SEK</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* SECTION: Billing */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">Billing</h2>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left py-2 px-3 font-medium">Invoice</th>
                    <th className="text-left py-2 px-3 font-medium">Customer</th>
                    <th className="text-right py-2 px-3 font-medium">Amount</th>
                    <th className="text-right py-2 px-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleInvoices.map((inv) => (
                    <tr key={inv.num} className="border-b border-border/50">
                      <td className="py-2 px-3 font-mono text-secondary">{inv.num}</td>
                      <td className="py-2 px-3 text-foreground">{inv.customer}</td>
                      <td className="py-2 px-3 text-right font-mono">{inv.amount} SEK</td>
                      <td className="py-2 px-3 text-right">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${inv.statusColor}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* SECTION: Salary */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">Salary</h2>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left py-2 px-3 font-medium">Employee</th>
                    <th className="text-left py-2 px-3 font-medium">Job Title</th>
                    <th className="text-left py-2 px-3 font-medium">Type</th>
                    <th className="text-right py-2 px-3 font-medium">Monthly Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleEmployees.map((emp) => (
                    <tr key={emp.name} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium text-foreground">{emp.name}</td>
                      <td className="py-2 px-3 text-muted-foreground">{emp.title}</td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-secondary/10 text-secondary">
                          {emp.type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{emp.salary} SEK</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* SECTION: Financial Statements */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">Financial Statements</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-medium text-foreground mb-2">Income (Intäkter)</p>
                <div className="space-y-1.5">
                  {sampleFinancials.income.map((r) => (
                    <div key={r.account} className="flex justify-between text-xs">
                      <span className="text-muted-foreground"><span className="font-mono text-secondary">{r.account}</span> {r.name}</span>
                      <span className="font-mono text-green-600">{r.balance} SEK</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-medium text-foreground mb-2">Expenses (Kostnader)</p>
                <div className="space-y-1.5">
                  {sampleFinancials.expenses.map((r) => (
                    <div key={r.account} className="flex justify-between text-xs">
                      <span className="text-muted-foreground"><span className="font-mono text-secondary">{r.account}</span> {r.name}</span>
                      <span className="font-mono text-destructive">{r.balance} SEK</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
