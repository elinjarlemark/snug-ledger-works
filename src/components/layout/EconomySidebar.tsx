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
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface EconomySidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const sidebarItems = [
  {
    name: "Economy Overview",
    href: "/economy",
    icon: LayoutDashboard,
    description: "Dashboard & summary",
  },
  {
    name: "Accounting",
    href: "/economy/accounting",
    icon: BookOpen,
    description: "Core bookkeeping",
  },
  {
    name: "Billing",
    href: "/economy/billing",
    icon: FileText,
    description: "Invoices & payments",
  },
  {
    name: "Salary",
    href: "/economy/salary",
    icon: Users,
    description: "Payroll management",
  },
  {
    name: "Declaration",
    href: "/economy/declaration",
    icon: FileCheck,
    description: "Tax declarations",
  },
  {
    name: "Financial Statements",
    href: "/economy/financial-statements",
    icon: BarChart3,
    description: "Reports & analysis",
  },
  {
    name: "Annual Reports",
    href: "/economy/annual-reports",
    icon: FileText,
    description: "Årsredovisning",
  },
  {
    name: "Accounts",
    href: "/economy/accounts",
    icon: Wallet,
    description: "Chart of accounts",
  },
];

export function EconomySidebar({ collapsed, onToggle }: EconomySidebarProps) {
  const location = useLocation();

  return (
    <aside
      className={cn(
        "fixed left-0 top-header h-[calc(100vh-var(--header-height))] bg-sidebar border-r border-sidebar-border z-40 transition-all duration-300 ease-in-out flex flex-col",
        collapsed ? "w-sidebar-collapsed" : "w-sidebar",
        collapsed && "hover:w-sidebar group"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border shrink-0">
        <span
          className={cn(
            "font-semibold text-sidebar-foreground transition-opacity duration-200",
            collapsed ? "opacity-0 group-hover:opacity-100" : "opacity-100"
          )}
        >
          Economy
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="text-sidebar-foreground hover:bg-sidebar-accent shrink-0"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn("economy-sidebar-link", isActive && "active")}
              title={collapsed ? item.name : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <div
                className={cn(
                  "flex flex-col transition-opacity duration-200",
                  collapsed ? "opacity-0 group-hover:opacity-100" : "opacity-100"
                )}
              >
                <span className="text-sm">{item.name}</span>
                <span className="text-xs text-sidebar-foreground/60">
                  {item.description}
                </span>
              </div>
            </Link>
          );
        })}
        
        {/* Extra space at the bottom for scrolling - 1 option height */}
        <div className="h-16"></div>
      </nav>

      <div
        className={cn(
          "p-4 border-t border-sidebar-border transition-opacity duration-200 shrink-0",
          collapsed ? "opacity-0 group-hover:opacity-100" : "opacity-100"
        )}
      >
        <div className="rounded-lg bg-sidebar-accent p-4">
          <p className="text-sidebar-foreground text-sm font-medium mb-2">
            Need help?
          </p>
          <p className="text-sidebar-foreground/60 text-xs mb-3">
            Check our documentation or contact support.
          </p>
          <Button variant="secondary" size="sm" className="w-full" asChild>
            <Link to="/support">Get Support</Link>
          </Button>
        </div>
      </div>
    </aside>
  );
}
