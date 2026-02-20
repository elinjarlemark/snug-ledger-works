// BAS Chart of Accounts - Swedish Standard
// Account classes determine balance behavior

export type AccountClass = "asset" | "equity_liability" | "revenue" | "expense";
export type AccountingStandard = "K2" | "K3" | "";

export interface BASAccount {
  number: string;
  name: string;
  class: AccountClass;
  description?: string;
  k3Only?: boolean;
}

const BAS_CSV_FILES = import.meta.glob("../data/bas/BAS_kontoplan_*.csv", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if ((char === "," || char === ";") && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  result.push(current.trim());
  return result;
}

function parseBasYearFromPath(path: string): number | null {
  const match = path.match(/BAS_kontoplan_(\d{4})\.csv$/);
  if (!match) return null;
  return Number(match[1]);
}

function parseBasCsv(csvContent: string): BASAccount[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const accounts: BASAccount[] = [];

  for (const line of lines) {
    const columns = parseCsvRow(line).map((col) => col.replace(/^"|"$/g, ""));
    if (columns.length < 2) continue;

    const accountNumberCandidate = columns[0].replace(/\D/g, "");
    if (!/^\d{4}$/.test(accountNumberCandidate)) continue;

    const accountName = columns[1];
    if (!accountName) continue;

    const k3Marker = (columns[2] ?? "").trim().toLowerCase();

    accounts.push({
      number: accountNumberCandidate,
      name: accountName,
      class: getAccountClass(accountNumberCandidate),
      k3Only: k3Marker === "x",
    });
  }

  return accounts;
}

function filterAccountsByStandard(accounts: BASAccount[], accountingStandard: AccountingStandard): BASAccount[] {
  if (accountingStandard === "K3") {
    return accounts;
  }
  return accounts.filter((account) => !account.k3Only);
}

export function getAvailableBASYears(): number[] {
  return Object.keys(BAS_CSV_FILES)
    .map(parseBasYearFromPath)
    .filter((year): year is number => year !== null)
    .sort((a, b) => a - b);
}

export function getLatestBASYear(): number | null {
  const years = getAvailableBASYears();
  return years.length > 0 ? years[years.length - 1] : null;
}

export function getBASAccountsForYear(year: number, accountingStandard: AccountingStandard = ""): BASAccount[] {
  const entry = Object.entries(BAS_CSV_FILES).find(([path]) => path.endsWith(`BAS_kontoplan_${year}.csv`));
  if (!entry) return [];
  return filterAccountsByStandard(parseBasCsv(entry[1]), accountingStandard);
}

export function getBASAccountsForDate(date: string, accountingStandard: AccountingStandard = ""): BASAccount[] {
  const year = Number(date.slice(0, 4));
  if (!Number.isFinite(year)) {
    const latestYear = getLatestBASYear();
    if (!latestYear) return DEFAULT_BAS_ACCOUNTS;
    const latestAccounts = getBASAccountsForYear(latestYear, accountingStandard);
    return latestAccounts.length > 0 ? latestAccounts : DEFAULT_BAS_ACCOUNTS;
  }

  const exactYearAccounts = getBASAccountsForYear(year, accountingStandard);
  if (exactYearAccounts.length > 0) {
    return exactYearAccounts;
  }

  const years = getAvailableBASYears();
  const fallbackYear = years.filter((availableYear) => availableYear <= year).at(-1) ?? getLatestBASYear();
  if (!fallbackYear) return DEFAULT_BAS_ACCOUNTS;

  const fallbackAccounts = getBASAccountsForYear(fallbackYear, accountingStandard);
  return fallbackAccounts.length > 0 ? fallbackAccounts : DEFAULT_BAS_ACCOUNTS;
}

export function getLatestBASAccounts(accountingStandard: AccountingStandard = ""): BASAccount[] {
  const latestYear = getLatestBASYear();
  if (!latestYear) return DEFAULT_BAS_ACCOUNTS;
  const latestAccounts = getBASAccountsForYear(latestYear, accountingStandard);
  return latestAccounts.length > 0 ? latestAccounts : DEFAULT_BAS_ACCOUNTS;
}

export function getAccountClass(accountNumber: string): AccountClass {
  const firstDigit = parseInt(accountNumber.charAt(0));
  
  switch (firstDigit) {
    case 1:
      return "asset";
    case 2:
      return "equity_liability";
    case 3:
      return "revenue";
    case 4:
    case 5:
    case 6:
    case 7:
    case 8:
      return "expense";
    default:
      return "asset";
  }
}

export function getAccountClassName(accountClass: AccountClass): string {
  switch (accountClass) {
    case "asset":
      return "Assets";
    case "equity_liability":
      return "Equity & Liabilities";
    case "revenue":
      return "Revenue";
    case "expense":
      return "Expenses";
  }
}

export function calculateBalance(
  accountClass: AccountClass,
  totalDebit: number,
  totalCredit: number
): number {
  if (accountClass === "asset" || accountClass === "expense") {
    return totalDebit - totalCredit;
  }
  return totalCredit - totalDebit;
}

export function isBalanceNormal(
  accountClass: AccountClass,
  balance: number
): boolean {
  return balance >= 0;
}

export const DEFAULT_BAS_ACCOUNTS: BASAccount[] = [
  { number: "1200", name: "Maskiner och inventarier", class: "asset", description: "Machinery and equipment" },
  { number: "1510", name: "Kundfordringar", class: "asset", description: "Accounts receivable" },
  { number: "1630", name: "Avräkning för skatter och avgifter", class: "asset", description: "Tax settlement account" },
  { number: "1710", name: "Förutbetalda hyreskostnader", class: "asset", description: "Prepaid rent" },
  { number: "1790", name: "Övriga förutbetalda kostnader", class: "asset", description: "Other prepaid expenses" },
  { number: "1910", name: "Kassa", class: "asset", description: "Cash" },
  { number: "1930", name: "Företagskonto", class: "asset", description: "Company bank account" },
  { number: "1940", name: "Placeringskonto", class: "asset", description: "Investment account" },
  { number: "2010", name: "Eget kapital", class: "equity_liability", description: "Equity" },
  { number: "2013", name: "Privat - Loss", class: "equity_liability", description: "Private withdrawals" },
  { number: "2091", name: "Balanserad vinst eller förlust", class: "equity_liability", description: "Retained earnings" },
  { number: "2099", name: "Årets resultat", class: "equity_liability", description: "Net income for the year" },
  { number: "2440", name: "Leverantörsskulder", class: "equity_liability", description: "Accounts payable" },
  { number: "2610", name: "Utgående moms", class: "equity_liability", description: "Output VAT" },
  { number: "2640", name: "Ingående moms", class: "equity_liability", description: "Input VAT" },
  { number: "2650", name: "Redovisningskonto för moms", class: "equity_liability", description: "VAT settlement account" },
  { number: "2710", name: "Personalskatt", class: "equity_liability", description: "Employee tax" },
  { number: "2731", name: "Avräkning lagstadgade sociala avgifter", class: "equity_liability", description: "Social security contributions" },
  { number: "2920", name: "Upplupna semesterlöner", class: "equity_liability", description: "Accrued vacation pay" },
  { number: "2990", name: "Övriga upplupna kostnader", class: "equity_liability", description: "Other accrued expenses" },
  { number: "3001", name: "Försäljning varor", class: "revenue", description: "Sales of goods" },
  { number: "3010", name: "Försäljning tjänster", class: "revenue", description: "Sales of services" },
  { number: "3740", name: "Öres- och kronutjämning", class: "revenue", description: "Rounding adjustments" },
  { number: "4000", name: "Inköp av varor", class: "expense", description: "Purchases of goods" },
  { number: "4010", name: "Inköp av material", class: "expense", description: "Purchases of materials" },
  { number: "5010", name: "Lokalhyra", class: "expense", description: "Rent" },
  { number: "5410", name: "Förbrukningsinventarier", class: "expense", description: "Consumable equipment" },
  { number: "5460", name: "Förbrukningsmaterial", class: "expense", description: "Consumable materials" },
  { number: "5800", name: "Resekostnader", class: "expense", description: "Travel expenses" },
  { number: "5910", name: "Annonsering", class: "expense", description: "Advertising" },
  { number: "6071", name: "Representation avdragsgill", class: "expense", description: "Entertainment (deductible)" },
  { number: "6110", name: "Kontorsmateriel", class: "expense", description: "Office supplies" },
  { number: "6212", name: "Mobiltelefon", class: "expense", description: "Mobile phone" },
  { number: "6230", name: "Datakommunikation", class: "expense", description: "Data communication" },
  { number: "6530", name: "Redovisningstjänster", class: "expense", description: "Accounting services" },
  { number: "6570", name: "Bankkostnader", class: "expense", description: "Bank fees" },
  { number: "7010", name: "Löner till kollektivanställda", class: "expense", description: "Wages (collective agreement)" },
  { number: "7210", name: "Löner till tjänstemän", class: "expense", description: "Salaries (employees)" },
  { number: "7510", name: "Arbetsgivaravgifter", class: "expense", description: "Employer contributions" },
  { number: "7533", name: "Särskild löneskatt", class: "expense", description: "Special payroll tax" },
  { number: "7690", name: "Övriga personalkostnader", class: "expense", description: "Other personnel expenses" },
  { number: "8310", name: "Ränteintäkter", class: "revenue", description: "Interest income" },
  { number: "8410", name: "Räntekostnader", class: "expense", description: "Interest expenses" },
  { number: "8910", name: "Skatt på årets resultat", class: "expense", description: "Tax on annual result" },
  { number: "8999", name: "Årets resultat", class: "equity_liability", description: "Net result" },
];

export function isValidAccountNumber(accountNumber: string): boolean {
  return /^\d{4}$/.test(accountNumber);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
