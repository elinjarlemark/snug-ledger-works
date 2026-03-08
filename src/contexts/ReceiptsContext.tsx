import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "./AuthContext";

export interface Receipt {
  id: string;
  companyId: string;
  name: string;
  type: string;
  dataUrl: string;
  voucherId: string | null;
  voucherNumber: number | null;
  createdAt: string;
}

interface ReceiptsContextType {
  receipts: Receipt[];
  addReceipt: (receipt: Omit<Receipt, "id" | "companyId" | "createdAt">) => Receipt;
  removeReceipt: (id: string) => void;
  unlinkReceipt: (id: string) => void;
  linkReceipt: (receiptId: string, voucherId: string, voucherNumber: number) => void;
  getReceiptsForVoucher: (voucherId: string) => Receipt[];
}

const ReceiptsContext = createContext<ReceiptsContextType | undefined>(undefined);

export function ReceiptsProvider({ children }: { children: ReactNode }) {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id || "";

  const [receipts, setReceipts] = useState<Receipt[]>(() => {
    if (!companyId) return [];
    const stored = localStorage.getItem(`accountpro_receipts_${companyId}`);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    if (!companyId) return;
    const stored = localStorage.getItem(`accountpro_receipts_${companyId}`);
    setReceipts(stored ? JSON.parse(stored) : []);
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      localStorage.setItem(`accountpro_receipts_${companyId}`, JSON.stringify(receipts));
    }
  }, [receipts, companyId]);

  const addReceipt = (data: Omit<Receipt, "id" | "companyId" | "createdAt">): Receipt => {
    const receipt: Receipt = {
      ...data,
      id: crypto.randomUUID(),
      companyId,
      createdAt: new Date().toISOString(),
    };
    setReceipts(prev => [...prev, receipt]);
    return receipt;
  };

  const removeReceipt = (id: string) => {
    setReceipts(prev => prev.filter(r => r.id !== id));
  };

  const unlinkReceipt = (id: string) => {
    setReceipts(prev => prev.map(r => r.id === id ? { ...r, voucherId: null, voucherNumber: null } : r));
  };

  const linkReceipt = (receiptId: string, voucherId: string, voucherNumber: number) => {
    setReceipts(prev => prev.map(r => r.id === receiptId ? { ...r, voucherId, voucherNumber } : r));
  };

  const getReceiptsForVoucher = (voucherId: string) => {
    return receipts.filter(r => r.voucherId === voucherId);
  };

  return (
    <ReceiptsContext.Provider value={{ receipts, addReceipt, removeReceipt, unlinkReceipt, linkReceipt, getReceiptsForVoucher }}>
      {children}
    </ReceiptsContext.Provider>
  );
}

export function useReceipts() {
  const ctx = useContext(ReceiptsContext);
  if (!ctx) throw new Error("useReceipts must be used within ReceiptsProvider");
  return ctx;
}
