import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useAccounting } from "@/contexts/AccountingContexts";
import { useAuditTrail } from "@/contexts/AuditTrailContext";
import { authService } from "@/services/auth";
import { toast } from "sonner";
import { Building, Save, ArrowLeft, Plus, Trash2, Check, Upload, Download, User, Calendar, Lock, Unlock } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { TakeoverPopup } from "@/components/company/TakeoverPopup";
import { TakeoverListener } from "@/components/company/TakeoverListener";
import { JoinRequestsPanel } from "@/components/company/JoinRequestsPanel";
import { useFiscalLock } from "@/contexts/FiscalLockContext";
import { useAccounting as useAccountingMain } from "@/contexts/AccountingContext";

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:8000";

export default function SettingsPage() {
  const {
    user,
    companies,
    activeCompany,
    addCompany,
    updateCompany,
    deleteCompany,
    setActiveCompany,
    markCompanySetupComplete,
    deleteAccount,
  } = useAuth();

  const { importSIE, exportSIE, vouchers } = useAccounting();
  const { lockedYears, isYearLocked, lockYear, unlockYear } = useFiscalLock();
  const { vouchers: mainVouchers } = useAccountingMain();
  const { entries: auditEntries } = useAuditTrail();
  const navigate = useNavigate();

  const [isNewCompany, setIsNewCompany] = useState(false);
  const [originalCompanyId, setOriginalCompanyId] = useState<string | null>(null);
  const [showAccountingStandardConfirmAlert, setShowAccountingStandardConfirmAlert] = useState(false);
  const [pendingAccountingStandard, setPendingAccountingStandard] = useState<"K2" | "K3" | "" | null>(null);

  // Delete company flow states
  const [showDeleteCompanyConfirm, setShowDeleteCompanyConfirm] = useState(false);
  const [showDeleteCompanyExport, setShowDeleteCompanyExport] = useState(false);

  // Delete account flow states
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [showDeleteAccountBye, setShowDeleteAccountBye] = useState(false);

  // Personal settings
  const [personalNumber, setPersonalNumber] = useState("");

  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`accountpro_personal_number_${user.id}`);
      if (stored) setPersonalNumber(stored);
    }
  }, [user]);

  const [formData, setFormData] = useState({
    companyName: "",
    organizationNumber: "",
    address: "",
    postalCode: "",
    city: "",
    country: "Sweden",
    vatNumber: "",
    fiscalYearStart: "01-01",
    fiscalYearEnd: "12-31",
    accountingStandard: "" as "K2" | "K3" | "",
  });

  useEffect(() => {
    if (activeCompany) {
      setFormData({
        companyName: activeCompany.companyName,
        organizationNumber: activeCompany.organizationNumber,
        address: activeCompany.address,
        postalCode: activeCompany.postalCode,
        city: activeCompany.city,
        country: activeCompany.country,
        vatNumber: activeCompany.vatNumber,
        fiscalYearStart: activeCompany.fiscalYearStart,
        fiscalYearEnd: activeCompany.fiscalYearEnd,
        accountingStandard: activeCompany.accountingStandard,
      });
    }
  }, [activeCompany]);

  // Clean up unsaved company on unmount / navigate away
  useEffect(() => {
    return () => {
      if (isNewCompany && activeCompany && !activeCompany.organizationNumber) {
        deleteCompany(activeCompany.id);
        if (originalCompanyId) setActiveCompany(originalCompanyId);
      }
    };
  }, [isNewCompany, activeCompany, originalCompanyId]);

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  if (!user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany) return;

    if (!formData.companyName.trim()) { toast.error("Company name is required"); return; }
    const orgNumDigits = formData.organizationNumber.replace(/-/g, "");
    if (orgNumDigits.length !== 10 || !/^\d{10}$/.test(orgNumDigits)) { toast.error("Organization number must be exactly 10 digits"); return; }
    if (!formData.address.trim()) { toast.error("Address is required"); return; }
    if (!formData.postalCode.trim()) { toast.error("Postal code is required"); return; }
    if (!formData.city.trim()) { toast.error("City is required"); return; }
    if (!formData.country.trim()) { toast.error("Country is required"); return; }
    if (!formData.accountingStandard) { toast.error("Accounting standard (K2/K3) is required"); return; }

    updateCompany({ ...formData, id: activeCompany.id, accountingStandard: formData.accountingStandard || undefined } as any);
    setIsNewCompany(false);
    setOriginalCompanyId(null);
    markCompanySetupComplete();
    toast.success("Company saved successfully!");
  };

  const handleChange = (field: string, value: string) => {
    if (field === "accountingStandard") {
      const nextStandard = value as "K2" | "K3" | "";
      if (nextStandard && formData.accountingStandard && formData.accountingStandard !== nextStandard) {
        setPendingAccountingStandard(nextStandard);
        setShowAccountingStandardConfirmAlert(true);
        return;
      }
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleOrganizationNumberChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "");
    const limited = digitsOnly.slice(0, 10);
    let formatted = limited;
    if (limited.length > 6) formatted = limited.slice(0, 6) + '-' + limited.slice(6);
    setFormData((prev) => ({ ...prev, organizationNumber: formatted }));
  };

  const handlePersonalNumberChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "");
    const limited = digitsOnly.slice(0, 12);
    let formatted = limited;
    if (limited.length > 8) formatted = limited.slice(0, 8) + '-' + limited.slice(8);
    setPersonalNumber(formatted);
  };

  const handleSavePersonal = () => {
    const digits = personalNumber.replace(/-/g, "");
    if (digits.length !== 12) {
      toast.error("Personal number must be exactly 12 digits (XXXXXXXX-XXXX)");
      return;
    }
    localStorage.setItem(`accountpro_personal_number_${user.id}`, personalNumber);
    toast.success("Personal settings saved!");
  };

  const handleAddCompany = () => {
    if (isNewCompany) return;
    const previousId = activeCompany?.id || null;
    const newCompany = addCompany({
      companyName: "", organizationNumber: "", address: "", postalCode: "", city: "", country: "Sweden",
      vatNumber: "", fiscalYearStart: "01-01", fiscalYearEnd: "12-31", accountingStandard: "",
    });
    setActiveCompany(newCompany.id);
    setIsNewCompany(true);
    setOriginalCompanyId(previousId);
    toast.info("Fill in company details and save");
  };

  const handleSIEUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".se,.si,.sie";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const content = await file.text();
        const result = importSIE(content);
        if (result.success) {
          if (result.imported > 0) toast.success("Imported " + result.imported + " voucher(s) from SIE file");
          if (result.skipped > 0) toast.info("Skipped " + result.skipped + " duplicate voucher(s)");
          if (result.errors.length > 0) result.errors.forEach((err) => toast.warning(err));
        } else {
          toast.error("Failed to import SIE file");
          result.errors.forEach((err) => toast.error(err));
        }
      } catch { toast.error("Failed to read SIE file"); }
    };
    input.click();
  };

  const handleSIEExport = () => {
    if (!activeCompany) { toast.error("No company selected"); return; }
    if (vouchers.length === 0) { toast.error("No vouchers to export"); return; }
    const sieContent = exportSIE();
    const blob = new Blob([sieContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = (activeCompany.companyName || "company") + "_" + new Date().toISOString().split("T")[0] + ".se";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("SIE file exported successfully");
  };

  const handleCancelNewCompany = () => {
    if (isNewCompany && activeCompany) {
      deleteCompany(activeCompany.id);
      if (originalCompanyId) setActiveCompany(originalCompanyId);
      setIsNewCompany(false);
      setOriginalCompanyId(null);
    }
  };

  const handleDeleteCompanyConfirm = () => {
    setShowDeleteCompanyConfirm(false);
    setShowDeleteCompanyExport(true);
  };

  const handleDeleteCompanyExportAndComplete = () => {
    if (!activeCompany) return;

    // Export SIE file
    if (vouchers.length > 0) {
      const sieContent = exportSIE();
      const sieBlob = new Blob([sieContent], { type: "text/plain;charset=utf-8" });
      const sieUrl = URL.createObjectURL(sieBlob);
      const sieLink = document.createElement("a");
      sieLink.href = sieUrl;
      sieLink.download = (activeCompany.companyName || "company") + "_" + new Date().toISOString().split("T")[0] + ".se";
      document.body.appendChild(sieLink);
      sieLink.click();
      document.body.removeChild(sieLink);
      URL.revokeObjectURL(sieUrl);
    }

    // Export audit trail as text file
    if (auditEntries.length > 0) {
      const auditContent = auditEntries
        .map((e) => `[${new Date(e.timestamp).toLocaleString()}] ${e.userName}: ${e.description}`)
        .join("\n");
      const auditBlob = new Blob([auditContent], { type: "text/plain;charset=utf-8" });
      const auditUrl = URL.createObjectURL(auditBlob);
      const auditLink = document.createElement("a");
      auditLink.href = auditUrl;
      auditLink.download = (activeCompany.companyName || "company") + "_audit_trail_" + new Date().toISOString().split("T")[0] + ".txt";
      document.body.appendChild(auditLink);
      auditLink.click();
      document.body.removeChild(auditLink);
      URL.revokeObjectURL(auditUrl);
    }

    deleteCompany(activeCompany.id);
    setShowDeleteCompanyExport(false);
    toast.success("Company deleted");
  };

  const handleDeleteAccountConfirm = () => {
    setShowDeleteAccountConfirm(false);
    setShowDeleteAccountBye(true);
  };

  const handleDeleteAccountBye = async () => {
    setShowDeleteAccountBye(false);
    await deleteAccount();
    navigate("/");
  };

  const isExistingCompany = !!activeCompany && activeCompany.organizationNumber.replace(/-/g, "").length === 10;
  

  return (
    <>
      <AlertDialog open={showAccountingStandardConfirmAlert} onOpenChange={setShowAccountingStandardConfirmAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change accounting standard?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to change accounting standard (K2/K3)?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingAccountingStandard(null); setShowAccountingStandardConfirmAlert(false); }}>No</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingAccountingStandard) setFormData((prev) => ({ ...prev, accountingStandard: pendingAccountingStandard })); setPendingAccountingStandard(null); setShowAccountingStandardConfirmAlert(false); }}>Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen flex flex-col">
        <Header />
        {activeCompany && user && (
          <TakeoverListener companyId={activeCompany.id} userId={Number(user.id)} pollMs={2000} />
        )}
        <main className="flex-1 container py-8">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-foreground">Settings</h1>
                <p className="text-muted-foreground">Manage your company and personal settings</p>
              </div>
            </div>

            <Tabs defaultValue="company">
              <TabsList className="w-full">
                <TabsTrigger value="company" className="flex-1 gap-2">
                  <Building className="h-4 w-4" />
                  Company Settings
                </TabsTrigger>
                <TabsTrigger value="personal" className="flex-1 gap-2">
                  <User className="h-4 w-4" />
                  Personal Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="company" className="space-y-6 mt-6">
                {/* Company Switcher */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                          <Building className="h-5 w-5 text-secondary" />
                        </div>
                        <div>
                          <CardTitle>Active Company</CardTitle>
                          <CardDescription>Switch between your companies</CardDescription>
                        </div>
                      </div>
                      <Button onClick={handleAddCompany} variant="outline" size="sm" disabled={isNewCompany}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Company
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Select value={activeCompany?.id || ""} onValueChange={setActiveCompany}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a company" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            <div className="flex items-center gap-2">
                              {company.id === activeCompany?.id && <Check className="h-4 w-4 text-secondary" />}
                              <span>{company.companyName || "Unnamed Company"}</span>
                              {company.organizationNumber && (
                                <span className="text-muted-foreground text-sm">({company.organizationNumber})</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {activeCompany && (
                  <JoinRequestsPanel companyId={activeCompany.id} userId={String(user.id)} />
                )}

                {activeCompany && (
                  <TakeoverPopup companyId={activeCompany.id} userId={Number(user.id)} />
                )}

                {/* Company Details Form */}
                {activeCompany && (
                  <Card>
                    <CardHeader>
                      <div>
                          <CardTitle>Company Details</CardTitle>
                          <CardDescription>This information will be used in reports and invoices</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="companyName">Company Name *</Label>
                            <Input id="companyName" value={formData.companyName} onChange={(e) => handleChange("companyName", e.target.value)} placeholder="Your Company AB" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="organizationNumber">Organization Number *</Label>
                            <Input id="organizationNumber" value={formData.organizationNumber} onChange={(e) => handleOrganizationNumberChange(e.target.value)} placeholder="XXXXXX-XXXX" maxLength={11} required disabled={isExistingCompany} className={isExistingCompany ? "bg-muted cursor-not-allowed" : ""} />
                            {isExistingCompany ? (
                              <p className="text-xs text-muted-foreground">Organization number cannot be changed after creation</p>
                            ) : (
                              <p className="text-xs text-muted-foreground">{formData.organizationNumber.replace(/-/g, "").length}/10 digits</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="address">Street Address *</Label>
                          <Input id="address" value={formData.address} onChange={(e) => handleChange("address", e.target.value)} placeholder="Storgatan 1" />
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="postalCode">Postal Code *</Label>
                            <Input id="postalCode" value={formData.postalCode} onChange={(e) => handleChange("postalCode", e.target.value)} placeholder="123 45" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="city">City *</Label>
                            <Input id="city" value={formData.city} onChange={(e) => handleChange("city", e.target.value)} placeholder="Stockholm" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="country">Country *</Label>
                            <Input id="country" value={formData.country} onChange={(e) => handleChange("country", e.target.value)} placeholder="Sweden" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="vatNumber">VAT Number</Label>
                          <Input id="vatNumber" value={formData.vatNumber} onChange={(e) => handleChange("vatNumber", e.target.value)} placeholder="SE123456789001" />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="accountingStandard">Accounting Standard (K2/K3) *</Label>
                          <Select value={formData.accountingStandard || "none"} onValueChange={(value) => handleChange("accountingStandard", value === "none" ? "" : value)}>
                            <SelectTrigger id="accountingStandard">
                              <SelectValue placeholder="Choose K2 or K3" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Choose K2 or K3</SelectItem>
                              <SelectItem value="K2">K2</SelectItem>
                              <SelectItem value="K3">K3</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="fiscalYearStart">Fiscal Year Start</Label>
                            <Input id="fiscalYearStart" value={formData.fiscalYearStart} onChange={(e) => handleChange("fiscalYearStart", e.target.value)} placeholder="01-01" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="fiscalYearEnd">Fiscal Year End</Label>
                            <Input id="fiscalYearEnd" value={formData.fiscalYearEnd} onChange={(e) => handleChange("fiscalYearEnd", e.target.value)} placeholder="12-31" />
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <Button type="button" variant="outline" onClick={handleSIEUpload} className="flex-1">
                            <Upload className="h-4 w-4 mr-2" />
                            Import SIE
                          </Button>
                          <Button type="button" variant="outline" onClick={handleSIEExport} className="flex-1">
                            <Download className="h-4 w-4 mr-2" />
                            Export SIE
                          </Button>
                        </div>

                        <div className="flex gap-3">
                          {isNewCompany && (
                            <Button type="button" variant="outline" onClick={handleCancelNewCompany}>Cancel</Button>
                          )}
                          <Button type="submit" className="flex-1">
                            <Save className="mr-2 h-4 w-4" />
                            Save Changes
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {/* Räkenskapsår (Fiscal Years) */}
                {activeCompany && isExistingCompany && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-secondary" />
                        </div>
                        <div>
                          <CardTitle>Räkenskapsår</CardTitle>
                          <CardDescription>View and manage fiscal year locks</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        // Derive years from vouchers
                        const yearsFromVouchers = new Set<number>();
                        mainVouchers.forEach((v) => {
                          const year = new Date(v.date).getFullYear();
                          yearsFromVouchers.add(year);
                        });
                        // Also include any locked years
                        lockedYears.forEach((y) => yearsFromVouchers.add(y));
                        // Include current year
                        yearsFromVouchers.add(new Date().getFullYear());
                        const sortedYears = Array.from(yearsFromVouchers).sort((a, b) => b - a);

                        return (
                          <div className="bg-card rounded-lg border border-border overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border bg-muted/30">
                                  <th className="text-left py-2 px-3 font-medium text-foreground">Räkenskapsår</th>
                                  <th className="text-left py-2 px-3 font-medium text-foreground">Period</th>
                                  <th className="text-left py-2 px-3 font-medium text-foreground">Status</th>
                                  <th className="text-right py-2 px-3 font-medium text-foreground">Åtgärd</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedYears.map((year) => {
                                  const locked = isYearLocked(year);
                                  const start = formData.fiscalYearStart || "01-01";
                                  const end = formData.fiscalYearEnd || "12-31";
                                  return (
                                    <tr key={year} className="border-b border-border/50">
                                      <td className="py-2 px-3 font-medium text-foreground">{year}</td>
                                      <td className="py-2 px-3 text-muted-foreground">
                                        {year}-{start} — {year}-{end}
                                      </td>
                                      <td className="py-2 px-3">
                                        {locked ? (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive">
                                            <Lock className="h-3 w-3" /> Låst
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-success/10 text-success">
                                            <Unlock className="h-3 w-3" /> Öppet
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2 px-3 text-right">
                                        <Button
                                          variant={locked ? "outline" : "destructive"}
                                          size="sm"
                                          className="h-6 text-xs px-2"
                                          onClick={() => {
                                            if (locked) {
                                              unlockYear(year);
                                              toast.info(`Räkenskapsår ${year} upplåst`);
                                            } else {
                                              lockYear(year);
                                              toast.success(`Räkenskapsår ${year} låst`);
                                            }
                                          }}
                                        >
                                          {locked ? "Lås upp" : "Lås"}
                                        </Button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}

                {/* Delete Company */}
                {activeCompany && isExistingCompany && (
                  <Card className="border-destructive/30">
                    <CardHeader>
                      <CardTitle className="text-destructive">Delete Company</CardTitle>
                      <CardDescription>Permanently delete this company and all its data</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="destructive" onClick={() => setShowDeleteCompanyConfirm(true)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Company
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="personal" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-secondary" />
                      </div>
                      <div>
                        <CardTitle>Personal Information</CardTitle>
                        <CardDescription>Your personal account details</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={user.name || ""} disabled className="bg-muted cursor-not-allowed" />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input value={user.email} disabled className="bg-muted cursor-not-allowed" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="personalNumber">Personal Number (Personnummer) *</Label>
                      <Input
                        id="personalNumber"
                        value={personalNumber}
                        onChange={(e) => handlePersonalNumberChange(e.target.value)}
                        placeholder="XXXXXXXX-XXXX"
                        maxLength={13}
                      />
                      <p className="text-xs text-muted-foreground">
                        {personalNumber.replace(/-/g, "").length}/12 digits — Format: XXXXXXXX-XXXX
                      </p>
                    </div>

                    <Button onClick={handleSavePersonal}>
                      <Save className="mr-2 h-4 w-4" />
                      Save Personal Settings
                    </Button>
                  </CardContent>
                </Card>

                {/* Delete Account */}
                <Card className="border-destructive/30">
                  <CardHeader>
                    <CardTitle className="text-destructive">Delete Account</CardTitle>
                    <CardDescription>Permanently delete your personal account and all associated data</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="destructive" onClick={() => setShowDeleteAccountConfirm(true)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Personal Account
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
        <Footer />
      </div>

      {/* Delete Company - Confirm Dialog */}
      <AlertDialog open={showDeleteCompanyConfirm} onOpenChange={setShowDeleteCompanyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this company?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The company "{activeCompany?.companyName}" and all its data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCompanyConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Company - Export Dialog */}
      <AlertDialog open={showDeleteCompanyExport} onOpenChange={setShowDeleteCompanyExport}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export your data</AlertDialogTitle>
            <AlertDialogDescription>
              You will now get an export of your bookings in an SIE4 file and audit trail text file. The download will start when you press Complete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleDeleteCompanyExportAndComplete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Complete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account - Confirm Dialog */}
      <AlertDialog open={showDeleteAccountConfirm} onOpenChange={setShowDeleteAccountConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Your personal account and all associated data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccountConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account - Bye Dialog */}
      <AlertDialog open={showDeleteAccountBye} onOpenChange={setShowDeleteAccountBye}>
        <AlertDialogContent className="text-center">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl">We hope you come back! 👋</AlertDialogTitle>
            <AlertDialogDescription>
              Your account has been prepared for deletion. Click the button below to finalize.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="justify-center sm:justify-center">
            <AlertDialogAction onClick={handleDeleteAccountBye}>BYE</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
