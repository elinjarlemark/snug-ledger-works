import { useState } from "react";
import { BookOpen, FileSpreadsheet, ListChecks, Calculator, Lock, Columns2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAccounting, Voucher } from "@/contexts/AccountingContext";
import { AccountingPanel } from "@/components/accounting/AccountingPanel";

const accountingFeatures = [
  {
    icon: FileSpreadsheet,
    title: "Voucher Management",
    description:
      "Create and manage vouchers (verifikationer) with automatic numbering and balance validation. Every voucher must balance with total debits equaling total credits.",
  },
  {
    icon: ListChecks,
    title: "BAS Account System",
    description:
      "Full support for the Swedish BAS chart of accounts. Each account has proper classification determining how balances are calculated.",
  },
  {
    icon: Calculator,
    title: "Real-time Validation",
    description:
      "The system continuously validates entries in real time. Unbalanced vouchers cannot be saved, ensuring data integrity.",
  },
];

const accountRules = [
  { class: "1xxx", name: "Assets", behavior: "Increases on debit, decreases on credit" },
  { class: "2xxx", name: "Equity & Liabilities", behavior: "Increases on credit, decreases on debit" },
  { class: "3xxx", name: "Revenue", behavior: "Increases on credit, decreases on debit" },
  { class: "4-8xxx", name: "Expenses", behavior: "Increases on debit, decreases on credit" },
];

export default function AccountingPage() {
  const { user } = useAuth();
  const { vouchers } = useAccounting();
  const [compareMode, setCompareMode] = useState(false);
  const [duplicateToRight, setDuplicateToRight] = useState<Voucher | null>(null);
  const [duplicateToLeft, setDuplicateToLeft] = useState<Voucher | null>(null);

  // Get sidebar control from layout
  const layoutContext = useOutletContext<{ setSidebarCollapsed?: (v: boolean) => void } | null>();

  const handleToggleCompare = () => {
    setCompareMode(true);
    layoutContext?.setSidebarCollapsed?.(true);
  };

  const handleExitCompare = () => {
    setCompareMode(false);
  };

  if (compareMode && user) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-secondary" />
            <h1 className="text-2xl font-bold text-foreground">Accounting — Compare</h1>
          </div>
          <Button variant="outline" onClick={handleExitCompare}>
            <X className="h-4 w-4 mr-2" />
            Exit Compare
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-border rounded-xl p-4 min-w-0">
            <AccountingPanel
              compact
              incomingDuplicate={duplicateToLeft}
              onClearIncomingDuplicate={() => setDuplicateToLeft(null)}
              onDuplicateToOther={(v) => setDuplicateToRight(v)}
            />
          </div>
          <div className="border border-border rounded-xl p-4 min-w-0">
            <AccountingPanel
              compact
              incomingDuplicate={duplicateToRight}
              onClearIncomingDuplicate={() => setDuplicateToRight(null)}
              onDuplicateToOther={(v) => setDuplicateToLeft(v)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-fade-in">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Accounting</h1>
              <p className="text-muted-foreground">
                Core bookkeeping with Swedish BAS compliance
              </p>
            </div>
          </div>

          {user && (
            <Button variant="outline" onClick={handleToggleCompare}>
              <Columns2 className="h-4 w-4 mr-2" />
              Compare
            </Button>
          )}
        </div>
      </div>

      {/* Main Panel */}
      {user && <AccountingPanel />}

      {/* Introduction */}
      <>
        <section className="info-section">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Double-Entry Bookkeeping
          </h2>
          <p className="text-muted-foreground mb-4">
            AccountPro implements strict double-entry bookkeeping following Swedish standards. Every financial transaction is recorded as a voucher (verifikation), with each voucher containing multiple lines that must always balance.
          </p>
          <p className="text-muted-foreground">
            This ensures complete accuracy and provides a clear audit trail for all financial activity. The system prevents any unbalanced entries from being saved.
          </p>
        </section>

        {/* Features Grid */}
        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-6">
            Key Features
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {accountingFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="feature-card">
                  <Icon className="h-8 w-8 text-secondary mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Account Classes */}
        <section className="info-section">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            BAS Account Classes
          </h2>
          <p className="text-muted-foreground mb-6">
            The BAS chart of accounts organizes accounts by class, with each class having specific rules for how balances are calculated:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Class</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Balance Behavior</th>
                </tr>
              </thead>
              <tbody>
                {accountRules.map((rule) => (
                  <tr key={rule.class} className="border-b border-border/50">
                    <td className="py-3 px-4 font-mono text-secondary">{rule.class}</td>
                    <td className="py-3 px-4 text-foreground">{rule.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{rule.behavior}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Login Prompt */}
        {!user && (
          <section className="bg-primary/5 rounded-xl p-8 border border-primary/10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Start Bookkeeping
                </h3>
                <p className="text-muted-foreground mb-4">
                  Sign in to access the full accounting functionality. Create vouchers, manage accounts, and generate reports for your business.
                </p>
                <Button asChild>
                  <Link to="/login">Sign In</Link>
                </Button>
              </div>
            </div>
          </section>
        )}
      </>
    </div>
  );
}
