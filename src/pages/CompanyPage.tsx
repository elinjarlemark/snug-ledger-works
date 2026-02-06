import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useAuth, CompanyProfile } from "@/contexts/AuthContext";
import { useAccounting } from "@/contexts/AccountingContexts";
import { toast } from "sonner";
import { Building, Save, ArrowLeft, Plus, Trash2, Check, Upload, Download } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function CompanyPage() {
  const { user, companies, activeCompany, addCompany, updateCompany, deleteCompany, setActiveCompany, isFirstTimeUser, markCompanySetupComplete } = useAuth();
  const { importSIE, exportSIE } = useAccounting();
  const navigate = useNavigate();
  const location = useLocation();
  const [isNewCompany, setIsNewCompany] = useState(false);
  const [originalCompanyId, setOriginalCompanyId] = useState<string | null>(null);
  const [showCompanyRequiredAlert, setShowCompanyRequiredAlert] = useState(false);
  
  // Check if we were redirected because company is required
  useEffect(() => {
    if (location.state?.showCompanyRequiredAlert) {
      setShowCompanyRequiredAlert(true);
      // Clear the state so it doesn't show again on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  
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
      });
    }
  }, [activeCompany]);

  if (!user) {
    navigate("/login");
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany) return;
    
    // Validate mandatory fields (all except VAT number)
    if (!formData.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    
    // Validate organization number: must be exactly 10 digits (formatted as XXXXXX-XXXX)
    const orgNumDigits = formData.organizationNumber.replace(/-/g, "");
    if (orgNumDigits.length !== 10 || !/^\d{10}$/.test(orgNumDigits)) {
      toast.error("Organization number must be exactly 10 digits");
      return;
    }
    
    if (!formData.address.trim()) {
      toast.error("Address is required");
      return;
    }
    
    if (!formData.postalCode.trim()) {
      toast.error("Postal code is required");
      return;
    }
    
    if (!formData.city.trim()) {
      toast.error("City is required");
      return;
    }
    
    if (!formData.country.trim()) {
      toast.error("Country is required");
      return;
    }
    
    updateCompany({
      ...formData,
      id: activeCompany.id,
    });
    setIsNewCompany(false);
    setOriginalCompanyId(null);
    markCompanySetupComplete();
    toast.success("Company saved successfully!");
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleOrganizationNumberChange = (value: string) => {
    // Remove all non-digits
    const digitsOnly = value.replace(/\D/g, "");
    
    // Limit to 10 digits
    const limited = digitsOnly.slice(0, 10);
    
    // Format with hyphen after 6 digits
    let formatted = limited;
    if (limited.length > 6) {
      formatted = `${limited.slice(0, 6)}-${limited.slice(6)}`;
    }
    
    setFormData(prev => ({ ...prev, organizationNumber: formatted }));
  };

  const handleAddCompany = () => {
    // Don't store original - we switch to new company immediately
    const newCompany = addCompany({
      companyName: "",
      organizationNumber: "",
      address: "",
      postalCode: "",
      city: "",
      country: "Sweden",
      vatNumber: "",
      fiscalYearStart: "01-01",
      fiscalYearEnd: "12-31",
    });
    setActiveCompany(newCompany.id);
    setIsNewCompany(true);
    setOriginalCompanyId(null);
    toast.info("Fill in company details and save");
  };

  const handleSIEUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".se,.si,.sie";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const content = await file.text();
          const result = importSIE(content);
          
          if (result.success) {
            if (result.imported > 0) {
              toast.success(`Imported ${result.imported} voucher(s) from SIE file`);
            }
            if (result.skipped > 0) {
              toast.info(`Skipped ${result.skipped} duplicate voucher(s)`);
            }
            if (result.errors.length > 0) {
              result.errors.forEach(err => toast.warning(err));
            }
          } else {
            toast.error("Failed to import SIE file");
            result.errors.forEach(err => toast.error(err));
          }
        } catch (error) {
          toast.error("Failed to read SIE file");
        }
      }
    };
    input.click();
  };

  const handleSIEExport = () => {
    if (!activeCompany) {
      toast.error("No company selected");
      return;
    }
    
    if (vouchers.length === 0) {
      toast.error("No vouchers to export");
      return;
    }

    const sieContent = exportSIE();
    const blob = new Blob([sieContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeCompany.companyName || "company"}_${new Date().toISOString().split('T')[0]}.se`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("SIE file exported successfully");
  };

  const handleCancelNewCompany = () => {
    if (isNewCompany && activeCompany) {
      deleteCompany(activeCompany.id);
      if (originalCompanyId) {
        setActiveCompany(originalCompanyId);
      }
      setIsNewCompany(false);
      setOriginalCompanyId(null);
    }
  };

  const handleDeleteCompany = () => {
    if (!activeCompany) return;
    
    deleteCompany(activeCompany.id);
    toast.success("Company deleted");
  };

  // Check if this is an existing saved company (has org number saved)
  const isExistingCompany = activeCompany && activeCompany.organizationNumber.replace(/-/g, "").length === 10;

  return (
    <>
      <AlertDialog open={showCompanyRequiredAlert} onOpenChange={setShowCompanyRequiredAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Company Required</AlertDialogTitle>
            <AlertDialogDescription>
              You need to add a company before you can visit the Economy page. Please fill in all mandatory company details and save.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowCompanyRequiredAlert(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-8">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-foreground">Company</h1>
                <p className="text-muted-foreground">Manage your companies</p>
              </div>
            </div>

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
                      <CardDescription>
                        Switch between your companies
                      </CardDescription>
                    </div>
                  </div>
                  <Button onClick={handleAddCompany} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Company
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Select
                  value={activeCompany?.id || ""}
                  onValueChange={setActiveCompany}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        <div className="flex items-center gap-2">
                          {company.id === activeCompany?.id && (
                            <Check className="h-4 w-4 text-secondary" />
                          )}
                          <span>{company.companyName || "Unnamed Company"}</span>
                          {company.organizationNumber && (
                            <span className="text-muted-foreground text-sm">
                              ({company.organizationNumber})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Company Details Form */}
            {activeCompany && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Company Details</CardTitle>
                      <CardDescription>
                        This information will be used in reports and invoices
                      </CardDescription>
                    </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-destructive hover:text-destructive"
                    onClick={handleDeleteCompany}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyName">Company Name</Label>
                        <Input
                          id="companyName"
                          value={formData.companyName}
                          onChange={(e) => handleChange("companyName", e.target.value)}
                          placeholder="Your Company AB"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="organizationNumber">Organization Number *</Label>
                        <Input
                          id="organizationNumber"
                          value={formData.organizationNumber}
                          onChange={(e) => handleOrganizationNumberChange(e.target.value)}
                          placeholder="XXXXXX-XXXX"
                          maxLength={11}
                          required
                          disabled={isExistingCompany}
                          className={isExistingCompany ? "bg-muted cursor-not-allowed" : ""}
                        />
                        {isExistingCompany ? (
                          <p className="text-xs text-muted-foreground">
                            Organization number cannot be changed after creation
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {formData.organizationNumber.replace(/-/g, "").length}/10 digits
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Street Address</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => handleChange("address", e.target.value)}
                        placeholder="Storgatan 1"
                      />
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">Postal Code</Label>
                        <Input
                          id="postalCode"
                          value={formData.postalCode}
                          onChange={(e) => handleChange("postalCode", e.target.value)}
                          placeholder="123 45"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => handleChange("city", e.target.value)}
                          placeholder="Stockholm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          value={formData.country}
                          onChange={(e) => handleChange("country", e.target.value)}
                          placeholder="Sweden"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="vatNumber">VAT Number</Label>
                      <Input
                        id="vatNumber"
                        value={formData.vatNumber}
                        onChange={(e) => handleChange("vatNumber", e.target.value)}
                        placeholder="SE123456789001"
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fiscalYearStart">Fiscal Year Start</Label>
                        <Input
                          id="fiscalYearStart"
                          value={formData.fiscalYearStart}
                          onChange={(e) => handleChange("fiscalYearStart", e.target.value)}
                          placeholder="01-01"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fiscalYearEnd">Fiscal Year End</Label>
                        <Input
                          id="fiscalYearEnd"
                          value={formData.fiscalYearEnd}
                          onChange={(e) => handleChange("fiscalYearEnd", e.target.value)}
                          placeholder="12-31"
                        />
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
                        <Button type="button" variant="outline" onClick={handleCancelNewCompany}>
                          Cancel
                        </Button>
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
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
