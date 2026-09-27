import { appStorage } from "@/lib/appStorage";
import {
  BASAccount,
  AccountClass,
  getAccountClass,
  getBASAccountsForYear,
  getAvailableBASYears,
} from "@/lib/bas-accounts";
import type { SIEParseResult } from "@/lib/sie";

export type ReportSection = "balance" | "income";
export type MappingStatus = "ready" | "needs_review";
export type HistoricalBasStatus =
  | "in_bas"
  | "not_in_bas"
  | "bas_version_missing";

export interface AccountReportMapping {
  fiscalYear: number;
  reportSection: ReportSection;
  reportGroup: string;
  k2ReportKey: string;
  defaultVatCodeId?: string;
  source: "bas" | "historical_auto" | "historical_reviewed";
  status: MappingStatus;
}

export interface HistoricalImportedAccount extends BASAccount {
  source: "sie";
  years: number[];
  firstSeenYear: number;
  lastSeenYear: number;
  basStatusByYear: Record<string, HistoricalBasStatus>;
  importedAt: string;
  reportMappings: Record<string, AccountReportMapping>;
}

export interface HistoricalAccountCandidate {
  number: string;
  name: string;
  year: number;
}

export const HISTORICAL_ACCOUNTS_KEY_PREFIX =
  "accountpro_historical_accounts_";

function getStorageKey(companyId: string): string {
  return HISTORICAL_ACCOUNTS_KEY_PREFIX + companyId;
}

function inRange(
  accountNumber: string,
  from: number,
  to: number
): boolean {
  const value = Number(accountNumber);
  return Number.isFinite(value) && value >= from && value <= to;
}

function inferDefaultVatCode(
  accountNumber: string,
  accountName: string
): string | undefined {
  const normalizedName = accountName.toLowerCase();

  if (inRange(accountNumber, 3000, 3999)) {
    if (
      normalizedName.includes("25 %") ||
      normalizedName.includes("25%")
    ) {
      return "SE25";
    }

    if (
      normalizedName.includes("12 %") ||
      normalizedName.includes("12%")
    ) {
      return "SE12";
    }

    if (
      normalizedName.includes("6 %") ||
      normalizedName.includes("6%")
    ) {
      return "SE6";
    }

    if (normalizedName.includes("momsfri")) {
      return "SE0";
    }
  }

  return undefined;
}

function inferReportGroup(
  accountNumber: string
): Pick<
  AccountReportMapping,
  "reportSection" | "reportGroup" | "k2ReportKey"
