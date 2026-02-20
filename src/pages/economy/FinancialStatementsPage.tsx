import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, FileText, Download, Lock, Columns2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAccounting, GeneralLedgerEntry } from "@/contexts/AccountingContext";
import { formatAmount, getAccountClassName, getAccountClass } from "@/lib/bas-accounts";
import { exportIncomeStatementPDF, exportBalanceSheetPDF } from "@/lib/pdf-export";
import { toast } from "sonner";
import { DateInputPicker } from "@/components/ui/date-input-picker";
import { YearSelector } from "@/components/ui/year-selector";

// Group accounts by class for better display
const groupByClass = (entries: GeneralLedgerEntry[]) => {
  const groups: Record<string, GeneralLedgerEntry[]> = {};
  entries.forEach(entry => {
    const classNum = entry.accountNumber.charAt(0);
    if (!groups[classNum]) groups[classNum] = [];
    groups[classNum].push(entry);
  });
  return groups;
};

interface ReportPanelProps {
  compact?: boolean;
}

function ReportPanel({ compact }: ReportPanelProps) {
  const { user, activeCompany } = useAuth();
  const { getIncomeStatement, getBalanceSheet, getGeneralLedger } = useAccounting();

  const [selectedYear, setSelectedYear] = useState<number | undefined>(new Date().getFullYear());
  const [startDate, setStartDate] = useState<Date | undefined>(
    selectedYear ? new Date(selectedYear, 0, 1) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    selectedYear ? new Date(selectedYear, 11, 31) : undefined
  );

  useEffect(() => {
    if (selectedYear !== undefined) {
      setStartDate(new Date(selectedYear, 0, 1));
      setEndDate(new Date(selectedYear, 11, 31));
    }
  }, [selectedYear]);

  const handleClear = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedYear(undefined);
  };

  const startDateStr = startDate ? format(startDate, "yyyy-MM-dd") : undefined;
  const endDateStr = endDate ? format(endDate, "yyyy-MM-dd") : undefined;

  const incomeStatement = getIncomeStatement(startDateStr, endDateStr);
  const balanceSheet = getBalanceSheet();
  const generalLedger = getGeneralLedger(startDateStr, endDateStr);

  const totalRevenue = incomeStatement.revenues.reduce((sum, e) => sum + e.balance, 0);
  const totalExpenses = incomeStatement.expenses.reduce((sum, e) => sum + e.balance, 0);

  const handleExportIncomeStatement = () => {
    if (!activeCompany || !startDateStr || !endDateStr) {
      toast.error("Please select a date range");
      return;
    }
    exportIncomeStatementPDF(
      incomeStatement,
      { companyName: activeCompany.companyName, organizationNumber: activeCompany.organizationNumber },
      startDateStr,
      endDateStr
    );
    toast.success("Income statement exported as PDF");
  };

  const handleExportBalanceSheet = () => {
    if (!activeCompany || !endDateStr) {
      toast.error("Please select an end date");
      return;
    }
    exportBalanceSheetPDF(
      balanceSheet,
      { companyName: activeCompany.companyName, organizationNumber: activeCompany.organizationNumber },
      endDateStr
    );
    toast.success("Balance sheet exported as PDF");
  };

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className={compact ? "text-base" : "text-lg"}>Report Period</CardTitle>
          <CardDescription>Select the date range for your financial reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">From:</span>
            <DateInputPicker date={startDate} onDateChange={setStartDate} placeholder="YYYY-MM-DD" />
            <span className="text-sm text-muted-foreground">to</span>
            <DateInputPicker date={endDate} onDateChange={setEndDate} placeholder="YYYY-MM-DD" />
            <YearSelector value={selectedYear} onChange={setSelectedYear} className="w-[140px]" />
            <Button variant="ghost" size="sm" onClick={handleClear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports Tabs */}
      <Tabs defaultValue="income" className="w-full">
        <TabsList className={cn("grid w-full grid-cols-3", compact && "text-xs")}>
          <TabsTrigger value="income" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            {!compact && "Income Statement"}
            {compact && "Income"}
          </TabsTrigger>
          <TabsTrigger value="balance" className="gap-2">
            <FileText className="h-4 w-4" />
            {!compact && "Balance Sheet"}
            {compact && "Balance"}
          </TabsTrigger>
          <TabsTrigger value="ledger" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            {!compact && "General Ledger"}
            {compact && "Ledger"}
          </TabsTrigger>
        </TabsList>

        {/* Income Statement */}
        <TabsContent value="income" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className={compact ? "text-base" : undefined}>Income Statement (Resultaträkning)</CardTitle>
                  <CardDescription>
                    {startDate && endDate ? `${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}` : "All time"}
                  </CardDescription>
                </div>
                {!compact && (
                  <Button variant="outline" size="sm" onClick={handleExportIncomeStatement}>
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Net Result */}
              <div className={cn("rounded-lg p-6", incomeStatement.netResult >= 0 ? "bg-success/10" : "bg-destructive/10")}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={cn("font-semibold", compact ? "text-base" : "text-lg")}>Net Result (Årets resultat)</h3>
                    <p className="text-sm text-muted-foreground">Revenue minus Expenses</p>
                  </div>
                  <div className={cn(
                    "font-bold font-mono",
                    compact ? "text-xl" : "text-3xl",
                    incomeStatement.netResult >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {formatAmount(incomeStatement.netResult)} SEK
                  </div>
                </div>
              </div>

              {/* Revenue Section */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success"></span>
                  Revenue (Intäkter) - Class 3
                </h3>
                {!compact && (
                  <p className="text-sm text-muted-foreground mb-4">
                    Revenue accounts increase in credit (right side).
                  </p>
                )}
                {incomeStatement.revenues.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4">No revenue transactions in this period</p>
                ) : (
                  <div className="bg-muted/30 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="text-sm border-b">
                          <th className="text-left p-3">Account</th>
                          <th className="text-left p-3">Name</th>
                          {!compact && <th className="text-right p-3">Debit</th>}
                          {!compact && <th className="text-right p-3">Credit</th>}
                          <th className="text-right p-3">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {incomeStatement.revenues.map((entry) => (
                          <tr key={entry.accountNumber} className="border-b border-border/50">
                            <td className="p-3 font-mono text-secondary">{entry.accountNumber}</td>
                            <td className="p-3">{entry.accountName}</td>
                            {!compact && <td className="p-3 text-right font-mono">{formatAmount(entry.totalDebit)}</td>}
                            {!compact && <td className="p-3 text-right font-mono">{formatAmount(entry.totalCredit)}</td>}
                            <td className="p-3 text-right font-mono font-semibold text-success">{formatAmount(entry.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-success/10">
                          <td colSpan={compact ? 2 : 4} className="p-3 font-semibold">Total Revenue</td>
                          <td className="p-3 text-right font-mono font-bold text-success">{formatAmount(totalRevenue)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Expenses Section */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-destructive"></span>
                  Expenses (Kostnader) - Classes 4-8
                </h3>
                {!compact && (
                  <p className="text-sm text-muted-foreground mb-4">
                    Expense accounts increase in debit (left side).
                  </p>
                )}
                {incomeStatement.expenses.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4">No expense transactions in this period</p>
                ) : (
                  <div className="bg-muted/30 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="text-sm border-b">
                          <th className="text-left p-3">Account</th>
                          <th className="text-left p-3">Name</th>
                          {!compact && <th className="text-right p-3">Debit</th>}
                          {!compact && <th className="text-right p-3">Credit</th>}
                          <th className="text-right p-3">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {incomeStatement.expenses.map((entry) => (
                          <tr key={entry.accountNumber} className="border-b border-border/50">
                            <td className="p-3 font-mono text-secondary">{entry.accountNumber}</td>
                            <td className="p-3">{entry.accountName}</td>
                            {!compact && <td className="p-3 text-right font-mono">{formatAmount(entry.totalDebit)}</td>}
                            {!compact && <td className="p-3 text-right font-mono">{formatAmount(entry.totalCredit)}</td>}
                            <td className="p-3 text-right font-mono font-semibold text-destructive">{formatAmount(entry.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-destructive/10">
                          <td colSpan={compact ? 2 : 4} className="p-3 font-semibold">Total Expenses</td>
                          <td className="p-3 text-right font-mono font-bold text-destructive">{formatAmount(totalExpenses)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet */}
        <TabsContent value="balance" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className={compact ? "text-base" : undefined}>Balance Sheet (Balansräkning)</CardTitle>
                  <CardDescription>Assets must equal Equity + Liabilities</CardDescription>
                </div>
                {!compact && (
                  <Button variant="outline" size="sm" onClick={handleExportBalanceSheet}>
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Balance Check */}
              <div className={cn("rounded-lg p-6", balanceSheet.isBalanced ? "bg-success/10" : "bg-destructive/10")}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={cn("font-semibold", compact ? "text-base" : "text-lg")}>Balance Check</h3>
                    <p className="text-sm text-muted-foreground">
                      {balanceSheet.isBalanced
                        ? "The balance sheet is balanced (Assets = Equity + Liabilities)"
                        : "WARNING: The balance sheet is NOT balanced!"}
                    </p>
                  </div>
                  <div className={cn("text-xl font-bold", balanceSheet.isBalanced ? "text-success" : "text-destructive")}>
                    {balanceSheet.isBalanced ? "✓ Balanced" : "⚠ Imbalanced"}
                  </div>
                </div>
              </div>

              <div className={cn("gap-6", compact ? "space-y-6" : "grid md:grid-cols-2")}>
                {/* Assets */}
                <div>
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-secondary"></span>
                    Assets (Tillgångar) - Class 1
                  </h3>
                  {!compact && (
                    <p className="text-sm text-muted-foreground mb-4">
                      Asset accounts increase in debit.
                    </p>
                  )}
                  {balanceSheet.assets.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4">No asset transactions</p>
                  ) : (
                    <div className="bg-muted/30 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="text-sm border-b">
                            <th className="text-left p-3">Account</th>
                            <th className="text-right p-3">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {balanceSheet.assets.map((entry) => (
                            <tr key={entry.accountNumber} className="border-b border-border/50">
                              <td className="p-3">
                                <span className="font-mono text-secondary">{entry.accountNumber}</span>
                                <span className="ml-2 text-muted-foreground">{entry.accountName}</span>
                              </td>
                              <td className="p-3 text-right font-mono">{formatAmount(entry.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-secondary/10">
                            <td className="p-3 font-semibold">Total Assets</td>
                            <td className="p-3 text-right font-mono font-bold">{formatAmount(balanceSheet.totalAssets)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* Equity & Liabilities */}
                <div>
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary"></span>
                    Equity & Liabilities - Class 2
                  </h3>
                  {!compact && (
                    <p className="text-sm text-muted-foreground mb-4">
                      Equity and liability accounts increase in credit.
                    </p>
                  )}
                  {balanceSheet.equityLiabilities.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4">No equity/liability transactions</p>
                  ) : (
                    <div className="bg-muted/30 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="text-sm border-b">
                            <th className="text-left p-3">Account</th>
                            <th className="text-right p-3">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {balanceSheet.equityLiabilities.map((entry) => (
                            <tr key={entry.accountNumber} className="border-b border-border/50">
                              <td className="p-3">
                                <span className="font-mono text-secondary">{entry.accountNumber}</span>
                                <span className="ml-2 text-muted-foreground">{entry.accountName}</span>
                              </td>
                              <td className="p-3 text-right font-mono">{formatAmount(entry.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-primary/10">
                            <td className="p-3 font-semibold">Total Equity & Liabilities</td>
                            <td className="p-3 text-right font-mono font-bold">{formatAmount(balanceSheet.totalEquityLiabilities)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* General Ledger */}
        <TabsContent value="ledger" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className={compact ? "text-base" : undefined}>General Ledger (Huvudbok)</CardTitle>
                  <CardDescription>
                    {startDate && endDate ? `${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}` : "All time"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {generalLedger.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No transactions in this period</div>
              ) : (
                <div className="bg-muted/30 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="text-sm border-b bg-muted/50">
                        <th className="text-left p-3">Account</th>
                        <th className="text-left p-3">Name</th>
                        {!compact && <th className="text-left p-3">Class</th>}
                        <th className="text-right p-3">Debit</th>
                        <th className="text-right p-3">Credit</th>
                        <th className="text-right p-3">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generalLedger.map((entry) => (
                        <tr key={entry.accountNumber} className="border-b border-border/50">
                          <td className="p-3 font-mono text-secondary font-semibold">{entry.accountNumber}</td>
                          <td className="p-3">{entry.accountName}</td>
                          {!compact && (
                            <td className="p-3">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary/10 text-secondary">
                                {getAccountClassName(getAccountClass(entry.accountNumber))}
                              </span>
                            </td>
                          )}
                          <td className="p-3 text-right font-mono">{formatAmount(entry.totalDebit)}</td>
                          <td className="p-3 text-right font-mono">{formatAmount(entry.totalCredit)}</td>
                          <td className="p-3 text-right font-mono font-semibold">{formatAmount(entry.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!compact && (
                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold mb-3">Understanding Account Classes</h4>
                  <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div>
                      <p className="font-medium text-foreground">Balance Sheet Accounts (1-2)</p>
                      <ul className="list-disc list-inside space-y-1 mt-1">
                        <li>Class 1 (Assets): Increase in debit, decrease in credit</li>
                        <li>Class 2 (Equity & Liabilities): Increase in credit, decrease in debit</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Income Statement Accounts (3-8)</p>
                      <ul className="list-disc list-inside space-y-1 mt-1">
                        <li>Class 3 (Revenue): Increase in credit, decrease in debit</li>
                        <li>Classes 4-7 (Expenses): Increase in debit, decrease in credit</li>
                        <li>Class 8 (Financial): Income in credit, expenses in debit</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function FinancialStatementsPage() {
  const { user } = useAuth();
  const [compareMode, setCompareMode] = useState(false);

  const layoutContext = useOutletContext<{ setSidebarCollapsed?: (v: boolean) => void } | null>();

  const handleToggleCompare = () => {
    setCompareMode(true);
    layoutContext?.setSidebarCollapsed?.(true);
  };

  if (!user) {
    return (
      <div className="space-y-12 animate-fade-in">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Financial Statements</h1>
              <p className="text-muted-foreground">Financial statements and year-end procedures</p>
            </div>
          </div>
        </div>
        <section className="bg-primary/5 rounded-xl p-8 border border-primary/10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-2">Generate Reports</h3>
              <p className="text-muted-foreground mb-4">
                Sign in to generate financial statements and complete year-end closing procedures.
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

  if (compareMode) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-secondary" />
            <h1 className="text-2xl font-bold text-foreground">Financial Statements — Compare</h1>
          </div>
          <Button variant="outline" onClick={() => setCompareMode(false)}>
            <X className="h-4 w-4 mr-2" />
            Exit Compare
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-border rounded-xl p-4 min-w-0">
            <ReportPanel compact />
          </div>
          <div className="border border-border rounded-xl p-4 min-w-0">
            <ReportPanel compact />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-secondary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Financial Statements</h1>
            <p className="text-muted-foreground">Financial statements for your business</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleToggleCompare}>
          <Columns2 className="h-4 w-4 mr-2" />
          Compare
        </Button>
      </div>

      <ReportPanel />
    </div>
  );
}
