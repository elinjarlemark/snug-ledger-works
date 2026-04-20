import { VatCode } from "./codes";

export type VatWarningSeverity = "info" | "warning" | "error";

export interface VatWarning {
  severity: VatWarningSeverity;
  message: string;
  context?: string;
}

export interface VatSettings {
  registered: boolean;
  registrationDate?: string;
  reportingPeriod: "manad" | "kvartal" | "ar";
  reportingMethod: "fakturering" | "bokslut";
  defaultSalesCodeId?: string;
  defaultPurchaseCodeId?: string;
  sellsVatFree: boolean;
  sellsEU: boolean;
  sellsOutsideEU: boolean;
  usesReverseCharge: boolean;
}

export const DEFAULT_VAT_SETTINGS: VatSettings = {
  registered: true,
  reportingPeriod: "kvartal",
  reportingMethod: "fakturering",
  defaultSalesCodeId: "SE25",
  defaultPurchaseCodeId: "IN25",
  sellsVatFree: false,
  sellsEU: false,
  sellsOutsideEU: false,
  usesReverseCharge: false,
};

export function validateInvoiceLineVat(params: {
  vatCodeId?: string;
  vatRate?: number;
  vatAmount?: number;
  codes: VatCode[];
  settings: VatSettings;
}): VatWarning[] {
  const { vatCodeId, vatAmount, codes, settings } = params;
  const warnings: VatWarning[] = [];

  if (!settings.registered && (vatAmount ?? 0) > 0) {
    warnings.push({ severity: "error", message: "Företaget är inte momsregistrerat — moms får inte debiteras." });
  }

  if (!vatCodeId) {
    warnings.push({ severity: "warning", message: "Momskod saknas på raden." });
    return warnings;
  }

  const code = codes.find((c) => c.id === vatCodeId);
  if (!code) {
    warnings.push({ severity: "warning", message: "Okänd momskod." });
    return warnings;
  }

  if (code.sats === 0 && (vatAmount ?? 0) > 0) {
    warnings.push({ severity: "error", message: `Momsfri kod (${code.code}) ska inte ha momsbelopp.` });
  }

  return warnings;
}

export function validateVatPeriodLock(params: {
  date: string;
  isPeriodLocked: (date: string) => boolean;
}): VatWarning[] {
  if (params.isPeriodLocked(params.date)) {
    return [
      {
        severity: "error",
        message: "Momsperioden är låst. Skapa en rättelseverifikation eller kreditfaktura istället.",
      },
    ];
  }
  return [];
}
