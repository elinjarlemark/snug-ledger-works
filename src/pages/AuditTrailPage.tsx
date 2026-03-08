import { useAuditTrail } from "@/contexts/AuditTrailContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ClipboardList } from "lucide-react";

export default function AuditTrailPage() {
  const { user, activeCompany } = useAuth();
  const { entries } = useAuditTrail();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Audit Trail</h1>
                <p className="text-sm text-muted-foreground">
                  {activeCompany
                    ? `Actions for ${activeCompany.companyName || "Unnamed Company"}`
                    : "No company selected"}
                </p>
              </div>
            </div>
          </div>

          {!activeCompany ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
              Select a company in Settings to view its audit trail.
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-2.5 px-3 font-medium text-foreground">Time</th>
                    <th className="text-left py-2.5 px-3 font-medium text-foreground">User</th>
                    <th className="text-left py-2.5 px-3 font-medium text-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-muted-foreground text-sm">
                        No audit trail entries yet for this company.
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-border/50">
                        <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(entry.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">{entry.userName}</td>
                        <td className="py-2.5 px-3">{entry.description}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
