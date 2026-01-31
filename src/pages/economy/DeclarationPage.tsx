import { FileCheck, Receipt, Calendar, Send, Lock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { scriptService } from "@/services/scripts/scriptService";

const declarationFeatures = [
  {
    icon: Receipt,
    title: "VAT Declarations",
    description:
      "Prepare periodic VAT declarations based on your bookkeeping data. Automatically calculate input and output VAT.",
  },
  {
    icon: Calendar,
    title: "Period Management",
    description:
      "Handle monthly, quarterly, or annual declaration periods according to your registration with Skatteverket.",
  },
  {
    icon: FileCheck,
    title: "Pre-Declaration Review",
    description:
      "Review and validate all figures before submission. Ensure accuracy and identify any discrepancies.",
  },
  {
    icon: Send,
    title: "Submission Support",
    description:
      "Generate declarations in the format required for submission to Swedish tax authorities.",
  },
];

const declarationTypes = [
  {
    name: "Momsdeklaration",
    description: "Periodic VAT declaration",
    frequency: "Monthly/Quarterly",
  },
  {
    name: "Arbetsgivardeklaration",
    description: "Employer declaration",
    frequency: "Monthly",
  },
  {
    name: "Inkomstdeklaration",
    description: "Income tax declaration",
    frequency: "Annual",
  },
];

export default function DeclarationPage() {
  const { user } = useAuth();

  const handleCreateDeclaration = async () => {
    const result = await scriptService.runDeclarationScript();
    
    if (!result.success) {
      toast.error(result.message);
    } else {
      toast.success("Declaration created successfully");
    }
  };
  return (
    <div className="space-y-12 animate-fade-in">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
            <FileCheck className="h-6 w-6 text-secondary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Declaration</h1>
            <p className="text-muted-foreground">
              Tax declarations and regulatory compliance
            </p>
          </div>
        </div>
      </div>

      {/* Introduction */}
      <section className="info-section">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Simplified Tax Compliance
        </h2>
        <p className="text-muted-foreground mb-4">
          The Declaration module helps you prepare and submit required tax declarations to Swedish authorities. All declaration data is derived directly from your bookkeeping records.
        </p>
        <p className="text-muted-foreground">
          Ensure accuracy with pre-submission validation and maintain a complete history of all submitted declarations for audit purposes.
        </p>
      </section>

      {/* Features Grid */}
      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-6">
          Declaration Features
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {declarationFeatures.map((feature) => {
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

      {/* Declaration Types */}
      <section className="info-section">
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Supported Declarations
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {declarationTypes.map((type) => (
            <div
              key={type.name}
              className="bg-card rounded-lg p-4 border border-border"
            >
              <h3 className="font-semibold text-foreground mb-1">{type.name}</h3>
              <p className="text-sm text-muted-foreground mb-2">
                {type.description}
              </p>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary/10 text-secondary">
                {type.frequency}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Create Declaration Section - Only show when logged in */}
      {user ? (
        <Card>
          <CardHeader>
            <CardTitle>Generate Declaration</CardTitle>
            <CardDescription>
              Create a tax declaration based on your bookkeeping data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                The declaration will be generated using data from your accounting records.
                Make sure all transactions are recorded before generating.
              </p>
              <div>
                <Button onClick={handleCreateDeclaration} className="gap-2">
                  <Play className="h-4 w-4" />
                  Create Declaration
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <section className="bg-primary/5 rounded-xl p-8 border border-primary/10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Prepare Declarations
              </h3>
              <p className="text-muted-foreground mb-4">
                Sign in to prepare and review tax declarations. Generate accurate reports based on your bookkeeping data.
              </p>
              <Button asChild>
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
