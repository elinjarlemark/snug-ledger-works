import { Link, useLocation } from "react-router-dom";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface EconomySidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const sidebarItems = [
  { name: "Economy Overview", href: "/economy", icon: LayoutDashboard, description: "Dashboard & summary" },
  { name: "Accounting", href: "/economy/accounting", icon: BookOpen, description: "Core bookkeeping" },
  { name: "Billing", href: "/economy/billing", icon: FileText, description: "Invoices & payments" },
  { name: "Receipts", href: "/economy/receipts", icon: Receipt, description: "Manage receipts" },
  { name: "Salary", href: "/economy/salary", icon: Users, description: "Payroll management" },
  { name: "Declaration", href: "/economy/declaration", icon: FileCheck, description: "Tax declarations" },
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
        collapsed ? "w-sidebar-collapsed" : "w-sidebar"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border shrink-0">
        <span className={cn("font-semibold text-sidebar-foreground transition-opacity duration-200 whitespace-nowrap", !isExpanded && "opacity-0 w-0 overflow-hidden")}>
          Economy
        </span>
        <Button variant="ghost" size="icon" onClick={onToggle} className="text-sidebar-foreground hover:bg-sidebar-accent shrink-0">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;

          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => handleNavClick(item.href)}
              className={cn("economy-sidebar-link", isActive && "active")}
              title={collapsed ? item.name : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <div className={cn("flex flex-col transition-opacity duration-200 whitespace-nowrap", !isExpanded && "opacity-0 w-0 overflow-hidden")}>
                <span className="text-sm">{item.name}</span>
                <span className="text-xs text-sidebar-foreground/60">{item.description}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className={cn("p-3 border-t border-sidebar-border transition-opacity duration-200 shrink-0", !isExpanded && "opacity-0 pointer-events-none")}>
        <Button variant="secondary" size="sm" className="w-full" asChild>
          <Link to="/support">Get Support</Link>
        </Button>
      </div>
    </aside>
  );
}
