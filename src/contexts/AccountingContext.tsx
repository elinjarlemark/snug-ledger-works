import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { BASAccount, DEFAULT_BAS_ACCOUNTS, getAccountClass, calculateBalance } from "@/lib/bas-accounts";

export interface VoucherLine {
  id: string;
  accountNumber: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface Voucher {
  id: string;
  voucherNumber: number;
  date: string;
  description: string;
  lines: VoucherLine[];
  createdAt: string;
}

export interface AccountStatement {
  accountNumber: string;
  accountName: string;
  entries: {
    date: string;
    voucherNumber: number;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }[];
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
}

export interface GeneralLedgerEntry {
  accountNumber: string;
  accountName: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

interface AccountingContextType {
  accounts: BASAccount[];
  vouchers: Voucher[];
  nextVoucherNumber: number;
  addAccount: (account: BASAccount) => void;
  removeAccount: (accountNumber: string) => void;
  createVoucher: (voucher: Omit<Voucher, "id" | "voucherNumber" | "createdAt">) => Voucher | null;
  deleteVoucher: (voucherId: string) => void;
  getAccountStatement: (accountNumber: string, startDate?: string, endDate?: string) => AccountStatement | null;
  getGeneralLedger: (startDate?: string, endDate?: string) => GeneralLedgerEntry[];
  getIncomeStatement: (startDate?: string, endDate?: string) => { revenues: GeneralLedgerEntry[]; expenses: GeneralLedgerEntry[]; netResult: number };
  getBalanceSheet: () => { assets: GeneralLedgerEntry[]; equityLiabilities: GeneralLedgerEntry[]; totalAssets: number; totalEquityLiabilities: number; isBalanced: boolean };
  validateVoucher: (lines: VoucherLine[]) => { isValid: boolean; totalDebit: number; totalCredit: number; difference: number };
}

const AccountingContext = createContext<AccountingContextType | undefined>(undefined);

export function AccountingProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<BASAccount[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [nextVoucherNumber, setNextVoucherNumber] = useState(1);

  useEffect(() => {
    // Load from localStorage
    const storedAccounts = localStorage.getItem("accountpro_accounts");
    const storedVouchers = localStorage.getItem("accountpro_vouchers");
    const storedNextNumber = localStorage.getItem("accountpro_next_voucher");

    if (storedAccounts) {
      setAccounts(JSON.parse(storedAccounts));
    } else {
      setAccounts(DEFAULT_BAS_ACCOUNTS);
      localStorage.setItem("accountpro_accounts", JSON.stringify(DEFAULT_BAS_ACCOUNTS));
    }

    if (storedVouchers) {
      setVouchers(JSON.parse(storedVouchers));
    }

    if (storedNextNumber) {
      setNextVoucherNumber(parseInt(storedNextNumber));
    }
  }, []);

  const saveAccounts = (newAccounts: BASAccount[]) => {
    setAccounts(newAccounts);
    localStorage.setItem("accountpro_accounts", JSON.stringify(newAccounts));
  };

  const saveVouchers = (newVouchers: Voucher[], newNextNumber: number) => {
    setVouchers(newVouchers);
    setNextVoucherNumber(newNextNumber);
    localStorage.setItem("accountpro_vouchers", JSON.stringify(newVouchers));
    localStorage.setItem("accountpro_next_voucher", newNextNumber.toString());
  };

  const addAccount = (account: BASAccount) => {
    const exists = accounts.find(a => a.number === account.number);
    if (exists) return;
    
    const newAccounts = [...accounts, account].sort((a, b) => a.number.localeCompare(b.number));
    saveAccounts(newAccounts);
  };

  const removeAccount = (accountNumber: string) => {
    // Check if account has transactions
    const hasTransactions = vouchers.some(v => 
      v.lines.some(l => l.accountNumber === accountNumber)
    );
    if (hasTransactions) return; // Can't delete account with transactions
    
    const newAccounts = accounts.filter(a => a.number !== accountNumber);
    saveAccounts(newAccounts);
  };

  const validateVoucher = (lines: VoucherLine[]) => {
    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    const difference = Math.abs(totalDebit - totalCredit);
    const isValid = difference < 0.01 && totalDebit > 0;
    
    return { isValid, totalDebit, totalCredit, difference };
  };

  const createVoucher = (voucherData: Omit<Voucher, "id" | "voucherNumber" | "createdAt">) => {
    const validation = validateVoucher(voucherData.lines);
    if (!validation.isValid) return null;

    const newVoucher: Voucher = {
      ...voucherData,
      id: crypto.randomUUID(),
      voucherNumber: nextVoucherNumber,
      createdAt: new Date().toISOString(),
    };

    const newVouchers = [...vouchers, newVoucher].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime() || a.voucherNumber - b.voucherNumber
    );
    
    saveVouchers(newVouchers, nextVoucherNumber + 1);
    return newVoucher;
  };

