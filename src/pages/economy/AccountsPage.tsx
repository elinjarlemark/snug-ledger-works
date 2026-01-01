import { Wallet, Plus, Info, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const defaultAccounts = [
  { number: "1930", name: "Företagskonto", class: "Assets", description: "Company bank account" },
];

const accountClasses = [
  {
    range: "1000-1999",
    name: "Assets (Tillgångar)",
    description: "Fixed assets, current assets, cash and bank accounts",
    examples: ["1930 Företagskonto", "1510 Kundfordringar", "1200 Maskiner"],
  },
  {
    range: "2000-2999",
    name: "Equity & Liabilities (Eget kapital & Skulder)",
    description: "Share capital, retained earnings, loans, and payables",
    examples: ["2010 Aktiekapital", "2440 Leverantörsskulder", "2610 Moms"],
  },
  {
    range: "3000-3999",
    name: "Revenue (Intäkter)",
    description: "Sales, service income, and other operating income",
    examples: ["3001 Försäljning varor", "3010 Försäljning tjänster"],
  },
  {
    range: "4000-7999",
    name: "Expenses (Kostnader)",
    description: "Operating costs, materials, salaries, and overhead",
    examples: ["4000 Inköp varor", "5010 Lokalhyra", "7010 Löner"],
  },
  {
    range: "8000-8999",
    name: "Financial Items (Finansiella poster)",
    description: "Interest income, interest expenses, and financial gains/losses",
    examples: ["8310 Ränteintäkter", "8410 Räntekostnader"],
  },
];

export default function AccountsPage() {
  return (
    <div className="space-y-12 animate-fade-in">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
            <Wallet className="h-6 w-6 text-secondary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Accounts</h1>
            <p className="text-muted-foreground">
              Chart of accounts based on Swedish BAS standard
            </p>
          </div>
        </div>
      </div>

      {/* Introduction */}
      <section className="info-section">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          BAS Chart of Accounts
        </h2>
        <p className="text-muted-foreground mb-4">
          The Accounts page displays all bookkeeping accounts configured for your company. Accounts follow the Swedish BAS standard, ensuring compatibility with regulatory requirements and industry practices.
        </p>
        <p className="text-muted-foreground">
          Each account number determines its class and how it behaves in the accounting system. New accounts can be added as needed to support your business operations.
        </p>
      </section>

      {/* Default Accounts */}
      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-6">
          System Accounts
        </h2>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 font-semibold text-foreground">
                  Account Number
                </th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">
                  Account Name
                </th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">
                  Class
                </th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {defaultAccounts.map((account) => (
                <tr key={account.number} className="border-b border-border/50">
                  <td className="py-3 px-4 font-mono text-secondary font-semibold">
                    {account.number}
                  </td>
                  <td className="py-3 px-4 text-foreground">{account.name}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary/10 text-secondary">
                      {account.class}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {account.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 flex items-start gap-2 text-muted-foreground text-sm">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Additional accounts can be added when logged in. All accounts must follow the BAS numbering standard.
          </span>
        </div>
      </section>

      {/* Account Classes Reference */}
      <section className="info-section">
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Account Class Reference
        </h2>
        <div className="space-y-6">
          {accountClasses.map((cls) => (
            <div key={cls.range} className="border-b border-border/50 pb-6 last:border-0 last:pb-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-secondary font-semibold">
                  {cls.range}
                </span>
                <span className="font-semibold text-foreground">{cls.name}</span>
              </div>
              <p className="text-muted-foreground text-sm mb-2">
                {cls.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {cls.examples.map((example) => (
                  <span
                    key={example}
                    className="inline-flex items-center px-2 py-1 rounded text-xs bg-muted text-muted-foreground"
                  >
                    {example}
                  </span>
                ))}
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
              Manage Accounts
            </h3>
            <p className="text-muted-foreground mb-4">
              Sign in to add and configure accounts for your company. Set up the chart of accounts that matches your business needs.
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
