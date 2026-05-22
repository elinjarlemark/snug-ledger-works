import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  Shield,
  Receipt,
  Calculator,
  ListChecks,
  Settings,
  LogOut,
  User,
  ClipboardList,
  ChevronDown,
  Search,
  Check,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useChecklist } from "@/contexts/ChecklistContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface EconomySidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { name: "Overview", href: "/economy", icon: LayoutDashboard },
  { name: "Checklist", href: "/economy/checklist", icon: ListChecks },
  { name: "Accounting", href: "/economy/accounting", icon: BookOpen },
  { name: "Billing", href: "/economy/billing", icon: FileText },
  { name: "Receipts", href: "/economy/receipts", icon: Receipt },
  { name: "Salary", href: "/economy/salary", icon: Users },
  { name: "Declaration", href: "/economy/declaration", icon: FileCheck },
  { name: "Moms", href: "/economy/moms", icon: Calculator },
  { name: "VAT Report", href: "/economy/vat-report", icon: FileCheck },
  { name: "Financial Statements", href: "/economy/financial-statements", icon: BarChart3 },
  { name: "Annual Reports", href: "/economy/annual-reports", icon: FileText },
  { name: "Accounts", href: "/economy/accounts", icon: Wallet },
];

const MAX_COMPANIES_SHOWN = 5;

export function EconomySidebar({ collapsed, onToggle }: EconomySidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, companies, activeCompany, setActiveCompany } = useAuth();
  const { items: checklistItems } = useChecklist();
  const activeChecklistCount = checklistItems.filter((i) => !i.done).length;
  const [companySearch, setCompanySearch] = useState("");

  const isExpanded = !collapsed;

  const allNavItems = user?.role === "admin"
    ? [...navItems, { name: "Admin Panel", href: "/admin", icon: Shield }]
    : navItems;

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

  if (!user) {
    return (
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border z-40 transition-all duration-300 ease-in-out flex flex-col",
          collapsed ? "w-sidebar-collapsed" : "w-sidebar"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border shrink-0">
          <span className={cn("font-semibold text-sidebar-foreground transition-opacity duration-200", !isExpanded && "opacity-0 w-0 overflow-hidden")}>
            AccountPro
          </span>
          <Button variant="ghost" size="icon" onClick={onToggle} className="text-sidebar-foreground hover:bg-sidebar-accent shrink-0 h-8 w-8">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
        <div className={cn("flex-1 p-4 overflow-y-auto scrollbar-hide transition-opacity duration-200", !isExpanded && "opacity-0")}>
          <p className="text-sm text-sidebar-foreground/60">Log in to access economy tools.</p>
        </div>
        <div className={cn("p-3 border-t border-sidebar-border shrink-0", !isExpanded && "opacity-0")}>
          <Button variant="default" size="sm" className="w-full" asChild>
            <Link to="/login">Sign In</Link>
          </Button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border z-40 transition-all duration-300 ease-in-out flex flex-col",
        collapsed ? "w-sidebar-collapsed" : "w-sidebar"
      )}
    >
      {/* User section at top */}
      <div className={cn(
        "flex items-center gap-3 p-4 border-b border-sidebar-border shrink-0",
        collapsed && "justify-center px-2"
      )}>
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sidebar-primary/15 text-sidebar-primary shrink-0">
          <User className="h-4 w-4" />
        </div>
        <div className={cn("flex flex-col min-w-0 transition-opacity duration-200", !isExpanded && "opacity-0 w-0 overflow-hidden")}>
          <span className="text-sm font-semibold text-sidebar-foreground truncate">{user.name}</span>
          <span className="text-[11px] text-sidebar-foreground/50 truncate">{user.email}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onToggle} className={cn("text-sidebar-foreground/60 hover:bg-sidebar-accent shrink-0 h-7 w-7 ml-auto", !isExpanded && "hidden")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {collapsed && (
          <Button variant="ghost" size="icon" onClick={onToggle} className="text-sidebar-foreground/60 hover:bg-sidebar-accent shrink-0 h-7 w-7 absolute right-1 top-4">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Quick Actions (collapsed: show icon, expanded: show dropdown) */}
      {isExpanded && (
        <div className="px-3 pt-3 pb-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-sidebar-foreground/70 border-sidebar-border hover:bg-sidebar-accent">
                <Plus className="h-4 w-4" />
                Quick Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
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
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto scrollbar-hide">
        {isExpanded && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 px-3 pt-2 pb-1">Navigation</p>
        )}
        {allNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          const isChecklist = item.href === "/economy/checklist";
          const showBadge = isChecklist && activeChecklistCount > 0;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn("economy-sidebar-link group", !isExpanded && "justify-center px-0 gap-0", isActive && "active")}
              title={collapsed ? item.name : undefined}
            >
              <div className="relative shrink-0">
                <Icon className={cn("h-[18px] w-[18px]", isActive && "text-sidebar-primary")} />
                {showBadge && (
                  <span
                    className="absolute -top-1.5 -right-1.5 min-w-[1rem] h-4 px-1 flex items-center justify-center rounded-full text-[10px] font-bold bg-sidebar-primary text-sidebar-primary-foreground"
                    aria-label={`${activeChecklistCount} active checklist items`}
                  >
                    {activeChecklistCount > 99 ? "99+" : activeChecklistCount}
                  </span>
                )}
              </div>
              <span className={cn("transition-opacity duration-200 whitespace-nowrap", !isExpanded && "opacity-0 w-0 overflow-hidden")}>
                {item.name}
                {showBadge && isExpanded && (
                  <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sidebar-primary/15 text-sidebar-primary">
                    {activeChecklistCount}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Sticky bottom section: Settings */}
      <div className="shrink-0 border-t border-sidebar-border">
        {isExpanded && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 px-6 pt-3 pb-1">Settings</p>
        )}
        <div className="px-3 py-1 space-y-0.5">
          <Link
            to="/settings"
            className={cn(
              "economy-sidebar-link group",
              !isExpanded && "justify-center px-0 gap-0",
              location.pathname === "/settings" && "active"
            )}
            title={collapsed ? "Settings" : undefined}
          >
            <Settings className={cn("h-[18px] w-[18px] shrink-0", location.pathname === "/settings" && "text-sidebar-primary")} />
            <span className={cn("transition-opacity duration-200 whitespace-nowrap", !isExpanded && "opacity-0 w-0 overflow-hidden")}>
              Settings
            </span>
          </Link>
          <Link
            to="/audit-trail"
            className={cn(
              "economy-sidebar-link group",
              !isExpanded && "justify-center px-0 gap-0",
              location.pathname === "/audit-trail" && "active"
            )}
            title={collapsed ? "Audit Trail" : undefined}
          >
            <ClipboardList className={cn("h-[18px] w-[18px] shrink-0", location.pathname === "/audit-trail" && "text-sidebar-primary")} />
            <span className={cn("transition-opacity duration-200 whitespace-nowrap", !isExpanded && "opacity-0 w-0 overflow-hidden")}>
              Audit Trail
            </span>
          </Link>
        </div>

        {/* Sign out */}
        <div className="px-3 py-3">
          <button
            onClick={handleLogout}
            className={cn(
              "economy-sidebar-link group w-full text-destructive/70 hover:text-destructive hover:bg-destructive/5",
              !isExpanded && "justify-center px-0 gap-0"
            )}
            title={collapsed ? "Sign Out" : undefined}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span className={cn("transition-opacity duration-200 whitespace-nowrap", !isExpanded && "opacity-0 w-0 overflow-hidden")}>
              Sign Out
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
