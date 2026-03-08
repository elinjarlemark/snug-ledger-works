import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "./AuthContext";

interface FiscalLockContextType {
  lockedYears: number[];
  isYearLocked: (year: number) => boolean;
  lockYear: (year: number) => void;
  unlockYear: (year: number) => void;
  canLockYear: (year: number) => { allowed: boolean; reason?: string };
  isDateInLockedYear: (date: string) => boolean;
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

  const isDateInLockedYear = (date: string) => {
    if (!date) return false;
    const year = new Date(date).getFullYear();
    return isNaN(year) ? false : lockedYears.includes(year);
  };

  const canLockYear = (year: number): { allowed: boolean; reason?: string } => {
    const currentYear = new Date().getFullYear();

    // Cannot lock a year if the current date is within that fiscal year
    if (year >= currentYear) {
      return { allowed: false, reason: `Cannot lock ${year} — the current date is within this fiscal year` };
    }

    // Must lock in chronological order: all prior years must be locked first
    const sortedLocked = [...lockedYears].sort((a, b) => a - b);
    // Find the earliest unlocked year before this one
    for (let y = year - 1; y >= currentYear - 20; y--) {
      // Only check years that could reasonably have data
      if (!lockedYears.includes(y) && y < year && y < currentYear) {
        return { allowed: false, reason: `Must lock ${y} before locking ${year} — years must be locked in chronological order` };
      }
      if (lockedYears.includes(y)) break;
      // If we reach a year far back without data, stop checking
    }

    return { allowed: true };
  };

  const lockYear = (year: number) => {
    if (!lockedYears.includes(year)) save([...lockedYears, year]);
  };

  const unlockYear = (year: number) => {
    save(lockedYears.filter((y) => y !== year));
  };

  return (
    <FiscalLockContext.Provider value={{ lockedYears, isYearLocked, lockYear, unlockYear, canLockYear, isDateInLockedYear }}>
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