> {
  if (inRange(accountNumber, 1000, 1399)) {
    return {
      reportSection: "balance",
      reportGroup: "Anläggningstillgångar",
      k2ReportKey: "fixed_assets",
    };
  }

  if (inRange(accountNumber, 1400, 1499)) {
    return {
      reportSection: "balance",
      reportGroup: "Varulager m.m.",
      k2ReportKey: "inventory",
    };
  }

  if (inRange(accountNumber, 1500, 1799)) {
    return {
      reportSection: "balance",
      reportGroup: "Kortfristiga fordringar",
      k2ReportKey: "current_receivables",
    };
  }

  if (inRange(accountNumber, 1800, 1899)) {
    return {
      reportSection: "balance",
      reportGroup: "Kortfristiga placeringar",
      k2ReportKey: "short_term_investments",
    };
  }

  if (inRange(accountNumber, 1900, 1999)) {
    return {
      reportSection: "balance",
      reportGroup: "Kassa och bank",
      k2ReportKey: "cash_and_bank",
    };
  }

  if (inRange(accountNumber, 2000, 2099)) {
    return {
      reportSection: "balance",
      reportGroup: "Eget kapital",
      k2ReportKey: "equity",
    };
  }

  if (inRange(accountNumber, 2100, 2299)) {
    return {
      reportSection: "balance",
      reportGroup: "Obeskattade reserver och avsättningar",
      k2ReportKey: "reserves_and_provisions",
    };
  }

  if (inRange(accountNumber, 2300, 2399)) {
    return {
      reportSection: "balance",
      reportGroup: "Långfristiga skulder",
      k2ReportKey: "long_term_liabilities",
    };
  }

  if (inRange(accountNumber, 2400, 2999)) {
    return {
      reportSection: "balance",
      reportGroup: "Kortfristiga skulder",
      k2ReportKey: "current_liabilities",
    };
  }

  if (inRange(accountNumber, 3000, 3799)) {
    return {
      reportSection: "income",
      reportGroup: "Nettoomsättning",
      k2ReportKey: "net_sales",
    };
  }

  if (inRange(accountNumber, 3800, 3999)) {
    return {
      reportSection: "income",
      reportGroup: "Övriga rörelseintäkter",
      k2ReportKey: "other_operating_income",
    };
  }

  if (inRange(accountNumber, 4000, 4999)) {
    return {
      reportSection: "income",
      reportGroup: "Råvaror, förnödenheter och handelsvaror",
      k2ReportKey: "materials_and_goods",
    };
  }

  if (inRange(accountNumber, 5000, 6999)) {
    return {
      reportSection: "income",
      reportGroup: "Övriga externa kostnader",
      k2ReportKey: "other_external_costs",
    };
  }

  if (inRange(accountNumber, 7000, 7699)) {
    return {
      reportSection: "income",
      reportGroup: "Personalkostnader",
      k2ReportKey: "personnel_costs",
    };
  }

  if (inRange(accountNumber, 7700, 7899)) {
    return {
      reportSection: "income",
      reportGroup: "Av- och nedskrivningar",
      k2ReportKey: "depreciation_and_impairment",
    };
  }

  if (inRange(accountNumber, 8000, 8399)) {
    return {
      reportSection: "income",
      reportGroup: "Finansiella intäkter",
      k2ReportKey: "financial_income",
    };
  }

  if (inRange(accountNumber, 8400, 8499)) {
    return {
      reportSection: "income",
      reportGroup: "Finansiella kostnader",
      k2ReportKey: "financial_expenses",
    };
  }

  if (inRange(accountNumber, 8800, 8899)) {
    return {
      reportSection: "income",
      reportGroup: "Bokslutsdispositioner",
      k2ReportKey: "appropriations",
    };
  }

  if (inRange(accountNumber, 8900, 8999)) {
    return {
      reportSection: "income",
      reportGroup: "Skatt och årets resultat",
      k2ReportKey: "tax_and_result",
    };
  }

  const accountClass = getAccountClass(accountNumber);

  if (
    accountClass === "asset" ||
    accountClass === "equity_liability"
  ) {
    return {
      reportSection: "balance",
      reportGroup: "Övrigt",
      k2ReportKey: "other_balance",
    };
  }

  return {
    reportSection: "income",
    reportGroup: "Övrigt",
    k2ReportKey: "other_income_statement",
  };
}

export function getBasReportMapping(
  fiscalYear: number,
  account: Pick<BASAccount, "number" | "name">
): AccountReportMapping {
  const base = inferReportGroup(account.number);

  return {
    fiscalYear,
    reportSection: base.reportSection,
    reportGroup: base.reportGroup,
    k2ReportKey: base.k2ReportKey,
    defaultVatCodeId: inferDefaultVatCode(
      account.number,
      account.name
    ),
    source: "bas",
    status: "ready",
  };
}

export function getHistoricalAutoMapping(
  fiscalYear: number,
  account: Pick<BASAccount, "number" | "name">
): AccountReportMapping {
  const base = inferReportGroup(account.number);

  return {
    fiscalYear,
    reportSection: base.reportSection,
    reportGroup: base.reportGroup,
    k2ReportKey: base.k2ReportKey,
    defaultVatCodeId: inferDefaultVatCode(
      account.number,
      account.name
    ),
    source: "historical_auto",
    status: "needs_review",
  };
}

