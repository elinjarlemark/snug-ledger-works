import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authService, User } from "@/services/auth";

export type { User } from "@/services/auth";

export interface CompanyProfile {
  id: string;
  companyName: string;
  organizationNumber: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  vatNumber: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  accountingStandard: "K2" | "K3" | "";
}

export interface AuthContextType {
  user: User | null;
  companies: CompanyProfile[];
  activeCompany: CompanyProfile | null;
  isLoading: boolean;
  isFirstTimeUser: boolean;
  hasValidCompany: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  addCompany: (company: Omit<CompanyProfile, "id">) => CompanyProfile;
  updateCompany: (company: CompanyProfile) => void;
  deleteCompany: (companyId: string) => void;
  setActiveCompany: (companyId: string) => void;
  markCompanySetupComplete: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_COMPANY_PROFILE: Omit<CompanyProfile, "id"> = {
  companyName: "",
  organizationNumber: "",
  address: "",
  postalCode: "",
  city: "",
  country: "Sweden",
  vatNumber: "",
  fiscalYearStart: "01-01",
  fiscalYearEnd: "12-31",
  accountingStandard: "",
};

// Predefined company for test user (test@test.com)
const TEST_USER_COMPANY: Omit<CompanyProfile, "id"> = {
  companyName: "Test AB",
  organizationNumber: "012345-6789",
  address: "Test 1",
  postalCode: "12345",
  city: "Test",
  country: "Sweden",
  vatNumber: "",
  fiscalYearStart: "01-01",
  fiscalYearEnd: "12-31",
  accountingStandard: "K2",
};

const TEST_USER_EMAIL = "test@test.com";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const mapCompanyFromApi = (company: any): CompanyProfile => ({
  id: String(company.id),
  companyName: company.companyName ?? "",
  organizationNumber: company.organizationNumber ?? "",
  address: company.address ?? "",
  postalCode: company.postalCode ?? "",
  city: company.city ?? "",
  country: company.country ?? "Sweden",
  vatNumber: company.vatNumber ?? "",
  fiscalYearStart: company.fiscalYearStart ?? "01-01",
  fiscalYearEnd: company.fiscalYearEnd ?? "12-31",
  accountingStandard: company.accountingStandard === "K3" ? "K3" : company.accountingStandard === "K2" ? "K2" : "",
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);

  const activeCompany = companies.find(c => c.id === activeCompanyId) || null;
  
  // Check if the active company has all mandatory fields filled
  const hasValidCompany = !!(
    activeCompany &&
    activeCompany.companyName.trim() &&
    activeCompany.organizationNumber.trim() &&
    activeCompany.address.trim() &&
    activeCompany.postalCode.trim() &&
    activeCompany.city.trim() &&
    activeCompany.country.trim() &&
    activeCompany.fiscalYearStart.trim() &&
    activeCompany.fiscalYearEnd.trim() &&
    !!activeCompany.accountingStandard
  );

  useEffect(() => {
    // Load from localStorage on mount
    const storedUser = localStorage.getItem("accountpro_user");
    const storedCompanies = localStorage.getItem("accountpro_companies");
    const storedActiveCompanyId = localStorage.getItem("accountpro_active_company");
    const storedFirstTime = localStorage.getItem("accountpro_first_time");
    
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      
      if (storedCompanies) {
        const parsed = JSON.parse(storedCompanies);
        setCompanies(parsed);
        // Set active company
        if (storedActiveCompanyId && parsed.some((c: CompanyProfile) => c.id === storedActiveCompanyId)) {
          setActiveCompanyId(storedActiveCompanyId);
        } else if (parsed.length > 0) {
          setActiveCompanyId(parsed[0].id);
        }
      }
      
      if (storedFirstTime === "true") {
        setIsFirstTimeUser(true);
      }

      if (authService.isDatabaseConnected()) {
        fetch(`${API_BASE_URL}/companies?user_id=${parsedUser.id}`)
          .then((response) => response.json())
          .then((payload) => {
            const apiCompanies = Array.isArray(payload) ? payload.map(mapCompanyFromApi) : [];
            if (apiCompanies.length > 0) {
              setCompanies(apiCompanies);
              localStorage.setItem("accountpro_companies", JSON.stringify(apiCompanies));
              const storedActiveId = localStorage.getItem("accountpro_active_company");
              if (storedActiveId && apiCompanies.some((c) => c.id === storedActiveId)) {
                setActiveCompanyId(storedActiveId);
              } else {
                setActiveCompanyId(apiCompanies[0].id);
                localStorage.setItem("accountpro_active_company", apiCompanies[0].id);
              }
            }
          })
          .catch(() => undefined);
      }
    }
    setIsLoading(false);
  }, []);

  const saveCompanies = (newCompanies: CompanyProfile[]) => {
    setCompanies(newCompanies);
    localStorage.setItem("accountpro_companies", JSON.stringify(newCompanies));
  };

