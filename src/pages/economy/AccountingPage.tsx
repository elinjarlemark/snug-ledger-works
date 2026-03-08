import { useState, useLayoutEffect } from "react";
import { BookOpen, X, Plus, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useOutletContext, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Voucher } from "@/contexts/AccountingContext";
import { AccountingPanel } from "@/components/accounting/AccountingPanel";

export default function AccountingPage() {
  const { user } = useAuth();
  const location = useLocation();

  useLayoutEffect(() => {
    const forceScrollTop = () => {
      window.scrollTo({ top: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    forceScrollTop();
    const frame = requestAnimationFrame(forceScrollTop);

    return () => cancelAnimationFrame(frame);
  }, [location.key, location.pathname]);

  const [compareMode, setCompareMode] = useState(false);
  const [duplicateToRight, setDuplicateToRight] = useState<Voucher | null>(null);
  const [duplicateToLeft, setDuplicateToLeft] = useState<Voucher | null>(null);
  const [triggerCreate, setTriggerCreate] = useState(false);

  const autoOpenCreate = !!(location.state as any)?.openCreateVoucher || triggerCreate;
  const prefillVoucher = (location.state as any)?.prefillVoucher || null;

  const layoutContext = useOutletContext<{ setSidebarCollapsed?: (v: boolean) => void } | null>();

  const handleToggleCompare = () => {
    setCompareMode(true);
    layoutContext?.setSidebarCollapsed?.(true);
  };

  const handleExitCompare = () => {
    setCompareMode(false);
  };

  if (compareMode && user) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-secondary" />
            <h1 className="text-2xl font-bold text-foreground">Accounting — Compare</h1>
          </div>
          <Button variant="outline" onClick={handleExitCompare}>
            <X className="h-4 w-4 mr-2" />
            Exit Compare
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-border rounded-xl p-4 min-w-0">
            <AccountingPanel
              compact
              incomingDuplicate={duplicateToLeft}
              onClearIncomingDuplicate={() => setDuplicateToLeft(null)}
              onDuplicateToOther={(v) => setDuplicateToRight(v)}
            />
          </div>
          <div className="border border-border rounded-xl p-4 min-w-0">
            <AccountingPanel
              compact
              incomingDuplicate={duplicateToRight}
              onClearIncomingDuplicate={() => setDuplicateToRight(null)}
              onDuplicateToOther={(v) => setDuplicateToLeft(v)}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Accounting</h1>
          </div>
        </div>

        <section className="bg-primary/5 rounded-xl p-8 border border-primary/10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-2">Start Bookkeeping</h3>
              <Button asChild>
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const isFormOpen = autoOpenCreate || triggerCreate;

  return (
    <div className="space-y-4 animate-fade-in">
      {!isFormOpen && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Accounting</h1>
            </div>
          </div>
          <Button size="sm" onClick={() => setTriggerCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Create Voucher
          </Button>
        </div>
      )}

      <AccountingPanel
        autoOpenCreate={autoOpenCreate}
        onAutoOpenCreateConsumed={() => setTriggerCreate(false)}
        onToggleCompare={handleToggleCompare}
      />
    </div>
  );
}