export function loadHistoricalAccounts(
  companyId: string
): HistoricalImportedAccount[] {
  if (!companyId) return [];

  const raw = appStorage.getItem(getStorageKey(companyId));

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as HistoricalImportedAccount[];

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (account) =>
          account &&
          typeof account.number === "string" &&
          typeof account.name === "string"
      )
      .map((account) => {
        const years = Array.isArray(account.years)
          ? account.years
              .map(Number)
              .filter(Number.isFinite)
              .sort((a, b) => a - b)
          : [];

        return {
          ...account,
          class:
            account.class ??
            getAccountClass(account.number),
          source: "sie" as const,
          years,
          firstSeenYear:
            account.firstSeenYear ??
            years[0] ??
            0,
          lastSeenYear:
            account.lastSeenYear ??
            years[years.length - 1] ??
            0,
          basStatusByYear:
            account.basStatusByYear ?? {},
          importedAt:
            account.importedAt ??
            new Date().toISOString(),
          reportMappings:
            account.reportMappings ?? {},
        };
      });
  } catch {
    return [];
  }
}

export function saveHistoricalAccounts(
  companyId: string,
  accounts: HistoricalImportedAccount[]
): void {
  if (!companyId) return;

  appStorage.setItem(
    getStorageKey(companyId),
    JSON.stringify(accounts)
  );
}

export function buildHistoricalImportedAccounts(
  candidates: HistoricalAccountCandidate[],
  existingAccounts: HistoricalImportedAccount[]
): HistoricalImportedAccount[] {
  const availableBasYears = new Set(
    getAvailableBASYears()
  );

  const result = new Map<
    string,
    HistoricalImportedAccount
  >();

  existingAccounts.forEach((account) => {
    result.set(account.number, {
      ...account,
      years: [...account.years],
      basStatusByYear: {
        ...account.basStatusByYear,
      },
      reportMappings: {
        ...account.reportMappings,
      },
    });
  });

  const now = new Date().toISOString();

  candidates.forEach((candidate) => {
    const basAccounts = getBASAccountsForYear(
      candidate.year,
      "K2"
    );

    const basHasAccount = basAccounts.some(
      (account) =>
        account.number === candidate.number
    );

    let basStatus: HistoricalBasStatus;

    if (!availableBasYears.has(candidate.year)) {
      basStatus = "bas_version_missing";
    } else if (basHasAccount) {
      basStatus = "in_bas";
    } else {
      basStatus = "not_in_bas";
    }

    const existing = result.get(candidate.number);

    const years = new Set(existing?.years ?? []);
    years.add(candidate.year);

    const sortedYears = Array.from(years).sort(
      (a, b) => a - b
    );

    const reportMappings = {
      ...(existing?.reportMappings ?? {}),
    };

    if (
      !reportMappings[String(candidate.year)]
    ) {
      reportMappings[String(candidate.year)] =
        getHistoricalAutoMapping(
          candidate.year,
          candidate
        );
    }

    result.set(candidate.number, {
      number: candidate.number,
      name: existing?.name || candidate.name,
      class:
        existing?.class ??
        getAccountClass(candidate.number),
      source: "sie",
      years: sortedYears,
      firstSeenYear: sortedYears[0],
      lastSeenYear:
        sortedYears[sortedYears.length - 1],
      basStatusByYear: {
        ...(existing?.basStatusByYear ?? {}),
        [String(candidate.year)]: basStatus,
      },
      importedAt:
        existing?.importedAt || now,
      reportMappings,
    });
  });

  return Array.from(result.values()).sort(
    (a, b) =>
      a.number.localeCompare(b.number)
  );
}

