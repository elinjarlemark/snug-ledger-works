import { useState, useEffect, useRef } from "react";
import { Plus, Eye, Calendar, Search, Lock, Columns2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
const VOUCHER_TEMPLATE_KEY_PREFIX = "accountpro_voucher_templates_";
const STANDARD_VOUCHER_TEMPLATE_KEY = "accountpro_standard_voucher_templates";

interface StoredVoucherTemplate {
  id: string;
  name: string;
  description: string;
  lines: {
    accountNumber: string;
    accountName: string;
    debit: number;
    credit: number;
    vatCodeId?: string;
  }[];
}

interface AccountingPanelProps {
  compact?: boolean;
  incomingDuplicate?: Voucher | null;
  onClearIncomingDuplicate?: () => void;
  onDuplicateToOther?: (voucher: Voucher) => void;
  autoOpenCreate?: boolean;
  onAutoOpenCreateConsumed?: () => void;
  onToggleCompare?: () => void;
  prefillVoucher?: any;
}

export function AccountingPanel({
  compact,
  incomingDuplicate,
  onClearIncomingDuplicate,
  onDuplicateToOther,
  autoOpenCreate,
  onAutoOpenCreateConsumed,
  onToggleCompare,
  prefillVoucher,
}: AccountingPanelProps) {
  const { user, activeCompany } = useAuth();
  const { vouchers } = useAccounting();
  const { isYearLocked } = useFiscalLock();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreateChoice, setShowCreateChoice] = useState(false);
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
  const [hideReversedVouchers, setHideReversedVouchers] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [customTemplates, setCustomTemplates] = useState<StoredVoucherTemplate[]>([]);
  const [standardTemplates, setStandardTemplates] = useState<StoredVoucherTemplate[]>([]);

  const currentYearLocked = selectedYear !== undefined ? isYearLocked(selectedYear) : false;

  const loadVoucherTemplates = () => {
    const standardRaw = localStorage.getItem(STANDARD_VOUCHER_TEMPLATE_KEY);
    setStandardTemplates(standardRaw ? JSON.parse(standardRaw) : []);

    if (!activeCompany?.id) {
      setCustomTemplates([]);
      return;
    }
    const customRaw = localStorage.getItem(`${VOUCHER_TEMPLATE_KEY_PREFIX}${activeCompany.id}`);
    setCustomTemplates(customRaw ? JSON.parse(customRaw) : []);
  };

  useEffect(() => {
    loadVoucherTemplates();
  }, [activeCompany?.id]);

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
  }, [searchQuery, hideReversedVouchers, voucherStartDate, voucherEndDate]);

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
    if (hideReversedVouchers && (v.reversesVoucherId || v.reversedByVoucherId)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      if (
        !v.description.toLowerCase().includes(q) &&
        !v.voucherNumber.toString().includes(q) &&
        !v.date.includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const handleVoucherClick = (v: Voucher) => {
    setSelectedVoucher(v);
    setShowCreateForm(false);
    setShowCreateChoice(false);
    setEditingVoucher(null);
    setDuplicatingVoucher(null);
  };

  const handleCreateClick = () => {
    loadVoucherTemplates();
    setShowCreateChoice(true);
    setShowCreateForm(false);
    setSelectedVoucher(null);
    setEditingVoucher(null);
    setDuplicatingVoucher(null);
  };

  const startManualVoucher = () => {
    setShowCreateChoice(false);
    setShowCreateForm(true);
    setDuplicatingVoucher(null);
  };

  const startFromTemplate = (template: StoredVoucherTemplate) => {
    setShowCreateChoice(false);
    setDuplicatingVoucher({
      id: template.id,
      companyId: activeCompany?.id || "",
      voucherNumber: 0,
      date: new Date().toISOString().split("T")[0],
      description: template.description || template.name,
      lines: template.lines.map((line) => ({ ...line, id: crypto.randomUUID() })),
      createdAt: new Date().toISOString(),
    });
    setShowCreateForm(true);
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
      {showCreateChoice && !showCreateForm && !editingVoucher && (
        <Card>
          <CardHeader>
            <CardTitle>Ny verifikation</CardTitle>
            <CardDescription>Välj hur du vill skapa verifikationen.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Button variant="outline" className="h-auto flex-col items-start p-4" onClick={startManualVoucher}>
              <span className="font-semibold">Manuell bokföring</span>
              <span className="text-xs text-muted-foreground text-left">Börja med tomma rader.</span>
            </Button>
            <div className="rounded-md border p-4 space-y-2">
              <p className="font-semibold text-sm">Färdiga mallar</p>
              {standardTemplates.length === 0 ? (
                <p className="text-xs text-muted-foreground">Inga färdiga mallar ännu. Alla användare kan lägga till dem tillfälligt.</p>
              ) : (
                <div className="space-y-2">
                  {standardTemplates.map((template) => (
                    <Button key={template.id} variant="ghost" size="sm" className="w-full justify-start" onClick={() => startFromTemplate(template)}>
                      {template.name}
                    </Button>
                  ))}
                </div>
              )}
              <Button size="sm" variant="secondary" onClick={startManualVoucher}>
                Lägg till färdig mall
              </Button>
            </div>
            <div className="rounded-md border p-4 space-y-2">
              <p className="font-semibold text-sm">Egna mallar</p>
              {customTemplates.length === 0 ? (
                <p className="text-xs text-muted-foreground">Inga egna mallar ännu. Skapa en manuellt och klicka “Spara som egen mall”.</p>
              ) : (
                <div className="space-y-2">
                  {customTemplates.map((template) => (
                    <Button key={template.id} variant="ghost" size="sm" className="w-full justify-start" onClick={() => startFromTemplate(template)}>
                      {template.name}
                    </Button>
                  ))}
                </div>
              )}
              <Button size="sm" variant="secondary" onClick={startManualVoucher}>
                Skapa egen mall
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(showCreateForm || editingVoucher) && (
        <VoucherForm
          onCancel={handleFormCancel}
          onSuccess={handleFormSuccess}
          editVoucher={editingVoucher || undefined}
          duplicateFrom={duplicatingVoucher || (prefillVoucher ? { ...prefillVoucher, voucherNumber: 0, date: new Date().toISOString().split("T")[0], lines: prefillVoucher.lines.map((l: any) => ({ ...l, id: crypto.randomUUID() })) } as Voucher : undefined)}
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
      {!showCreateForm && !showCreateChoice && !selectedVoucher && !editingVoucher && (
         <>

          {/* Filters */}
          <Card>
            <CardHeader className="py-3 pb-2">
              <CardTitle className="text-base">Voucher Period</CardTitle>
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
              <Button variant="default" size="sm" onClick={handleCreateClick}>
                <Plus className="h-4 w-4 mr-2" />
                Ny verifikation
              </Button>
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
                  placeholder="Search by name, number or date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                <Checkbox checked={hideReversedVouchers} onCheckedChange={(checked) => setHideReversedVouchers(checked === true)} />
                Dölj vända verifikationer
              </label>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-2 px-3 font-medium text-foreground">#</th>
                  <th className="text-left py-2 px-3 font-medium text-foreground">Date</th>
                  <th className="text-left py-2 px-3 font-medium text-foreground">Description</th>
                  <th className="text-right py-2 px-3 font-medium text-foreground">Amount</th>
                  <th className="text-center py-2 px-3 font-medium text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
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
                        <td className="py-2 px-3 font-mono text-secondary">
                          {voucher.voucherNumber}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{voucher.date}</td>
                        <td className="py-2 px-3 text-foreground">
                          <div>{voucher.description}</div>
                          {(voucher.reversesVoucherNumber || voucher.reversedByVoucherNumber) && (
                            <div className="text-[11px] text-amber-700">
                              {voucher.reversesVoucherNumber
                                ? `Vänder #${voucher.reversesVoucherNumber}`
                                : `Vänd av #${voucher.reversedByVoucherNumber}`}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium">
                          {formatAmount(total)} SEK
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVoucherClick(voucher);
                            }}
                          >
                            <Eye className="h-3 w-3 mr-1" />
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
