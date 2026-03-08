import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Check, ChevronDown, ClipboardList, Settings, Plus, FileText, BookOpen, Search } from "lucide-react";

const loggedInNavItems = [
  { name: "Settings", href: "/settings" },
  { name: "Economy", href: "/economy" },
];

const loggedOutNavItems = [
  { name: "Preview", href: "/preview" },
  { name: "About", href: "/about" },
  { name: "Pricing", href: "/pricing" },
  { name: "Contact", href: "/contact" },
];

const MAX_COMPANIES_SHOWN = 5;

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, companies, activeCompany, setActiveCompany } = useAuth();
  const [companySearch, setCompanySearch] = useState("");

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const filteredCompanies = companies.filter(c => {
    if (!companySearch.trim()) return true;
    const q = companySearch.toLowerCase();
    return (c.companyName || "").toLowerCase().includes(q) || (c.organizationNumber || "").includes(q);
  });

  const showCompanySearch = companies.length > MAX_COMPANIES_SHOWN;
  const displayedCompanies = showCompanySearch ? filteredCompanies : companies.slice(0, MAX_COMPANIES_SHOWN);

  return (
    <header className="sticky top-0 z-50 w-full h-header border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary">
              <span className="text-primary-foreground font-bold text-lg">A</span>
            </div>
            <span className="text-xl font-bold text-foreground">
              Account<span className="text-secondary">Pro</span>
            </span>
          </Link>

          {/* Quick Actions Dropdown */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-1 h-8 w-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => navigate("/economy/accounting", { state: { openCreateVoucher: true } })}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Create Voucher
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/economy/billing", { state: { openCreateInvoice: true } })}>
                  <FileText className="h-4 w-4 mr-2" />
                  Create Invoice
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <nav className="flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "nav-link",
                location.pathname.startsWith(item.href) && "active"
              )}
            >
              {item.name}
            </Link>
          ))}
          
          {user ? (
            <HoverCard openDelay={100} closeDelay={200}>
              <HoverCardTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  {user.name}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </HoverCardTrigger>
              <HoverCardContent className="w-64 p-2 bg-popover border border-border shadow-lg z-50" align="end">
                <div className="space-y-1">
                  {/* Switch Company */}
                  <p className="text-xs text-muted-foreground px-2 py-1">Switch Company</p>
                  {showCompanySearch && (
                    <div className="px-2 pb-1">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                          placeholder="Search companies..."
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
                          ? "bg-secondary/10 text-secondary"
                          : "hover:bg-muted"
                      )}
                    >
                      {company.id === activeCompany?.id && (
                        <Check className="h-4 w-4 shrink-0" />
                      )}
                      <div className={cn(company.id !== activeCompany?.id && "ml-6")}>
                        <p className="font-medium truncate">
                          {company.companyName || "Unnamed Company"}
                        </p>
                        {company.organizationNumber && (
                          <p className="text-xs text-muted-foreground">
                            {company.organizationNumber}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}

                  <div className="border-t border-border mt-2 pt-2 space-y-1">
                    <button
                      onClick={() => navigate("/audit-trail")}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-muted transition-colors"
                    >
                      <ClipboardList className="h-4 w-4 ml-6" />
                      Audit Trail
                    </button>
                    <button
                      onClick={() => navigate("/settings")}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-muted transition-colors"
                    >
                      <Settings className="h-4 w-4 ml-6" />
                      Settings
                    </button>
                  </div>

                  <div className="border-t border-border mt-2 pt-2">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-muted transition-colors text-destructive"
                    >
                      <LogOut className="h-4 w-4 ml-6" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            <Button variant="default" size="sm" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
