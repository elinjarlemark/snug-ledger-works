import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface User {
  id: string;
  email: string;
  name: string;
}

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
};

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
    activeCompany.fiscalYearEnd.trim()
  );

  useEffect(() => {
    // Load from localStorage on mount
    const storedUser = localStorage.getItem("accountpro_user");
    const storedCompanies = localStorage.getItem("accountpro_companies");
    const storedActiveCompanyId = localStorage.getItem("accountpro_active_company");
    const storedFirstTime = localStorage.getItem("accountpro_first_time");
    
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      
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
    }
    setIsLoading(false);
  }, []);

  const saveCompanies = (newCompanies: CompanyProfile[]) => {
    setCompanies(newCompanies);
    localStorage.setItem("accountpro_companies", JSON.stringify(newCompanies));
  };

  const login = async (email: string, _password: string) => {
    // Simulated login - in production, this would validate with backend
    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      name: email.split("@")[0],
    };
    
    setUser(newUser);
    localStorage.setItem("accountpro_user", JSON.stringify(newUser));
    
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
      // Create a default company
      const defaultCompany: CompanyProfile = {
        ...DEFAULT_COMPANY_PROFILE,
        id: crypto.randomUUID(),
      };
      setCompanies([defaultCompany]);
      setActiveCompanyId(defaultCompany.id);
      localStorage.setItem("accountpro_companies", JSON.stringify([defaultCompany]));
      localStorage.setItem("accountpro_active_company", defaultCompany.id);
    }
  };

  const signup = async (email: string, _password: string, name: string) => {
    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      name,
    };
    
    setUser(newUser);
    localStorage.setItem("accountpro_user", JSON.stringify(newUser));
    
    // Create a default company but mark as first-time user
    const defaultCompany: CompanyProfile = {
      ...DEFAULT_COMPANY_PROFILE,
      id: crypto.randomUUID(),
    };
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
    const newCompanies = [...companies, newCompany];
    saveCompanies(newCompanies);
    // Also immediately set as active since saveCompanies is async
    setActiveCompanyId(newCompany.id);
    localStorage.setItem("accountpro_active_company", newCompany.id);
    return newCompany;
  };

  const updateCompany = (company: CompanyProfile) => {
    const newCompanies = companies.map(c => c.id === company.id ? company : c);
    saveCompanies(newCompanies);
  };

  const deleteCompany = (companyId: string) => {
    const newCompanies = companies.filter(c => c.id !== companyId);
    
    if (newCompanies.length === 0) {
      // Create a fresh empty company when deleting the last one
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
      // If deleted active company, switch to first remaining
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
