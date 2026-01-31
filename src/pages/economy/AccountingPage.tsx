import { useState, useRef, useEffect } from "react";
import { BookOpen, FileSpreadsheet, ListChecks, Calculator, Lock, Plus, Eye, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAccounting, Voucher } from "@/contexts/AccountingContext";
import { VoucherForm } from "@/components/accounting/VoucherForm";
import { VoucherDetails } from "@/components/accounting/VoucherDetails";
import { formatAmount } from "@/lib/bas-accounts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { YearSelector } from "@/components/ui/year-selector";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const pageTopRef = useRef<HTMLDivElement>(null);
  
  // Year selector
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  // Voucher period filter - derived from selected year
  const [voucherStartDate, setVoucherStartDate] = useState<Date | undefined>(new Date(selectedYear, 0, 1));
  const [voucherEndDate, setVoucherEndDate] = useState<Date | undefined>(new Date(selectedYear, 11, 31));
  
  // Update dates when year changes
  useEffect(() => {
    setVoucherStartDate(new Date(selectedYear, 0, 1));
    setVoucherEndDate(new Date(selectedYear, 11, 31));
  }, [selectedYear]);

  // Filter vouchers by date
  const filteredVouchers = vouchers.filter((voucher) => {
    const voucherDate = new Date(voucher.date);
    if (voucherStartDate && voucherDate < voucherStartDate) return false;
    if (voucherEndDate && voucherDate > voucherEndDate) return false;
    return true;
  });

  const handleVoucherClick = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setShowCreateForm(false);
    setEditingVoucher(null);
  };

  const handleCreateClick = () => {
    setShowCreateForm(true);
    setSelectedVoucher(null);
    setEditingVoucher(null);
  };

  const handleFormCancel = () => {
    setShowCreateForm(false);
    setEditingVoucher(null);
  };

  const handleFormSuccess = () => {
    setShowCreateForm(false);
    setEditingVoucher(null);
    // Scroll to top of page after successful save
    window.scrollTo({ top: 0, behavior: 'smooth' });
    pageTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDetailsClose = () => {
    setSelectedVoucher(null);
  };

  const handleEditVoucher = () => {
    if (selectedVoucher) {
      setEditingVoucher(selectedVoucher);
      setSelectedVoucher(null);
    }
  };

  return (
    <div ref={pageTopRef} className="space-y-12 animate-fade-in">
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
          
          {user && !showCreateForm && !selectedVoucher && !editingVoucher && (
            <Button onClick={handleCreateClick}>
              <Plus className="h-4 w-4 mr-2" />
              Create Voucher
            </Button>
          )}
        </div>
      </div>

      {/* Authenticated: Show voucher form (create or edit) */}
      {user && (showCreateForm || editingVoucher) && (
        <VoucherForm 
          onCancel={handleFormCancel} 
          onSuccess={handleFormSuccess}
          editVoucher={editingVoucher || undefined}
        />
      )}

      {user && selectedVoucher && (
        <VoucherDetails 
          voucher={selectedVoucher} 
          onClose={handleDetailsClose}
          onEdit={handleEditVoucher}
        />
      )}

      {/* Authenticated: Show vouchers list */}
      {user && vouchers.length > 0 && !showCreateForm && !selectedVoucher && !editingVoucher && (
        <section>
          {/* Voucher Period Filter */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Voucher Period</CardTitle>
              <CardDescription>Filter vouchers by date range</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">From:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !voucherStartDate && "text-muted-foreground")}>
                      <Calendar className="mr-1 h-3 w-3" />
                      {voucherStartDate ? format(voucherStartDate, "yyyy-MM-dd") : "Start"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={voucherStartDate}
                      onSelect={setVoucherStartDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-sm text-muted-foreground">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !voucherEndDate && "text-muted-foreground")}>
                      <Calendar className="mr-1 h-3 w-3" />
                      {voucherEndDate ? format(voucherEndDate, "yyyy-MM-dd") : "End"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={voucherEndDate}
                      onSelect={setVoucherEndDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <YearSelector 
                  value={selectedYear} 
                  onChange={setSelectedYear}
                  className="w-[140px]"
                />
                <Button variant="ghost" size="sm" onClick={() => {
                  setVoucherStartDate(undefined);
                  setVoucherEndDate(undefined);
                }}>
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          <h2 className="text-2xl font-semibold text-foreground mb-4">
            Vouchers ({filteredVouchers.length})
          </h2>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-semibold text-foreground">#</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Description</th>
                  <th className="text-right py-3 px-4 font-semibold text-foreground">Amount</th>
                  <th className="text-center py-3 px-4 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVouchers.slice(-10).reverse().map((voucher) => {
                  const total = voucher.lines.reduce((sum, l) => sum + l.debit, 0);
                  return (
                    <tr 
                      key={voucher.id} 
                      className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => handleVoucherClick(voucher)}
                    >
                      <td className="py-3 px-4 font-mono text-secondary">
                        {voucher.voucherNumber}
                      </td>
                      <td className="py-3 px-4">{voucher.date}</td>
                      <td className="py-3 px-4 text-muted-foreground">{voucher.description}</td>
                      <td className="py-3 px-4 text-right font-mono">{formatAmount(total)} SEK</td>
                      <td className="py-3 px-4 text-center">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVoucherClick(voucher);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Introduction */}
      {!showCreateForm && !selectedVoucher && !editingVoucher && (
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

          {/* Login Prompt - only for non-authenticated users */}
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
                  <div className="flex gap-3">
                    <Button asChild>
                      <Link to="/login">Sign In</Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link to="/economy/accounts">View Account Structure</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