  const login = async (email: string, password: string) => {
    // Use the auth service for authentication
    const result = await authService.login(email, password);
    
    if (!result.success || !result.user) {
      throw new Error(result.error || "Login failed");
    }
    
    const newUser = result.user;
    setUser(newUser);
    localStorage.setItem("accountpro_user", JSON.stringify(newUser));
    
    // Check if this is the test user
    const isTestUser = email.toLowerCase() === TEST_USER_EMAIL;
    const isAdminUser = email.toLowerCase() === "admin@snug.local";
    
    if (authService.isDatabaseConnected()) {
      const response = await fetch(`${API_BASE_URL}/companies?user_id=${newUser.id}`);
      const payload = await response.json().catch(() => []);
      const apiCompanies = Array.isArray(payload) ? payload.map(mapCompanyFromApi) : [];
      if (apiCompanies.length > 0) {
        setCompanies(apiCompanies);
        const storedActiveId = localStorage.getItem("accountpro_active_company");
        if (storedActiveId && apiCompanies.some((c) => c.id === storedActiveId)) {
          setActiveCompanyId(storedActiveId);
        } else {
          setActiveCompanyId(apiCompanies[0].id);
        }
      } else {
        const defaultCompany: CompanyProfile = {
          ...(isTestUser ? TEST_USER_COMPANY : DEFAULT_COMPANY_PROFILE),
          id: crypto.randomUUID(),
        };
        const createResponse = await fetch(`${API_BASE_URL}/companies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: newUser.id,
            company_name: defaultCompany.companyName,
            organization_number: defaultCompany.organizationNumber,
            address: defaultCompany.address,
            postal_code: defaultCompany.postalCode,
            city: defaultCompany.city,
            country: defaultCompany.country,
            vat_number: defaultCompany.vatNumber,
            fiscal_year_start: defaultCompany.fiscalYearStart,
            fiscal_year_end: defaultCompany.fiscalYearEnd,
          }),
        });
        const created = await createResponse.json().catch(() => ({}));
        const createdCompany = {
          ...defaultCompany,
          id: String(created.id ?? defaultCompany.id),
        };
        setCompanies([createdCompany]);
        setActiveCompanyId(createdCompany.id);
      }
      return;
    }

    // Load or create companies
    const storedCompanies = localStorage.getItem("accountpro_companies");
    if (storedCompanies) {
      const parsed = JSON.parse(storedCompanies);
      setCompanies(parsed);
      const storedActiveId = localStorage.getItem("accountpro_active_company");
      if (storedActiveId && parsed.some((c: CompanyProfile) => c.id === storedActiveId)) {
        setActiveCompanyId(storedActiveId);
      } else if (parsed.length > 0) {
        setActiveCompanyId(parsed[0].id);
      }
    } else {
      // Create a default company - use predefined data for test user
      const defaultCompany: CompanyProfile = {
        ...(isTestUser ? TEST_USER_COMPANY : DEFAULT_COMPANY_PROFILE),
        id: crypto.randomUUID(),
      };
      if (isAdminUser) {
        localStorage.setItem("accountpro_active_company", defaultCompany.id);
      }
      setCompanies([defaultCompany]);
      setActiveCompanyId(defaultCompany.id);
      localStorage.setItem("accountpro_companies", JSON.stringify([defaultCompany]));
      localStorage.setItem("accountpro_active_company", defaultCompany.id);
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    // Use the auth service for signup
    const result = await authService.signup(email, password, name);
    
    if (!result.success || !result.user) {
      throw new Error(result.error || "Signup failed");
    }
    
    const newUser = result.user;
    setUser(newUser);
    localStorage.setItem("accountpro_user", JSON.stringify(newUser));
    
    // Create a default company but mark as first-time user
    const defaultCompany: CompanyProfile = {
      ...DEFAULT_COMPANY_PROFILE,
      id: crypto.randomUUID(),
    };
    if (authService.isDatabaseConnected()) {
      const createResponse = await fetch(`${API_BASE_URL}/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: newUser.id,
          company_name: defaultCompany.companyName,
          organization_number: defaultCompany.organizationNumber,
          address: defaultCompany.address,
          postal_code: defaultCompany.postalCode,
          city: defaultCompany.city,
          country: defaultCompany.country,
          vat_number: defaultCompany.vatNumber,
          fiscal_year_start: defaultCompany.fiscalYearStart,
          fiscal_year_end: defaultCompany.fiscalYearEnd,
          accounting_standard: defaultCompany.accountingStandard || null,
        }),
      });
      const created = await createResponse.json().catch(() => ({}));
      const createdCompany = {
        ...defaultCompany,
        id: String(created.id ?? defaultCompany.id),
      };
      setCompanies([createdCompany]);
      setActiveCompanyId(createdCompany.id);
      setIsFirstTimeUser(true);
      return;
    }

    setCompanies([defaultCompany]);
    setActiveCompanyId(defaultCompany.id);
    setIsFirstTimeUser(true);
    localStorage.setItem("accountpro_companies", JSON.stringify([defaultCompany]));
    localStorage.setItem("accountpro_active_company", defaultCompany.id);
    localStorage.setItem("accountpro_first_time", "true");
  };

  const markCompanySetupComplete = () => {
    setIsFirstTimeUser(false);
    localStorage.removeItem("accountpro_first_time");
  };

  const logout = () => {
    setUser(null);
    setCompanies([]);
    setActiveCompanyId(null);
    setIsFirstTimeUser(false);
    localStorage.removeItem("accountpro_user");
    localStorage.removeItem("accountpro_first_time");
  };

  const addCompany = (companyData: Omit<CompanyProfile, "id">) => {
    const newCompany: CompanyProfile = {
      ...companyData,
      id: crypto.randomUUID(),
    };
    if (authService.isDatabaseConnected() && user) {
      const previousActiveCompanyId = activeCompanyId;
      setCompanies((prevCompanies) => [...prevCompanies, newCompany]);
      setActiveCompanyId(newCompany.id);

      fetch(`${API_BASE_URL}/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          company_name: newCompany.companyName,
          organization_number: newCompany.organizationNumber,
          address: newCompany.address,
          postal_code: newCompany.postalCode,
          city: newCompany.city,
          country: newCompany.country,
          vat_number: newCompany.vatNumber,
          fiscal_year_start: newCompany.fiscalYearStart,
          fiscal_year_end: newCompany.fiscalYearEnd,
          accounting_standard: newCompany.accountingStandard || null,
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Failed to create company");
          }
          const created = await response.json().catch(() => ({}));
          const createdCompany = { ...newCompany, id: String(created.id ?? newCompany.id) };

          setCompanies((prevCompanies) => {
            const index = prevCompanies.findIndex((company) => company.id === newCompany.id);
            if (index === -1) {
              return [...prevCompanies, createdCompany];
            }
            const nextCompanies = [...prevCompanies];
            nextCompanies[index] = createdCompany;
            return nextCompanies;
          });
          setActiveCompanyId(createdCompany.id);
        })
        .catch(() => {
          setCompanies((prevCompanies) => {
            const filteredCompanies = prevCompanies.filter((company) => company.id !== newCompany.id);
            const canRestorePrevious =
              previousActiveCompanyId !== null &&
              filteredCompanies.some((company) => company.id === previousActiveCompanyId);

            if (canRestorePrevious) {
              setActiveCompanyId(previousActiveCompanyId);
            } else {
              setActiveCompanyId(filteredCompanies.length > 0 ? filteredCompanies[0].id : null);
            }
            return filteredCompanies;
          });
        });
      return newCompany;
    }

    const newCompanies = [...companies, newCompany];
    saveCompanies(newCompanies);
    setActiveCompanyId(newCompany.id);
    localStorage.setItem("accountpro_active_company", newCompany.id);
    return newCompany;
  };

  const updateCompany = (company: CompanyProfile) => {
    if (authService.isDatabaseConnected()) {
      fetch(`${API_BASE_URL}/companies/${company.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: company.companyName,
          organization_number: company.organizationNumber,
          address: company.address,
          postal_code: company.postalCode,
          city: company.city,
          country: company.country,
          vat_number: company.vatNumber,
          fiscal_year_start: company.fiscalYearStart,
          fiscal_year_end: company.fiscalYearEnd,
          accounting_standard: company.accountingStandard || null,
        }),
      });
      const newCompanies = companies.map(c => c.id === company.id ? company : c);
      setCompanies(newCompanies);
      return;
    }
    const newCompanies = companies.map(c => c.id === company.id ? company : c);
    saveCompanies(newCompanies);
  };

  const deleteCompany = (companyId: string) => {
    const newCompanies = companies.filter(c => c.id !== companyId);

    if (authService.isDatabaseConnected()) {
      fetch(`${API_BASE_URL}/companies/${companyId}`, { method: "DELETE" });
      setCompanies(newCompanies);
      if (newCompanies.length === 0) {
        setActiveCompanyId(null);
      } else if (activeCompanyId === companyId) {
        setActiveCompanyId(newCompanies[0].id);
      }
      return;
    }

    if (newCompanies.length === 0) {
      const freshCompany: CompanyProfile = {
        ...DEFAULT_COMPANY_PROFILE,
        id: crypto.randomUUID(),
      };
      saveCompanies([freshCompany]);
      setActiveCompanyId(freshCompany.id);
      localStorage.setItem("accountpro_active_company", freshCompany.id);
      setIsFirstTimeUser(true);
      localStorage.setItem("accountpro_first_time", "true");
    } else {
      saveCompanies(newCompanies);
      if (activeCompanyId === companyId) {
        setActiveCompanyId(newCompanies[0].id);
        localStorage.setItem("accountpro_active_company", newCompanies[0].id);
      }
    }
  };

  const setActiveCompany = (companyId: string) => {
    if (companies.some(c => c.id === companyId)) {
      setActiveCompanyId(companyId);
      localStorage.setItem("accountpro_active_company", companyId);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      companies,
      activeCompany,
      isLoading,
      isFirstTimeUser,
      hasValidCompany,
      login, 
      signup, 
      logout, 
      addCompany,
      updateCompany,
      deleteCompany,
      setActiveCompany,
      markCompanySetupComplete,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
