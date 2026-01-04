import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { User, LogOut, Building, Check, ChevronDown } from "lucide-react";

const navItems = [
  { name: "Economy", href: "/economy" },
  { name: "Pricing", href: "/pricing" },
  { name: "Support", href: "/support" },
  { name: "About", href: "/about" },
];

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, companies, activeCompany, setActiveCompany } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full h-header border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-full items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary">
            <span className="text-primary-foreground font-bold text-lg">A</span>
          </div>
          <span className="text-xl font-bold text-foreground">
            Account<span className="text-secondary">Pro</span>
          </span>
        </Link>

        <nav className="flex items-center gap-8">
          {user && (
            <HoverCard openDelay={100} closeDelay={200}>
              <HoverCardTrigger asChild>
                <Link
                  to="/company"
                  className={cn(
                    "nav-link flex items-center gap-1",
                    location.pathname.startsWith("/company") && "active"
                  )}
                >
                  Company
                  <ChevronDown className="h-3 w-3" />
                </Link>
              </HoverCardTrigger>
              <HoverCardContent className="w-64 p-2 bg-popover border border-border shadow-lg z-50" align="start">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground px-2 py-1">Switch Company</p>
                  {companies.map((company) => (
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
                  <div className="border-t border-border mt-2 pt-2">
                    <Link
                      to="/company"
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-muted transition-colors"
                    >
                      <Building className="h-4 w-4 ml-6" />
                      Manage Companies
                    </Link>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          )}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  {user.name}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover border border-border z-50">
                <DropdownMenuItem onClick={() => navigate("/company")}>
                  <Building className="mr-2 h-4 w-4" />
                  Company
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
