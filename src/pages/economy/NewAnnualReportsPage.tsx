import { FileText, Lock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { scriptService } from "@/services/scripts/scriptService";

const annualReportFeatures = [
  {
    title: "Automated Generation",
    description: "Generate complete annual reports based on your financial data from the Financial Statements module.",
  },
  {
    title: "Compliance Ready",
    description: "Reports formatted according to Swedish accounting standards (K2/K3) and Bokföringsnämndens guidelines.",
  },
  {
    title: "Management Report",
    description: "Includes förvaltningsberättelse with key business information and significant events.",
  },
  {
    title: "Notes & Appendices",
    description: "Automatic generation of required notes and supplementary information.",
  },
];

export default function NewAnnualReportsPage() {
  const { user } = useAuth();

  const handleCreateAnnualReport = async () => {
    const result = await scriptService.runAnnualReportScript();
    
    if (!result.success) {
      toast.error(result.message);
    } else {
      toast.success("Annual report created successfully");
    }
  };

  if (!user) {
    return (
      <div className="space-y-12 animate-fade-in">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Annual Reports</h1>
              <p className="text-muted-foreground">Generate official annual reports for filing</p>
            </div>
          </div>
        </div>

        <section className="bg-primary/5 rounded-xl p-8 border border-primary/10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-2">Create Annual Reports</h3>
              <p className="text-muted-foreground mb-4">
                Sign in to generate and manage your official annual reports (Årsredovisning).
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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
            <FileText className="h-6 w-6 text-secondary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Annual Reports</h1>
            <p className="text-muted-foreground">Generate official annual reports (Årsredovisning)</p>
          </div>
        </div>
      </div>

      {/* Create Annual Report Card */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Annual Report</CardTitle>
          <CardDescription>
            Create a complete annual report based on your financial statements and company data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              The annual report will be generated using data from your Financial Statements. 
              Make sure all transactions are recorded and verified before generating the report.
            </p>
            <div>
              <Button onClick={handleCreateAnnualReport} className="gap-2">
                <Play className="h-4 w-4" />
                Create Annual Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-6">
          Annual Report Features
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {annualReportFeatures.map((feature) => (
            <div key={feature.title} className="feature-card">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Info Section */}
      <section className="info-section">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          About Annual Reports
        </h2>
        <p className="text-muted-foreground mb-4">
          The annual report (Årsredovisning) is a legally required document that summarizes your company's 
          financial position and performance for the fiscal year. It must be filed with Bolagsverket within 
          7 months of the fiscal year end.
        </p>
        <p className="text-muted-foreground">
          This module generates reports that comply with Swedish accounting law (Årsredovisningslagen) 
          and the applicable K-regulations from Bokföringsnämnden.
        </p>
      </section>
    </div>
  );
}
