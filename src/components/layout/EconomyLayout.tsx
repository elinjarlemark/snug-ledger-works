import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { EconomySidebar } from "./EconomySidebar";
import { cn } from "@/lib/utils";

export function EconomyLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
