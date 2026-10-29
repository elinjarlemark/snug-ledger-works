import { appStorage, flushAppStorage } from "@/lib/appStorage";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import { useAccounting } from "./AccountingContext";

export interface Receipt {
  id: string;
  companyId: string;
  name: string;
  type: string;
  dataUrl: string;
  voucherId: string | null;
  voucherNumber: number | null;
  voucherSeries?: string | null;
  createdAt: string;
}

interface ReceiptsContextType {
  receipts: Receipt[];
  addReceipt: (
    receipt: Omit<Receipt, "id" | "companyId" | "createdAt">
  ) => Promise<Receipt>;
  removeReceipt: (id: string) => Promise<boolean>;
  unlinkReceipt: (id: string) => boolean;
  linkReceipt: (
    receiptId: string,
    voucherId: string,
    voucherNumber: number,
    voucherSeries?: string | null
  ) => Promise<boolean>;
  getReceiptsForVoucher: (voucherId: string) => Receipt[];
}

interface ReceiptState {
  companyId: string;
  receipts: Receipt[];
}

interface StoredVoucherReference {
  id: string;
  companyId: string;
  voucherNumber: number;
  series?: string | null;
  status?: string;
}

const ReceiptsContext = createContext<ReceiptsContextType | undefined>(undefined);

const VOUCHER_SERIES_PATTERN = /^[A-Z][A-Z0-9]{0,9}$/;
const SUPPORTED_RECEIPT_TYPES = new Set(["application/pdf"]);

function normalizeVoucherSeries(series?: string | null): string | null {
  if (series === undefined || series === null || !series.trim()) return null;
  const normalized = series.trim().toUpperCase();
  return VOUCHER_SERIES_PATTERN.test(normalized) ? normalized : null;
}

function receiptKey(companyId: string): string {
  return "accountpro_receipts_" + companyId;
}

function readPostedVoucherFromStorage(
  companyId: string,
  voucherId: string
): StoredVoucherReference | undefined {
  const raw = appStorage.getItem("accountpro_vouchers_" + companyId);
  if (!raw) return undefined;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;

    const candidate = parsed.find((item): item is StoredVoucherReference => {
      if (!item || typeof item !== "object") return false;
      const voucher = item as Record<string, unknown>;
      return (
        voucher.id === voucherId &&
        voucher.companyId === companyId &&
        typeof voucher.voucherNumber === "number"
      );
    });

    if (!candidate || candidate.status === "DRAFT") return undefined;
    return candidate;
  } catch {
    return undefined;
  }
}

function isSupportedReceiptType(type: string): boolean {
  return type.startsWith("image/") || SUPPORTED_RECEIPT_TYPES.has(type);
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
    throw new Error(
      "Företagets sparade kvitton kunde inte läsas. Kontrollera datan innan du fortsätter."
    );
  }
}

