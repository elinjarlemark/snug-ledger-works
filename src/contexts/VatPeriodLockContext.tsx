import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { useVat } from "./VatContext";

interface VatPeriodLockContextType {
  lockedPeriods: string[];
  lockPeriod: (periodKey: string) => void;
  unlockPeriod: (periodKey: string) => void;
  isPeriodLocked: (periodKey: string) => boolean;
  /** Given an ISO date "YYYY-MM-DD", check if the corresponding period is locked */
  isDateInLockedPeriod: (isoDate: string) => boolean;
  /** Compute the period key for a given ISO date based on company settings */
  periodKeyForDate: (isoDate: string) => string;
}

const VatPeriodLockContext = createContext<VatPeriodLockContextType | undefined>(undefined);

function quarterFromMonth(monthIndex: number): number {
  return Math.floor(monthIndex / 3) + 1;
}

export function VatPeriodLockProvider({ children }: { children: ReactNode }) {
  const { activeCompany } = useAuth();
  const { vatSettings } = useVat();
  const companyId = activeCompany?.id || "";

  const [lockedPeriods, setLockedPeriods] = useState<string[]>([]);

  useEffect(() => {
    if (!companyId) {
      setLockedPeriods([]);
      return;
    }
    const stored = localStorage.getItem(`vat_locked_periods_${companyId}`);
    if (stored) {
      try {
        setLockedPeriods(JSON.parse(stored));
      } catch {
        setLockedPeriods([]);
      }
    } else {
      setLockedPeriods([]);
    }
  }, [companyId]);

  const persist = (next: string[]) => {
    setLockedPeriods(next);
    if (companyId) localStorage.setItem(`vat_locked_periods_${companyId}`, JSON.stringify(next));
  };

  const lockPeriod = (key: string) => {
    if (!lockedPeriods.includes(key)) persist([...lockedPeriods, key]);
  };

  const unlockPeriod = (key: string) => {
    persist(lockedPeriods.filter((k) => k !== key));
  };

  const isPeriodLocked = (key: string) => lockedPeriods.includes(key);

  const periodKeyForDate = (isoDate: string): string => {
    if (!isoDate) return "";
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = d.getMonth();
    if (vatSettings.reportingPeriod === "ar") return `${year}`;
    if (vatSettings.reportingPeriod === "kvartal") return `${year}-Q${quarterFromMonth(month)}`;
    return `${year}-${String(month + 1).padStart(2, "0")}`;
  };

  const isDateInLockedPeriod = (isoDate: string) => {
    const key = periodKeyForDate(isoDate);
    return key ? lockedPeriods.includes(key) : false;
  };

  return (
    <VatPeriodLockContext.Provider value={{ lockedPeriods, lockPeriod, unlockPeriod, isPeriodLocked, isDateInLockedPeriod, periodKeyForDate }}>
      {children}
    </VatPeriodLockContext.Provider>
  );
}

export function useVatPeriodLock() {
  const ctx = useContext(VatPeriodLockContext);
  if (!ctx) throw new Error("useVatPeriodLock must be used within a VatPeriodLockProvider");
  return ctx;
}
