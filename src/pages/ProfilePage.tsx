import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Building, Save, ArrowLeft } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function ProfilePage() {
  const { user, companyProfile, updateCompanyProfile } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    companyName: companyProfile?.companyName || "",
    organizationNumber: companyProfile?.organizationNumber || "",
    address: companyProfile?.address || "",
    postalCode: companyProfile?.postalCode || "",
    city: companyProfile?.city || "",
    country: companyProfile?.country || "Sweden",
    vatNumber: companyProfile?.vatNumber || "",
    fiscalYearStart: companyProfile?.fiscalYearStart || "01-01",
    fiscalYearEnd: companyProfile?.fiscalYearEnd || "12-31",
  });

  if (!user) {
    navigate("/login");
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompanyProfile(formData);
    toast.success("Company profile updated successfully!");
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Company Profile</h1>
              <p className="text-muted-foreground">Manage your company information</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Building className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <CardTitle>Company Details</CardTitle>
                  <CardDescription>
                    This information will be used in reports and invoices
                  </CardDescription>
                </div>
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
                    <Label htmlFor="organizationNumber">Organization Number</Label>
                    <Input
                      id="organizationNumber"
                      value={formData.organizationNumber}
                      onChange={(e) => handleChange("organizationNumber", e.target.value)}
                      placeholder="XXXXXX-XXXX"
                    />
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

                <Button type="submit" className="w-full">
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
