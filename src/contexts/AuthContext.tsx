// src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { authService, User } from '@/services/auth';
import { unlockCompany } from "@/lib/api";

export type { User } from '@/services/auth';

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
  accountingStandard: 'K2' | 'K3' | '';
  invoiceBookingAccount?: string;
}

export interface PendingSignup {
  email: string;
  password: string;
  name: string;
}

export interface AuthContextType {
  user: User | null;
  companies: CompanyProfile[];
  activeCompany: CompanyProfile | null;
  isLoading: boolean;
  isFirstTimeUser: boolean;
  hasValidCompany: boolean;

  login: (email: string, password: string) => Promise<void>;

  pendingSignup: PendingSignup | null;
  beginSignup: (email: string, password: string, name: string) => void;
  cancelSignup: () => void;

  // pending-signup completion flows
  completeSignupWithCompany: (company: Omit<CompanyProfile, 'id'>) => Promise<void>;
  completeSignupWithJoin: (organizationNumber: string) => Promise<void>;

  // legacy (kept for compatibility; can remove later)
  completeSignupAndCreateCompany: (company: Omit<CompanyProfile, 'id'>) => Promise<void>;
  completeSignupAndJoinCompany: (organizationNumber: string) => Promise<void>;

  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  deleteAccount: () => Promise<void>;

  addCompany: (company: Omit<CompanyProfile, 'id'>) => CompanyProfile;
  updateCompany: (company: CompanyProfile) => void;
  deleteCompany: (companyId: string) => void;
  setActiveCompany: (companyId: string) => void;

