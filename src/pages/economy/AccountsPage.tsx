import { useState, useMemo } from "react";
import { Wallet, Info, Lock, Eye, Search, Check, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAccounting } from "@/contexts/AccountingContext";
import { AddAccountDialog } from "@/components/accounting/AddAccountDialog";
import { AccountStatementDialog } from "@/components/accounting/AccountStatementDialog";
import { getAccountClassName } from "@/lib/bas-accounts";
import { cn } from "@/lib/utils";
import { YearSelector } from "@/components/ui/year-selector";

const accountClasses = [
  { range: "1000-1999", name: "Assets (Tillgångar)", description: "Fixed assets, current assets, cash and bank accounts" },
  { range: "2000-2999", name: "Equity & Liabilities (Eget kapital & Skulder)", description: "Share capital, retained earnings, loans, and payables" },
  { range: "3000-3999", name: "Revenue (Intäkter)", description: "Sales, service income, and other operating income" },
  { range: "4000-7999", name: "Expenses (Kostnader)", description: "Operating costs, materials, salaries, and overhead" },
  { range: "8000-8999", name: "Financial Items (Finansiella poster)", description: "Interest income, interest expenses, and financial gains/losses" },
];

export default function AccountsPage() {
  const { user } = useAuth();
  const { accounts, vouchers } = useAccounting();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<number | undefined>(new Date().getFullYear());

  // Filter accounts based on search query
  const filteredAccounts = useMemo(() => {
    let filtered = accounts;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (account) =>
          account.number.toLowerCase().includes(query) ||
          account.name.toLowerCase().includes(query)
      );
    }

    // No year-based filtering - show all accounts regardless of year selection

    return filtered;
  }, [accounts, searchQuery, selectedYear, vouchers]);

  // Compute date range from selected year for the statement dialog
  const statementStartDate = selectedYear ? `${selectedYear}-01-01` : undefined;
  const statementEndDate = selectedYear ? `${selectedYear}-12-31` : undefined;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
          <Wallet className="h-5 w-5 text-secondary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Accounts</h1>
        </div>
      </div>

      {/* Accounts List */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold text-foreground">
            {user ? "Your Accounts" : "System Accounts"}
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <YearSelector
                value={selectedYear}
                onChange={setSelectedYear}
                className="w-[140px]"
              />
              {selectedYear !== undefined && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedYear(undefined)}>
                  Show all
                </Button>
              )}
            </div>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[280px] justify-between">
                  {searchQuery ? (
                    <span className="text-foreground">{searchQuery}</span>
                  ) : (
                    <span className="text-muted-foreground">Search accounts...</span>
                  )}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="end">
                <Command>
                  <CommandInput
                    placeholder="Search by number or name..."
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  <CommandList>
                    <CommandEmpty>No account found.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {accounts.map((account) => (
                        <CommandItem
                          key={account.number}
                          value={`${account.number} ${account.name}`}
                          onSelect={() => {
                            setSearchQuery(`${account.number} ${account.name}`);
                            setSearchOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              searchQuery.includes(account.number) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="font-mono">{account.number}</span>
                          <span className="ml-2 text-muted-foreground">{account.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {(searchQuery || selectedYear !== undefined) && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Showing {filteredAccounts.length} of {accounts.length} accounts
              {selectedYear !== undefined && ` with transactions in ${selectedYear}`}
            </span>
            <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setSelectedYear(undefined); }}>
              Clear all filters
            </Button>
          </div>
        )}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2 px-3 font-medium text-foreground">Account Number</th>
                <th className="text-left py-2 px-3 font-medium text-foreground">Account Name</th>
                <th className="text-left py-2 px-3 font-medium text-foreground">Class</th>
                {user && <th className="text-right py-2 px-3 font-medium text-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account) => (
                <tr key={account.number} className="border-b border-border/50">
                  <td className="py-2 px-3 font-mono text-secondary font-medium">
                    {account.number}
                  </td>
                  <td className="py-2 px-3 text-foreground">{account.name}</td>
                  <td className="py-2 px-3">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-secondary/10 text-secondary">
                      {getAccountClassName(account.class)}
                    </span>
                  </td>
                  {user && (
                    <td className="py-2 px-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => setSelectedAccount(account.number)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Statement
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!user && (
          <div className="mt-4 flex items-start gap-2 text-muted-foreground text-sm">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Additional accounts can be added when logged in. All accounts must follow the BAS numbering standard.
            </span>
          </div>
        )}
      </section>

      {/* Account Classes Reference */}
      <section className="info-section">
        <h2 className="text-base font-semibold text-foreground mb-4">
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
