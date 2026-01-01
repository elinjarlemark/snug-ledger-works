import { BarChart3, FileText, TrendingUp, Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const reportFeatures = [
  {
    icon: TrendingUp,
    title: "Income Statement",
    description:
      "Generate a complete income statement showing revenues, costs, and net profit/loss for the fiscal year.",
  },
  {
    icon: FileText,
    title: "Balance Sheet",
    description:
      "Produce a balance sheet with assets on one side and equity plus liabilities on the other, always in balance.",
  },
  {
    icon: BarChart3,
    title: "General Ledger",
    description:
      "View detailed account activity with total debits, credits, and final balances for all active accounts.",
  },
  {
    icon: Clock,
    title: "Year-End Closing",
    description:
      "Complete the fiscal year with proper closing entries, transferring results to equity accounts.",
  },
];

const closingSteps = [
  {
    step: "1",
    title: "Review All Entries",
    description: "Verify all transactions are recorded and properly classified",
  },
  {
    step: "2",
    title: "Period Adjustments",
    description: "Record accruals, prepayments, and other adjusting entries",
  },
  {
    step: "3",
    title: "Generate Reports",
    description: "Produce income statement and balance sheet for the period",
  },
  {
    step: "4",
    title: "Close Revenue & Expense",
    description: "Zero out income and expense accounts to result account",
  },
  {
    step: "5",
    title: "Transfer Result",
    description: "Move net result to equity using year-end accounts",
  },
];

export default function AnnualReportsPage() {
  return (
    <div className="space-y-12 animate-fade-in">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-secondary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Annual Reports</h1>
            <p className="text-muted-foreground">
              Financial statements and year-end procedures
            </p>
          </div>
        </div>
      </div>

      {/* Introduction */}
      <section className="info-section">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Complete Financial Reporting
        </h2>
        <p className="text-muted-foreground mb-4">
          The Annual Reports module provides all tools needed to close the fiscal year and generate statutory financial statements. All reports are derived from your bookkeeping data.
        </p>
        <p className="text-muted-foreground">
          The system validates that your balance sheet is balanced before allowing completion, ensuring accuracy and regulatory compliance.
        </p>
      </section>

      {/* Features Grid */}
      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-6">
          Reporting Features
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {reportFeatures.map((feature) => {
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

      {/* Year-End Process */}
      <section className="info-section">
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Year-End Closing Process
        </h2>
        <div className="space-y-4">
          {closingSteps.map((step) => (
            <div key={step.step} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-semibold shrink-0">
                {step.step}
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Login Prompt */}
      <section className="bg-primary/5 rounded-xl p-8 border border-primary/10">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Generate Reports
            </h3>
            <p className="text-muted-foreground mb-4">
              Sign in to generate financial statements and complete year-end closing procedures for your business.
            </p>
            <Button asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
