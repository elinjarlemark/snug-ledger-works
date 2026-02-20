import { useState, useEffect } from "react";
import { Plus, Eye, Calendar, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useAccounting, Voucher } from "@/contexts/AccountingContext";
import { VoucherForm } from "./VoucherForm";
import { VoucherDetails } from "./VoucherDetails";
import { VoucherPagination } from "./VoucherPagination";
import { formatAmount } from "@/lib/bas-accounts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { YearSelector } from "@/components/ui/year-selector";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const VOUCHERS_PER_PAGE = 10;

interface AccountingPanelProps {
  compact?: boolean;
  incomingDuplicate?: Voucher | null;
  onClearIncomingDuplicate?: () => void;
  onDuplicateToOther?: (voucher: Voucher) => void;
}

export function AccountingPanel({
  compact,
  incomingDuplicate,
  onClearIncomingDuplicate,
  onDuplicateToOther,
}: AccountingPanelProps) {
  const { user } = useAuth();
  const { vouchers } = useAccounting();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [duplicatingVoucher, setDuplicatingVoucher] = useState<Voucher | null>(null);

  const [selectedYear, setSelectedYear] = useState<number | undefined>(new Date().getFullYear());
  const [voucherStartDate, setVoucherStartDate] = useState<Date | undefined>(
    selectedYear ? new Date(selectedYear, 0, 1) : undefined
  );
  const [voucherEndDate, setVoucherEndDate] = useState<Date | undefined>(
    selectedYear ? new Date(selectedYear, 11, 31) : undefined
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (selectedYear !== undefined) {
      setVoucherStartDate(new Date(selectedYear, 0, 1));
      setVoucherEndDate(new Date(selectedYear, 11, 31));
    }
  }, [selectedYear]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, voucherStartDate, voucherEndDate]);

  // Handle incoming duplicate from other panel
  useEffect(() => {
    if (incomingDuplicate) {
      setDuplicatingVoucher(incomingDuplicate);
      setShowCreateForm(true);
      setSelectedVoucher(null);
      setEditingVoucher(null);
      onClearIncomingDuplicate?.();
    }
  }, [incomingDuplicate]);

  const filteredVouchers = vouchers.filter((v) => {
    const vDate = new Date(v.date);
    if (voucherStartDate && vDate < voucherStartDate) return false;
    if (voucherEndDate && vDate > voucherEndDate) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      if (!v.description.toLowerCase().includes(q) && !v.voucherNumber.toString().includes(q))
        return false;
    }
    return true;
  });

  const handleVoucherClick = (v: Voucher) => {
    setSelectedVoucher(v);
    setShowCreateForm(false);
    setEditingVoucher(null);
    setDuplicatingVoucher(null);
  };

  const handleCreateClick = () => {
    setShowCreateForm(true);
    setSelectedVoucher(null);
    setEditingVoucher(null);
    setDuplicatingVoucher(null);
  };

  const handleFormCancel = () => {
    setShowCreateForm(false);
    setEditingVoucher(null);
    setDuplicatingVoucher(null);
  };

  const handleFormSuccess = () => {
    setShowCreateForm(false);
    setEditingVoucher(null);
    setDuplicatingVoucher(null);
  };

  const handleEditVoucher = () => {
    if (selectedVoucher) {
      setEditingVoucher(selectedVoucher);
      setSelectedVoucher(null);
    }
  };

  const handleDuplicateVoucher = (voucher: Voucher) => {
    if (onDuplicateToOther) {
      // In compare mode, duplicate to other panel
      onDuplicateToOther(voucher);
    } else {
      // Normal mode - duplicate in place
      setDuplicatingVoucher(voucher);
      setShowCreateForm(true);
      setSelectedVoucher(null);
      setEditingVoucher(null);
    }
  };

  const handleClear = () => {
    setVoucherStartDate(undefined);
    setVoucherEndDate(undefined);
    setSelectedYear(undefined);
    setSearchQuery("");
  };

  if (!user) return null;

  const totalPages = Math.ceil(filteredVouchers.length / VOUCHERS_PER_PAGE);
  const startIndex = (currentPage - 1) * VOUCHERS_PER_PAGE;
  const paginatedVouchers = filteredVouchers
    .slice()
    .reverse()
    .slice(startIndex, startIndex + VOUCHERS_PER_PAGE);

  return (
    <div className="space-y-4">
      {/* Create/Edit/Duplicate Form */}
      {(showCreateForm || editingVoucher) && (
        <VoucherForm
          onCancel={handleFormCancel}
          onSuccess={handleFormSuccess}
          editVoucher={editingVoucher || undefined}
          duplicateFrom={duplicatingVoucher || undefined}
        />
      )}

      {/* Voucher Details */}
      {selectedVoucher && (
        <VoucherDetails
          voucher={selectedVoucher}
          onClose={() => setSelectedVoucher(null)}
          onEdit={handleEditVoucher}
          onDuplicate={handleDuplicateVoucher}
        />
      )}

      {/* Voucher List */}
      {!showCreateForm && !selectedVoucher && !editingVoucher && (
        <>
          <div className="flex justify-end">
            <Button onClick={handleCreateClick} size={compact ? "sm" : "default"}>
              <Plus className="h-4 w-4 mr-2" />
              Create Voucher
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className={compact ? "text-base" : "text-lg"}>Voucher Period</CardTitle>
              <CardDescription>Filter vouchers by date range</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">From:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-[130px] justify-start text-left font-normal",
                        !voucherStartDate && "text-muted-foreground"
                      )}
                    >
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
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-[130px] justify-start text-left font-normal",
                        !voucherEndDate && "text-muted-foreground"
                      )}
                    >
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
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className={cn("font-semibold text-foreground", compact ? "text-lg" : "text-2xl")}>
              Vouchers ({filteredVouchers.length})
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name or number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Table */}
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
                {paginatedVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No vouchers found matching your search.
                    </td>
                  </tr>
                ) : (
                  paginatedVouchers.map((voucher) => {
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
                        <td className="py-3 px-4 text-right font-mono">
                          {formatAmount(total)} SEK
                        </td>
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
                  })
                )}
              </tbody>
            </table>
          </div>

          <VoucherPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
}
