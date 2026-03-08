import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "./AuthContext";

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  companyId: string;
  description: string;
}

interface AuditTrailContextType {
  entries: AuditEntry[];
  addEntry: (description: string) => void;
}

const AuditTrailContext = createContext<AuditTrailContextType | undefined>(undefined);

export function AuditTrailProvider({ children }: { children: ReactNode }) {
  const { user, activeCompany } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  const companyId = activeCompany?.id || "";

  // Load entries when company changes
  useEffect(() => {
    if (!companyId) {
      setEntries([]);
      return;
    }
    const stored = localStorage.getItem(`accountpro_audit_trail_${companyId}`);
    if (stored) {
      setEntries(JSON.parse(stored));
    } else {
      setEntries([]);
    }
  }, [companyId]);

  const addEntry = (description: string) => {
    if (!user || !companyId) return;

    const entry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId: String(user.id),
      userName: user.name || user.email,
      companyId,
      description,
    };

    const newEntries = [entry, ...entries];
    setEntries(newEntries);
    localStorage.setItem(`accountpro_audit_trail_${companyId}`, JSON.stringify(newEntries));
  };

  return (
    <AuditTrailContext.Provider value={{ entries, addEntry }}>
      {children}
    </AuditTrailContext.Provider>
  );
}

export function useAuditTrail() {
  const context = useContext(AuditTrailContext);
  if (context === undefined) {
    throw new Error("useAuditTrail must be used within an AuditTrailProvider");
  }
  return context;
}
