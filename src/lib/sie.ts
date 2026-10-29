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

const INTERNAL_VOUCHER_SERIES_PATTERN = /^[A-Z][A-Z0-9]{0,9}$/;
const FALLBACK_INTERNAL_VOUCHER_SERIES = "A";

function internalVoucherSeries(
  voucher: Pick<Voucher, "series">
): string {
  const raw =
    typeof voucher.series === "string" && voucher.series.trim()
      ? voucher.series.trim().toUpperCase()
      : FALLBACK_INTERNAL_VOUCHER_SERIES;

  return INTERNAL_VOUCHER_SERIES_PATTERN.test(raw)
    ? raw
    : FALLBACK_INTERNAL_VOUCHER_SERIES;
}

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

const PC437_HIGH_CHARS =
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";

const PC437_ENCODE_MAP = (() => {
  const map = new Map<string, number>();

  for (let index = 0; index < 128; index += 1) {
    map.set(String.fromCharCode(index), index);
  }

  Array.from(PC437_HIGH_CHARS).forEach((character, index) => {
    map.set(character, index + 128);
  });

  return map;
})();

function normalizeSIECharacters(
  value: string
): string {
  return value
    .normalize("NFC")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function sanitizeSIEField(
  value: string
): string {
  return normalizeSIECharacters(
    value
  ).replace(
    /[\u0000-\u001F\u007F]/g,
    " "
  );
}

function quoteSIEText(
  value: string
): string {
  return (
    '"' +
    sanitizeSIEField(value).replace(/"/g, '\\"') +
    '"'
  );
}

export function encodeSIEFileBytes(
  content: string
): Uint8Array {
  const normalized = normalizeSIECharacters(content);
  const bytes: number[] = [];

  for (const character of normalized) {
    const byte = PC437_ENCODE_MAP.get(character);
    bytes.push(byte ?? 0x3f);
  }

  return new Uint8Array(bytes);
}

function decodePC437(
  bytes: Uint8Array
): string {
  let result = "";

  bytes.forEach((byte) => {
    result +=
      byte < 128
        ? String.fromCharCode(byte)
        : PC437_HIGH_CHARS[byte - 128] ?? "?";
  });

  return result;
}

export function decodeSIEFileBytes(
  input: ArrayBuffer | Uint8Array
): string {
  const bytes =
    input instanceof Uint8Array
      ? input
      : new Uint8Array(input);

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }

  const probeLength = Math.min(bytes.length, 1024);
  let asciiProbe = "";
  for (let index = 0; index < probeLength; index += 1) {
    const byte = bytes[index];
    asciiProbe += byte < 128 ? String.fromCharCode(byte) : "?";
  }

  if (/^|\n\s*#FORMAT\s+PC8(?:\s|$)/im.test(asciiProbe)) {
    return decodePC437(bytes);
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return decodePC437(bytes);
  }
}

function getAccountType(
  accountNumber:
    string
): string {
  switch (
    getAccountClass(
      accountNumber
    )
  ) {
    case "asset":
      return "T";

    case "equity_liability":
      return "S";

    case "revenue":
      return "I";

    case "expense":
      return "K";
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

function assertISODate(
  value: string,
  label: string
): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(label + " måste anges som ÅÅÅÅ-MM-DD.");
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(label + " är inte ett giltigt datum.");
  }
}

function shiftISODateOneYearBack(
  value: string
): string {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText) - 1;
  const month = Number(monthText);
  const day = Number(dayText);

  const lastDayOfMonth =
    new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfMonth);

  return (
    String(year).padStart(4, "0") +
    "-" +
    String(month).padStart(2, "0") +
    "-" +
    String(clampedDay).padStart(2, "0")
  );
}

function addVoucherBalances(
  target: Map<string, number>,
  vouchers: Voucher[]
): void {
  vouchers.forEach((voucher) => {
    voucher.lines.forEach((line) => {
      const current = target.get(line.accountNumber) ?? 0;
      target.set(
        line.accountNumber,
        roundToOre(
          current +
          line.debit -
          line.credit
        )
      );
    });
  });
}

function mapValue(
  values: Map<string, number>,
  accountNumber: string
): number {
  return roundToOre(values.get(accountNumber) ?? 0);
}

function isNonZeroAmount(
  value: number
): boolean {
  return Math.abs(roundToOre(value)) >= 0.005;
}

