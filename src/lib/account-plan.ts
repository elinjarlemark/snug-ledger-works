import { appStorage } from "@/lib/appStorage";

import {
  BASAccount,
  AccountClass,
  getAccountClass,
  getBASAccountForYear,
  getBASAccountsForYear,
  getBASReportMetadataForAccount,
  getAvailableBASYears,
  getLatestBASYear,
} from "@/lib/bas-accounts";

import type {
  SIEParseResult,
} from "@/lib/sie";

export type ReportSection =
  | "balance"
  | "income";

export type MappingStatus =
  | "ready"
  | "needs_review";

export type HistoricalBasStatus =
  | "in_bas"
  | "not_in_bas"
  | "bas_version_missing";

export interface AccountReportMapping {
  fiscalYear: number;

  reportSection:
    ReportSection;

  reportGroup:
    string;

  k2ReportKey:
    string;

  defaultVatCodeId?:
    string;

  source:
    | "bas"
    | "historical_auto"
    | "historical_reviewed";

  status:
    MappingStatus;

  ink2rField?:
    string | null;

  sruCodes?:
    string;

  amountRule?:
    string;

  confidence?:
    string;

  notes?:
    string;
}

export interface HistoricalImportedAccount
  extends BASAccount {
  source:
    "sie";

  years:
    number[];

  firstSeenYear:
    number;

  lastSeenYear:
    number;

  basStatusByYear:
    Record<
      string,
      HistoricalBasStatus
    >;

  importedAt:
    string;

  reportMappings:
    Record<
      string,
      AccountReportMapping
    >;
}

export interface HistoricalAccountCandidate {
  number:
    string;

  name:
    string;

  year:
    number;
}

export const HISTORICAL_ACCOUNTS_KEY_PREFIX =
  "accountpro_historical_accounts_";

function getStorageKey(
  companyId: string
): string {
  return (
    HISTORICAL_ACCOUNTS_KEY_PREFIX +
    companyId
  );
}

function inRange(
  accountNumber: string,
  from: number,
  to: number
): boolean {
  const value =
    Number(
      accountNumber
    );

  return (
    Number.isFinite(
      value
    ) &&
    value >= from &&
    value <= to
  );
}

function inferHistoricalVatCode(
  accountNumber: string,
  accountName: string
):
  | string
  | undefined {
  const number =
    Number(
      accountNumber
    );

  if (
    !Number.isFinite(
      number
    ) ||
    number < 3000 ||
    number > 3999
  ) {
    return undefined;
  }

  const name =
    accountName
      .toLowerCase();

  if (
    name.includes(
      "25 %"
    ) ||
    name.includes(
      "25%"
    )
  ) {
    return "SE25";
  }

  if (
    name.includes(
      "12 %"
    ) ||
    name.includes(
      "12%"
    )
  ) {
    return "SE12";
  }

  if (
    name.includes(
      "6 %"
    ) ||
    name.includes(
      "6%"
    )
  ) {
    return "SE6";
  }

  if (
    name.includes(
      "momsfri"
    )
  ) {
    return "SE0";
  }

  return undefined;
}