  markCompanySetupComplete: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PENDING_SIGNUP_KEY = 'accountpro_pending_signup';

const DEFAULT_COMPANY_PROFILE: Omit<CompanyProfile, 'id'> = {
  companyName: '',
  organizationNumber: '',
  address: '',
  postalCode: '',
  city: '',
  country: 'Sweden',
  vatNumber: '',
  fiscalYearStart: '01-01',
  fiscalYearEnd: '12-31',
  accountingStandard: '',
};

// Predefined company for test user (test@test.com)
const TEST_USER_COMPANY: Omit<CompanyProfile, 'id'> = {
  companyName: 'Test AB',
  organizationNumber: '012345-6789',
  address: 'Test 1',
  postalCode: '12345',
  city: 'Test',
  country: 'Sweden',
  vatNumber: '',
  fiscalYearStart: '01-01',
  fiscalYearEnd: '12-31',
  accountingStandard: 'K2',
};

const TEST_USER_EMAIL = 'test@test.com';
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:8000';

const mapCompanyFromApi = (company: any): CompanyProfile => ({
  id: String(company.id),
  companyName: company.companyName ?? '',
  organizationNumber: company.organizationNumber ?? '',
  address: company.address ?? '',
  postalCode: company.postalCode ?? '',
  city: company.city ?? '',
  country: company.country ?? 'Sweden',
  vatNumber: company.vatNumber ?? '',
  fiscalYearStart: company.fiscalYearStart ?? '01-01',
  fiscalYearEnd: company.fiscalYearEnd ?? '12-31',
  accountingStandard:
    company.accountingStandard === 'K3' ? 'K3' : company.accountingStandard === 'K2' ? 'K2' : '',
});

const toCompanyRequestBody = (company: Omit<CompanyProfile, 'id'>, userId?: string | number) => {
  const numericUserId = Number(userId);

  return {
    ...(Number.isFinite(numericUserId) ? { user_id: numericUserId } : {}),
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
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(null);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) || null;

  const companiesRef = useRef<CompanyProfile[]>([]);
  const companyUpdateControllersRef = useRef<Record<string, AbortController | undefined>>({});

  useEffect(() => {
    companiesRef.current = companies;
  }, [companies]);

  const upsertCompanyOnServer = (companyId: string, company: Omit<CompanyProfile, 'id'>) => {
    const previousController = companyUpdateControllersRef.current[companyId];
    if (previousController) {
      previousController.abort();
    }

    const controller = new AbortController();
    companyUpdateControllersRef.current[companyId] = controller;

    return fetch(API_BASE_URL + '/companies/' + companyId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toCompanyRequestBody(company)),
      signal: controller.signal,
    })
      .catch((error) => {
        if (error?.name === 'AbortError') {
          return;
        }
        throw error;
      })
      .finally(() => {
        if (companyUpdateControllersRef.current[companyId] === controller) {
          delete companyUpdateControllersRef.current[companyId];
        }
      });
  };

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
    const storedPending = localStorage.getItem(PENDING_SIGNUP_KEY);
    if (storedPending) {
      try {
        const parsedPending = JSON.parse(storedPending);
        if (parsedPending?.email && parsedPending?.password && parsedPending?.name) {
          setPendingSignup(parsedPending);
        }
      } catch {
        localStorage.removeItem(PENDING_SIGNUP_KEY);
      }
    }

    const storedUser = localStorage.getItem('accountpro_user');
    const storedCompanies = localStorage.getItem('accountpro_companies');
    const storedActiveCompanyId = localStorage.getItem('accountpro_active_company');
    const storedFirstTime = localStorage.getItem('accountpro_first_time');

    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);

      if (storedCompanies) {
        const parsed = JSON.parse(storedCompanies);
        setCompanies(parsed);

        if (storedActiveCompanyId && parsed.some((c: CompanyProfile) => c.id === storedActiveCompanyId)) {
          setActiveCompanyId(storedActiveCompanyId);
        } else if (parsed.length > 0) {
          setActiveCompanyId(parsed[0].id);
        }
      }

      if (storedFirstTime === 'true') {
        setIsFirstTimeUser(true);
      }

      if (authService.isDatabaseConnected()) {
        fetch(API_BASE_URL + '/companies?user_id=' + parsedUser.id)
          .then((response) => response.json())
          .then((payload) => {
            const apiCompanies = Array.isArray(payload) ? payload.map(mapCompanyFromApi) : [];
            setCompanies(apiCompanies);
            localStorage.setItem('accountpro_companies', JSON.stringify(apiCompanies));

            if (apiCompanies.length > 0) {
              const storedActiveId = localStorage.getItem('accountpro_active_company');
              if (storedActiveId && apiCompanies.some((c) => c.id === storedActiveId)) {
                setActiveCompanyId(storedActiveId);
              } else {
                setActiveCompanyId(apiCompanies[0].id);
                localStorage.setItem('accountpro_active_company', apiCompanies[0].id);
              }
            } else {
              setActiveCompanyId(null);
              localStorage.removeItem('accountpro_active_company');
            }
          })
          .catch(() => undefined);
      }
    }

    setIsLoading(false);
  }, []);

  const saveCompanies = (newCompanies: CompanyProfile[]) => {
    setCompanies(newCompanies);
    localStorage.setItem('accountpro_companies', JSON.stringify(newCompanies));
  };

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);

    if (!result.success || !result.user) {
      throw new Error(result.error || 'Login failed');
    }

    const newUser = result.user;
    setUser(newUser);
    localStorage.setItem('accountpro_user', JSON.stringify(newUser));

    const isTestUser = email.toLowerCase() === TEST_USER_EMAIL;
    const isAdminUser = email.toLowerCase() === 'admin@snug.local';

    if (authService.isDatabaseConnected()) {
      try {
        const response = await fetch(API_BASE_URL + '/companies?user_id=' + newUser.id);
        const payload = await response.json().catch(() => []);
        const apiCompanies = Array.isArray(payload) ? payload.map(mapCompanyFromApi) : [];

        if (apiCompanies.length > 0) {
          setCompanies(apiCompanies);
          localStorage.setItem('accountpro_companies', JSON.stringify(apiCompanies));

          const storedActiveId = localStorage.getItem('accountpro_active_company');
          if (storedActiveId && apiCompanies.some((c) => c.id === storedActiveId)) {
            setActiveCompanyId(storedActiveId);
          } else {
            setActiveCompanyId(apiCompanies[0].id);
            localStorage.setItem('accountpro_active_company', apiCompanies[0].id);
          }
        } else {
          setCompanies([]);
          setActiveCompanyId(null);
          localStorage.setItem('accountpro_companies', JSON.stringify([]));
          localStorage.removeItem('accountpro_active_company');
        }
        return;
      } catch {
        // Fallback to local state in Lovable/local mode when backend is unreachable.
      }
    }

    const storedCompanies = localStorage.getItem('accountpro_companies');
    if (storedCompanies) {
      const parsed = JSON.parse(storedCompanies);
      setCompanies(parsed);
      const storedActiveId = localStorage.getItem('accountpro_active_company');
      if (storedActiveId && parsed.some((c: CompanyProfile) => c.id === storedActiveId)) {
        setActiveCompanyId(storedActiveId);
      } else if (parsed.length > 0) {
        setActiveCompanyId(parsed[0].id);
      }
    } else {
      const defaultCompany: CompanyProfile = {
        ...(isTestUser ? TEST_USER_COMPANY : DEFAULT_COMPANY_PROFILE),
        id: crypto.randomUUID(),
      };
      if (isAdminUser) {
        localStorage.setItem('accountpro_active_company', defaultCompany.id);
      }
      setCompanies([defaultCompany]);
      setActiveCompanyId(defaultCompany.id);
      localStorage.setItem('accountpro_companies', JSON.stringify([defaultCompany]));
      localStorage.setItem('accountpro_active_company', defaultCompany.id);
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    const result = await authService.signup(email, password, name);

    if (!result.success || !result.user) {
      throw new Error(result.error || 'Signup failed');
    }

    const newUser = result.user;
    setUser(newUser);
    localStorage.setItem('accountpro_user', JSON.stringify(newUser));

    const defaultCompany: CompanyProfile = {
      ...DEFAULT_COMPANY_PROFILE,
      id: crypto.randomUUID(),
    };

    if (authService.isDatabaseConnected()) {
      const createResponse = await fetch(API_BASE_URL + '/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    localStorage.setItem('accountpro_companies', JSON.stringify([defaultCompany]));
    localStorage.setItem('accountpro_active_company', defaultCompany.id);
    localStorage.setItem('accountpro_first_time', 'true');
  };

  const markCompanySetupComplete = () => {
    setIsFirstTimeUser(false);
    localStorage.removeItem('accountpro_first_time');
  };

	const logout = () => {
		const currentUser = user;
		const currentCompanyId = activeCompanyId;

		// Best-effort unlock innan vi rensar state
		if (authService.isDatabaseConnected() && currentUser && currentCompanyId) {
			unlockCompany(currentCompanyId, currentUser.id).catch(() => undefined);
		}

		setUser(null);
		setCompanies([]);
		setActiveCompanyId(null);
		setIsFirstTimeUser(false);

		localStorage.removeItem("accountpro_user");
		localStorage.removeItem("accountpro_first_time");
		localStorage.removeItem("accountpro_companies");
		localStorage.removeItem("accountpro_active_company");
	};

	const deleteAccount = async () => {
		if (!user) return;
		const userId = String(user.id);
		
		// Delete user from auth store
		await authService.deleteUser(userId);
		
		// Clean up all user-related localStorage
		const keysToRemove: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key && (key.includes(userId) || key.startsWith('accountpro_'))) {
				keysToRemove.push(key);
			}
		}
		keysToRemove.forEach((key) => localStorage.removeItem(key));
		
		// Reset state
		setUser(null);
		setCompanies([]);
		setActiveCompanyId(null);
		setIsFirstTimeUser(false);
	};

  const beginSignup = (email: string, password: string, name: string) => {
    const payload = { email: email.trim(), password, name: name.trim() };
    setPendingSignup(payload);
    localStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify(payload));
  };

  const cancelSignup = () => {
    setPendingSignup(null);
    localStorage.removeItem(PENDING_SIGNUP_KEY);
  };

  const completeSignupWithCompany = async (company: Omit<CompanyProfile, 'id'>) => {
    if (!pendingSignup) throw new Error('No pending signup found');
    if (!authService.isDatabaseConnected()) throw new Error('Database auth must be enabled for this flow');

    const signupRes = await authService.signup(pendingSignup.email, pendingSignup.password, pendingSignup.name);
    if (!signupRes.success || !signupRes.user) {
      throw new Error(signupRes.error || 'Signup failed');
    }

    const newUser = signupRes.user;
    setUser(newUser);
    localStorage.setItem('accountpro_user', JSON.stringify(newUser));

    const createCompanyRes = await fetch(API_BASE_URL + '/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toCompanyRequestBody(company, newUser.id)),
    });

    const created = await createCompanyRes.json().catch(() => ({}));
    if (!createCompanyRes.ok) {
      throw new Error(created?.detail || created?.error || 'Failed to create company');
    }

    const listRes = await fetch(API_BASE_URL + '/companies?user_id=' + newUser.id);
    const listPayload = await listRes.json().catch(() => []);
    const apiCompanies = Array.isArray(listPayload) ? listPayload.map(mapCompanyFromApi) : [];

    setCompanies(apiCompanies);
    localStorage.setItem('accountpro_companies', JSON.stringify(apiCompanies));

    if (apiCompanies.length > 0) {
      setActiveCompanyId(apiCompanies[0].id);
      localStorage.setItem('accountpro_active_company', apiCompanies[0].id);
    } else {
      setActiveCompanyId(null);
      localStorage.removeItem('accountpro_active_company');
    }

    cancelSignup();
    setIsFirstTimeUser(false);
    localStorage.removeItem('accountpro_first_time');
  };

  // IMPORTANT: This now creates a JOIN REQUEST (does NOT join directly)
  const completeSignupWithJoin = async (organizationNumber: string) => {
		if (!pendingSignup) throw new Error('Ingen pågående registrering');

		const result = await authService.signup(
			pendingSignup.email,
			pendingSignup.password,
			pendingSignup.name
		);

		if (!result.success || !result.user) {
			throw new Error(result.error || 'Signup failed');
		}

		const newUser = result.user;
		setUser(newUser);
		localStorage.setItem('accountpro_user', JSON.stringify(newUser));

		if (!authService.isDatabaseConnected()) {
			throw new Error('Database auth must be enabled for this flow');
		}

		// Skapa JOIN REQUEST (inte direkt medlemskap)
		const reqRes = await fetch(API_BASE_URL + '/companies/join-requests', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				user_id: Number(newUser.id),
				organization_number: organizationNumber,
			}),
		});

		const reqPayload = await reqRes.json().catch(() => ({}));
		if (!reqRes.ok || reqPayload?.success !== true) {
			throw new Error(reqPayload?.detail || reqPayload?.error || 'Kunde inte skicka join request');
		}

		// Viktigt: du är INTE medlem än, så vi ska INTE lägga in companies i state här.
		setCompanies([]);
		setActiveCompanyId(null);
		localStorage.setItem('accountpro_companies', JSON.stringify([]));
		localStorage.removeItem('accountpro_active_company');

		cancelSignup();
		setIsFirstTimeUser(false);
		localStorage.removeItem('accountpro_first_time');
	};

  // legacy aliases (so old imports don’t break)
  const completeSignupAndCreateCompany = completeSignupWithCompany;
  const completeSignupAndJoinCompany = async (organizationNumber: string) => {
		return completeSignupWithJoin(organizationNumber);
	};

  const addCompany = (companyData: Omit<CompanyProfile, 'id'>) => {
    const newCompany: CompanyProfile = { ...companyData, id: crypto.randomUUID() };

    if (authService.isDatabaseConnected() && user) {
      const previousActiveCompanyId = activeCompanyId;

      setCompanies((prev) => [...prev, newCompany]);
      setActiveCompanyId(newCompany.id);

      fetch(API_BASE_URL + '/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toCompanyRequestBody(newCompany, user.id)),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error('Failed to create company');
          }
          const created = await response.json().catch(() => ({}));
          const createdCompanyId = String(created.id ?? newCompany.id);
          const latestCompanySnapshot =
            companiesRef.current.find((company) => company.id === newCompany.id) ?? newCompany;

          setCompanies((prevCompanies) => {
            const index = prevCompanies.findIndex((company) => company.id === newCompany.id);
            if (index === -1) {
              return [...prevCompanies, { ...latestCompanySnapshot, id: createdCompanyId }];
            }
            const next = [...prevCompanies];
            next[index] = { ...latestCompanySnapshot, id: createdCompanyId };
            return next;
          });

          if (latestCompanySnapshot.id !== createdCompanyId) {
            upsertCompanyOnServer(createdCompanyId, latestCompanySnapshot).catch(() => undefined);
          }

          setActiveCompanyId(createdCompanyId);
          localStorage.setItem('accountpro_active_company', createdCompanyId);
        })
        .catch(() => {
          setCompanies((prevCompanies) => {
            const filtered = prevCompanies.filter((company) => company.id !== newCompany.id);
            const canRestorePrevious =
              previousActiveCompanyId !== null && filtered.some((company) => company.id === previousActiveCompanyId);

            if (canRestorePrevious) {
              setActiveCompanyId(previousActiveCompanyId);
            } else {
              setActiveCompanyId(filtered.length > 0 ? filtered[0].id : null);
            }
            return filtered;
          });
        });

      return newCompany;
    }

    const newCompanies = [...companies, newCompany];
    saveCompanies(newCompanies);
    setActiveCompanyId(newCompany.id);
    localStorage.setItem('accountpro_active_company', newCompany.id);
    return newCompany;
  };

  const updateCompany = (company: CompanyProfile) => {
    if (authService.isDatabaseConnected()) {
      upsertCompanyOnServer(company.id, company).catch(() => undefined);
      setCompanies(companies.map((c) => (c.id === company.id ? company : c)));
      return;
    }
    saveCompanies(companies.map((c) => (c.id === company.id ? company : c)));
  };

  const deleteCompany = (companyId: string) => {
    const newCompanies = companies.filter((c) => c.id !== companyId);

    if (authService.isDatabaseConnected()) {
      fetch(API_BASE_URL + '/companies/' + companyId, { method: 'DELETE' }).catch(() => undefined);
      setCompanies(newCompanies);

      if (newCompanies.length === 0) {
        setActiveCompanyId(null);
        localStorage.removeItem('accountpro_active_company');
        localStorage.setItem('accountpro_companies', JSON.stringify([]));
      } else if (activeCompanyId === companyId) {
        setActiveCompanyId(newCompanies[0].id);
        localStorage.setItem('accountpro_active_company', newCompanies[0].id);
      }
      return;
    }

    if (newCompanies.length === 0) {
      const fresh: CompanyProfile = { ...DEFAULT_COMPANY_PROFILE, id: crypto.randomUUID() };
      saveCompanies([fresh]);
      setActiveCompanyId(fresh.id);
      localStorage.setItem('accountpro_active_company', fresh.id);
      setIsFirstTimeUser(true);
      localStorage.setItem('accountpro_first_time', 'true');
    } else {
      saveCompanies(newCompanies);
      if (activeCompanyId === companyId) {
        setActiveCompanyId(newCompanies[0].id);
        localStorage.setItem('accountpro_active_company', newCompanies[0].id);
      }
    }
  };

  const setActiveCompany = (companyId: string) => {
    if (companies.some((c) => c.id === companyId)) {
      setActiveCompanyId(companyId);
      localStorage.setItem('accountpro_active_company', companyId);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        companies,
        activeCompany,
        isLoading,
        isFirstTimeUser,
        hasValidCompany,

        login,

        pendingSignup,
        beginSignup,
        cancelSignup,

        completeSignupWithCompany,
        completeSignupWithJoin,
        completeSignupAndCreateCompany,
        completeSignupAndJoinCompany,

        signup,
        logout,
        deleteAccount,

        addCompany,
        updateCompany,
        deleteCompany,
        setActiveCompany,
        markCompanySetupComplete,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}