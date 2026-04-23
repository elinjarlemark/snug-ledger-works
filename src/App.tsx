import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AccountingProvider } from "@/contexts/AccountingContext";
import { BillingProvider } from "@/contexts/BillingContext";
import { AuditTrailProvider } from "@/contexts/AuditTrailContext";
import { FiscalLockProvider } from "@/contexts/FiscalLockContext";
import { ReceiptsProvider } from "@/contexts/ReceiptsContext";
import { VatProvider } from "@/contexts/VatContext";
import { VatPeriodLockProvider } from "@/contexts/VatPeriodLockContext";
import { ChecklistProvider } from "@/contexts/ChecklistContext";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { EconomyLayout } from "@/components/layout/EconomyLayout";
import { ScrollToTop } from "@/components/ScrollToTop";
import { RequireCompany } from '@/components/RequireCompany';
import { GlobalTakeoverListener } from "@/components/company/GlobalTakeoverListener";
import { MobileGate } from "@/components/mobile/MobileGate";
import MobileLanding from "./pages/mobile/MobileLanding";
import MobileUpload from "./pages/mobile/MobileUpload";

// Pages
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import CompanyGate from "./pages/CompanyGate";
import SettingsPage from "./pages/SettingsPage";
import EconomyIndex from "./pages/economy/EconomyIndex";
import AccountingPage from "./pages/economy/AccountingPage";
import BillingPage from "./pages/economy/BillingPage";
import SalaryPage from "./pages/economy/SalaryPage";
import DeclarationPage from "./pages/economy/DeclarationPage";
import FinancialStatementsPage from "./pages/economy/FinancialStatementsPage";
import NewAnnualReportsPage from "./pages/economy/NewAnnualReportsPage";
import AccountsPage from "./pages/economy/AccountsPage";
import ReceiptsPage from "./pages/economy/ReceiptsPage";
import VATReportPage from "./pages/economy/VATReportPage";
import MomsPage from "./pages/economy/MomsPage";
import ChecklistPage from "./pages/economy/ChecklistPage";
import AdminPage from "./pages/AdminPage";
import AuditTrailPage from "./pages/AuditTrailPage";
import PreviewPage from "./pages/PreviewPage";
import AboutPage from "./pages/AboutPage";
import PricingPage from "./pages/PricingPage";
import ContactPage from "./pages/ContactPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AccountingProvider>
        <BillingProvider>
          <AuditTrailProvider>
            <FiscalLockProvider>
              <ReceiptsProvider>
                <VatProvider>
                <VatPeriodLockProvider>
                <ChecklistProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <ScrollToTop />
                    <GlobalTakeoverListener />
                    <MobileGate />
                    <Routes>
                      {/* Mobile-only routes */}
                      <Route path="/mobile" element={<MobileLanding />} />
                      <Route path="/mobile/upload" element={<MobileUpload />} />

                      {/* Public pages with header/footer */}
                      <Route element={<PublicLayout />}>
                        <Route path="/" element={<Index />} />
                        <Route path="/about" element={<AboutPage />} />
                        <Route path="/pricing" element={<PricingPage />} />
                        <Route path="/contact" element={<ContactPage />} />
                      </Route>

                      {/* Preview */}
                      <Route path="/preview" element={<PreviewPage />} />

                      {/* Economy section with sidebar */}
                      <Route path='/economy' element={<RequireCompany><EconomyLayout /></RequireCompany>}>
                        <Route index element={<EconomyIndex />} />
                        <Route path="accounting" element={<AccountingPage />} />
                        <Route path="billing" element={<BillingPage />} />
                        <Route path="receipts" element={<ReceiptsPage />} />
                        <Route path="salary" element={<SalaryPage />} />
                        <Route path="declaration" element={<DeclarationPage />} />
                        <Route path="vat-report" element={<VATReportPage />} />
                        <Route path="moms" element={<MomsPage />} />
                        <Route path="financial-statements" element={<FinancialStatementsPage />} />
                        <Route path="annual-reports" element={<NewAnnualReportsPage />} />
                        <Route path="accounts" element={<AccountsPage />} />
                        <Route path="checklist" element={<ChecklistPage />} />
                      </Route>

                      {/* Settings */}
                      <Route path="/settings" element={<SettingsPage />} />

                      {/* Admin */}
                      <Route path="/admin" element={<AdminPage />} />

                      {/* Audit Trail */}
                      <Route path="/audit-trail" element={<AuditTrailPage />} />

                      {/* Auth */}
                      <Route path="/login" element={<LoginPage />} />
                      <Route path='/company-gate' element={<CompanyGate />} />

                      {/* Legacy redirect */}
                      <Route path="/company" element={<SettingsPage />} />

                      {/* Catch-all */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </BrowserRouter>
                </TooltipProvider>
                </ChecklistProvider>
                  </VatPeriodLockProvider>
                </VatProvider>
              </ReceiptsProvider>
            </FiscalLockProvider>
          </AuditTrailProvider>
        </BillingProvider>
      </AccountingProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
