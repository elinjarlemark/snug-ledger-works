import { FileCheck, Lock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { scriptService } from "@/services/scripts/scriptService";

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

  if (!user) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
            <FileCheck className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Declaration</h1>
          </div>
        </div>

        <section className="bg-primary/5 rounded-xl p-6 border border-primary/10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground mb-2">Prepare Declarations</h3>
              <Button size="sm" asChild>
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
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
          <FileCheck className="h-5 w-5 text-secondary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Declaration</h1>
        </div>
      </div>

      <Card>
        <CardHeader className="py-3 pb-2">
          <CardTitle className="text-base">Generate Declaration</CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <Button onClick={handleCreateDeclaration} size="sm" className="gap-2">
            <Play className="h-3.5 w-3.5" />
            Create Declaration
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