function inferFallbackReportGroup(
  accountNumber: string
): {
  reportSection:
    ReportSection;

  reportGroup:
    string;

  reportKey:
    string;
} {
  if (
    inRange(
      accountNumber,
      1000,
      1099
    )
  ) {
    return {
      reportSection:
        "balance",

      reportGroup:
        "Immateriella anläggningstillgångar",

      reportKey:
        "immateriella_anlaggningstillgangar",
    };
  }

  if (
    inRange(
      accountNumber,
      1100,
      1299
    )
  ) {
    return {
      reportSection:
        "balance",

      reportGroup:
        "Materiella anläggningstillgångar",

      reportKey:
        "materiella_anlaggningstillgangar",
    };
  }

  if (
    inRange(
      accountNumber,
      1300,
      1399
    )
  ) {
    return {
      reportSection:
        "balance",

      reportGroup:
        "Finansiella anläggningstillgångar",

      reportKey:
        "finansiella_anlaggningstillgangar",
    };
  }

  if (
    inRange(
      accountNumber,
      1400,
      1499
    )
  ) {
    return {
      reportSection:
        "balance",

      reportGroup:
        "Varulager m.m.",

      reportKey:
        "varulager",
    };
  }

  if (
    inRange(
      accountNumber,
      1500,
      1799
    )
  ) {
    return {
      reportSection:
        "balance",

      reportGroup:
        "Kortfristiga fordringar",

      reportKey:
        "kortfristiga_fordringar",
    };
  }

  if (
    inRange(
      accountNumber,
      1800,
      1899
    )
  ) {
    return {
      reportSection:
        "balance",

      reportGroup:
        "Kortfristiga placeringar",

      reportKey:
        "kortfristiga_placeringar",
    };
  }

  if (
    inRange(
      accountNumber,
      1900,
      1999
    )
  ) {
    return {
      reportSection:
        "balance",

      reportGroup:
        "Kassa och bank",

      reportKey:
        "kassa_och_bank",
    };
  }

  if (
    inRange(
      accountNumber,
      2000,
      2099
    )
  ) {
    return {
      reportSection:
        "balance",

      reportGroup:
        "Eget kapital",

      reportKey:
        "eget_kapital",
    };
  }

  if (
    inRange(
      accountNumber,
      2100,
      2199
    )
  ) {
    return {
      reportSection:
        "balance",

      reportGroup:
        "Obeskattade reserver",

      reportKey:
        "obeskattade_reserver",
    };
  }

  if (
    inRange(
      accountNumber,
      2200,
      2299
    )
  ) {
    return {
      reportSection:
        "balance",

      reportGroup:
        "Avsättningar",

      reportKey:
        "avsattningar",
    };
  }

  if (
    inRange(
      accountNumber,
      2300,
      2399
    )
  ) {
    return {
      reportSection:
        "balance",

      reportGroup:
        "Långfristiga skulder",

      reportKey:
        "langfristiga_skulder",
    };
  }

  if (
    inRange(
      accountNumber,
      2400,
      2999
    )
  ) {
    return {
      reportSection:
        "balance",

      reportGroup:
        "Kortfristiga skulder",

      reportKey:
        "kortfristiga_skulder",
    };
  }

  if (
    inRange(
      accountNumber,
      3000,
      3799
    )
  ) {
    return {
      reportSection:
        "income",

      reportGroup:
        "Nettoomsättning",

      reportKey:
        "nettoomsattning",
    };
  }

  if (
    inRange(
      accountNumber,
      3800,
      3999
    )
  ) {
    return {
      reportSection:
        "income",

      reportGroup:
        "Övriga rörelseintäkter",

      reportKey:
        "ovriga_rorelseintakter",
    };
  }

  if (
    inRange(
      accountNumber,
      4000,
      4999
    )
  ) {
    return {
      reportSection:
        "income",

      reportGroup:
        "Råvaror, förnödenheter och handelsvaror",

      reportKey:
        "ravaror_och_handelsvaror",
    };
  }

  if (
    inRange(
      accountNumber,
      5000,
      6999
    )
  ) {
    return {
      reportSection:
        "income",

      reportGroup:
        "Övriga externa kostnader",

      reportKey:
        "ovriga_externa_kostnader",
    };
  }

  if (
    inRange(
      accountNumber,
      7000,
      7699
    )
  ) {
    return {
      reportSection:
        "income",

      reportGroup:
        "Personalkostnader",

      reportKey:
        "personalkostnader",
    };
  }

  if (
    inRange(
      accountNumber,
      7700,
      7899
    )
  ) {
    return {
      reportSection:
        "income",

      reportGroup:
        "Av- och nedskrivningar",

      reportKey:
        "avskrivningar",
    };
  }

  if (
    inRange(
      accountNumber,
      8000,
      8399
    )
  ) {
    return {
      reportSection:
        "income",

      reportGroup:
        "Finansiella intäkter",

      reportKey:
        "finansiella_intakter",
    };
  }

  if (
    inRange(
      accountNumber,
      8400,
      8499
    )
  ) {
    return {
      reportSection:
        "income",

      reportGroup:
        "Finansiella kostnader",

      reportKey:
        "finansiella_kostnader",
    };
  }

  if (
    inRange(
      accountNumber,
      8800,
      8899
    )
  ) {
    return {
      reportSection:
        "income",

      reportGroup:
        "Bokslutsdispositioner",

      reportKey:
        "bokslutsdispositioner",
    };
  }

  return {
    reportSection:
      "income",

    reportGroup:
      "Skatt och årets resultat",

    reportKey:
      "skatt_och_resultat",
  };
}

