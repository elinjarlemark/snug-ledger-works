import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "./AuthContext";

interface FiscalLockContextType {
  lockedYears: number[];
  isYearLocked: (year: number) => boolean;
  lockYear: (year: number) => void;
  unlockYear: (year: number) => void;
}

const FiscalLockContext = createContext<FiscalLockContextType | undefined>(undefined);

export function FiscalLockProvider({ children }: { children: ReactNode }) {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id || "";
  const [lockedYears, setLockedYears] = useState<number[]>([]);

  useEffect(() => {
    if (!companyId) {
      setLockedYears([]);
      return;
    }
    const stored = localStorage.getItem(`accountpro_locked_years_${companyId}`);
    if (stored) {
      setLockedYears(JSON.parse(stored));
    } else {
      setLockedYears([]);
    }
  }, [companyId]);

  const save = (years: number[]) => {
    setLockedYears(years);
    if (companyId) {
      localStorage.setItem(`accountpro_locked_years_${companyId}`, JSON.stringify(years));
    }
  };

  const isYearLocked = (year: number) => lockedYears.includes(year);

  const lockYear = (year: number) => {
    if (!lockedYears.includes(year)) save([...lockedYears, year]);
  };

  const unlockYear = (year: number) => {
    save(lockedYears.filter((y) => y !== year));
  };

  return (
    <FiscalLockContext.Provider value={{ lockedYears, isYearLocked, lockYear, unlockYear }}>
      {children}
    </FiscalLockContext.Provider>
  );
}

export function useFiscalLock() {
  const context = useContext(FiscalLockContext);
  if (context === undefined) {
    throw new Error("useFiscalLock must be used within a FiscalLockProvider");
  }
  return context;
}
