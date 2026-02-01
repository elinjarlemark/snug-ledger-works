import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { EconomySidebar } from "./EconomySidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export function EconomyLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, hasValidCompany, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only redirect logged-in users without valid company when trying to access sub-pages
    if (!isLoading && user && !hasValidCompany && location.pathname !== "/economy") {
      navigate("/company", { replace: true, state: { showCompanyRequiredAlert: true } });
    }
  }, [user, hasValidCompany, isLoading, navigate, location.pathname]);

  // Show nothing while checking or redirecting (only for logged-in users on sub-pages)
  if (!isLoading && user && !hasValidCompany && location.pathname !== "/economy") {
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
