// BAS Chart of Accounts - Swedish Standard
// Account classes determine balance behavior

export type AccountClass = "asset" | "equity_liability" | "revenue" | "expense";

export interface BASAccount {
  number: string;
  name: string;
  class: AccountClass;
  description?: string;
}

export function getAccountClass(accountNumber: string): AccountClass {
  const firstDigit = parseInt(accountNumber.charAt(0));
  
  switch (firstDigit) {
    case 1:
      return "asset"; // Assets - debit increases, credit decreases
    case 2:
      return "equity_liability"; // Equity & Liabilities - credit increases, debit decreases
    case 3:
      return "revenue"; // Revenue - credit increases, debit decreases
    case 4:
    case 5:
    case 6:
    case 7:
    case 8:
      return "expense"; // Expenses & Financial - debit increases, credit decreases
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
  // Assets and Expenses: Debit - Credit
  // Equity, Liabilities, Revenue: Credit - Debit
  if (accountClass === "asset" || accountClass === "expense") {
    return totalDebit - totalCredit;
  }
  return totalCredit - totalDebit;
}

export function isBalanceNormal(
  accountClass: AccountClass,
  balance: number
): boolean {
  // Normal balance is positive
  // Assets/Expenses should have debit (positive) balance
  // Equity/Liabilities/Revenue should have credit (positive) balance
  return balance >= 0;
}

// Default BAS accounts for a Swedish company
export const DEFAULT_BAS_ACCOUNTS: BASAccount[] = [
  // Assets (1xxx)
  { number: "1200", name: "Maskiner och inventarier", class: "asset", description: "Machinery and equipment" },
  { number: "1510", name: "Kundfordringar", class: "asset", description: "Accounts receivable" },
  { number: "1630", name: "Avräkning för skatter och avgifter", class: "asset", description: "Tax settlement account" },
  { number: "1710", name: "Förutbetalda hyreskostnader", class: "asset", description: "Prepaid rent" },
  { number: "1790", name: "Övriga förutbetalda kostnader", class: "asset", description: "Other prepaid expenses" },
  { number: "1910", name: "Kassa", class: "asset", description: "Cash" },
  { number: "1930", name: "Företagskonto", class: "asset", description: "Company bank account" },
  { number: "1940", name: "Placeringskonto", class: "asset", description: "Investment account" },
  
  // Equity & Liabilities (2xxx)
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
  
  // Revenue (3xxx)
  { number: "3001", name: "Försäljning varor", class: "revenue", description: "Sales of goods" },
  { number: "3010", name: "Försäljning tjänster", class: "revenue", description: "Sales of services" },
  { number: "3740", name: "Öres- och kronutjämning", class: "revenue", description: "Rounding adjustments" },
  
  // Cost of goods sold (4xxx)
  { number: "4000", name: "Inköp av varor", class: "expense", description: "Purchases of goods" },
  { number: "4010", name: "Inköp av material", class: "expense", description: "Purchases of materials" },
  
  // External expenses (5xxx-6xxx)
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
  
  // Personnel expenses (7xxx)
  { number: "7010", name: "Löner till kollektivanställda", class: "expense", description: "Wages (collective agreement)" },
  { number: "7210", name: "Löner till tjänstemän", class: "expense", description: "Salaries (employees)" },
  { number: "7510", name: "Arbetsgivaravgifter", class: "expense", description: "Employer contributions" },
  { number: "7533", name: "Särskild löneskatt", class: "expense", description: "Special payroll tax" },
  { number: "7690", name: "Övriga personalkostnader", class: "expense", description: "Other personnel expenses" },
  
  // Financial items (8xxx)
  { number: "8310", name: "Ränteintäkter", class: "revenue", description: "Interest income" },
  { number: "8410", name: "Räntekostnader", class: "expense", description: "Interest expenses" },
  { number: "8910", name: "Skatt på årets resultat", class: "expense", description: "Tax on annual result" },
  { number: "8999", name: "Årets resultat", class: "equity_liability", description: "Net result" },
];

export function isValidAccountNumber(accountNumber: string): boolean {
  // BAS account numbers are 4 digits
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
