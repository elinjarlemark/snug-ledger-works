import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Receipt, ArrowRight, Smartphone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

export default function MobileLanding() {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/mobile/upload" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-hero text-primary-foreground flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center space-y-8">
        <div className="w-20 h-20 rounded-2xl bg-secondary/20 backdrop-blur-sm flex items-center justify-center border border-secondary/30">
          <Receipt className="h-10 w-10 text-secondary" />
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold leading-tight">
            Account<span className="text-secondary">Pro</span>
          </h1>
          <p className="text-lg text-primary-foreground/80 max-w-sm">
            Ladda upp kvitton snabbt och enkelt från din mobil.
          </p>
        </div>

        <div className="w-full max-w-xs space-y-3 pt-4">
          <Button variant="hero" size="xl" className="w-full" asChild>
            <Link to="/login">
              Logga in
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-2 text-sm text-primary-foreground/60 pt-8">
          <Smartphone className="h-4 w-4" />
          <span>Mobil-läge aktiverat</span>
        </div>
      </div>
    </div>
  );
}
