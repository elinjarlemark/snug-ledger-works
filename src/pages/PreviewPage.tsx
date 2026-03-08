import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { EconomyLayout } from "@/components/layout/EconomyLayout";
import { AccountingProvider } from "@/contexts/AccountingContext";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

export default function PreviewPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 relative">
        {/* Demo/preview overlay */}
        <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-4 pointer-events-auto">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Preview Mode</h2>
            <p className="text-muted-foreground max-w-md">
              This is a preview of the AccountPro economy dashboard. Sign in or create an account to get started.
            </p>
            <div className="flex gap-3 justify-center">
              <Button asChild>
                <Link to="/login">Sign In</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/login">Create Account</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Blurred preview content */}
        <div className="pointer-events-none select-none" aria-hidden="true">
          <div className="container py-8 space-y-6">
            {/* Fake dashboard preview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["Total Revenue", "Expenses", "Net Result"].map((title) => (
                <div key={title} className="rounded-lg border border-border bg-card p-6">
                  <p className="text-sm text-muted-foreground">{title}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">SEK XX,XXX</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-card p-6 h-64">
                <p className="text-sm font-medium text-foreground mb-4">Recent Vouchers</p>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-border">
                      <div>
                        <p className="text-sm font-medium text-foreground">Voucher #{i}</p>
                        <p className="text-xs text-muted-foreground">2026-01-{String(i).padStart(2, '0')}</p>
                      </div>
                      <p className="text-sm text-foreground">SEK X,XXX</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-6 h-64">
                <p className="text-sm font-medium text-foreground mb-4">Account Overview</p>
                <div className="space-y-3">
                  {["1930 - Company Account", "2440 - Supplier Debts", "3000 - Revenue", "5010 - Salaries"].map((acc) => (
                    <div key={acc} className="flex justify-between items-center py-2 border-b border-border">
                      <p className="text-sm text-foreground">{acc}</p>
                      <p className="text-sm text-foreground">SEK X,XXX</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
