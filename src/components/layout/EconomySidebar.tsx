import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, FileText, Users, FileCheck, BarChart3, Wallet, ChevronLeft, ChevronRight, Shield, Receipt, Calculator, ListChecks, Settings, LogOut, User, ClipboardList, MessageSquare, Plus, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useChecklist } from "@/contexts/ChecklistContext";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface EconomySidebarProps { collapsed: boolean; onToggle: () => void; }

const groups = [
  { label: "Översikt", items: [
    { name: "Översikt", href: "/economy", icon: LayoutDashboard },
    { name: "Checklista", href: "/economy/checklist", icon: ListChecks },
  ] },
  { label: "Löpande arbete", items: [
    { name: "Bokföring", href: "/economy/accounting", icon: BookOpen },
    { name: "Fakturering", href: "/economy/billing", icon: FileText },
    { name: "Kvitton", href: "/economy/receipts", icon: Receipt },
    { name: "Löner", href: "/economy/salary", icon: Users },
  ] },
  { label: "Rapporter & avslut", items: [
    { name: "Moms", href: "/economy/moms", icon: Calculator },
    { name: "Momsrapport", href: "/economy/vat-report", icon: FileCheck },
    { name: "Deklaration", href: "/economy/declaration", icon: FileCheck },
    { name: "Finansiella rapporter", href: "/economy/financial-statements", icon: BarChart3 },
    { name: "Årsredovisning", href: "/economy/annual-reports", icon: FileText },
    { name: "Konton", href: "/economy/accounts", icon: Wallet },
  ] },
  { label: "Administration", items: [
    { name: "Kommentarer", href: "/comments", icon: MessageSquare },
    { name: "Ändringslogg", href: "/audit-trail", icon: ClipboardList },
    { name: "Inställningar", href: "/settings", icon: Settings },
  ] },
];

export function EconomySidebar({ collapsed, onToggle }: EconomySidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { items } = useChecklist();
  const count = items.filter(item => !item.done).length;
  return (
    <aside className={cn("workspace-sidebar fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar transition-[width] duration-200", collapsed ? "w-sidebar-collapsed" : "w-sidebar")}>
      <div className={cn("flex shrink-0 items-center gap-2 px-5 py-5", collapsed && "justify-center px-2")}>
        {!collapsed && <Link to="/economy" className="min-w-0 flex-1 text-lg font-semibold tracking-tight text-foreground">Account<span className="text-primary">Pro</span></Link>}
        <Button variant="ghost" size="icon" onClick={onToggle} aria-label={collapsed ? "Visa meny" : "Fäll ihop meny"} className="h-8 w-8 shrink-0 text-muted-foreground">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      {user ? <>
        <div className="px-3 pb-2">
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" aria-label="Snabbåtgärder" className={cn("w-full gap-2", collapsed ? "px-0" : "justify-start")}><Plus className="h-4 w-4" />{!collapsed && "Snabbåtgärder"}</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => navigate("/economy/accounting", { state: { openCreateVoucher: true } })}><BookOpen className="mr-2 h-4 w-4" />Ny verifikation</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/economy/billing", { state: { openCreateInvoice: true } })}><FileText className="mr-2 h-4 w-4" />Ny faktura</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <nav aria-label="Huvudnavigation" className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {groups.map((group, index) => <div key={group.label} className={cn(index > 0 && "mt-4")}>
            {!collapsed && index > 0 && <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{group.label}</p>}
            {group.items.map(({ name, href, icon: Icon }) => {
              const active = pathname === href;
              const badge = href === "/economy/checklist" && count > 0;
              return <Link key={href} to={href} aria-current={active ? "page" : undefined} aria-label={collapsed ? name : undefined} title={collapsed ? name : undefined} className={cn("economy-sidebar-link", active && "active", collapsed && "justify-center px-0")}>
                <span className="relative shrink-0"><Icon className="h-4 w-4" aria-hidden="true" />{badge && collapsed && <span className="absolute -right-2 -top-2 rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{count > 99 ? "99+" : count}</span>}</span>
                {!collapsed && <><span className="min-w-0 flex-1">{name}</span>{badge && <span className="rounded-full bg-sidebar-accent px-1.5 text-xs tabular-nums text-sidebar-primary">{count > 99 ? "99+" : count}</span>}</>}
              </Link>;
            })}
          </div>)}
          {user.role === "admin" && <Link to="/admin" aria-label="Adminpanel" title={collapsed ? "Adminpanel" : undefined} aria-current={pathname === "/admin" ? "page" : undefined} className={cn("economy-sidebar-link mt-1", pathname === "/admin" && "active", collapsed && "justify-center px-0")}><Shield className="h-4 w-4 shrink-0" />{!collapsed && "Adminpanel"}</Link>}
        </nav>
        <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
          {!collapsed && <div className="mb-2 flex items-center gap-2 px-3"><User className="h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{user.name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div></div>}
          <button type="button" aria-label="Logga ut" title={collapsed ? "Logga ut" : undefined} className={cn("economy-sidebar-link w-full", collapsed && "justify-center px-0")} onClick={() => { logout(); navigate("/"); }}><LogOut className="h-4 w-4" />{!collapsed && "Logga ut"}</button>
        </div>
      </> : <div className="px-3"><p className={cn("mb-4 text-sm text-muted-foreground", collapsed && "sr-only")}>Logga in för att komma åt ekonomiverktygen.</p><Button asChild size="sm"><Link to="/login" aria-label="Logga in">{collapsed ? <User className="h-4 w-4" /> : "Logga in"}</Link></Button></div>}
    </aside>
  );
}