export function getBasReportMapping(
  fiscalYear: number,
  account:
    Pick<
      BASAccount,
      | "number"
      | "name"
      | "report"
      | "defaultVatCodeId"
    >
): AccountReportMapping {
  const report =
    account.report ||
    getBASReportMetadataForAccount(
      fiscalYear,
      account.number
    );

  if (report) {
    const fallback =
      inferFallbackReportGroup(
        account.number
      );

    const reportSection:
      ReportSection =
      report.reportSection ===
      "balance"
        ? "balance"
        : report.reportSection ===
            "income"
          ? "income"
          : fallback.reportSection;

    return {
      fiscalYear,

      reportSection,

      reportGroup:
        report.reportGroup ||
        fallback.reportGroup,

      // Behåller fältnamnet
      // k2ReportKey eftersom andra
      // komponenter redan använder det.
      //
      // För BAS 2026 innehåller det
      // den exakta INK2R-kopplingen
      // från projektets fullständiga
      // konto-mapping.
      k2ReportKey:
        report.ink2rField
          ? "INK2R " +
            report.ink2rField
          : fallback.reportKey,

      defaultVatCodeId:
        account.defaultVatCodeId,

      source:
        "bas",

      status:
        "ready",

      ink2rField:
        report.ink2rField,

      sruCodes:
        report.sruCodes,

      amountRule:
        report.amountRule,

      confidence:
        report.confidence,

      notes:
        report.notes,
    };
  }

  // För äldre BAS-år där vi ännu
  // inte har en fullständig separat
  // konto-mapping används denna
  // klassificering.
  //
  // Den används INTE för BAS 2026,
  // eftersom samtliga unika 2026-
  // konton har exakt mapping.

  const fallback =
    inferFallbackReportGroup(
      account.number
    );

  return {
    fiscalYear,

    reportSection:
      fallback.reportSection,

    reportGroup:
      fallback.reportGroup,

    k2ReportKey:
      fallback.reportKey,

    defaultVatCodeId:
      account.defaultVatCodeId,

    source:
      "bas",

    status:
      "ready",
  };
}

export function getHistoricalAutoMapping(
  fiscalYear: number,
  account:
    Pick<
      BASAccount,
      "number" | "name"
    >
): AccountReportMapping {
  // Om kontot faktiskt finns i
  // årets BAS använder vi dess
  // exakta mapping.

  const basAccount =
    getBASAccountForYear(
      fiscalYear,
      account.number
    );

  if (basAccount) {
    const exact =
      getBasReportMapping(
        fiscalYear,
        basAccount
      );

    return {
      ...exact,

      source:
        "historical_auto",

      status:
        "needs_review",
    };
  }

  // Kontot finns inte i årets BAS.
  //
  // Förslaget nedan får därför aldrig
  // automatiskt klassas som färdig-
  // granskat.

  const fallback =
    inferFallbackReportGroup(
      account.number
    );

  return {
    fiscalYear,

    reportSection:
      fallback.reportSection,

    reportGroup:
      fallback.reportGroup,

    k2ReportKey:
      fallback.reportKey,

    defaultVatCodeId:
      inferHistoricalVatCode(
        account.number,
        account.name
      ),

    source:
      "historical_auto",

    status:
      "needs_review",
  };
}

export function loadHistoricalAccounts(
  companyId: string
):
  HistoricalImportedAccount[] {
  if (!companyId) {
    return [];
  }

  const raw =
    appStorage.getItem(
      getStorageKey(
        companyId
      )
    );

  if (!raw) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(
        raw
      ) as HistoricalImportedAccount[];

    if (
      !Array.isArray(
        parsed
      )
    ) {
      return [];
    }

    return parsed
      .filter(
        (account) =>
          account &&
          typeof account.number ===
            "string" &&
          typeof account.name ===
            "string"
      )
      .map(
        (account) => {
          const years =
            Array.isArray(
              account.years
            )
              ? account.years
                  .map(Number)
                  .filter(
                    Number.isFinite
                  )
                  .sort(
                    (a, b) =>
                      a - b
                  )
              : [];

          return {
            ...account,

            class:
              account.class ||
              getAccountClass(
                account.number
              ),

            source:
              "sie" as const,

            years,

            firstSeenYear:
              account.firstSeenYear ||
              years[0] ||
              0,

            lastSeenYear:
              account.lastSeenYear ||
              years[
                years.length - 1
              ] ||
              0,

            basStatusByYear:
              account.basStatusByYear ||
              {},

            importedAt:
              account.importedAt ||
              new Date()
                .toISOString(),

            reportMappings:
              account.reportMappings ||
              {},
          };
        }
      )
      .sort(
        (a, b) =>
          a.number.localeCompare(
            b.number
          )
      );
  } catch {
    return [];
  }
}

