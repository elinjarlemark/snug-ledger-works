import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AccountingProvider } from "@/contexts/AccountingContext";
import { BillingProvider } from "@/contexts/BillingContext";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { EconomyLayout } from "@/components/layout/EconomyLayout";
import Index from "./pages/Index";
import PricingPage from "./pages/PricingPage";
import SupportPage from "./pages/SupportPage";
import AboutPage from "./pages/AboutPage";
import LoginPage from "./pages/LoginPage";
import CompanyPage from "./pages/CompanyPage";
import EconomyIndex from "./pages/economy/EconomyIndex";
import AccountingPage from "./pages/economy/AccountingPage";
import BillingPage from "./pages/economy/BillingPage";
import SalaryPage from "./pages/economy/SalaryPage";
import DeclarationPage from "./pages/economy/DeclarationPage";
import FinancialStatementsPage from "./pages/economy/FinancialStatementsPage";
import NewAnnualReportsPage from "./pages/economy/NewAnnualReportsPage";
import AccountsPage from "./pages/economy/AccountsPage";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AccountingProvider>
        <BillingProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public pages with header/footer */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Index />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/support" element={<SupportPage />} />
                <Route path="/about" element={<AboutPage />} />
              </Route>

              {/* Economy section with sidebar */}
              <Route path="/economy" element={<EconomyLayout />}>
                <Route index element={<EconomyIndex />} />
                <Route path="accounting" element={<AccountingPage />} />
                <Route path="billing" element={<BillingPage />} />
                <Route path="salary" element={<SalaryPage />} />
                <Route path="declaration" element={<DeclarationPage />} />
                <Route path="financial-statements" element={<FinancialStatementsPage />} />
                <Route path="annual-reports" element={<NewAnnualReportsPage />} />
                <Route path="accounts" element={<AccountsPage />} />
              </Route>

              {/* Company page */}
              <Route path="/company" element={<CompanyPage />} />

              {/* Admin page */}
              <Route path="/admin" element={<AdminPage />} />

              {/* Auth pages (standalone) */}
              <Route path="/login" element={<LoginPage />} />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </BillingProvider>
      </AccountingProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
