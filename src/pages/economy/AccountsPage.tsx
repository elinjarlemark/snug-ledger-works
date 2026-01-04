import { useState } from "react";
import { Wallet, Info, Lock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAccounting } from "@/contexts/AccountingContext";
import { AddAccountDialog } from "@/components/accounting/AddAccountDialog";
import { AccountStatementDialog } from "@/components/accounting/AccountStatementDialog";
import { getAccountClassName } from "@/lib/bas-accounts";

const accountClasses = [
  { range: "1000-1999", name: "Assets (Tillgångar)", description: "Fixed assets, current assets, cash and bank accounts" },
  { range: "2000-2999", name: "Equity & Liabilities (Eget kapital & Skulder)", description: "Share capital, retained earnings, loans, and payables" },
  { range: "3000-3999", name: "Revenue (Intäkter)", description: "Sales, service income, and other operating income" },
  { range: "4000-7999", name: "Expenses (Kostnader)", description: "Operating costs, materials, salaries, and overhead" },
  { range: "8000-8999", name: "Financial Items (Finansiella poster)", description: "Interest income, interest expenses, and financial gains/losses" },
];

export default function AccountsPage() {
  const { user } = useAuth();
  const { accounts } = useAccounting();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  return (
    <div className="space-y-12 animate-fade-in">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
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
      </div>

      {/* Accounts List */}
      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-6">
          {user ? "Your Accounts" : "System Accounts"}
        </h2>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 font-semibold text-foreground">Account Number</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">Account Name</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">Class</th>
                {user && <th className="text-right py-3 px-4 font-semibold text-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.number} className="border-b border-border/50">
                  <td className="py-3 px-4 font-mono text-secondary font-semibold">
                    {account.number}
                  </td>
                  <td className="py-3 px-4 text-foreground">{account.name}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary/10 text-secondary">
                      {getAccountClassName(account.class)}
                    </span>
                  </td>
                  {user && (
                    <td className="py-3 px-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedAccount(account.number)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Statement
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 flex items-start gap-2 text-muted-foreground text-sm">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {user 
              ? "Click 'Statement' to view account transactions. Add new accounts using the button above."
              : "Additional accounts can be added when logged in. All accounts must follow the BAS numbering standard."}
          </span>
        </div>
      </section>

      {/* Account Classes Reference */}
      <section className="info-section">
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Account Class Reference
        </h2>
        <div className="space-y-4">
          {accountClasses.map((cls) => (
            <div key={cls.range} className="flex items-start gap-4 border-b border-border/50 pb-4 last:border-0">
              <span className="font-mono text-secondary font-semibold min-w-[100px]">{cls.range}</span>
              <div>
                <span className="font-semibold text-foreground">{cls.name}</span>
                <p className="text-muted-foreground text-sm">{cls.description}</p>
              </div>
            </div>
          ))}
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
      )}

      <AddAccountDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      {selectedAccount && (
        <AccountStatementDialog 
          open={!!selectedAccount} 
          onOpenChange={(open) => !open && setSelectedAccount(null)}
          accountNumber={selectedAccount}
        />
      )}
    </div>
  );
}
