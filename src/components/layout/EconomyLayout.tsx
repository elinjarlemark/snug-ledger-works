import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Header } from "./Header";
import { EconomySidebar } from "./EconomySidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export function EconomyLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, hasValidCompany, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect logged-in users without valid company from ALL economy routes
    if (!isLoading && user && !hasValidCompany) {
      navigate("/company", { replace: true, state: { showCompanyRequiredAlert: true } });
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
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
