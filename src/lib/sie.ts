import {
  BASAccount,
  getAccountClass,
} from "./bas-accounts";

import type {
  Voucher,
  VoucherLine,
} from "@/contexts/AccountingContexts";

import {
  fromOre,
  roundToOre,
  toOre,
  validateBookkeepingLines,
} from "@/lib/money";

export interface SIEAccount {
  number: string;
  name: string;
}

export interface SIEVoucher {
  series: string;
  number: number;

  date: string;

  description:
    string;

  lines:
    VoucherLine[];

  // Datum och signatur som källfilen uppgav vid #VER.
  registrationDate?: string;
  signature?: string;
}

export interface SIEBalance {
  accountNumber:
    string;

  amount:
    number;
}

export interface SIEParseResult {
  accounts:
    SIEAccount[];

  vouchers:
    SIEVoucher[];

  openingBalances:
    SIEBalance[];

  previousClosingBalances:
    SIEBalance[];

  metadata: {
    companyName?:
      string;

    organizationNumber?:
      string;

    fiscalYearStart?:
      string;

    fiscalYearEnd?:
      string;
  };

  errors:
    string[];
}

function addVoucherValidationErrors(
  result:
    SIEParseResult,

  voucher:
    SIEVoucher,

  lineNumber:
    number
): boolean {
  const validation =
    validateBookkeepingLines(
      voucher.lines
    );

  if (
    validation.isValid
  ) {
    return true;
  }

  validation.errors.forEach(
    (error) => {
      result.errors.push(
        "Rad " +
        String(
          lineNumber
        ) +
        ": Verifikation " +
        voucher.series +
        String(
          voucher.number
        ) +
        " är ogiltig: " +
        error.message
      );
    }
  );

  return false;
}

function validateBalanceCollection(
  balances:
    SIEBalance[],

  label:
    string,

  errors:
    string[]
): void {
  if (
    balances.length ===
    0
  ) {
    return;
  }

  let totalOre =
    0;

  balances.forEach(
    (balance) => {
      const ore =
        toOre(
          balance.amount
        );

      if (
        ore !== null
      ) {
        totalOre +=
          ore;
      }
    }
  );

  if (
    totalOre !== 0
  ) {
    errors.push(
      label +
      " är inte balanserad. Nettoskillnad: " +
      fromOre(
        Math.abs(
          totalOre
        )
      ).toFixed(2) +
      " SEK."
    );
  }
}

