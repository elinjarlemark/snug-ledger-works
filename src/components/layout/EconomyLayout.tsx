import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { EconomySidebar } from "./EconomySidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { useUnlockOnTabClose } from "@/hooks/useUnlockOnTabClose";


export function EconomyLayout() {
	useInactivityLogout();
	useUnlockOnTabClose();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, hasValidCompany, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/economy/accounting") {
      const forceScrollTop = () => {
        window.scrollTo({ top: 0, behavior: "instant" });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      };

      forceScrollTop();
      const frame = requestAnimationFrame(forceScrollTop);

      return () => cancelAnimationFrame(frame);
    }
  }, [location.key, location.pathname]);

  useEffect(() => {
    // Redirect logged-in users without valid company from ALL economy routes
    if (!isLoading && user && !hasValidCompany) {
      navigate("/settings", { replace: true, state: { showCompanyRequiredAlert: true } });
    }
  }, [user, hasValidCompany, isLoading, navigate]);

  // Show nothing while checking or redirecting
  if (!isLoading && user && !hasValidCompany) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1">
        <EconomySidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main
          className={cn(
            "flex-1 transition-all duration-300 ease-in-out",
            sidebarCollapsed ? "ml-sidebar-collapsed" : "ml-sidebar"
          )}
        >
          <div className="container py-8">
            <Outlet context={{ sidebarCollapsed, setSidebarCollapsed }} />
          </div>
        </main>
      </div>
    </div>
  );
}
