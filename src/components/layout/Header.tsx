import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { name: "Economy", href: "/economy" },
  { name: "Pricing", href: "/pricing" },
  { name: "Support", href: "/support" },
  { name: "About", href: "/about" },
];

export function Header() {
  const location = useLocation();

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
          <Button variant="default" size="sm" asChild>
            <Link to="/login">Sign In</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