export function parseSIEFile(content: string): SIEParseResult {
  const result: SIEParseResult = {
    accounts: [],
    vouchers: [],
    openingBalances: [],
    previousClosingBalances: [],
    metadata: {},
    errors: [],
  };

  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const seenIdentities = new Set<string>();
  let currentVoucher: SIEVoucher | null = null;
  let inVoucherBlock = false;

  // Ett verifikationsnummer är unikt inom serie och räkenskapsår.
  // Brutna räkenskapsår behöver därför skiljas från kalenderår.
  const fiscalPeriodKey = (date: string): string => {
    const firstDay = result.metadata.fiscalYearStart?.slice(5) || "01-01";
    const startYear = Number(date.slice(0, 4)) - (date.slice(5) < firstDay ? 1 : 0);
    return String(startYear) + "-" + firstDay;
  };

  const completeVoucher = (lineNumber: number) => {
    if (!currentVoucher) return;

    const identity = [
      currentVoucher.series,
      String(currentVoucher.number),
      fiscalPeriodKey(currentVoucher.date),
    ].join(":");

    if (seenIdentities.has(identity)) {
      result.errors.push(
        "Rad " + lineNumber + ": Dubblerat ursprungligt verifikationsnummer " +
        currentVoucher.series + currentVoucher.number +
        " under räkenskapsåret som börjar " + fiscalPeriodKey(currentVoucher.date) +
        ". Importen stoppas för att undvika att bokföring skrivs över."
      );
    } else {
      seenIdentities.add(identity);
      if (addVoucherValidationErrors(result, currentVoucher, lineNumber)) {
        result.vouchers.push(currentVoucher);
      }
    }

    currentVoucher = null;
    inVoucherBlock = false;
  };

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line) return;

    if (line === "{") {
      if (currentVoucher) inVoucherBlock = true;
      return;
    }

    if (line === "}") {
      if (currentVoucher && inVoucherBlock) completeVoucher(lineNumber);
      return;
    }

    if (!line.startsWith("#")) return;
    const parsed = parseSIELine(line);
    if (!parsed) return;

    const { command, values } = parsed;
    switch (command) {
      case "FNAMN":
        result.metadata.companyName = values[0] || "";
        break;

      case "ORGNR":
        result.metadata.organizationNumber = values[0] || "";
        break;

      case "RAR":
        if (values[0] === "0" && values.length >= 3) {
          const startDate = parseSIEDate(values[1]);
          const endDate = parseSIEDate(values[2]);
          if (startDate) result.metadata.fiscalYearStart = startDate;
          if (endDate) result.metadata.fiscalYearEnd = endDate;
          if (!startDate || !endDate) {
            result.errors.push("Rad " + lineNumber + ": Ogiltig räkenskapsperiod i #RAR.");
          }
        }
        break;

      case "KONTO":
        if (values.length >= 2 && values[0] && values[1]) {
          result.accounts.push({ number: values[0], name: values[1] });
        }
        break;

      case "VER": {
        if (currentVoucher) {
          result.errors.push(
            "Rad " + lineNumber + ": Föregående verifikation stängdes inte före nästa #VER."
          );
          currentVoucher = null;
          inVoucherBlock = false;
        }
        const series = values[0] || "A";
        const number = Number(values[1]);
        const date = parseSIEDate(values[2]);
        if (
          values.length < 3 ||
          !Number.isSafeInteger(number) ||
          number < 0 ||
          !date
        ) {
          result.errors.push("Rad " + lineNumber + ": Ogiltig serie, nummer eller datum i #VER.");
          return;
        }
        const registrationDate = values[4] ? parseSIEDate(values[4]) : undefined;
        if (values[4] && !registrationDate) {
          result.errors.push("Rad " + lineNumber + ": Ogiltigt registreringsdatum i #VER.");
        }
        currentVoucher = {
          series,
          number,
          date,
          description: values[3] || "",
          lines: [],
          registrationDate: registrationDate || undefined,
          signature: values[5] || undefined,
        };
        inVoucherBlock = false;
        break;
      }

      case "TRANS": {
        if (!currentVoucher || !inVoucherBlock) return;
        const accountNumber = values[0];
        const amountIndex = values[1]?.startsWith("{") ? 2 : 1;
        const amount = parseSIEAmount(values[amountIndex]);
        if (!accountNumber || amount === null) {
          result.errors.push(
            "Rad " + lineNumber + ": Konto eller belopp saknas/är ogiltigt i #TRANS."
          );
          return;
        }
        if (amount === 0) return; // En nollrad är ingen bokföringspost.
        const account = result.accounts.find((item) => item.number === accountNumber);
        currentVoucher.lines.push({
          id: crypto.randomUUID(),
          accountNumber,
          accountName: account?.name || "Konto " + accountNumber,
          debit: amount > 0 ? amount : 0,
          credit: amount < 0 ? Math.abs(amount) : 0,
        });
        break;
      }

      case "IB":
      case "UB": {
        const isOpening = command === "IB" && values[0] === "0";
        const isPreviousClosing = command === "UB" && values[0] === "-1";
        if (!isOpening && !isPreviousClosing) break;
        const amount = parseSIEAmount(values[2]);
        if (!values[1] || amount === null) {
          result.errors.push(
            "Rad " + lineNumber + ": Ogiltigt konto eller belopp i #" + command + "."
          );
          return;
        }
        const target = isOpening ? result.openingBalances : result.previousClosingBalances;
        target.push({ accountNumber: values[1], amount });
        break;
      }

      default:
        break;
    }
  });

  if (currentVoucher) {
    result.errors.push(
      "SIE-filen avslutades innan verifikation " +
      currentVoucher.series + currentVoucher.number + " stängdes."
    );
  }

  if (result.openingBalances.length) {
    validateBalanceCollection(result.openingBalances, "Ingående balans i SIE-filen", result.errors);
  } else {
    validateBalanceCollection(
      result.previousClosingBalances,
      "Föregående års utgående balans i SIE-filen",
      result.errors
    );
  }

  return result;
}