  const deleteVoucher = (voucherId: string) => {
    const newVouchers = vouchers.filter(v => v.id !== voucherId);
    saveVouchers(newVouchers, nextVoucherNumber);
  };

  const getAccountStatement = (accountNumber: string, startDate?: string, endDate?: string): AccountStatement | null => {
    const account = accounts.find(a => a.number === accountNumber);
    if (!account) return null;

    const accountClass = getAccountClass(accountNumber);
    let runningBalance = 0;
    
    const entries = vouchers
      .filter(v => {
        if (startDate && v.date < startDate) return false;
        if (endDate && v.date > endDate) return false;
        return v.lines.some(l => l.accountNumber === accountNumber);
      })
      .flatMap(v => 
        v.lines
          .filter(l => l.accountNumber === accountNumber)
          .map(l => {
            const balanceChange = calculateBalance(accountClass, l.debit, l.credit);
            runningBalance += balanceChange;
            return {
              date: v.date,
              voucherNumber: v.voucherNumber,
              description: v.description,
              debit: l.debit,
              credit: l.credit,
              balance: runningBalance,
            };
          })
      );

    const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);

    return {
      accountNumber,
      accountName: account.name,
      entries,
      totalDebit,
      totalCredit,
      finalBalance: runningBalance,
    };
  };

  const getGeneralLedger = (startDate?: string, endDate?: string): GeneralLedgerEntry[] => {
    const ledger: Map<string, { totalDebit: number; totalCredit: number }> = new Map();

    vouchers
      .filter(v => {
        if (startDate && v.date < startDate) return false;
        if (endDate && v.date > endDate) return false;
        return true;
      })
      .forEach(v => {
        v.lines.forEach(l => {
          const current = ledger.get(l.accountNumber) || { totalDebit: 0, totalCredit: 0 };
          ledger.set(l.accountNumber, {
            totalDebit: current.totalDebit + l.debit,
            totalCredit: current.totalCredit + l.credit,
          });
        });
      });

    return Array.from(ledger.entries())
      .map(([accountNumber, { totalDebit, totalCredit }]) => {
        const account = accounts.find(a => a.number === accountNumber);
        const accountClass = getAccountClass(accountNumber);
        return {
          accountNumber,
          accountName: account?.name || "Unknown",
          totalDebit,
          totalCredit,
          balance: calculateBalance(accountClass, totalDebit, totalCredit),
        };
      })
      .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
  };

  const getIncomeStatement = (startDate?: string, endDate?: string) => {
    const ledger = getGeneralLedger(startDate, endDate);
    
    const revenues = ledger.filter(e => e.accountNumber.startsWith("3") || e.accountNumber === "8310");
    const expenses = ledger.filter(e => 
      e.accountNumber.startsWith("4") || 
      e.accountNumber.startsWith("5") || 
      e.accountNumber.startsWith("6") || 
      e.accountNumber.startsWith("7") ||
      (e.accountNumber.startsWith("8") && e.accountNumber !== "8310" && e.accountNumber !== "8999")
    );

    const totalRevenue = revenues.reduce((sum, e) => sum + e.balance, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.balance, 0);
    const netResult = totalRevenue - totalExpenses;

    return { revenues, expenses, netResult };
  };

  const getBalanceSheet = () => {
    const ledger = getGeneralLedger();
    
    const assets = ledger.filter(e => e.accountNumber.startsWith("1"));
    const equityLiabilities = ledger.filter(e => e.accountNumber.startsWith("2"));

    const totalAssets = assets.reduce((sum, e) => sum + e.balance, 0);
    const totalEquityLiabilities = equityLiabilities.reduce((sum, e) => sum + e.balance, 0);
    
    // In a balanced system, Assets = Equity + Liabilities
    const isBalanced = Math.abs(totalAssets - totalEquityLiabilities) < 0.01;

    return { assets, equityLiabilities, totalAssets, totalEquityLiabilities, isBalanced };
  };

  return (
    <AccountingContext.Provider value={{
      accounts,
      vouchers,
      nextVoucherNumber,
      addAccount,
      removeAccount,
      createVoucher,
      deleteVoucher,
      getAccountStatement,
      getGeneralLedger,
      getIncomeStatement,
      getBalanceSheet,
      validateVoucher,
    }}>
      {children}
    </AccountingContext.Provider>
  );
}

export function useAccounting() {
  const context = useContext(AccountingContext);
  if (context === undefined) {
    throw new Error("useAccounting must be used within an AccountingProvider");
  }
  return context;
}