export function saveHistoricalAccounts(
  companyId: string,
  accounts:
    HistoricalImportedAccount[]
): void {
  if (!companyId) {
    return;
  }

  appStorage.setItem(
    getStorageKey(
      companyId
    ),

    JSON.stringify(
      accounts
    )
  );
}

export function buildHistoricalImportedAccounts(
  candidates:
    HistoricalAccountCandidate[],

  existingAccounts:
    HistoricalImportedAccount[]
):
  HistoricalImportedAccount[] {
  const availableBasYears =
    new Set(
      getAvailableBASYears()
    );

  const result =
    new Map<
      string,
      HistoricalImportedAccount
    >();

  existingAccounts.forEach(
    (account) => {
      result.set(
        account.number,
        {
          ...account,

          years: [
            ...account.years,
          ],

          basStatusByYear: {
            ...account.basStatusByYear,
          },

          reportMappings: {
            ...account.reportMappings,
          },
        }
      );
    }
  );

  const now =
    new Date()
      .toISOString();

  candidates.forEach(
    (candidate) => {
      const basAccounts =
        getBASAccountsForYear(
          candidate.year,
          "K2"
        );

      const basHasAccount =
        basAccounts.some(
          (account) =>
            account.number ===
            candidate.number
        );

      let basStatus:
        HistoricalBasStatus;

      if (
        !availableBasYears.has(
          candidate.year
        )
      ) {
        basStatus =
          "bas_version_missing";
      } else if (
        basHasAccount
      ) {
        basStatus =
          "in_bas";
      } else {
        basStatus =
          "not_in_bas";
      }

      const existing =
        result.get(
          candidate.number
        );

      const years =
        new Set(
          existing?.years ||
            []
        );

      years.add(
        candidate.year
      );

      const sortedYears =
        Array.from(
          years
        ).sort(
          (a, b) =>
            a - b
        );

      const reportMappings = {
        ...(
          existing?.reportMappings ||
          {}
        ),
      };

      if (
        !reportMappings[
          String(
            candidate.year
          )
        ]
      ) {
        reportMappings[
          String(
            candidate.year
          )
        ] =
          getHistoricalAutoMapping(
            candidate.year,
            candidate
          );
      }

      result.set(
        candidate.number,
        {
          number:
            candidate.number,

          name:
            existing?.name ||
            candidate.name,

          class:
            existing?.class ||
            getAccountClass(
              candidate.number
            ),

          source:
            "sie",

          years:
            sortedYears,

          firstSeenYear:
            sortedYears[0],

          lastSeenYear:
            sortedYears[
              sortedYears.length -
                1
            ],

          basStatusByYear: {
            ...(
              existing?.basStatusByYear ||
              {}
            ),

            [String(
              candidate.year
            )]:
              basStatus,
          },

          importedAt:
            existing?.importedAt ||
            now,

          reportMappings,
        }
      );
    }
  );

  return Array.from(
    result.values()
  ).sort(
    (a, b) =>
      a.number.localeCompare(
        b.number
      )
  );
}

