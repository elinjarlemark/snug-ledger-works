import {
  INK2_ACCOUNT_MAPPING_2026,
  type Ink2AccountMapping,
} from "@/lib/ink2Mapping2026";

// AccountPro är K2-only.
//
// BAS-kontoplanen läses direkt från årsvisa CSV-filer.
// Vi har därför ingen handskriven delmängd av BAS-konton.
//
// För BAS 2026 kompletteras varje konto med den fullständiga
// INK2-mappningen som redan finns i projektet.
// ink2Mapping2026.ts innehåller samtliga unika kontonummer
// från BAS_kontoplan_2026.csv.

export type AccountClass =
  | "asset"
  | "equity_liability"
  | "revenue"
  | "expense";

export type AccountingStandard =
  | "K2"
  | "K3"
  | "";

export type BASReportSection =
  | "balance"
  | "income"
  | "none";

export interface BASReportMetadata {
  reportSection: BASReportSection;
  reportGroup: string;

  ink2rField: string | null;
  ink2rLabel?: string;

  section?: string;
  sruCodes?: string;
  amountRule?: string;

  confidence?: string;
  notes?: string;
}

export interface BASAccount {
  number: string;
  name: string;

  class: AccountClass;

  description?: string;

  k3Only?: boolean;

  basYear?: number;

  source?: "bas" | "sie";

  report?: BASReportMetadata;

  defaultVatCodeId?: string;
}

const BAS_CSV_FILES =
  import.meta.glob(
    "../data/bas/BAS_kontoplan_*.csv",
    {
      query: "?raw",
      import: "default",
      eager: true,
    }
  ) as Record<string, string>;

