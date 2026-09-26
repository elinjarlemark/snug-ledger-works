import { useState } from "react";
import { Outlet } from "react-router-dom";
import { EconomySidebar } from "./EconomySidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronDown, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeSwitch } from "./ThemeSwitch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MAX_COMPANIES_SHOWN = 5;

export function SidebarShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { companies, activeCompany, setActiveCompany } = useAuth();
  const [companySearch, setCompanySearch] = useState("");

  const filteredCompanies = companies.filter(c => {
    if (!companySearch.trim()) return true;
    const q = companySearch.toLowerCase();
    return (c.companyName || "").toLowerCase().includes(q) || (c.organizationNumber || "").includes(q);
  });

  const showCompanySearch = companies.length > MAX_COMPANIES_SHOWN;
  const displayedCompanies = showCompanySearch ? filteredCompanies : companies.slice(0, MAX_COMPANIES_SHOWN);

  return (
    <div className="workspace min-h-screen flex">
      <EconomySidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main
        className={cn(
          "workspace-page min-w-0 flex-1 transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "ml-sidebar-collapsed" : "ml-sidebar"
        )}
      >
        {/* Top bar */}
        <div className="workspace-topbar sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="px-3 text-xs text-muted-foreground">Aktivt företag</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-foreground/70 hover:text-foreground">
                  <span className="text-sm font-medium truncate max-w-[180px]">
                    {activeCompany?.companyName || "Välj företag"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2">
                <p className="text-xs text-muted-foreground px-2 py-1 font-medium">Byt företag</p>
                {showCompanySearch && (
                  <div className="px-2 pb-1">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input
                        placeholder="Sök företag..."
                        aria-label="Sök företag"
                        value={companySearch}
                        onChange={(e) => setCompanySearch(e.target.value)}
                        className="h-7 pl-7 text-xs"
                      />
                    </div>
                  </div>
                )}
                {displayedCompanies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => setActiveCompany(company.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors text-left",
                      company.id === activeCompany?.id
                        ? "bg-sidebar-primary/10 text-sidebar-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    {company.id === activeCompany?.id && (
                      <Check className="h-4 w-4 shrink-0" />
                    )}
                    <div className={cn(company.id !== activeCompany?.id && "ml-6")}>
                      <p className="font-medium truncate">{company.companyName || "Namnlöst företag"}</p>
                      {company.organizationNumber && (
                        <p className="text-xs text-muted-foreground">{company.organizationNumber}</p>
                      )}
                    </div>
                  </button>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <ThemeSwitch />
        </div>

        <div className="workspace-content">
          <Outlet context={{ sidebarCollapsed, setSidebarCollapsed }} />
        </div>
      </main>
    </div>
  );
}