export function registerHistoricalAccountsFromSIE(
  companyId: string,
  parseResult:
    SIEParseResult
):
  HistoricalImportedAccount[] {
  if (!companyId) {
    return [];
  }

  const accountNames =
    new Map<
      string,
      string
    >();

  parseResult.accounts.forEach(
    (account) => {
      accountNames.set(
        account.number,
        account.name
      );
    }
  );

  const candidateMap =
    new Map<
      string,
      HistoricalAccountCandidate
    >();

  const addCandidate = (
    accountNumber: string,
    year: number
  ) => {
    if (
      !accountNumber ||
      !Number.isFinite(
        year
      )
    ) {
      return;
    }

    const key =
      accountNumber +
      ":" +
      String(year);

    if (
      candidateMap.has(
        key
      )
    ) {
      return;
    }

    candidateMap.set(
      key,
      {
        number:
          accountNumber,

        name:
          accountNames.get(
            accountNumber
          ) ||
          "Konto " +
            accountNumber,

        year,
      }
    );
  };

  parseResult.vouchers.forEach(
    (voucher) => {
      const year =
        Number(
          voucher.date.slice(
            0,
            4
          )
        );

      voucher.lines.forEach(
        (line) => {
          addCandidate(
            line.accountNumber,
            year
          );
        }
      );
    }
  );

  const fiscalYear =
    Number(
      parseResult.metadata
        .fiscalYearStart
        ?.slice(
          0,
          4
        )
    );

  const fallbackYear =
    Number.isFinite(
      fiscalYear
    )
      ? fiscalYear
      : Number(
          parseResult
            .vouchers[0]
            ?.date.slice(
              0,
              4
            )
        );

  if (
    Number.isFinite(
      fallbackYear
    )
  ) {
    parseResult
      .openingBalances
      .forEach(
        (balance) => {
          addCandidate(
            balance.accountNumber,
            fallbackYear
          );
        }
      );

    parseResult
      .previousClosingBalances
      .forEach(
        (balance) => {
          addCandidate(
            balance.accountNumber,
            fallbackYear - 1
          );
        }
      );
  }

  const existing =
    loadHistoricalAccounts(
      companyId
    );

  const merged =
    buildHistoricalImportedAccounts(
      Array.from(
        candidateMap.values()
      ),
      existing
    );

  saveHistoricalAccounts(
    companyId,
    merged
  );

  return merged;
}

export function getHistoricalAccountsEligibleForYear(
  historicalAccounts:
    HistoricalImportedAccount[],

  fiscalYear: number
):
  HistoricalImportedAccount[] {
  if (
    !Number.isFinite(
      fiscalYear
    )
  ) {
    return [];
  }

  const basNumbers =
    new Set(
      getBASAccountsForYear(
        fiscalYear,
        "K2"
      ).map(
        (account) =>
          account.number
      )
    );

  // Här ligger själva regeln vi
  // bestämde:
  //
  // Ett historiskt konto får bara
  // visas som specialalternativ om
  // företaget faktiskt har använt
  // kontot tidigare OCH kontot inte
  // finns i årets BAS.

  return historicalAccounts.filter(
    (account) =>
      !basNumbers.has(
        account.number
      )
  );
}

export function confirmHistoricalAccountMapping(
  companyId: string,
  accountNumber: string,
  fiscalYear: number
):
  | HistoricalImportedAccount
  | null {
  const accounts =
    loadHistoricalAccounts(
      companyId
    );

  const index =
    accounts.findIndex(
      (account) =>
        account.number ===
        accountNumber
    );

  if (
    index < 0
  ) {
    return null;
  }

  const account =
    accounts[index];

  const existingMapping =
    account.reportMappings[
      String(
        fiscalYear
      )
    ];

  const mapping =
    existingMapping ||
    getHistoricalAutoMapping(
      fiscalYear,
      account
    );

  const updated:
    HistoricalImportedAccount =
    {
      ...account,

      reportMappings: {
        ...account.reportMappings,

        [String(
          fiscalYear
        )]: {
          ...mapping,

          fiscalYear,

          source:
            "historical_reviewed",

          status:
            "ready",
        },
      },
    };

  accounts[index] =
    updated;

  saveHistoricalAccounts(
    companyId,
    accounts
  );

  return updated;
}

export function getHistoricalAccountYearsLabel(
  account:
    HistoricalImportedAccount
): string {
  if (
    account.years.length ===
    0
  ) {
    return "Okänt år";
  }

  if (
    account.years.length ===
    1
  ) {
    return String(
      account.years[0]
    );
  }

  return account.years.join(
    ", "
  );
}

export function getAccountMappingForYear(
  fiscalYear: number,
  account:
    BASAccount,
  historicalAccounts:
    HistoricalImportedAccount[]
):
  AccountReportMapping {
  const basAccount =
    getBASAccountForYear(
      fiscalYear,
      account.number
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
        entry.number ===
        account.number
    );

  const historicalMapping =
    historicalAccount
      ?.reportMappings[
        String(
          fiscalYear
        )
      ];

  if (
    historicalMapping
  ) {
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
  return getAccountClass(
    accountNumber
  );
}

export function getLatestInstalledBASYear():
  | number
  | null {
  return getLatestBASYear();
}