function parseCsvRow(
  line: string
): string[] {
  const result: string[] = [];

  let current = "";
  let inQuotes = false;

  for (
    let index = 0;
    index < line.length;
    index += 1
  ) {
    const char =
      line[index];

    if (char === '"') {
      if (
        inQuotes &&
        line[index + 1] === '"'
      ) {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes =
        !inQuotes;

      continue;
    }

    if (
      (char === "," ||
        char === ";") &&
      !inQuotes
    ) {
      result.push(
        current.trim()
      );

      current = "";

      continue;
    }

    current += char;
  }

  result.push(
    current.trim()
  );

  return result;
}

function parseBasYearFromPath(
  path: string
): number | null {
  const match =
    path.match(
      /BAS_kontoplan_(\d{4})\.csv$/
    );

  if (!match) {
    return null;
  }

  const year =
    Number(match[1]);

  if (
    !Number.isFinite(year)
  ) {
    return null;
  }

  return year;
}

function fallbackAccountClass(
  accountNumber: string
): AccountClass {
  const firstDigit =
    Number(
      accountNumber.charAt(0)
    );

  if (
    firstDigit === 1
  ) {
    return "asset";
  }

  if (
    firstDigit === 2
  ) {
    return "equity_liability";
  }

  if (
    firstDigit === 3
  ) {
    return "revenue";
  }

  return "expense";
}

function classFromMapping(
  accountNumber: string,
  mapping:
    | Ink2AccountMapping
    | undefined
): AccountClass {
  if (!mapping) {
    return fallbackAccountClass(
      accountNumber
    );
  }

  const section =
    (
      mapping.section ||
      ""
    ).toLowerCase();

  const amountRule =
    (
      mapping.amountRule ||
      ""
    ).toLowerCase();

  if (
    section.includes(
      "balans - tillgångar"
    )
  ) {
    return "asset";
  }

  if (
    section.includes(
      "balans - eget kapital/skulder"
    )
  ) {
    return "equity_liability";
  }

  if (
    amountRule.startsWith(
      "intäkt"
    )
  ) {
    return "revenue";
  }

  if (
    amountRule.startsWith(
      "kostnad"
    )
  ) {
    return "expense";
  }

  return fallbackAccountClass(
    accountNumber
  );
}

function reportMetadataFromMapping(
  mapping:
    | Ink2AccountMapping
    | undefined
):
  | BASReportMetadata
  | undefined {
  if (!mapping) {
    return undefined;
  }

  const section =
    mapping.section || "";

  let reportSection:
    BASReportSection =
    "none";

  if (
    section.includes(
      "Balans"
    )
  ) {
    reportSection =
      "balance";
  } else if (
    section.includes(
      "Resultat"
    )
  ) {
    reportSection =
      "income";
  }

  return {
    reportSection,

    reportGroup:
      mapping.ink2rLabel ||
      mapping.section ||
      "Ingen separat rapportpost",

    ink2rField:
      mapping.ink2rField,

    ink2rLabel:
      mapping.ink2rLabel,

    section:
      mapping.section,

    sruCodes:
      mapping.sruCodes,

    amountRule:
      mapping.amountRule,

    confidence:
      mapping.confidence,

    notes:
      mapping.notes,
  };
}

function inferDefaultVatCodeId(
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
    )
  ) {
    return undefined;
  }

  // Vi sätter endast automatisk momskod
  // när informationen uttryckligen framgår
  // av ett försäljningskontos namn.
  //
  // Komplexa EU-, export-, import- och
  // omvänd-momsfall ska inte gissas.

  if (
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

function getInk2MappingForYear(
  year: number,
  accountNumber: string
):
  | Ink2AccountMapping
  | undefined {
  // Den fullständiga
  // kontospecifika mapping som
  // finns i projektet gäller
  // BAS 2026.

  if (
    year !== 2026
  ) {
    return undefined;
  }

  return (
    INK2_ACCOUNT_MAPPING_2026[
      accountNumber
    ]
  );
}

function parseBasCsv(
  csvContent: string,
  year: number
): BASAccount[] {
  const lines =
    csvContent
      .split(/\r?\n/)
      .map(
        (line) =>
          line.trim()
      )
      .filter(
        (line) =>
          line.length > 0
      );

  const accountsByNumber =
    new Map<
      string,
      BASAccount
    >();

  for (
    const line of lines
  ) {
    const columns =
      parseCsvRow(line);

    if (
      columns.length < 2
    ) {
      continue;
    }

    const accountNumber =
      columns[0].trim();

    if (
      !/^\d{4}$/.test(
        accountNumber
      )
    ) {
      continue;
    }

    const csvName =
      columns[1].trim();

    if (!csvName) {
      continue;
    }

    const k3Marker =
      (
        columns[2] ||
        ""
      )
        .trim()
        .toLowerCase();

    const mapping =
      getInk2MappingForYear(
        year,
        accountNumber
      );

    // BAS 2026 CSV:n innehåller
    // några dubbla kontonummer.
    //
    // 2026-mappingen har redan ett
    // kanoniskt namn för dessa.
    //
    // Exempel:
    // 2087 förekommer med två olika
    // benämningar i CSV-filen.
    //
    // Mappningen använder därför:
    // "Bunden överkursfond / Insatsemission".

    const accountName =
      mapping?.accountName ||
      csvName;

    const existing =
      accountsByNumber.get(
        accountNumber
      );

    const k3Only =
      k3Marker === "x" ||
      existing?.k3Only ===
        true;

    const account:
      BASAccount = {
      number:
        accountNumber,

      name:
        accountName,

      class:
        classFromMapping(
          accountNumber,
          mapping
        ),

      description:
        mapping?.ink2rField &&
        mapping.ink2rLabel
          ? "INK2R " +
            mapping.ink2rField +
            " – " +
            mapping.ink2rLabel
          : mapping?.notes,

      k3Only,

      basYear:
        year,

      source:
        "bas",

      report:
        reportMetadataFromMapping(
          mapping
        ),

      defaultVatCodeId:
        inferDefaultVatCodeId(
          accountNumber,
          accountName
        ),
    };

    accountsByNumber.set(
      accountNumber,
      account
    );
  }

  return Array.from(
    accountsByNumber.values()
  ).sort(
    (a, b) =>
      a.number.localeCompare(
        b.number
      )
  );
}

function filterAccountsForAccountPro(
  accounts: BASAccount[]
): BASAccount[] {
  // AccountPro stöder endast K2.
  //
  // Konton som är markerade
  // som K3-only i BAS-filen
  // visas därför aldrig.

  return accounts.filter(
    (account) =>
      !account.k3Only
  );
}

function getRawBASAccountsForYear(
  year: number
): BASAccount[] {
  const suffix =
    "BAS_kontoplan_" +
    String(year) +
    ".csv";

  const entry =
    Object.entries(
      BAS_CSV_FILES
    ).find(
      ([path]) =>
        path.endsWith(
          suffix
        )
    );

  if (!entry) {
    return [];
  }

  return parseBasCsv(
    entry[1],
    year
  );
}

export function getAvailableBASYears():
  number[] {
  return Object.keys(
    BAS_CSV_FILES
  )
    .map(
      parseBasYearFromPath
    )
    .filter(
      (
        year
      ): year is number =>
        year !== null
    )
    .filter(
      (
        year,
        index,
        years
      ) =>
        years.indexOf(
          year
        ) ===
        index
    )
    .sort(
      (a, b) =>
        a - b
    );
}

export function getLatestBASYear():
  | number
  | null {
  const years =
    getAvailableBASYears();

  if (
    years.length === 0
  ) {
    return null;
  }

  return years[
    years.length - 1
  ];
}

export function hasBASYear(
  year: number
): boolean {
  return getAvailableBASYears()
    .includes(year);
}

export function getBASVersionLabel(
  year: number
): string {
  return (
    "BAS " +
    String(year)
  );
}

export function getBASAccountsForYear(
  year: number,
  _accountingStandard:
    AccountingStandard =
    "K2"
): BASAccount[] {
  return filterAccountsForAccountPro(
    getRawBASAccountsForYear(
      year
    )
  );
}

export function getBASAccountsForDate(
  date: string,
  accountingStandard:
    AccountingStandard =
    "K2"
): BASAccount[] {
  const year =
    Number(
      date.slice(
        0,
        4
      )
    );

  if (
    !Number.isFinite(
      year
    )
  ) {
    return [];
  }

  // Ingen fallback.
  //
  // En verifikation daterad
  // 2026 använder BAS 2026.
  //
  // Finns inte BAS för året
  // används inte ett annat års
  // kontoplan automatiskt.

  return getBASAccountsForYear(
    year,
    accountingStandard
  );
}

export function getLatestBASAccounts(
  accountingStandard:
    AccountingStandard =
    "K2"
): BASAccount[] {
  const latestYear =
    getLatestBASYear();

  if (!latestYear) {
    return [];
  }

  return getBASAccountsForYear(
    latestYear,
    accountingStandard
  );
}

export function getBASAccountForYear(
  year: number,
  accountNumber: string
):
  | BASAccount
  | undefined {
  return getBASAccountsForYear(
    year,
    "K2"
  ).find(
    (account) =>
      account.number ===
      accountNumber
  );
}

export function getBASReportMetadataForAccount(
  year: number,
  accountNumber: string
):
  | BASReportMetadata
  | undefined {
  return getBASAccountForYear(
    year,
    accountNumber
  )?.report;
}

export function getAccountClass(
  accountNumber: string
): AccountClass {
  const mapping =
    INK2_ACCOUNT_MAPPING_2026[
      accountNumber
    ];

  return classFromMapping(
    accountNumber,
    mapping
  );
}

export function getAccountClassName(
  accountClass: AccountClass
): string {
  switch (
    accountClass
  ) {
    case "asset":
      return "Tillgång";

    case "equity_liability":
      return "Eget kapital / skuld";

    case "revenue":
      return "Intäkt";

    case "expense":
      return "Kostnad";
  }
}

export function calculateBalance(
  accountClass:
    AccountClass,
  totalDebit: number,
  totalCredit: number
): number {
  if (
    accountClass ===
      "asset" ||
    accountClass ===
      "expense"
  ) {
    return (
      totalDebit -
      totalCredit
    );
  }

  return (
    totalCredit -
    totalDebit
  );
}

export function isBalanceNormal(
  _accountClass:
    AccountClass,
  balance: number
): boolean {
  return balance >= 0;
}

// Behåll exportnamnet eftersom äldre
// kod kan importera detta.
//
// Skillnaden mot tidigare är att detta
// INTE längre är en handskriven lista
// med några få konton.
//
// Den innehåller hela den senaste
// installerade K2-BAS-kontoplanen.

export const DEFAULT_BAS_ACCOUNTS:
  BASAccount[] =
  (() => {
    const latestYear =
      getLatestBASYear();

    if (!latestYear) {
      return [];
    }

    return getBASAccountsForYear(
      latestYear,
      "K2"
    );
  })();

export function isValidAccountNumber(
  accountNumber: string
): boolean {
  return /^\d{4}$/.test(
    accountNumber
  );
}

export function formatCurrency(
  amount: number
): string {
  return new Intl.NumberFormat(
    "sv-SE",
    {
      style:
        "currency",

      currency:
        "SEK",

      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  ).format(amount);
}

export function formatAmount(
  amount: number
): string {
  return new Intl.NumberFormat(
    "sv-SE",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  ).format(amount);
}