export function registerHistoricalAccountsFromSIE(
  companyId: string,
  parseResult: SIEParseResult
): HistoricalImportedAccount[] {
  if (!companyId) return [];

  const accountNames = new Map<string, string>();

  parseResult.accounts.forEach((account) => {
    accountNames.set(
      account.number,
      account.name
    );
  });

  const candidateMap = new Map<
    string,
    HistoricalAccountCandidate
  >();

  const addCandidate = (
    accountNumber: string,
    year: number
  ) => {
    if (
      !accountNumber ||
      !Number.isFinite(year)
    ) {
      return;
    }

    const key =
      accountNumber + ":" + String(year);

    if (candidateMap.has(key)) return;

    candidateMap.set(key, {
      number: accountNumber,
      name:
        accountNames.get(accountNumber) ||
        "Konto " + accountNumber,
      year,
    });
  };

  parseResult.vouchers.forEach((voucher) => {
    const year = Number(
      voucher.date.slice(0, 4)
    );

    voucher.lines.forEach((line) => {
      addCandidate(
        line.accountNumber,
        year
      );
    });
  });

  const fiscalYear = Number(
    parseResult.metadata.fiscalYearStart?.slice(
      0,
      4
    )
  );

  const fallbackYear =
    Number.isFinite(fiscalYear)
      ? fiscalYear
      : Number(
          parseResult.vouchers[0]?.date.slice(
            0,
            4
          )
        );

  if (Number.isFinite(fallbackYear)) {
    parseResult.openingBalances.forEach(
      (balance) => {
        addCandidate(
          balance.accountNumber,
          fallbackYear
        );
      }
    );

    parseResult.previousClosingBalances.forEach(
      (balance) => {
        addCandidate(
          balance.accountNumber,
          fallbackYear - 1
        );
      }
    );
  }

  const existing =
    loadHistoricalAccounts(companyId);

  const merged =
    buildHistoricalImportedAccounts(
      Array.from(candidateMap.values()),
      existing
    );

  saveHistoricalAccounts(
    companyId,
    merged
  );

  return merged;
}

export function getHistoricalAccountsEligibleForYear(
  historicalAccounts: HistoricalImportedAccount[],
  fiscalYear: number
): HistoricalImportedAccount[] {
  if (!Number.isFinite(fiscalYear)) {
    return [];
  }

  const basNumbers = new Set(
    getBASAccountsForYear(
      fiscalYear,
      "K2"
    ).map((account) => account.number)
  );

  return historicalAccounts.filter(
    (account) =>
      !basNumbers.has(account.number)
  );
}

export function confirmHistoricalAccountMapping(
  companyId: string,
  accountNumber: string,
  fiscalYear: number
): HistoricalImportedAccount | null {
  const accounts =
    loadHistoricalAccounts(companyId);

  const index = accounts.findIndex(
    (account) =>
      account.number === accountNumber
  );

  if (index < 0) return null;

  const account = accounts[index];

  const existingMapping =
    account.reportMappings[
      String(fiscalYear)
    ];

  const mapping =
    existingMapping ??
    getHistoricalAutoMapping(
      fiscalYear,
      account
    );

  const updated: HistoricalImportedAccount =
    {
      ...account,
      reportMappings: {
        ...account.reportMappings,
        [String(fiscalYear)]: {
          ...mapping,
          fiscalYear,
          source: "historical_reviewed",
          status: "ready",
        },
      },
    };

  accounts[index] = updated;

  saveHistoricalAccounts(
    companyId,
    accounts
  );

  return updated;
}

export function getHistoricalAccountYearsLabel(
  account: HistoricalImportedAccount
): string {
  if (account.years.length === 0) {
    return "Okänt år";
  }

  if (account.years.length === 1) {
    return String(account.years[0]);
  }

  return account.years.join(", ");
}

export function getAccountMappingForYear(
  fiscalYear: number,
  account: BASAccount,
  historicalAccounts: HistoricalImportedAccount[]
): AccountReportMapping {
  const basAccount =
    getBASAccountsForYear(
      fiscalYear,
      "K2"
    ).find(
      (entry) =>
        entry.number === account.number
    );

  if (basAccount) {
    return getBasReportMapping(
      fiscalYear,
      basAccount
    );
  }

  const historicalAccount =
    historicalAccounts.find(
      (entry) =>
        entry.number === account.number
    );

  const historicalMapping =
    historicalAccount?.reportMappings[
      String(fiscalYear)
    ];

  if (historicalMapping) {
    return historicalMapping;
  }

  return getHistoricalAutoMapping(
    fiscalYear,
    account
  );
}

export function getHistoricalAccountClass(
  accountNumber: string
): AccountClass {
  return getAccountClass(accountNumber);
}
