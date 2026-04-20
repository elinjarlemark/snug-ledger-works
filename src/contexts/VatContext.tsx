import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { DEFAULT_VAT_CODES, VatCode } from "@/lib/vat/codes";
import { DEFAULT_VAT_SETTINGS, VatSettings } from "@/lib/vat/validation";

interface VatContextType {
  vatCodes: VatCode[];
  vatSettings: VatSettings;
  updateVatCode: (code: VatCode) => void;
  addVatCode: (code: VatCode) => void;
  removeVatCode: (id: string) => void;
  setVatSettings: (settings: VatSettings) => void;
}

const VatContext = createContext<VatContextType | undefined>(undefined);

export function VatProvider({ children }: { children: ReactNode }) {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id || "";

  const [vatCodes, setVatCodes] = useState<VatCode[]>(DEFAULT_VAT_CODES);
  const [vatSettings, setVatSettingsState] = useState<VatSettings>(DEFAULT_VAT_SETTINGS);

  useEffect(() => {
    if (!companyId) {
      setVatCodes(DEFAULT_VAT_CODES);
      setVatSettingsState(DEFAULT_VAT_SETTINGS);
      return;
    }

    const storedCodes = localStorage.getItem(`vat_codes_${companyId}`);
    if (storedCodes) {
      try {
        setVatCodes(JSON.parse(storedCodes));
      } catch {
        setVatCodes(DEFAULT_VAT_CODES);
      }
    } else {
      setVatCodes(DEFAULT_VAT_CODES);
    }

    const storedSettings = localStorage.getItem(`vat_settings_${companyId}`);
    if (storedSettings) {
      try {
        setVatSettingsState({ ...DEFAULT_VAT_SETTINGS, ...JSON.parse(storedSettings) });
      } catch {
        setVatSettingsState(DEFAULT_VAT_SETTINGS);
      }
    } else {
      setVatSettingsState(DEFAULT_VAT_SETTINGS);
    }
  }, [companyId]);

  const persistCodes = useCallback((next: VatCode[]) => {
    setVatCodes(next);
    if (companyId) localStorage.setItem(`vat_codes_${companyId}`, JSON.stringify(next));
  }, [companyId]);

  const updateVatCode = (code: VatCode) => {
    persistCodes(vatCodes.map((c) => (c.id === code.id ? code : c)));
  };

  const addVatCode = (code: VatCode) => {
    if (vatCodes.some((c) => c.id === code.id)) return;
    persistCodes([...vatCodes, code]);
  };

  const removeVatCode = (id: string) => {
    persistCodes(vatCodes.filter((c) => c.id !== id));
  };

  const setVatSettings = (settings: VatSettings) => {
    setVatSettingsState(settings);
    if (companyId) localStorage.setItem(`vat_settings_${companyId}`, JSON.stringify(settings));
  };

  return (
    <VatContext.Provider value={{ vatCodes, vatSettings, updateVatCode, addVatCode, removeVatCode, setVatSettings }}>
      {children}
    </VatContext.Provider>
  );
}

export function useVat() {
  const ctx = useContext(VatContext);
  if (!ctx) throw new Error("useVat must be used within a VatProvider");
  return ctx;
}