export function generateSIEFile(
  vouchers:
    Voucher[],

  accounts:
    BASAccount[],

  options:
    SIEExportOptions
): string {
  assertISODate(
    options.fiscalYearStart,
    "Räkenskapsårets startdatum"
  );
  assertISODate(
    options.fiscalYearEnd,
    "Räkenskapsårets slutdatum"
  );

  if (
    options.fiscalYearStart >
    options.fiscalYearEnd
  ) {
    throw new Error(
      "Räkenskapsårets startdatum får inte ligga efter slutdatumet."
    );
  }

  const lines: string[] = [];
  const today =
    new Date()
      .toISOString()
      .split("T")[0];

  const fiscalYearStart =
    options.fiscalYearStart;
  const fiscalYearEnd =
    options.fiscalYearEnd;

  const previousFiscalYearStart =
    shiftISODateOneYearBack(
      fiscalYearStart
    );
  const previousFiscalYearEnd =
    shiftISODateOneYearBack(
      fiscalYearEnd
    );

  const isSyntheticOpeningBalanceVoucher =
    (
      voucher:
        Voucher
    ) =>
      voucher.voucherNumber === 0 &&
      voucher.description ===
        "Ingående balans från SIE";

  const postedVouchers =
    vouchers.filter(
      (voucher) =>
        voucher.status !==
        "DRAFT"
    );

  const openingBalanceVouchers =
    postedVouchers.filter(
      isSyntheticOpeningBalanceVoucher
    );

  const normalVouchers =
    postedVouchers.filter(
      (voucher) =>
        !isSyntheticOpeningBalanceVoucher(
          voucher
        )
    );

  const vouchersBeforeCurrentYear =
    normalVouchers.filter(
      (voucher) =>
        voucher.date <
        fiscalYearStart
    );

  const currentYearVouchers =
    normalVouchers.filter(
      (voucher) =>
        voucher.date >=
          fiscalYearStart &&
        voucher.date <=
          fiscalYearEnd
    );

  const previousYearVouchers =
    normalVouchers.filter(
      (voucher) =>
        voucher.date >=
          previousFiscalYearStart &&
        voucher.date <=
          previousFiscalYearEnd
    );

  const openingBalances =
    new Map<
      string,
      number
    >();

  addVoucherBalances(
    openingBalances,
    openingBalanceVouchers
  );
  addVoucherBalances(
    openingBalances,
    vouchersBeforeCurrentYear
  );

  const currentChanges =
    new Map<
      string,
      number
    >();

  addVoucherBalances(
    currentChanges,
    currentYearVouchers
  );

  const previousYearChanges =
    new Map<
      string,
      number
    >();

  addVoucherBalances(
    previousYearChanges,
    previousYearVouchers
  );

  const accountNames =
    new Map<
      string,
      string
    >(
      accounts.map(
        (account) => [
          account.number,
          account.name,
        ]
      )
    );

  postedVouchers.forEach(
    (voucher) => {
      voucher.lines.forEach(
        (line) => {
          if (
            !accountNames.has(
              line.accountNumber
            )
          ) {
            accountNames.set(
              line.accountNumber,
              line.accountName ||
                "Konto " +
                  line.accountNumber
            );
          }
        }
      );
    }
  );

  const usedAccountNumbers =
    new Set<string>();

  openingBalances.forEach(
    (value, accountNumber) => {
      if (
        isNonZeroAmount(
          value
        )
      ) {
        usedAccountNumbers.add(
          accountNumber
        );
      }
    }
  );

  currentChanges.forEach(
    (
      _value,
      accountNumber
    ) => {
      usedAccountNumbers.add(
        accountNumber
      );
    }
  );

  previousYearChanges.forEach(
    (
      value,
      accountNumber
    ) => {
      if (
        isNonZeroAmount(
          value
        )
      ) {
        usedAccountNumbers.add(
          accountNumber
        );
      }
    }
  );

  currentYearVouchers.forEach(
    (voucher) => {
      voucher.lines.forEach(
        (line) =>
          usedAccountNumbers.add(
            line.accountNumber
          )
      );
    }
  );

  const sortedAccountNumbers =
    Array.from(
      usedAccountNumbers
    ).sort(
      (a, b) =>
        a.localeCompare(b)
    );

  const hasPreviousYearData =
    Array.from(
      openingBalances.values()
    ).some(
      isNonZeroAmount
    ) ||
    previousYearVouchers.length >
      0;

  lines.push(
    "#FLAGGA 0"
  );

  lines.push(
    "#PROGRAM " +
    quoteSIEText(
      "AccountPro"
    ) +
    " " +
    quoteSIEText(
      "1.0"
    )
  );

  lines.push(
    "#FORMAT PC8"
  );

  lines.push(
    "#GEN " +
    formatSIEDate(
      today
    )
  );

  lines.push(
    "#SIETYP 4"
  );

  lines.push(
    "#FNAMN " +
    quoteSIEText(
      options.companyName
    )
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

  if (
    options.address ||
    options.postalCode ||
    options.city
  ) {
    const postalAddress =
      [
        options.postalCode,
        options.city,
      ]
        .filter(Boolean)
        .join(" ");

    lines.push(
      "#ADRESS " +
      quoteSIEText("") +
      " " +
      quoteSIEText(
        options.address || ""
      ) +
      " " +
      quoteSIEText(
        postalAddress
      ) +
      " " +
      quoteSIEText("")
    );
  }

  lines.push(
    "#RAR 0 " +
    formatSIEDate(
      fiscalYearStart
    ) +
    " " +
    formatSIEDate(
      fiscalYearEnd
    )
  );

  if (
    hasPreviousYearData
  ) {
    lines.push(
      "#RAR -1 " +
      formatSIEDate(
        previousFiscalYearStart
      ) +
      " " +
      formatSIEDate(
        previousFiscalYearEnd
      )
    );
  }

  lines.push(
    "#VALUTA SEK"
  );

  lines.push(
    "#KPTYP EUBAS97"
  );

  /*
   * SIE kräver att kontoplansuppgifter kommer före saldo- och
   * verifikationsposter. Därför deklareras samtliga använda konton först.
   */
  sortedAccountNumbers.forEach(
    (
      accountNumber
    ) => {
      const accountName =
        accountNames.get(
          accountNumber
        ) ||
        "Konto " +
          accountNumber;

      lines.push(
        "#KONTO " +
        accountNumber +
        " " +
        quoteSIEText(
          accountName
        )
      );

      lines.push(
        "#KTYP " +
        accountNumber +
        " " +
        getAccountType(
          accountNumber
        )
      );
    }
  );

  /*
   * #IB/#UB gäller endast balanskonton.
   * SIE använder rå debet/kredit-skyltning: debet är positivt,
   * kredit negativt.
   */
  sortedAccountNumbers.forEach(
    (
      accountNumber
    ) => {
      const accountType =
        getAccountType(
          accountNumber
        );

      if (
        accountType !==
          "T" &&
        accountType !==
          "S"
      ) {
        return;
      }

      const openingBalance =
        mapValue(
          openingBalances,
          accountNumber
        );

      const currentClosingBalance =
        roundToOre(
          openingBalance +
          mapValue(
            currentChanges,
            accountNumber
          )
        );

      if (
        isNonZeroAmount(
          openingBalance
        )
      ) {
        lines.push(
          "#IB 0 " +
          accountNumber +
          " " +
          openingBalance.toFixed(
            2
          )
        );

        if (
          hasPreviousYearData
        ) {
          lines.push(
            "#UB -1 " +
            accountNumber +
            " " +
            openingBalance.toFixed(
              2
            )
          );
        }
      }

      if (
        isNonZeroAmount(
          currentClosingBalance
        )
      ) {
        lines.push(
          "#UB 0 " +
          accountNumber +
          " " +
          currentClosingBalance.toFixed(
            2
          )
        );
      }
    }
  );

  /*
   * #RES används för resultatkonton. Om föregående års transaktioner
   * faktiskt finns i AccountPro kan även jämförelseårets resultat exporteras.
   */
  sortedAccountNumbers.forEach(
    (
      accountNumber
    ) => {
      const accountType =
        getAccountType(
          accountNumber
        );

      if (
        accountType !==
          "I" &&
        accountType !==
          "K"
      ) {
        return;
      }

      const currentResult =
        mapValue(
          currentChanges,
          accountNumber
        );

      if (
        isNonZeroAmount(
          currentResult
        )
      ) {
        lines.push(
          "#RES 0 " +
          accountNumber +
          " " +
          currentResult.toFixed(
            2
          )
        );
      }

      if (
        hasPreviousYearData
      ) {
        const previousResult =
          mapValue(
            previousYearChanges,
            accountNumber
          );

        if (
          isNonZeroAmount(
            previousResult
          )
        ) {
          lines.push(
            "#RES -1 " +
            accountNumber +
            " " +
            previousResult.toFixed(
              2
            )
          );
        }
      }
    }
  );

  currentYearVouchers
    .slice()
    .sort(
      (
        a,
        b
      ) =>
        internalVoucherSeries(a)
          .localeCompare(
            internalVoucherSeries(b)
          ) ||
        a.voucherNumber -
          b.voucherNumber ||
        a.date.localeCompare(
          b.date
        )
    )
    .forEach(
      (
        voucher
      ) => {
        const validation =
          validateBookkeepingLines(
            voucher.lines
          );

        if (
          !validation.isValid
        ) {
          throw new Error(
            "Verifikation " +
            internalVoucherSeries(
              voucher
            ) +
            String(
              voucher.voucherNumber
            ) +
            " kan inte exporteras till SIE: " +
            validation.errors
              .map(
                (error) =>
                  error.message
              )
              .join("; ")
          );
        }

        const series =
          internalVoucherSeries(
            voucher
          );

        const dateString =
          formatSIEDate(
            voucher.date
          );

        lines.push(
          "#VER " +
          quoteSIEText(
            series
          ) +
          " " +
          String(
            voucher.voucherNumber
          ) +
          " " +
          dateString +
          " " +
          quoteSIEText(
            voucher.description
          )
        );

        lines.push(
          "{"
        );

        voucher.lines.forEach(
          (
            line
          ) => {
            const debitOre =
              toOre(
                line.debit
              ) ??
              0;

            const creditOre =
              toOre(
                line.credit
              ) ??
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
    "\r\n"
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
    (voucher.originalSeries ?? internalVoucherSeries(voucher)) === series &&
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
      series: FALLBACK_INTERNAL_VOUCHER_SERIES,
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

    series:
      FALLBACK_INTERNAL_VOUCHER_SERIES,

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
