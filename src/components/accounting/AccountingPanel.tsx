import { useState, useEffect, useRef } from "react";
import { Plus, Eye, Calendar, Search, Lock, Unlock, Columns2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useAccounting, Voucher } from "@/contexts/AccountingContext";
import { useFiscalLock } from "@/contexts/FiscalLockContext";
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
import { toast } from "sonner";

const VOUCHERS_PER_PAGE = 10;

interface AccountingPanelProps {
  compact?: boolean;
  incomingDuplicate?: Voucher | null;
  onClearIncomingDuplicate?: () => void;
  onDuplicateToOther?: (voucher: Voucher) => void;
  autoOpenCreate?: boolean;
  onAutoOpenCreateConsumed?: () => void;
  onToggleCompare?: () => void;
}

export function AccountingPanel({
  compact,
  incomingDuplicate,
  onClearIncomingDuplicate,
  onDuplicateToOther,
  autoOpenCreate,
  onAutoOpenCreateConsumed,
  onToggleCompare,
}: AccountingPanelProps) {
  const { user } = useAuth();
  const { vouchers } = useAccounting();
  const { isYearLocked, lockYear, unlockYear } = useFiscalLock();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [duplicatingVoucher, setDuplicatingVoucher] = useState<Voucher | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number | undefined>(today.getFullYear());
  const [voucherStartDate, setVoucherStartDate] = useState<Date | undefined>(
    selectedYear ? new Date(selectedYear, 0, 1) : undefined
  );
  const [voucherEndDate, setVoucherEndDate] = useState<Date | undefined>(
    selectedYear ? new Date(selectedYear, 11, 31) : undefined
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const currentYearLocked = selectedYear !== undefined ? isYearLocked(selectedYear) : false;

  // Auto-open create form from header shortcut
  useEffect(() => {
    if (autoOpenCreate) {
      handleCreateClick();
      onAutoOpenCreateConsumed?.();
    }
  }, [autoOpenCreate]);

  useEffect(() => {
    if (selectedYear !== undefined) {
      setVoucherStartDate(new Date(selectedYear, 0, 1));
      setVoucherEndDate(new Date(selectedYear, 11, 31));
    }
  }, [selectedYear]);

  useEffect(() => {
    setCurrentPage(1);
    // Scroll list to top when search changes
    listRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [searchQuery, voucherStartDate, voucherEndDate]);

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
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleDuplicateVoucher = (voucher: Voucher) => {
    if (onDuplicateToOther) {
      onDuplicateToOther(voucher);
    } else {
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

  const handleToggleLock = () => {
    if (selectedYear === undefined) return;
    if (currentYearLocked) {
      unlockYear(selectedYear);
      toast.info(`Fiscal year ${selectedYear} unlocked`);
    } else {
      lockYear(selectedYear);
      toast.success(`Fiscal year ${selectedYear} locked`);
    }
  };

  if (!user) return null;

  const totalPages = Math.ceil(filteredVouchers.length / VOUCHERS_PER_PAGE);
  const startIndex = (currentPage - 1) * VOUCHERS_PER_PAGE;
  const paginatedVouchers = filteredVouchers
    .slice()
    .reverse()
    .slice(startIndex, startIndex + VOUCHERS_PER_PAGE);

  return (
    <div className="space-y-4" ref={listRef}>
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
          onDuplicate={handleDuplicateVoucher}
        />
      )}

      {/* Voucher List */}
      {!showCreateForm && !selectedVoucher && !editingVoucher && (
         <>

          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className={compact ? "text-base" : "text-lg"}>Voucher Period</CardTitle>
                  <CardDescription>Filter vouchers by date range</CardDescription>
                </div>
                {selectedYear !== undefined && (
                  <Button
                    variant={currentYearLocked ? "destructive" : "outline"}
                    size="sm"
                    onClick={handleToggleLock}
                  >
                    {currentYearLocked ? (
                      <>
                        <Lock className="h-4 w-4 mr-1" />
                        Unlock {selectedYear}
                      </>
                    ) : (
                      <>
                        <Unlock className="h-4 w-4 mr-1" />
                        Lock {selectedYear}
                      </>
                    )}
                  </Button>
                )}
              </div>
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
                      disabled={{ after: today }}
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
                      disabled={{ after: today }}
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
              {currentYearLocked && (
                <p className="text-sm text-destructive mt-2 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> This fiscal year is locked. Vouchers cannot be reverted.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Vouchers heading + Compare + Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className={cn("font-semibold text-foreground", compact ? "text-lg" : "text-2xl")}>
              Vouchers ({filteredVouchers.length})
            </h2>
            <div className="flex items-center gap-2">
              {onToggleCompare && (
                <Button variant="outline" size="sm" onClick={onToggleCompare}>
                  <Columns2 className="h-4 w-4 mr-2" />
                  Compare
                </Button>
              )}
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
