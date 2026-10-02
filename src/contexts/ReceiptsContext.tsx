import { appStorage } from "@/lib/appStorage";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
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
  removeReceipt: (id: string) => boolean;
  unlinkReceipt: (id: string) => boolean;
  linkReceipt: (receiptId: string, voucherId: string, voucherNumber: number) => boolean;
  getReceiptsForVoucher: (voucherId: string) => Receipt[];
}

interface ReceiptState {
  companyId: string;
  receipts: Receipt[];
}

const ReceiptsContext = createContext<ReceiptsContextType | undefined>(undefined);

function receiptKey(companyId: string): string {
  return "accountpro_receipts_" + companyId;
}

function readReceipts(companyId: string): Receipt[] {
  if (!companyId) return [];
  const stored = appStorage.getItem(receiptKey(companyId));
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("Felaktigt kvittoformat");
    return parsed as Receipt[];
  } catch (error) {
    // Skriv inte över befintliga, oläsbara data med en tom lista.
    console.error("Det gick inte att läsa företagets kvitton:", error);
    throw new Error("Företagets sparade kvitton kunde inte läsas. Kontrollera datan innan du fortsätter.");
  }
}

export function ReceiptsProvider({ children }: { children: ReactNode }) {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id || "";

  // Företagets ID följer med tillståndet så att data från ett tidigare
  // företag aldrig skrivs till det nya företaget när man växlar företag.
  const [state, setState] = useState<ReceiptState>(() => ({
    companyId,
    receipts: readReceipts(companyId),
  }));

  useEffect(() => {
    setState({
      companyId,
      receipts: readReceipts(companyId),
    });
  }, [companyId]);

  useEffect(() => {
    if (!companyId || state.companyId !== companyId) return;
    appStorage.setItem(receiptKey(companyId), JSON.stringify(state.receipts));
  }, [companyId, state]);

  const receipts = state.companyId === companyId ? state.receipts : [];

  const addReceipt = (
    data: Omit<Receipt, "id" | "companyId" | "createdAt">
  ): Receipt => {
    if (!companyId || state.companyId !== companyId) {
      throw new Error("Välj ett företag innan du lägger till ett underlag.");
    }

    // Kompletteringar skapas alltid som NYA underlag med egna ID:n.
    // Vi ändrar aldrig en redan sparad fils innehåll eller ID.
    const receipt: Receipt = {
      ...data,
      id: crypto.randomUUID(),
      companyId,
      createdAt: new Date().toISOString(),
    };

    setState((previous) => {
      if (previous.companyId !== companyId) return previous;
      return {
        companyId,
        receipts: [...previous.receipts, receipt],
      };
    });

    return receipt;
  };

  const removeReceipt = (id: string): boolean => {
    const receipt = receipts.find((item) => item.id === id);
    if (!receipt) return false;

    if (receipt.voucherId) {
      toast.error("Underlaget är kopplat till en bokförd verifikation och får inte raderas.");
      return false;
    }

    setState((previous) => {
      if (previous.companyId !== companyId) return previous;
      return {
        companyId,
        receipts: previous.receipts.filter((item) => item.id !== id),
      };
    });
    return true;
  };

  const unlinkReceipt = (id: string): boolean => {
    const receipt = receipts.find((item) => item.id === id);
    if (!receipt) return false;

    if (receipt.voucherId) {
      toast.error("Ett underlag till en bokförd verifikation kan inte kopplas loss. Lägg i stället till en komplettering om det behövs.");
      return false;
    }

    // Ett redan fristående kvitto behöver inte ändras.
    return true;
  };

  const linkReceipt = (
    receiptId: string,
    voucherId: string,
    voucherNumber: number
  ): boolean => {
    const receipt = receipts.find((item) => item.id === receiptId);
    if (!receipt) return false;

    if (!voucherId || !Number.isInteger(voucherNumber) || voucherNumber < 1) {
      toast.error("Välj en bokförd verifikation att koppla underlaget till.");
      return false;
    }

    if (receipt.voucherId) {
      if (receipt.voucherId === voucherId && receipt.voucherNumber === voucherNumber) {
        return true;
      }
      toast.error("Underlaget är redan kopplat till en verifikation och kan inte flyttas.");
      return false;
    }

    setState((previous) => {
      if (previous.companyId !== companyId) return previous;
      return {
        companyId,
        receipts: previous.receipts.map((item) =>
          item.id === receiptId
            ? { ...item, voucherId, voucherNumber }
            : item
        ),
      };
    });
    return true;
  };

  const getReceiptsForVoucher = (voucherId: string): Receipt[] =>
    receipts.filter((receipt) => receipt.voucherId === voucherId);

  return (
    <ReceiptsContext.Provider
      value={{
        receipts,
        addReceipt,
        removeReceipt,
        unlinkReceipt,
        linkReceipt,
        getReceiptsForVoucher,
      }}
    >
      {children}
    </ReceiptsContext.Provider>
  );
}

export function useReceipts(): ReceiptsContextType {
  const context = useContext(ReceiptsContext);
  if (!context) {
    throw new Error("useReceipts must be used within ReceiptsProvider");
  }
  return context;
}
