// SIE File Parser and Exporter
// Swedish standard accounting exchange format

import { BASAccount, getAccountClass } from "./bas-accounts";
import { Voucher, VoucherLine } from "@/contexts/AccountingContexts";

export interface SIEAccount {
  number: string;
  name: string;
}

export interface SIEVoucher {
  series: string;
  number: number;
  date: string; // YYYY-MM-DD
  description: string;
  lines: VoucherLine[];
}

export interface SIEParseResult {
  accounts: SIEAccount[];
  vouchers: SIEVoucher[];
  metadata: {
    companyName?: string;
    organizationNumber?: string;
    fiscalYearStart?: string;
    fiscalYearEnd?: string;
  };
  errors: string[];
}

/**
 * Parse a SIE file content and extract accounts and vouchers
 */
export function parseSIEFile(content: string): SIEParseResult {
  const result: SIEParseResult = {
    accounts: [],
    vouchers: [],
    metadata: {},
    errors: [],
  };

  // Normalize line endings
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  
  let currentVoucher: SIEVoucher | null = null;
  let inVoucherBlock = false;
  let lineNumber = 0;

  for (const line of lines) {
    lineNumber++;
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) continue;

    // Handle voucher block closing
    if (trimmedLine === "}") {
      if (currentVoucher) {
        // Validate voucher balance
        const totalDebit = currentVoucher.lines.reduce((sum, l) => sum + l.debit, 0);
        const totalCredit = currentVoucher.lines.reduce((sum, l) => sum + l.credit, 0);
        
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
          result.errors.push(`Line ${lineNumber}: Voucher ${currentVoucher.series}${currentVoucher.number} is unbalanced (debit: ${totalDebit}, credit: ${totalCredit})`);
        } else if (currentVoucher.lines.length > 0) {
          result.vouchers.push(currentVoucher);
        }
        currentVoucher = null;
      }
      inVoucherBlock = false;
      continue;
    }

    // Skip lines that don't start with #
    if (!trimmedLine.startsWith("#")) continue;

    // Parse the line
    const parsed = parseSIELine(trimmedLine);
    if (!parsed) continue;

    const { command, values } = parsed;

    switch (command) {
      case "FNAMN":
        // Company name
        result.metadata.companyName = values[0] || "";
        break;

      case "ORGNR":
        // Organization number
        result.metadata.organizationNumber = values[0] || "";
        break;

      case "RAR":
        // Fiscal year: #RAR 0 YYYYMMDD YYYYMMDD
        if (values.length >= 3 && values[0] === "0") {
          const startDate = parseSIEDate(values[1]);
          const endDate = parseSIEDate(values[2]);
          if (startDate) result.metadata.fiscalYearStart = startDate;
          if (endDate) result.metadata.fiscalYearEnd = endDate;
        }
        break;

      case "KONTO":
        // Account definition: #KONTO account_number "account_name"
        if (values.length >= 2) {
          const accountNumber = values[0];
          const accountName = values[1];
          if (accountNumber && accountName) {
            result.accounts.push({
              number: accountNumber,
              name: accountName,
            });
          }
        }
        break;

      case "VER":
        // Voucher header: #VER series number date "description"
        if (values.length >= 3) {
          const series = values[0] || "A";
          const number = parseInt(values[1]) || 0;
          const date = parseSIEDate(values[2]);
          const description = values[3] || "";

          if (date) {
            currentVoucher = {
              series,
              number,
              date,
              description,
              lines: [],
            };
          }
        }
        // Check if block starts on same line
        if (trimmedLine.includes("{")) {
          inVoucherBlock = true;
        }
        break;

      case "TRANS":
        // Transaction line: #TRANS account_number {} amount
        if (currentVoucher && values.length >= 2) {
          const accountNumber = values[0];
          // Skip empty {} if present (dimension info)
          let amountIndex = 1;
          if (values[1] === "{}") {
            amountIndex = 2;
          }
          const amount = parseFloat(values[amountIndex]) || 0;

          if (accountNumber) {
            const account = result.accounts.find(a => a.number === accountNumber);
            currentVoucher.lines.push({
              id: crypto.randomUUID(),
              accountNumber,
              accountName: account?.name || `Account ${accountNumber}`,
              debit: amount > 0 ? amount : 0,
              credit: amount < 0 ? Math.abs(amount) : 0,
            });
          }
        }
        break;
    }

    // Check for opening brace after VER line
    if (command === "VER" || trimmedLine.includes("{")) {
      inVoucherBlock = true;
    }
  }

  return result;
}

/**
 * Parse a single SIE line into command and values
 */
function parseSIELine(line: string): { command: string; values: string[] } | null {
  // Match #COMMAND followed by values
  const match = line.match(/^#(\w+)\s*(.*)?$/);
  if (!match) return null;

  const command = match[1];
  const rest = match[2] || "";

  // Parse values, handling quoted strings
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < rest.length) {
    const char = rest[i];

    if (char === '"') {
      if (inQuotes) {
        values.push(current);
        current = "";
        inQuotes = false;
      } else {
        inQuotes = true;
      }
    } else if (char === " " && !inQuotes) {
      if (current) {
        values.push(current);
        current = "";
      }
    } else if (char === "{" && !inQuotes) {
      // Handle {} blocks
      const closeIndex = rest.indexOf("}", i);
      if (closeIndex > i) {
        values.push(rest.substring(i, closeIndex + 1));
        i = closeIndex;
      }
    } else if (char !== "}" || inQuotes) {
      current += char;
    }
    i++;
  }

  if (current) {
    values.push(current);
  }

  return { command, values };
}

