import { FileText, Lock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { scriptService } from "@/services/scripts/scriptService";

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
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Annual Reports</h1>
          </div>
        </div>

        <section className="bg-primary/5 rounded-xl p-8 border border-primary/10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-2">Create Annual Reports</h3>
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Annual Reports</h1>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Annual Report</CardTitle>
          <CardDescription>
            Create annual report from your financial statements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleCreateAnnualReport} className="gap-2">
            <Play className="h-4 w-4" />
            Create Annual Report
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