export function ReceiptsProvider({ children }: { children: ReactNode }) {
  const { activeCompany } = useAuth();
  const { getVoucherById } = useAccounting();
  const companyId = activeCompany?.id || "";

  // Företagets ID följer med tillståndet så att data från ett tidigare
  // företag aldrig skrivs till det nya företaget när man växlar företag.
  const [state, setState] = useState<ReceiptState>(() => ({
    companyId,
    receipts: readReceipts(companyId),
  }));

  const stateRef = useRef(state);
  const activeCompanyIdRef = useRef(companyId);

  const replaceState = (next: ReceiptState) => {
    stateRef.current = next;
    setState(next);
  };

  useEffect(() => {
    activeCompanyIdRef.current = companyId;
    const next = {
      companyId,
      receipts: readReceipts(companyId),
    };
    stateRef.current = next;
    setState(next);
  }, [companyId]);

  const receipts = state.companyId === companyId ? state.receipts : [];

  /**
   * Spara hela kvittolagret och vänta på PostgreSQL-kvittens innan operationen
   * betraktas som lyckad. Om backend nekar skrivningen återställs den lokala
   * bilden till det senast bekräftade läget.
   */
  const persistReceipts = async (
    requestedCompanyId: string,
    previousReceipts: Receipt[],
    nextReceipts: Receipt[]
  ): Promise<Receipt[]> => {
    if (!requestedCompanyId || activeCompanyIdRef.current !== requestedCompanyId) {
      throw new Error("Företaget byttes innan underlaget kunde sparas.");
    }

    const key = receiptKey(requestedCompanyId);
    const optimisticState = {
      companyId: requestedCompanyId,
      receipts: nextReceipts,
    };

    appStorage.setItem(key, JSON.stringify(nextReceipts));
    replaceState(optimisticState);

    try {
      await flushAppStorage();

      if (activeCompanyIdRef.current !== requestedCompanyId) {
        throw new Error("Företaget byttes medan underlaget sparades.");
      }

      const confirmedReceipts = readReceipts(requestedCompanyId);
      replaceState({
        companyId: requestedCompanyId,
        receipts: confirmedReceipts,
      });
      return confirmedReceipts;
    } catch (error) {
      // Backend har inte accepterat nästa version. Lägg tillbaka den tidigare
      // lokala bilden och försök även återställa appStorage till samma läge.
      // Om nätverket är nere ligger den återställda versionen kvar i outboxen
      // och kan synkas när anslutningen fungerar igen.
      if (activeCompanyIdRef.current === requestedCompanyId) {
        appStorage.setItem(key, JSON.stringify(previousReceipts));
        replaceState({
          companyId: requestedCompanyId,
          receipts: previousReceipts,
        });

        try {
          await flushAppStorage();
        } catch {
          // Behåll originalfelet. appStorage har redan den återställda versionen
          // i sin lokala återställningsjournal.
        }
      }

      throw error;
    }
  };

  const addReceipt = async (
    data: Omit<Receipt, "id" | "companyId" | "createdAt">
  ): Promise<Receipt> => {
    const requestedCompanyId = companyId;
    if (
      !requestedCompanyId ||
      stateRef.current.companyId !== requestedCompanyId ||
      activeCompanyIdRef.current !== requestedCompanyId
    ) {
      throw new Error("Välj ett företag innan du lägger till ett underlag.");
    }

    if (!data.name.trim()) {
      throw new Error("Underlaget måste ha ett filnamn.");
    }
    if (!isSupportedReceiptType(data.type)) {
      throw new Error("Endast bilder och PDF-filer stöds som underlag.");
    }
    if (!data.dataUrl.startsWith("data:")) {
      throw new Error("Underlaget saknar giltigt filinnehåll.");
    }

    const previousReceipts = [...stateRef.current.receipts];

    // Om underlaget kopplas direkt till en verifikation hämtar kvittolagret
    // nummer och serie från själva den bokförda verifikationen. Då kan klienten
    // inte skapa en länk vars metadata skiljer sig från originalverifikationen.
    const explicitSeries = normalizeVoucherSeries(data.voucherSeries);
    if (
      data.voucherSeries !== undefined &&
      data.voucherSeries !== null &&
      data.voucherSeries.trim() &&
      !explicitSeries
    ) {
      throw new Error("Verifikationsserien är ogiltig.");
    }

    const linkedVoucher = data.voucherId
      ? getVoucherById(data.voucherId) ||
        readPostedVoucherFromStorage(requestedCompanyId, data.voucherId)
      : undefined;

    if (data.voucherId) {
      if (!linkedVoucher || linkedVoucher.status === "DRAFT") {
        throw new Error("Underlaget måste kopplas till en befintlig bokförd verifikation.");
      }
      if (linkedVoucher.companyId !== requestedCompanyId) {
        throw new Error("Underlaget och verifikationen måste tillhöra samma företag.");
      }
    } else if (data.voucherNumber !== null || explicitSeries !== null) {
      throw new Error("Ett fristående underlag får inte ha verifikationsnummer eller serie.");
    }

    const linkedSeries = linkedVoucher
      ? normalizeVoucherSeries(linkedVoucher.series) || "A"
      : null;

    const receipt: Receipt = {
      ...data,
      voucherNumber: linkedVoucher ? linkedVoucher.voucherNumber : null,
      voucherSeries: linkedVoucher ? linkedSeries : null,
      id: crypto.randomUUID(),
      companyId: requestedCompanyId,
      createdAt: new Date().toISOString(),
    };

    const nextReceipts = [...previousReceipts, receipt];
    const confirmedReceipts = await persistReceipts(
      requestedCompanyId,
      previousReceipts,
      nextReceipts
    );

    const confirmed = confirmedReceipts.find((item) => item.id === receipt.id);
    if (!confirmed) {
      throw new Error("Databasen bekräftade inte det nya underlaget.");
    }

    return confirmed;
  };

  const removeReceipt = async (id: string): Promise<boolean> => {
    const requestedCompanyId = companyId;
    const currentReceipts = stateRef.current.companyId === requestedCompanyId
      ? stateRef.current.receipts
      : [];
    const receipt = currentReceipts.find((item) => item.id === id);
    if (!receipt) return false;

    if (receipt.voucherId) {
      toast.error("Underlaget är kopplat till en bokförd verifikation och får inte raderas.");
      return false;
    }

    const previousReceipts = [...currentReceipts];
    const nextReceipts = currentReceipts.filter((item) => item.id !== id);

    const confirmedReceipts = await persistReceipts(
      requestedCompanyId,
      previousReceipts,
      nextReceipts
    );

    return !confirmedReceipts.some((item) => item.id === id);
  };

  const unlinkReceipt = (id: string): boolean => {
    const currentReceipts = stateRef.current.companyId === companyId
      ? stateRef.current.receipts
      : [];
    const receipt = currentReceipts.find((item) => item.id === id);
    if (!receipt) return false;

    if (receipt.voucherId) {
      toast.error(
        "Ett underlag till en bokförd verifikation kan inte kopplas loss. Lägg i stället till en komplettering om det behövs."
      );
      return false;
    }

    // Ett redan fristående kvitto behöver inte ändras.
    return true;
  };

  const linkReceipt = async (
    receiptId: string,
    voucherId: string,
    voucherNumber: number,
    voucherSeries?: string | null
  ): Promise<boolean> => {
    const requestedCompanyId = companyId;
    const currentReceipts = stateRef.current.companyId === requestedCompanyId
      ? stateRef.current.receipts
      : [];
    const receipt = currentReceipts.find((item) => item.id === receiptId);
    if (!receipt) return false;

    if (!voucherId || !Number.isInteger(voucherNumber) || voucherNumber < 1) {
      toast.error("Välj en bokförd verifikation att koppla underlaget till.");
      return false;
    }

    const suppliedVoucherSeries = normalizeVoucherSeries(voucherSeries);
    if (
      voucherSeries !== undefined &&
      voucherSeries !== null &&
      voucherSeries.trim() &&
      !suppliedVoucherSeries
    ) {
      toast.error("Verifikationsserien är ogiltig.");
      return false;
    }

    const linkedVoucher =
      getVoucherById(voucherId) ||
      readPostedVoucherFromStorage(requestedCompanyId, voucherId);
    if (!linkedVoucher || linkedVoucher.status === "DRAFT") {
      toast.error("Verifikationen finns inte eller är inte bokförd.");
      return false;
    }
    if (linkedVoucher.companyId !== requestedCompanyId) {
      toast.error("Underlaget och verifikationen måste tillhöra samma företag.");
      return false;
    }
    if (linkedVoucher.voucherNumber !== voucherNumber) {
      toast.error("Verifikationsnumret stämmer inte med den valda verifikationen.");
      return false;
    }

    const actualVoucherSeries = normalizeVoucherSeries(linkedVoucher.series) || "A";
    if (suppliedVoucherSeries && suppliedVoucherSeries !== actualVoucherSeries) {
      toast.error("Verifikationsserien stämmer inte med den valda verifikationen.");
      return false;
    }

    if (receipt.voucherId) {
      if (
        receipt.voucherId === voucherId &&
        receipt.voucherNumber === voucherNumber &&
        normalizeVoucherSeries(receipt.voucherSeries) === actualVoucherSeries
      ) {
        return true;
      }
      toast.error("Underlaget är redan kopplat till en verifikation och kan inte flyttas.");
      return false;
    }

    const previousReceipts = [...currentReceipts];
    const nextReceipts = currentReceipts.map((item) =>
      item.id === receiptId
        ? {
            ...item,
            voucherId,
            voucherNumber: linkedVoucher.voucherNumber,
            voucherSeries: actualVoucherSeries,
          }
        : item
    );

    const confirmedReceipts = await persistReceipts(
      requestedCompanyId,
      previousReceipts,
      nextReceipts
    );

    const confirmed = confirmedReceipts.find((item) => item.id === receiptId);
    return Boolean(
      confirmed &&
      confirmed.voucherId === voucherId &&
      confirmed.voucherNumber === linkedVoucher.voucherNumber &&
      normalizeVoucherSeries(confirmed.voucherSeries) === actualVoucherSeries
    );
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