/**
 * Parse SIE date format (YYYYMMDD) to ISO format (YYYY-MM-DD)
 */
function parseSIEDate(dateStr: string): string | null {
  if (!dateStr || dateStr.length !== 8) return null;
  
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  
  return `${year}-${month}-${day}`;
}

/**
 * Format ISO date to SIE format (YYYYMMDD)
 */
function formatSIEDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

export interface SIEExportOptions {
  companyName: string;
  organizationNumber: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
}

/**
 * Generate a SIE file from vouchers and accounts
 */
export function generateSIEFile(
  vouchers: Voucher[],
  accounts: BASAccount[],
  options: SIEExportOptions
): string {
  const lines: string[] = [];

  // Header
  lines.push('#FLAGGA 0');
  lines.push('#FORMAT PC8');
  lines.push('#SIETYP 4');
  lines.push('#PROGRAM "AccountPro" 1.0');
  lines.push(`#GEN ${formatSIEDate(new Date().toISOString().split('T')[0])}`);

  // Company info
  lines.push(`#FNAMN "${options.companyName}"`);
  if (options.organizationNumber) {
    lines.push(`#ORGNR ${options.organizationNumber.replace(/-/g, "")}`);
  }

  // Fiscal year
  const currentYear = new Date().getFullYear();
  const fiscalStart = `${currentYear}${options.fiscalYearStart.replace(/-/g, "")}`;
  const fiscalEnd = `${currentYear}${options.fiscalYearEnd.replace(/-/g, "")}`;
  lines.push(`#RAR 0 ${fiscalStart} ${fiscalEnd}`);

  // Account definitions - only include accounts used in vouchers
  const usedAccountNumbers = new Set<string>();
  vouchers.forEach(v => {
    v.lines.forEach(l => usedAccountNumbers.add(l.accountNumber));
  });

  accounts
    .filter(a => usedAccountNumbers.has(a.number))
    .sort((a, b) => a.number.localeCompare(b.number))
    .forEach(account => {
      lines.push(`#KONTO ${account.number} "${account.name}"`);
    });

  // Add blank line before vouchers
  lines.push('');

  // Vouchers
  vouchers
    .sort((a, b) => a.date.localeCompare(b.date) || a.voucherNumber - b.voucherNumber)
    .forEach(voucher => {
      const series = "A"; // Default series
      const dateStr = formatSIEDate(voucher.date);
      const description = voucher.description.replace(/"/g, '\\"');
      
      lines.push(`#VER ${series} ${voucher.voucherNumber} ${dateStr} "${description}"`);
      lines.push('{');
      
      voucher.lines.forEach(line => {
        // Positive amount = debit, negative amount = credit
        const amount = line.debit > 0 ? line.debit : -line.credit;
        lines.push(`\t#TRANS ${line.accountNumber} {} ${amount.toFixed(2)}`);
      });
      
      lines.push('}');
    });

  return lines.join('\n');
}

/**
 * Check if a voucher already exists based on series, number, and date
 */
export function findDuplicateVoucher(
  existingVouchers: Voucher[],
  series: string,
  number: number,
  date: string
): Voucher | undefined {
  return existingVouchers.find(v => 
    v.voucherNumber === number && 
    v.date === date
  );
}

/**
 * Convert SIE vouchers to internal voucher format
 */
export function convertSIEVouchersToInternal(
  sieVouchers: SIEVoucher[],
  companyId: string,
  existingVouchers: Voucher[],
  accounts: BASAccount[]
): { newVouchers: Voucher[]; skippedDuplicates: number; nextVoucherNumber: number } {
  const newVouchers: Voucher[] = [];
  let skippedDuplicates = 0;
  
  // Find the highest existing voucher number
  let nextVoucherNumber = existingVouchers.length > 0 
    ? Math.max(...existingVouchers.map(v => v.voucherNumber)) + 1 
    : 1;

  for (const sieVoucher of sieVouchers) {
    // Check for duplicates
    const duplicate = findDuplicateVoucher(
      [...existingVouchers, ...newVouchers],
      sieVoucher.series,
      sieVoucher.number,
      sieVoucher.date
    );

    if (duplicate) {
      skippedDuplicates++;
      continue;
    }

    // Update account names from our account list
    const linesWithNames = sieVoucher.lines.map(line => {
      const account = accounts.find(a => a.number === line.accountNumber);
      return {
        ...line,
        accountName: account?.name || line.accountName,
      };
    });

    const newVoucher: Voucher = {
      id: crypto.randomUUID(),
      companyId,
      voucherNumber: nextVoucherNumber,
      date: sieVoucher.date,
      description: sieVoucher.description,
      lines: linesWithNames,
      createdAt: new Date().toISOString(),
    };

    newVouchers.push(newVoucher);
    nextVoucherNumber++;
  }

  return { newVouchers, skippedDuplicates, nextVoucherNumber };
}

/**
 * Convert SIE accounts to BAS accounts
 */
export function convertSIEAccountsToBAS(sieAccounts: SIEAccount[]): BASAccount[] {
  return sieAccounts.map(account => ({
    number: account.number,
    name: account.name,
    class: getAccountClass(account.number),
  }));
}
