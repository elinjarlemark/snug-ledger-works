import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Users,
  FileCheck,
  BarChart3,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Info,
  Shield,
  Receipt,
  Calculator,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface EconomySidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const sidebarItems = [
  { name: "Economy Overview", href: "/economy", icon: LayoutDashboard, description: "Dashboard & summary" },
  { name: "Checklist", href: "/economy/checklist", icon: ListChecks, description: "Saker att göra" },
  { name: "Accounting", href: "/economy/accounting", icon: BookOpen, description: "Core bookkeeping" },
  { name: "Billing", href: "/economy/billing", icon: FileText, description: "Invoices & payments" },
  { name: "Receipts", href: "/economy/receipts", icon: Receipt, description: "Manage receipts" },
  { name: "Salary", href: "/economy/salary", icon: Users, description: "Payroll management" },
  { name: "Declaration", href: "/economy/declaration", icon: FileCheck, description: "Tax declarations" },
  { name: "Moms", href: "/economy/moms", icon: Calculator, description: "Momsmodul (K2)" },
  { name: "VAT Report", href: "/economy/vat-report", icon: FileCheck, description: "Momsredovisning (klassisk)" },
  { name: "Financial Statements", href: "/economy/financial-statements", icon: BarChart3, description: "Reports & analysis" },
  { name: "Annual Reports", href: "/economy/annual-reports", icon: FileText, description: "Årsredovisning" },
  { name: "Accounts", href: "/economy/accounts", icon: Wallet, description: "Chart of accounts" },
];

export function EconomySidebar({ collapsed, onToggle }: EconomySidebarProps) {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = user?.role === "admin"
    ? [...sidebarItems, { name: "Admin Panel", href: "/admin", icon: Shield, description: "Manage users" }]
    : sidebarItems;

  const handleNavClick = (href: string) => {
    if (location.pathname !== href) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const isExpanded = !collapsed;

  // Not logged in
  if (!user) {
    return (
      <aside
        className={cn(
          "fixed left-0 top-header h-[calc(100vh-var(--header-height))] bg-sidebar border-r border-sidebar-border z-40 transition-all duration-300 ease-in-out flex flex-col",
          collapsed ? "w-sidebar-collapsed" : "w-sidebar"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border shrink-0">
          <span className={cn("font-semibold text-sidebar-foreground transition-opacity duration-200", !isExpanded && "opacity-0 w-0 overflow-hidden")}>
            Economy
          </span>
          <Button variant="ghost" size="icon" onClick={onToggle} className="text-sidebar-foreground hover:bg-sidebar-accent shrink-0">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
        <div className={cn("flex-1 p-4 overflow-y-auto scrollbar-hide transition-opacity duration-200", !isExpanded && "opacity-0")}>
          <div className="flex items-center gap-2 mb-4 text-sidebar-foreground">
            <Info className="h-5 w-5 text-secondary" />
            <span className="font-medium">About This Section</span>
          </div>
          <div className="space-y-4 text-sm text-sidebar-foreground/80">
            <p>The Economy module provides a complete suite of tools for Swedish business accounting.</p>
          </div>
        </div>
        <div className={cn("p-4 border-t border-sidebar-border transition-opacity duration-200 shrink-0", !isExpanded && "opacity-0")}>
          <Button variant="secondary" size="sm" className="w-full" asChild>
            <Link to="/login">Log In to Get Started</Link>
          </Button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-header h-[calc(100vh-var(--header-height))] bg-sidebar border-r border-sidebar-border z-40 transition-all duration-300 ease-in-out flex flex-col",
        "before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-b before:from-sidebar-primary/[0.04] before:via-transparent before:to-transparent before:pointer-events-none",
        collapsed ? "w-sidebar-collapsed" : "w-sidebar"
      )}
    >
      <div className="relative flex items-center justify-between p-4 border-b border-sidebar-border shrink-0">
        <span className={cn("font-semibold text-sidebar-foreground transition-opacity duration-200 whitespace-nowrap", !isExpanded && "opacity-0 w-0 overflow-hidden")}>
          Economy
        </span>
        <Button variant="ghost" size="icon" onClick={onToggle} className="text-sidebar-foreground hover:bg-sidebar-accent shrink-0 h-8 w-8">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="relative flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;

          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => handleNavClick(item.href)}
              className={cn("economy-sidebar-link group", !isExpanded && "justify-center px-0 gap-0", isActive && "active")}
              title={collapsed ? item.name : undefined}
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              <Icon className={cn(
                "h-5 w-5 shrink-0 transition-transform duration-200",
                "group-hover:scale-110",
                isActive && "text-sidebar-primary"
              )} />
              <div className={cn("flex flex-col transition-opacity duration-200 whitespace-nowrap min-w-0", !isExpanded && "opacity-0 w-0 overflow-hidden")}>
                <span className="text-sm">{item.name}</span>
                <span className="text-[11px] text-sidebar-foreground/55">{item.description}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className={cn("relative p-3 border-t border-sidebar-border transition-opacity duration-200 shrink-0", !isExpanded && "opacity-0 pointer-events-none")}>
        <Button variant="secondary" size="sm" className="w-full shadow-sm hover:shadow-glow transition-shadow" asChild>
          <Link to="/support">Get Support</Link>
        </Button>
      </div>
    </aside>
  );
}
