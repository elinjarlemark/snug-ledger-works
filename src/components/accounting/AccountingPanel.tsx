import { useState, useEffect, useRef } from "react";
import { Plus, Eye, Calendar, Search, Lock, Columns2, Trash2 } from "lucide-react";
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

type TemplateKind = "standard" | "custom";

interface TemplateBuilderLine {
  id: string;
  accountNumber: string;
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
  const { vouchers, accounts } = useAccounting();
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
  const [templateBuilderKind, setTemplateBuilderKind] = useState<TemplateKind | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateLines, setTemplateLines] = useState<TemplateBuilderLine[]>([
    { id: crypto.randomUUID(), accountNumber: "" },
    { id: crypto.randomUUID(), accountNumber: "" },
  ]);
  const [savedTemplate, setSavedTemplate] = useState<StoredVoucherTemplate | null>(null);
  const [activeTemplateName, setActiveTemplateName] = useState("");

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
      setTemplateBuilderKind(null);
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
    setTemplateBuilderKind(null);
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
    setTemplateBuilderKind(null);
    setActiveTemplateName("");
  };

  const startManualVoucher = () => {
    setShowCreateChoice(false);
    setShowCreateForm(true);
    setDuplicatingVoucher(null);
    setTemplateBuilderKind(null);
    setActiveTemplateName("");
  };

  const startFromTemplate = (template: StoredVoucherTemplate) => {
    setShowCreateChoice(false);
    setTemplateBuilderKind(null);
    setActiveTemplateName(template.name);
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

  const resetTemplateBuilder = () => {
    setTemplateName("");
    setTemplateDescription("");
    setTemplateLines([
      { id: crypto.randomUUID(), accountNumber: "" },
      { id: crypto.randomUUID(), accountNumber: "" },
    ]);
    setSavedTemplate(null);
  };

  const startTemplateBuilder = (kind: TemplateKind) => {
    resetTemplateBuilder();
    setTemplateBuilderKind(kind);
    setShowCreateChoice(false);
    setShowCreateForm(false);
    setSelectedVoucher(null);
    setEditingVoucher(null);
    setDuplicatingVoucher(null);
  };

  const goBackToCreateChoice = () => {
    setTemplateBuilderKind(null);
    setShowCreateChoice(true);
    setShowCreateForm(false);
    setSelectedVoucher(null);
    setEditingVoucher(null);
    setDuplicatingVoucher(null);
    setActiveTemplateName("");
  };

  const updateTemplateLine = (lineId: string, accountNumber: string) => {
    setTemplateLines((currentLines) =>
      currentLines.map((line) => line.id === lineId ? { ...line, accountNumber } : line)
    );
    setSavedTemplate(null);
  };

  const addTemplateLine = () => {
    setTemplateLines((currentLines) => [...currentLines, { id: crypto.randomUUID(), accountNumber: "" }]);
    setSavedTemplate(null);
  };

  const removeTemplateLine = (lineId: string) => {
    if (templateLines.length <= 1) return;
    setTemplateLines((currentLines) => currentLines.filter((line) => line.id !== lineId));
    setSavedTemplate(null);
  };

  const buildTemplateFromForm = (): StoredVoucherTemplate | null => {
    const name = templateName.trim();
    const uniqueAccountNumbers = Array.from(new Set(templateLines.map((line) => line.accountNumber).filter(Boolean)));
    if (!name) {
      toast.error("Skriv ett namn på mallen");
      return null;
    }
    if (uniqueAccountNumbers.length === 0) {
      toast.error("Välj minst ett konto till mallen");
      return null;
    }

    return {
      id: crypto.randomUUID(),
      name,
      description: templateDescription.trim() || name,
      lines: uniqueAccountNumbers.map((accountNumber) => {
        const account = accounts.find((item) => item.number === accountNumber);
        return {
          accountNumber,
          accountName: account?.name || "",
          debit: 0,
          credit: 0,
        };
      }),
    };
  };

  const saveBuiltTemplate = () => {
    if (!templateBuilderKind) return;
    if (templateBuilderKind === "custom" && !activeCompany?.id) return;

    const template = buildTemplateFromForm();
    if (!template) return;

    const key = templateBuilderKind === "standard"
      ? STANDARD_VOUCHER_TEMPLATE_KEY
      : `${VOUCHER_TEMPLATE_KEY_PREFIX}${activeCompany?.id}`;
    const existing = JSON.parse(localStorage.getItem(key) ?? "[]");
    localStorage.setItem(key, JSON.stringify([...existing, template]));
    setSavedTemplate(template);
    loadVoucherTemplates();
    toast.success(templateBuilderKind === "standard" ? "Färdig mall sparad" : "Egen mall sparad");
  };

  const useSavedTemplate = () => {
    if (savedTemplate) {
      startFromTemplate(savedTemplate);
    }
  };


  const handleFormCancel = () => {
    setShowCreateForm(false);
    setEditingVoucher(null);
    setDuplicatingVoucher(null);
    setTemplateBuilderKind(null);
    setActiveTemplateName("");
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
      {templateBuilderKind && (
        <Card>
          <CardHeader>
            <CardTitle>
              {templateBuilderKind === "standard" ? "Skapa färdig mall" : "Skapa egen mall"}
            </CardTitle>
            <CardDescription>
              Välj bara mallens namn och vilka konton som ska fyllas i när mallen används.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Mallnamn</label>
                <Input
                  value={templateName}
                  onChange={(event) => {
                    setTemplateName(event.target.value);
                    setSavedTemplate(null);
                  }}
                  placeholder="Ex. Leverantörsfaktura"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Förifyllt namn på verifikation</label>
                <Input
                  value={templateDescription}
                  onChange={(event) => {
                    setTemplateDescription(event.target.value);
                    setSavedTemplate(null);
                  }}
                  placeholder="Lämna tomt för att använda mallnamnet"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Konton i mallen</label>
              <div className="space-y-2">
                {templateLines.map((line) => (
                  <div key={line.id} className="flex gap-2">
                    <select
                      value={line.accountNumber}
                      onChange={(event) => updateTemplateLine(line.id, event.target.value)}
                      className="h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Välj konto...</option>
                      {accounts.map((account) => (
                        <option key={account.number} value={account.number}>
                          {account.number} · {account.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTemplateLine(line.id)}
                      disabled={templateLines.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addTemplateLine}>
                <Plus className="h-4 w-4 mr-1" />
                Lägg till konto
              </Button>
            </div>

            {savedTemplate && (
              <div className="rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success">
                Mallen “{savedTemplate.name}” är sparad. Du kan använda den direkt eller skapa en ny mall.
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={goBackToCreateChoice}>
                Gå tillbaka
              </Button>
              {savedTemplate ? (
                <>
                  <Button variant="secondary" onClick={resetTemplateBuilder}>
                    Gör ny mall
                  </Button>
                  <Button onClick={useSavedTemplate}>
                    Använd mall
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={resetTemplateBuilder}>
                    Rensa
                  </Button>
                  <Button onClick={saveBuiltTemplate}>
                    Spara
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit/Duplicate Form */}
      {showCreateChoice && !showCreateForm && !editingVoucher && !templateBuilderKind && (
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
              <Button size="sm" variant="secondary" onClick={() => startTemplateBuilder("standard")}>
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
              <Button size="sm" variant="secondary" onClick={() => startTemplateBuilder("custom")}>
                Skapa egen mall
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(showCreateForm || editingVoucher) && !templateBuilderKind && (
        <VoucherForm
          onCancel={handleFormCancel}
          onSuccess={handleFormSuccess}
          editVoucher={editingVoucher || undefined}
          duplicateFrom={duplicatingVoucher || (prefillVoucher ? { ...prefillVoucher, voucherNumber: 0, date: new Date().toISOString().split("T")[0], lines: prefillVoucher.lines.map((l: any) => ({ ...l, id: crypto.randomUUID() })) } as Voucher : undefined)}
          templateName={activeTemplateName || undefined}
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
      {!showCreateForm && !showCreateChoice && !selectedVoucher && !editingVoucher && !templateBuilderKind && (
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
