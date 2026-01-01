import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface CompanyProfile {
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

interface AuthContextType {
  user: User | null;
  companyProfile: CompanyProfile | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  updateCompanyProfile: (profile: CompanyProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
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
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage on mount
    const storedUser = localStorage.getItem("accountpro_user");
    const storedProfile = localStorage.getItem("accountpro_company_profile");
    
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setCompanyProfile(storedProfile ? JSON.parse(storedProfile) : DEFAULT_COMPANY_PROFILE);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, _password: string) => {
    // Simulated login - in production, this would validate with backend
    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      name: email.split("@")[0],
    };
    
    setUser(newUser);
    localStorage.setItem("accountpro_user", JSON.stringify(newUser));
    
    // Load or create company profile
    const storedProfile = localStorage.getItem("accountpro_company_profile");
    if (storedProfile) {
      setCompanyProfile(JSON.parse(storedProfile));
    } else {
      setCompanyProfile(DEFAULT_COMPANY_PROFILE);
      localStorage.setItem("accountpro_company_profile", JSON.stringify(DEFAULT_COMPANY_PROFILE));
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
    setCompanyProfile(DEFAULT_COMPANY_PROFILE);
    localStorage.setItem("accountpro_company_profile", JSON.stringify(DEFAULT_COMPANY_PROFILE));
  };

  const logout = () => {
    setUser(null);
    setCompanyProfile(null);
    localStorage.removeItem("accountpro_user");
  };

  const updateCompanyProfile = (profile: CompanyProfile) => {
    setCompanyProfile(profile);
    localStorage.setItem("accountpro_company_profile", JSON.stringify(profile));
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      companyProfile, 
      isLoading, 
      login, 
      signup, 
      logout, 
      updateCompanyProfile 
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