function parseSIELine(line: string): { command: string; values: string[] } | null {
  const match = line.match(/^#(\w+)\s*(.*)$/);
  if (!match) return null;
  const rest = match[2] || "";
  const values: string[] = [];
  let current = "";
  let quoted = false;
  let hasToken = false;

  for (let index = 0; index < rest.length; index += 1) {
    const char = rest[index];
    if (quoted) {
      if (char === "\\" && rest[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"' && rest[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
      hasToken = true;
    } else if (/\s/.test(char)) {
      if (hasToken) {
        values.push(current);
        current = "";
        hasToken = false;
      }
    } else if (char === "{") {
      if (hasToken) {
        values.push(current);
        current = "";
        hasToken = false;
      }
      const closing = rest.indexOf("}", index);
      if (closing >= 0) {
        values.push(rest.slice(index, closing + 1));
        index = closing;
      } else {
        current = rest.slice(index);
        hasToken = true;
        break;
      }
    } else {
      current += char;
      hasToken = true;
    }
  }

  if (hasToken) values.push(current);
  return { command: match[1], values };
}

function parseSIEAmount(amountString: string | undefined): number | null {
  if (typeof amountString !== "string") return null;
  const normalized = amountString.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  const absoluteOre = toOre(Math.abs(amount));
  if (absoluteOre === null || !Number.isSafeInteger(absoluteOre)) return null;
  return amount < 0 ? -fromOre(absoluteOre) : fromOre(absoluteOre);
}

function parseSIEDate(
  dateString:
    string
):
  string | null {
  if (
    !dateString ||
    dateString.length !==
      8
  ) {
    return null;
  }

  const year =
    dateString.substring(
      0,
      4
    );

  const month =
    dateString.substring(
      4,
      6
    );

  const day =
    dateString.substring(
      6,
      8
    );

  const isoDate =
    year +
    "-" +
    month +
    "-" +
    day;

  const parsed =
    new Date(
      isoDate +
      "T00:00:00"
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null;
  }

  if (
    parsed.getFullYear() !==
      Number(
        year
      ) ||
    parsed.getMonth() +
      1 !==
      Number(
        month
      ) ||
    parsed.getDate() !==
      Number(
        day
      )
  ) {
    return null;
  }

  return isoDate;
}

function formatSIEDate(
  isoDate:
    string
): string {
  return isoDate.replace(
    /-/g,
    ""
  );
}

export interface SIEExportOptions {
  companyName: string;

  organizationNumber:
    string;

  fiscalYearStart:
    string;

  fiscalYearEnd:
    string;

  address?:
    string;

  postalCode?:
    string;

  city?:
    string;
}

function encodePC8(
  text:
    string
): string {
  return text
    .replace(
      /å/g,
      "„"
    )
    .replace(
      /ä/g,
      "„"
    )
    .replace(
      /ö/g,
      '"'
    )
    .replace(
      /Å/g,
      "Å"
    )
    .replace(
      /Ä/g,
      "Ä"
    )
    .replace(
      /Ö/g,
      "Ö"
    );
}

function getAccountType(
  accountNumber:
    string
): string {
  const firstDigit =
    accountNumber.charAt(
      0
    );

  switch (
    firstDigit
  ) {
    case "1":
      return "T";

    case "2":
      return "S";

    case "3":
      return "I";

    case "4":
    case "5":
    case "6":
    case "7":
    case "8":
      return "K";

    default:
      return "T";
  }
}

function formatOrgNumber(
  organizationNumber:
    string
): string {
  const cleaned =
    organizationNumber.replace(
      /\D/g,
      ""
    );

  if (
    cleaned.length ===
    10
  ) {
    return (
      cleaned.substring(
        0,
        6
      ) +
      "-" +
      cleaned.substring(
        6
      )
    );
  }

  return organizationNumber;
}

export function generateSIEFile(
  vouchers:
    Voucher[],

  accounts:
    BASAccount[],

  options:
    SIEExportOptions
): string {
  const lines:
    string[] =
    [];

  const today =
    new Date()
      .toISOString()
      .split("T")[0];

  const fiscalStartMonth =
    options
      .fiscalYearStart
      .substring(
        5,
        7
      );

  const fiscalStartDay =
    options
      .fiscalYearStart
      .substring(
        8,
        10
      );

  const fiscalEndMonth =
    options
      .fiscalYearEnd
      .substring(
        5,
        7
      );

  const fiscalEndDay =
    options
      .fiscalYearEnd
      .substring(
        8,
        10
      );

  const currentYear =
    new Date()
      .getFullYear();

  const previousYear =
    currentYear -
    1;

  const currentYearStart =
    String(
      currentYear
    ) +
    fiscalStartMonth +
    fiscalStartDay;

  const currentYearEnd =
    String(
      currentYear
    ) +
    fiscalEndMonth +
    fiscalEndDay;

  const previousYearStart =
    String(
      previousYear
    ) +
    fiscalStartMonth +
    fiscalStartDay;

  const previousYearEnd =
    String(
      previousYear
    ) +
    fiscalEndMonth +
    fiscalEndDay;

  const isSyntheticOpeningBalanceVoucher =
    (
      voucher:
        Voucher
    ) =>
      voucher
        .voucherNumber ===
        0 &&
      voucher
        .description ===
        "Ingående balans från SIE";

  const openingBalanceVouchers =
    vouchers.filter(
      isSyntheticOpeningBalanceVoucher
    );

  const normalVouchers =
    vouchers.filter(
      (voucher) =>
        !isSyntheticOpeningBalanceVoucher(
          voucher
        )
    );

  const currentYearStartDate =
    String(
      currentYear
    ) +
    "-" +
    fiscalStartMonth +
    "-" +
    fiscalStartDay;

  const currentYearVouchers =
    normalVouchers.filter(
      (voucher) =>
        voucher.date >=
        currentYearStartDate
    );

  const previousYearVouchers =
    normalVouchers.filter(
      (voucher) =>
        voucher.date <
        currentYearStartDate
    );

  lines.push(
    "#FLAGGA 0"
  );

  lines.push(
    "#FORMAT PC8"
  );

  lines.push(
    "#SIETYP 4"
  );

  lines.push(
    '#PROGRAM "AccountPro" 1.0'
  );

  lines.push(
    "#GEN " +
    formatSIEDate(
      today
    )
  );

  lines.push(
    '#FNAMN "' +
    encodePC8(
      options.companyName
    ) +
    '"'
  );

  if (
    options.organizationNumber
  ) {
    lines.push(
      "#ORGNR " +
      formatOrgNumber(
        options.organizationNumber
      )
    );
  }

  const address =
    options.address ||
    "";

  const postalCity =
    options.postalCode &&
    options.city
      ? '"' +
        options.postalCode +
        " " +
        options.city +
        '"'
      : '""';

  lines.push(
    '#ADRESS "' +
    encodePC8(
      address
    ) +
    '" ' +
    postalCity
  );

  lines.push(
    "#RAR 0 " +
    currentYearStart +
    " " +
    currentYearEnd
  );

  lines.push(
    "#RAR -1 " +
    previousYearStart +
    " " +
    previousYearEnd
  );

  lines.push(
    "#VALUTA SEK"
  );

  lines.push(
    "#KPTYP EUBAS97"
  );

  const usedAccountNumbers =
    new Set<string>();

  vouchers.forEach(
    (voucher) => {
      voucher.lines.forEach(
        (line) => {
          usedAccountNumbers.add(
            line.accountNumber
          );
        }
      );
    }
  );

  const previousYearBalances:
    Record<
      string,
      number
    > = {};

  openingBalanceVouchers.forEach(
    (voucher) => {
      voucher.lines.forEach(
        (line) => {
          if (
            !previousYearBalances[
              line.accountNumber
            ]
          ) {
            previousYearBalances[
              line.accountNumber
            ] = 0;
          }

          previousYearBalances[
            line.accountNumber
          ] =
            roundToOre(
              previousYearBalances[
                line.accountNumber
              ] +
              line.debit -
              line.credit
            );
        }
      );
    }
  );

  previousYearVouchers.forEach(
    (voucher) => {
      voucher.lines.forEach(
        (line) => {
          if (
            !previousYearBalances[
              line.accountNumber
            ]
          ) {
            previousYearBalances[
              line.accountNumber
            ] = 0;
          }

          previousYearBalances[
            line.accountNumber
          ] =
            roundToOre(
              previousYearBalances[
                line.accountNumber
              ] +
              line.debit -
              line.credit
            );
        }
      );
    }
  );

  const currentYearBalances:
    Record<
      string,
      number
    > = {};

  currentYearVouchers.forEach(
    (voucher) => {
      voucher.lines.forEach(
        (line) => {
          if (
            !currentYearBalances[
              line.accountNumber
            ]
          ) {
            currentYearBalances[
              line.accountNumber
            ] = 0;
          }

          currentYearBalances[
            line.accountNumber
          ] =
            roundToOre(
              currentYearBalances[
                line.accountNumber
              ] +
              line.debit -
              line.credit
            );
        }
      );
    }
  );

  const sortedAccounts =
    accounts
      .filter(
        (account) =>
          usedAccountNumbers.has(
            account.number
          )
      )
      .sort(
        (a, b) =>
          a.number.localeCompare(
            b.number
          )
      );

  sortedAccounts.forEach(
    (account) => {
      const accountType =
        getAccountType(
          account.number
        );

      const previousBalance =
        previousYearBalances[
          account.number
        ] ||
        0;

      lines.push(
        "#KONTO " +
        account.number +
        ' "' +
        encodePC8(
          account.name
        ) +
        '"'
      );

      lines.push(
        "#KTYP " +
        account.number +
        " " +
        accountType
      );

      lines.push(
        "#IB 0 " +
        account.number +
        " " +
        roundToOre(
          previousBalance
        ).toFixed(2)
      );

      lines.push(
        "#UB -1 " +
        account.number +
        " " +
        roundToOre(
          previousBalance
        ).toFixed(2)
      );
    }
  );

  sortedAccounts.forEach(
    (account) => {
      const accountType =
        getAccountType(
          account.number
        );

      const previousBalance =
        previousYearBalances[
          account.number
        ] ||
        0;

      const currentChange =
        currentYearBalances[
          account.number
        ] ||
        0;

      const totalBalance =
        roundToOre(
          previousBalance +
          currentChange
        );

      if (
        accountType ===
          "T" ||
        accountType ===
          "S"
      ) {
        lines.push(
          "#UB 0 " +
          account.number +
          " " +
          totalBalance.toFixed(
            2
          )
        );
      } else {
        lines.push(
          "#RES 0 " +
          account.number +
          " " +
          roundToOre(
            currentChange
          ).toFixed(2)
        );
      }
    }
  );

  currentYearVouchers
    .sort(
      (
        a,
        b
      ) =>
        a.date.localeCompare(
          b.date
        ) ||
        a.voucherNumber -
          b.voucherNumber
    )
    .forEach(
      (voucher) => {
        const validation =
          validateBookkeepingLines(
            voucher.lines
          );

        if (
          !validation.isValid
        ) {
          return;
        }

        const series =
          "A";

        const dateString =
          formatSIEDate(
            voucher.date
          );

        const description =
          encodePC8(
            voucher
              .description
              .replace(
                /"/g,
                '\\"'
              )
          );

        lines.push(
          "#VER " +
          series +
          " " +
          String(
            voucher.voucherNumber
          ) +
          " " +
          dateString +
          ' "' +
          description +
          '"'
        );

        lines.push(
          "{"
        );

        voucher.lines.forEach(
          (line) => {
            const debitOre =
              toOre(
                line.debit
              ) ||
              0;

            const creditOre =
              toOre(
                line.credit
              ) ||
              0;

            if (
              debitOre ===
                0 &&
              creditOre ===
                0
            ) {
              return;
            }

            const amountOre =
              debitOre >
              0
                ? debitOre
                : -creditOre;

            const amount =
              fromOre(
                amountOre
              );

            lines.push(
              "   #TRANS " +
              line.accountNumber +
              " {} " +
              amount.toFixed(
                2
              )
            );
          }
        );

        lines.push(
          "}"
        );
      }
    );

  return lines.join(
    "\n"
  );
}

// Identiteten i SIE är serie + nummer i räkenskapsåret.
// AccountPros interna verifikationsnummer är inte SIE-källans nummer.
export function findDuplicateVoucher(
  existingVouchers: Voucher[],
  series: string,
  number: number,
  date: string
): Voucher | undefined {
  const year = date.slice(0, 4);
  return existingVouchers.find((voucher) =>
    (voucher.originalSeries || "A") === series &&
    (voucher.originalVoucherNumber ?? voucher.voucherNumber) === number &&
    voucher.date.slice(0, 4) === year
  );
}

export function convertSIEVouchersToInternal(
  sieVouchers: SIEVoucher[],
  companyId: string,
  existingVouchers: Voucher[],
  accounts: BASAccount[]
): {
  newVouchers: Voucher[];
  skippedDuplicates: number;
  nextVoucherNumber: number;
} {
  const newVouchers: Voucher[] = [];
  let skippedDuplicates = 0;
  let nextVoucherNumber = existingVouchers.length
    ? Math.max(0, ...existingVouchers.map((item) => item.voucherNumber)) + 1
    : 1;
  const accountNames = new Map(accounts.map((account) => [account.number, account.name]));

  for (const source of sieVouchers) {
    const existing = findDuplicateVoucher(
      [...existingVouchers, ...newVouchers], source.series, source.number, source.date
    );
    if (existing) {
      // Ny import till företag med bokförda verifikationer är tills vidare
      // spärrad i AccountingContexts. Här identifieras dubbletter med käll-ID.
      skippedDuplicates += 1;
      continue;
    }

    const validation = validateBookkeepingLines(source.lines);
    if (!validation.isValid) {
      // Parsern stoppar hela importen om en verifikation är obalanserad.
      // Om funktionen används direkt ska den inte kunna skapa en ogiltig post.
      throw new Error(
        "SIE-verifikation " + source.series + source.number +
        " är ogiltig: " + validation.errors.map((error) => error.message).join("; ")
      );
    }

    const linesWithNames = source.lines
      .filter((line) => (toOre(line.debit) || 0) !== 0 || (toOre(line.credit) || 0) !== 0)
      .map((line) => ({
        ...line,
        accountName: accountNames.get(line.accountNumber) || line.accountName,
        debit: roundToOre(line.debit),
        credit: roundToOre(line.credit),
      }));

    const now = new Date().toISOString();
    newVouchers.push({
      id: crypto.randomUUID(),
      companyId,
      voucherNumber: nextVoucherNumber,
      date: source.date,
      description: source.description,
      lines: linesWithNames,
      createdAt: now,
      status: "POSTED",
      documentDate: source.date,
      postedAt: now,
      postedByName: source.signature || "SIE-import",
      originalSeries: source.series,
      originalVoucherNumber: source.number,
    });
    nextVoucherNumber += 1;
  }

  return { newVouchers, skippedDuplicates, nextVoucherNumber };
}

export function convertSIEOpeningBalancesToVoucher(
  parseResult:
    SIEParseResult,

  companyId:
    string,

  accounts:
    BASAccount[]
):
  Voucher |
  null {
  const sourceBalances =
    parseResult
      .openingBalances
      .length >
    0
      ? parseResult
          .openingBalances
      : parseResult
          .previousClosingBalances;

  if (
    sourceBalances.length ===
    0
  ) {
    return null;
  }

  let totalOre =
    0;

  sourceBalances.forEach(
    (balance) => {
      const ore =
        toOre(
          balance.amount
        );

      if (
        ore !== null
      ) {
        totalOre +=
          ore;
      }
    }
  );

  if (
    totalOre !== 0
  ) {
    return null;
  }

  const lines =
    sourceBalances
      .filter(
        (balance) => {
          const ore =
            toOre(
              balance.amount
            );

          return (
            ore !== null &&
            ore !== 0
          );
        }
      )
      .map(
        (balance) => {
          const account =
            accounts.find(
              (entry) =>
                entry.number ===
                balance.accountNumber
            );

          const roundedAmount =
            roundToOre(
              balance.amount
            );

          return {
            id:
              crypto.randomUUID(),

            accountNumber:
              balance.accountNumber,

            accountName:
              account?.name ||
              "Konto " +
              balance
                .accountNumber,

            debit:
              roundedAmount >
              0
                ? roundedAmount
                : 0,

            credit:
              roundedAmount <
              0
                ? Math.abs(
                    roundedAmount
                  )
                : 0,
          };
        }
      );

  if (
    lines.length ===
    0
  ) {
    return null;
  }

  const validation =
    validateBookkeepingLines(
      lines
    );

  if (
    !validation.isValid
  ) {
    return null;
  }

  const date =
    parseResult.metadata
      .fiscalYearStart ||
    parseResult
      .vouchers[0]
      ?.date ||
    new Date()
      .toISOString()
      .split("T")[0];

  return {
    id:
      crypto.randomUUID(),

    companyId,

    voucherNumber:
      1,

    date,

    description:
      "Ingående balans från SIE",

    lines,
    status: "POSTED",
    documentDate: date,
    postedAt: new Date().toISOString(),
    postedByName: "SIE-import",

    createdAt:
      new Date()
        .toISOString(),
  };
}

export function convertSIEAccountsToBAS(
  sieAccounts:
    SIEAccount[]
):
  BASAccount[] {
  return sieAccounts.map(
    (account) => ({
      number:
        account.number,

      name:
        account.name,

      class:
        getAccountClass(
          account.number
        ),

      source:
        "sie" as const,
    })
  );
}
