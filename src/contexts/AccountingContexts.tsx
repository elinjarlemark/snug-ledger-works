import { appStorage, flushAppStorage } from "@/lib/appStorage";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";

import {
  BASAccount,
  getAccountClass,
  calculateBalance,
  getLatestBASAccounts,
} from "@/lib/bas-accounts";

import { useAuth } from "./AuthContext";
import { authService } from "@/services/auth";

import {
  parseSIEFile,
  generateSIEFile,
  convertSIEVouchersToInternal,
  convertSIEAccountsToBAS,
  convertSIEOpeningBalancesToVoucher,
} from "@/lib/sie";

import {
  loadHistoricalAccounts,
  registerHistoricalAccountsFromSIE,
} from "@/lib/account-plan";

import {
  validateBookkeepingLines,
  roundToOre,
  toOre,
  type BookkeepingValidationResult,
} from "@/lib/money";

const ATTACH_KEY_PREFIX =
  "accountpro_attachment_";

function isQuotaError(
  err: unknown
): boolean {
  return (
    err instanceof DOMException &&
    (
      err.name ===
        "QuotaExceededError" ||
      err.name ===
        "NS_ERROR_DOM_QUOTA_REACHED" ||
      err.code === 22 ||
      err.code === 1014
    )
  );
}

function getAttachmentStorageKey(
  companyId: string,
  voucherId: string,
  attachmentId: string
): string {
  return (
    ATTACH_KEY_PREFIX +
    companyId +
    "_" +
    voucherId +
    "_" +
    attachmentId
  );
}

function storeAttachmentExternally(
  companyId: string,
  voucherId: string,
  attachmentId: string,
  dataUrl: string
): boolean {
  try {
    appStorage.setItem(
      getAttachmentStorageKey(
        companyId,
        voucherId,
        attachmentId
      ),
      dataUrl
    );

    return true;
  } catch {
    return false;
  }
}

function loadExternalAttachment(
  companyId: string,
  voucherId: string,
  attachmentId: string
): string | null {
  try {
    return appStorage.getItem(
      getAttachmentStorageKey(
        companyId,
        voucherId,
        attachmentId
      )
    );
  } catch {
    return null;
  }
}

function persistVouchers(
  companyId: string,
  vouchers: any[]
): void {
  const key =
    "accountpro_vouchers_" +
    companyId;

  try {
    appStorage.setItem(
      key,
      JSON.stringify(
        vouchers
      )
    );

    return;
  } catch (err) {
    if (
      !isQuotaError(err)
    ) {
      console.error("Failed to persist vouchers:", err);
      throw err;
    }
  }

  const slim =
    vouchers.map(
      (voucher: any) => {
        if (
          !voucher.attachments ||
          voucher.attachments
            .length === 0
        ) {
          return voucher;
        }

        const slimAttachments =
          voucher.attachments.map(
            (
              attachment: any
            ) => {
              if (
                attachment.dataUrl
              ) {
                const stored =
                  storeAttachmentExternally(
                    companyId,
                    voucher.id,
                    attachment.id,
                    attachment.dataUrl
                  );

                if (stored) {
                  const {
                    dataUrl,
                    ...rest
                  } = attachment;

                  return {
                    ...rest,
                    _external:
                      true,
                  };
                }
              }

              return attachment;
            }
          );

        return {
          ...voucher,

          attachments:
            slimAttachments,
        };
      }
    );

  try {
    appStorage.setItem(
      key,
      JSON.stringify(
        slim
      )
    );
  } catch (err) {
    console.error("Vouchers still exceed quota after externalizing attachments:", err);
    throw err;
  }
}

function rehydrateVouchers(
  companyId: string,
  vouchers: any[]
): any[] {
  return vouchers.map(
    (voucher: any) => {
      if (
        !voucher.attachments ||
        voucher.attachments
          .length === 0
      ) {
        return voucher;
      }

      const attachments =
        voucher.attachments.map(
          (
            attachment: any
          ) => {
            if (
              attachment._external &&
              !attachment.dataUrl
            ) {
              const dataUrl =
                loadExternalAttachment(
                  companyId,
                  voucher.id,
                  attachment.id
                );

              if (dataUrl) {
                const {
                  _external,
                  ...rest
                } = attachment;

                return {
                  ...rest,
                  dataUrl,
                };
              }
            }

            return attachment;
          }
        );

      return {
        ...voucher,
        attachments,
      };
    }
  );
}

export interface VoucherLine {
  id: string;
  accountNumber: string;
  accountName: string;

  debit: number;
  credit: number;

  vatCodeId?: string;
}

export interface VoucherAttachment {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
}

export interface Voucher {
  id: string;
  companyId: string;

  voucherNumber:
    number;

  date: string;

  description:
    string;

  lines:
    VoucherLine[];

  attachments?:
    VoucherAttachment[];

  reversesVoucherId?:
    string;

  reversesVoucherNumber?:
    number;

  reversedByVoucherId?:
    string;

  reversedByVoucherNumber?:
    number;

  createdAt:
    string;

  // Older vouchers without these fields are migrated non-destructively.
  status?: "POSTED" | "DRAFT";
  documentDate?: string;
  party?: string;
  partyId?: string;
  postedAt?: string;
  postedByUserId?: string;
  postedByName?: string;
  originalSeries?: string;
  originalVoucherNumber?: number;
  importSourceId?: string;
  importedAt?: string;
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
  accounts:
    BASAccount[];

  vouchers:
    Voucher[];

  nextVoucherNumber:
    number;

  addAccount: (
    account:
      BASAccount
  ) => void;

  removeAccount: (
    accountNumber:
      string
  ) => void;

  createVoucher: (
    voucher:
      Omit<
        Voucher,
        | "id"
        | "companyId"
        | "voucherNumber"
        | "createdAt"
      >
  ) =>
    Promise<Voucher | null>;

  updateVoucher: (
    voucherId:
      string,

    updates:
      Partial<
        Pick<
          Voucher,
          | "date"
          | "description"
          | "lines"
          | "attachments"
          | "reversesVoucherId"
          | "reversesVoucherNumber"
          | "reversedByVoucherId"
          | "reversedByVoucherNumber"
        >
      >
  ) =>
    Voucher | null;

  deleteVoucher: (
    voucherId:
      string
  ) => void;

  reverseVoucher: (
    voucher:
      Voucher,
    date?:
      string
  ) =>
    Promise<Voucher | null>;

  getVoucherById: (
    voucherId:
      string
  ) =>
    Voucher | undefined;

  getVoucherByNumber: (
    voucherNumber:
      number
  ) =>
    Voucher | undefined;

  getAccountStatement: (
    accountNumber:
      string,
    startDate?:
      string,
    endDate?:
      string
  ) =>
    AccountStatement | null;

  getGeneralLedger: (
    startDate?:
      string,
    endDate?:
      string
  ) =>
    GeneralLedgerEntry[];

  getIncomeStatement: (
    startDate?:
      string,
    endDate?:
      string
  ) => {
    revenues:
      GeneralLedgerEntry[];

    expenses:
      GeneralLedgerEntry[];

    netResult:
      number;
  };

  getBalanceSheet: (
    endDate?:
      string
  ) => {
    assets:
      GeneralLedgerEntry[];

    equityLiabilities:
      GeneralLedgerEntry[];

    totalAssets:
      number;

    totalEquityLiabilities:
      number;

    isBalanced:
      boolean;
  };

  validateVoucher: (
    lines:
      VoucherLine[]
  ) =>
    BookkeepingValidationResult;

  importSIE: (
    fileContent:
      string
  ) => Promise<{
    success:
      boolean;

    imported:
      number;

    skipped:
      number;

    errors:
      string[];
  }>;

  exportSIE:
    () => string;
}

const AccountingContext =
  createContext<
    AccountingContextType |
      undefined
  >(undefined);

const API_BASE_URL =
  import.meta.env
    .VITE_API_BASE_URL ??
  "http://localhost:8000";

function mergeAccountsPreferFirst(
  ...groups:
    BASAccount[][]
): BASAccount[] {
  const accountsByNumber =
    new Map<
      string,
      BASAccount
    >();

  groups.forEach(
    (group) => {
      group.forEach(
        (account) => {
          if (
            !accountsByNumber.has(
              account.number
            )
          ) {
            accountsByNumber.set(
              account.number,
              account
            );
          }
        }
      );
    }
  );

  return Array.from(
    accountsByNumber.values()
  ).sort(
    (a, b) =>
      a.number.localeCompare(
        b.number
      )
  );
}

function normalizeVoucherLines(
  lines:
    VoucherLine[]
): VoucherLine[] {
  return lines
    .map(
      (line) => ({
        ...line,

        accountNumber:
          (
            line.accountNumber ||
            ""
          ).trim(),

        debit:
          roundToOre(
            line.debit
          ),

        credit:
          roundToOre(
            line.credit
          ),
      })
    )
    .filter(
      (line) => {
        const debitOre =
          toOre(
            line.debit
          ) || 0;

        const creditOre =
          toOre(
            line.credit
          ) || 0;

        return (
          Boolean(
            line.accountNumber
          ) &&
          (
            debitOre > 0 ||
            creditOre > 0
          )
        );
      }
    );
}

export function AccountingProvider({
  children,
}: {
  children:
    ReactNode;
}) {
  const {
    user,
    activeCompany,
  } = useAuth();

  const [
    accounts,
    setAccounts,
  ] =
    useState<
      BASAccount[]
    >([]);

  const [
    vouchers,
    setVouchers,
  ] =
    useState<
      Voucher[]
    >([]);

  const [
    nextVoucherNumber,
    setNextVoucherNumber,
  ] =
    useState(1);

  const companyId =
    activeCompany?.id ||
    "";

  const activeCompanyIdRef =
    useRef(
      companyId
    );
  // Förhindra samtidiga postningar och stopp vid avvisad databasskrivning.
  const writingRef = useRef(false);
  const failedWriteRef = useRef(false);

  useEffect(
    () => {
      activeCompanyIdRef.current =
        companyId;
    },
    [
      companyId,
    ]
  );

  const syncSieStateToDatabase = (
    nextVouchers:
      Voucher[],

    nextAccounts:
      BASAccount[]
  ) => {
    const numericUserId =
      Number(
        user?.id
      );

    const numericCompanyId =
      Number(
        companyId
      );

    if (
      !authService.isDatabaseConnected() ||
      !Number.isFinite(
        numericUserId
      ) ||
      !Number.isFinite(
        numericCompanyId
      ) ||
      !activeCompany
    ) {
      return;
    }

    const sieContent =
      generateSIEFile(
        nextVouchers,
        nextAccounts,
        {
          companyName:
            activeCompany
              .companyName,

          organizationNumber:
            activeCompany
              .organizationNumber,

          fiscalYearStart:
            activeCompany
              .fiscalYearStart,

          fiscalYearEnd:
            activeCompany
              .fiscalYearEnd,
        }
      );

    fetch(
      API_BASE_URL +
        "/companies/" +
        numericCompanyId +
        "/sie-state",
      {
        method:
          "PUT",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            user_id:
              numericUserId,

            sie_content:
              sieContent,
          }),
      }
    ).then((response) => {
      if (!response.ok) {
        console.warn("SIE-spegeln kunde inte uppdateras. Verifikationen finns kvar i arbetsytans bokföringsregister.");
      }
    }).catch((error) => {
      console.warn("SIE-spegeln kunde inte uppdateras:", error);
    });
  };

  useEffect(
    () => {
      const latestAccounts =
        getLatestBASAccounts(
          "K2"
        );

      if (!companyId) {
        setAccounts(
          latestAccounts
        );

        setVouchers([]);

        setNextVoucherNumber(
          1
        );

        return;
      }

      const historicalAccounts =
        loadHistoricalAccounts(
          companyId
        );

      const initialAccounts =
        mergeAccountsPreferFirst(
          latestAccounts,
          historicalAccounts
        );

      setAccounts(
        initialAccounts
      );

      const storedVouchers =
        appStorage.getItem(
          "accountpro_vouchers_" +
            companyId
        );

      const storedNextNumber =
        appStorage.getItem(
          "accountpro_next_voucher_" +
            companyId
        );

      let initialVouchers:
        Voucher[] =
        storedVouchers
          ? JSON.parse(
              storedVouchers
            ) as Voucher[]
          : [];

      initialVouchers =
        rehydrateVouchers(
          companyId,
          initialVouchers
        ) as Voucher[];

      let initialNextNumber =
        storedNextNumber
          ? Number.parseInt(
              storedNextNumber,
              10
            )
          : 1;

      const isTestUser =
        !authService.isDatabaseConnected() &&
        user?.email?.toLowerCase() ===
          "test@test.com";

      const hasImportedSIE =
        appStorage.getItem(
          "accountpro_sie_imported_" +
            companyId
        ) ===
        "true";

      if (
        isTestUser &&
        !hasImportedSIE &&
        initialVouchers.length ===
          0
      ) {
        const today =
          new Date()
            .toISOString()
            .split("T")[0];

        const seedAccount =
          initialAccounts.find(
            (account) =>
              account.number ===
              "1930"
          );

        if (seedAccount) {
          const seeded:
            Voucher[] =
            [];

          let voucherNo =
            1;

          initialAccounts.forEach(
            (account) => {
              if (
                account.number ===
                "1930"
              ) {
                return;
              }

              seeded.push({
                id:
                  crypto.randomUUID(),

                companyId,

                voucherNumber:
                  voucherNo,

                date:
                  today,

                description:
                  "Demo: " +
                  account.number +
                  " " +
                  account.name,

                createdAt:
                  new Date()
                    .toISOString(),

                lines: [
                  {
                    id:
                      crypto.randomUUID(),

                    accountNumber:
                      "1930",

                    accountName:
                      seedAccount.name,

                    debit:
                      1,

                    credit:
                      0,
                  },

                  {
                    id:
                      crypto.randomUUID(),

                    accountNumber:
                      account.number,

                    accountName:
                      account.name,

                    debit:
                      0,

                    credit:
                      1,
                  },
                ],
              });

              voucherNo +=
                1;
            }
          );

          initialVouchers =
            seeded;

          initialNextNumber =
            voucherNo;

          persistVouchers(
            companyId,
            seeded
          );

          appStorage.setItem(
            "accountpro_next_voucher_" +
              companyId,

            String(
              voucherNo
            )
          );
        }
      }

      setVouchers(
        initialVouchers
      );

      setNextVoucherNumber(
        initialNextNumber
      );

      const numericUserId =
        Number(
          user?.id
        );

      const numericCompanyId =
        Number(
          companyId
        );

      if (
        storedVouchers !==
          null ||
        !authService.isDatabaseConnected() ||
        !Number.isFinite(
          numericUserId
        ) ||
        !Number.isFinite(
          numericCompanyId
        )
      ) {
        return;
      }

      const hydrationController =
        new AbortController();

      const requestedCompanyId =
        companyId;

      fetch(
        API_BASE_URL +
          "/companies/" +
          numericCompanyId +
          "/sie-state?user_id=" +
          numericUserId,
        {
          signal:
            hydrationController
              .signal,
        }
      )
        .then(
          (response) => {
            if (
              !response.ok
            ) {
              throw new Error(
                "Failed to fetch SIE state"
              );
            }

            return response.json();
          }
        )
        .then(
          (payload) => {
            if (
              hydrationController
                .signal
                .aborted ||
              activeCompanyIdRef
                .current !==
                requestedCompanyId
            ) {
              return;
            }

            const sieContent =
              typeof payload?.sieContent ===
              "string"
                ? payload.sieContent
                : "";

            if (
              !sieContent.trim()
            ) {
              return;
            }

            const parseResult =
              parseSIEFile(
                sieContent
              );

            if (
              parseResult
                .errors
                .length >
              0
            ) {
              return;
            }

            registerHistoricalAccountsFromSIE(
              requestedCompanyId,
              parseResult
            );

            const historicalAfterImport =
              loadHistoricalAccounts(
                requestedCompanyId
              );

            const sieAccounts =
              convertSIEAccountsToBAS(
                parseResult.accounts
              );

            const conversionAccounts =
              mergeAccountsPreferFirst(
                sieAccounts,
                historicalAfterImport,
                latestAccounts
              );

            const contextAccounts =
              mergeAccountsPreferFirst(
                latestAccounts,
                historicalAfterImport
              );

            const openingBalanceVoucher =
              convertSIEOpeningBalancesToVoucher(
                parseResult,
                requestedCompanyId,
                conversionAccounts
              );

            if (
              openingBalanceVoucher
            ) {
              openingBalanceVoucher
                .voucherNumber =
                0;
            }

            const converted =
              convertSIEVouchersToInternal(
                parseResult.vouchers,
                requestedCompanyId,
                [],
                conversionAccounts
              );

            const dbVouchers =
              [
                ...(
                  openingBalanceVoucher
                    ? [
                        openingBalanceVoucher,
                      ]
                    : []
                ),

                ...converted
                  .newVouchers,
              ].sort(
                (
                  a,
                  b
                ) =>
                  new Date(
                    a.date
                  ).getTime() -
                    new Date(
                      b.date
                    ).getTime() ||
                  a.voucherNumber -
                    b.voucherNumber
              );

            if (
              activeCompanyIdRef
                .current !==
              requestedCompanyId
            ) {
              return;
            }

            setAccounts(
              contextAccounts
            );

            setVouchers(
              dbVouchers
            );

            setNextVoucherNumber(
              converted
                .nextVoucherNumber
            );

            persistVouchers(
              requestedCompanyId,
              dbVouchers
            );

            appStorage.setItem(
              "accountpro_next_voucher_" +
                requestedCompanyId,

              converted
                .nextVoucherNumber
                .toString()
            );
          }
        )
        .catch(
          (error) => {
            if (
              error?.name ===
              "AbortError"
            ) {
              return;
            }

            return undefined;
          }
        );

      return () => {
        hydrationController.abort();
      };
    },
    [
      companyId,
      user?.id,
    ]
  );

  const saveAccounts = (
    newAccounts:
      BASAccount[]
  ) => {
    setAccounts(
      newAccounts
    );
  };

  const saveVouchers = async (
    newVouchers: Voucher[],
    newNextNumber: number
  ): Promise<void> => {
    if (!companyId) throw new Error("Välj ett företag innan du bokför.");
    const requestedCompanyId = companyId;
    persistVouchers(requestedCompanyId, newVouchers);
    appStorage.setItem("accountpro_next_voucher_" + requestedCompanyId, String(newNextNumber));
    // appStorage lagrar först ändringen i en återställningsjournal. Vänta
    // här på databasens kvittens innan vi visar att bokföringen lyckades.
    await flushAppStorage();
    if (activeCompanyIdRef.current !== requestedCompanyId) {
      throw new Error("Företaget byttes medan verifikationen sparades.");
    }
    setVouchers(newVouchers);
    setNextVoucherNumber(newNextNumber);
  };

  const commitVoucherState = async (
    newVouchers: Voucher[],
    newNextNumber: number
  ): Promise<boolean> => {
    if (writingRef.current || failedWriteRef.current) {
      console.warn("Bokföringen är upptagen eller en tidigare sparning misslyckades.");
      return false;
    }
    writingRef.current = true;
    try {
      await saveVouchers(newVouchers, newNextNumber);
      return true;
    } catch (error) {
      failedWriteRef.current = true;
      console.error("Bokföringen kunde inte bekräftas av lagringen:", error);
      // AppStorage behåller sin återställningsjournal. Tillåt inte en ny
      // bokföringspost med samma nummer innan felet har lösts.
      return false;
    } finally {
      writingRef.current = false;
    }
  };

  const addAccount = (
    _account:
      BASAccount
  ) => {
    console.warn(
      "AccountPro använder endast BAS-kontoplanen. Egna konton kan inte skapas manuellt."
    );
  };

  const removeAccount = (
    _accountNumber:
      string
  ) => {
    console.warn(
      "BAS-konton och historiskt verifierade konton tas inte bort ur AccountPro."
    );
  };

  const validateVoucher = (
    lines:
      VoucherLine[]
  ):
    BookkeepingValidationResult => {
    return validateBookkeepingLines(
      lines
    );
  };

  const createVoucher = async (
    voucherData:
      Omit<
        Voucher,
        | "id"
        | "companyId"
        | "voucherNumber"
        | "createdAt"
      >
  ) => {
    const normalizedLines =
      normalizeVoucherLines(
        voucherData.lines
      );

    const validation =
      validateVoucher(voucherData.lines);

    if (!validation.isValid || !companyId || !voucherData.date || !voucherData.description.trim()) {
      return null;
    }
    const today = new Date().toLocaleDateString("sv-SE");
    if (voucherData.date > today) {
      return null;
    }
    const lockedYears = JSON.parse(appStorage.getItem("accountpro_locked_years_" + companyId) || "[]") as number[];
    if (lockedYears.includes(Number(voucherData.date.slice(0, 4)))) {
      return null;
    }

    const postedAt = new Date().toISOString();
    const newVoucher:
      Voucher = {
      ...voucherData,

      lines:
        normalizedLines,
      status: "POSTED",
      documentDate: voucherData.documentDate || today,
      postedAt,
      postedByUserId: String(user?.id || ""),
      postedByName: user?.name || user?.email || "Okänd användare",

      id:
        crypto.randomUUID(),

      companyId,

      voucherNumber:
        Math.max(nextVoucherNumber, ...vouchers.map((entry) => entry.voucherNumber + 1)),

      createdAt:
        new Date()
          .toISOString(),
    };

    const sourceVoucher =
      voucherData
        .reversesVoucherId
        ? vouchers.find(
            (voucher) =>
              voucher.id ===
              voucherData
                .reversesVoucherId
          )
        : undefined;

    if (voucherData.reversesVoucherId && (
      !sourceVoucher ||
      sourceVoucher.reversedByVoucherId ||
      vouchers.some((entry) => entry.reversesVoucherId === sourceVoucher.id)
    )) {
      return null;
    }

    const linkedSourceVoucher =
      sourceVoucher
        ? {
            ...sourceVoucher,

            reversedByVoucherId:
              newVoucher.id,

            reversedByVoucherNumber:
              newVoucher
                .voucherNumber,
          }
        : undefined;

    const newVouchers =
      [
        ...vouchers.map(
          (voucher) =>
            linkedSourceVoucher &&
            voucher.id ===
              linkedSourceVoucher.id
              ? linkedSourceVoucher
              : voucher
        ),

        newVoucher,
      ].sort(
        (
          a,
          b
        ) =>
          new Date(
            a.date
          ).getTime() -
            new Date(
              b.date
            ).getTime() ||
          a.voucherNumber -
            b.voucherNumber
      );

    if (!(await commitVoucherState(newVouchers, newVoucher.voucherNumber + 1))) {
      return null;
    }

    syncSieStateToDatabase(
      newVouchers,
      accounts
    );

    return newVoucher;
  };

  // Posted vouchers are permanent. Drafts live outside this context and may be deleted.
  const deleteVoucher = (_voucherId: string): void => {
    console.warn("Bokförda verifikationer kan inte raderas. Skapa en rättelse.");
  };

  const updateVoucher = (
    _voucherId: string,
    _updates: Partial<Pick<Voucher,
      | "date" | "description" | "lines" | "attachments"
      | "reversesVoucherId" | "reversesVoucherNumber"
      | "reversedByVoucherId" | "reversedByVoucherNumber"
    >>
  ): Voucher | null => {
    console.warn("Bokförda verifikationer kan inte ändras. Skapa en rättelse.");
    return null;
  };

  const reverseVoucher = async (
    voucher:
      Voucher,

    date =
      new Date()
        .toISOString()
        .split("T")[0]
  ) => {
    const existingVoucher =
      vouchers.find(
        (entry) =>
          entry.id ===
          voucher.id
      );

    if (!existingVoucher || existingVoucher.reversedByVoucherId ||
      vouchers.some((entry) => entry.reversesVoucherId === existingVoucher.id)) {
      return null;
    }

    const reversalLines =
      existingVoucher
        .lines
        .map(
          (line) => ({
            id:
              crypto.randomUUID(),

            accountNumber:
              line.accountNumber,

            accountName:
              line.accountName,

            debit:
              roundToOre(
                line.credit
              ),

            credit:
              roundToOre(
                line.debit
              ),

            vatCodeId:
              line.vatCodeId,
          })
        );

    const validation =
      validateVoucher(
        reversalLines
      );

    if (
      !validation.isValid
    ) {
      return null;
    }

    const today = new Date().toLocaleDateString("sv-SE");
    if (date > today || JSON.parse(appStorage.getItem("accountpro_locked_years_" + companyId) || "[]").includes(Number(date.slice(0, 4)))) {
      return null;
    }
    const postedAt = new Date().toISOString();
    const reversalVoucher:
      Voucher = {
      status: "POSTED",
      documentDate: today,
      postedAt,
      postedByUserId: String(user?.id || ""),
      postedByName: user?.name || user?.email || "Okänd användare",
      id:
        crypto.randomUUID(),

      companyId,

      voucherNumber:
        Math.max(nextVoucherNumber, ...vouchers.map((entry) => entry.voucherNumber + 1)),

      date,

      description:
        "Reversal of voucher #" +
        existingVoucher
          .voucherNumber +
        ": " +
        existingVoucher
          .description,

      lines:
        reversalLines,

      reversesVoucherId:
        existingVoucher.id,

      reversesVoucherNumber:
        existingVoucher
          .voucherNumber,

      createdAt:
        new Date()
          .toISOString(),
    };

    const updatedOriginal:
      Voucher = {
      ...existingVoucher,

      reversedByVoucherId:
        reversalVoucher.id,

      reversedByVoucherNumber:
        reversalVoucher
          .voucherNumber,
    };

    const newVouchers =
      vouchers
        .map(
          (entry) =>
            entry.id ===
            existingVoucher.id
              ? updatedOriginal
              : entry
        )
        .concat(
          reversalVoucher
        )
        .sort(
          (
            a,
            b
          ) =>
            new Date(
              a.date
            ).getTime() -
              new Date(
                b.date
              ).getTime() ||
            a.voucherNumber -
              b.voucherNumber
        );

    if (!(await commitVoucherState(newVouchers, reversalVoucher.voucherNumber + 1))) {
      return null;
    }

    syncSieStateToDatabase(
      newVouchers,
      accounts
    );

    return reversalVoucher;
  };

  const getVoucherById = (
    voucherId:
      string
  ) => {
    return vouchers.find(
      (voucher) =>
        voucher.id ===
        voucherId
    );
  };

  const getVoucherByNumber = (
    voucherNumber:
      number
  ) => {
    return vouchers.find(
      (voucher) =>
        voucher.voucherNumber ===
        voucherNumber
    );
  };

  const getAccountStatement = (
    accountNumber:
      string,

    startDate?:
      string,

    endDate?:
      string
  ):
    AccountStatement |
    null => {
    const account =
      accounts.find(
        (entry) =>
          entry.number ===
          accountNumber
      );

    if (!account) {
      return null;
    }

    const accountClass =
      getAccountClass(
        accountNumber
      );

    let runningBalance =
      0;

    const entries =
      vouchers
        .filter(
          (voucher) => {
            if (
              startDate &&
              voucher.date <
                startDate
            ) {
              return false;
            }

            if (
              endDate &&
              voucher.date >
                endDate
            ) {
              return false;
            }

            return voucher.lines.some(
              (line) =>
                line.accountNumber ===
                accountNumber
            );
          }
        )
        .flatMap(
          (voucher) =>
            voucher.lines
              .filter(
                (line) =>
                  line.accountNumber ===
                  accountNumber
              )
              .map(
                (line) => {
                  const balanceChange =
                    calculateBalance(
                      accountClass,
                      line.debit,
                      line.credit
                    );

                  runningBalance =
                    roundToOre(
                      runningBalance +
                        balanceChange
                    );

                  return {
                    date:
                      voucher.date,

                    voucherNumber:
                      voucher
                        .voucherNumber,

                    description:
                      voucher
                        .description,

                    debit:
                      line.debit,

                    credit:
                      line.credit,

                    balance:
                      runningBalance,
                  };
                }
              )
        );

    const totalDebit =
      roundToOre(
        entries.reduce(
          (
            sum,
            entry
          ) =>
            sum +
            entry.debit,
          0
        )
      );

    const totalCredit =
      roundToOre(
        entries.reduce(
          (
            sum,
            entry
          ) =>
            sum +
            entry.credit,
          0
        )
      );

    return {
      accountNumber,

      accountName:
        account.name,

      entries,

      totalDebit,

      totalCredit,

      finalBalance:
        runningBalance,
    };
  };

  const getGeneralLedger = (
    startDate?:
      string,

    endDate?:
      string
  ):
    GeneralLedgerEntry[] => {
    const ledger =
      new Map<
        string,
        {
          totalDebit:
            number;

          totalCredit:
            number;
        }
      >();

    vouchers
      .filter(
        (voucher) => {
          if (
            startDate &&
            voucher.date <
              startDate
          ) {
            return false;
          }

          if (
            endDate &&
            voucher.date >
              endDate
          ) {
            return false;
          }

          return true;
        }
      )
      .forEach(
        (voucher) => {
          voucher.lines.forEach(
            (line) => {
              const current =
                ledger.get(
                  line.accountNumber
                ) || {
                  totalDebit:
                    0,

                  totalCredit:
                    0,
                };

              ledger.set(
                line.accountNumber,
                {
                  totalDebit:
                    roundToOre(
                      current.totalDebit +
                        line.debit
                    ),

                  totalCredit:
                    roundToOre(
                      current.totalCredit +
                        line.credit
                    ),
                }
              );
            }
          );
        }
      );

    return Array.from(
      ledger.entries()
    )
      .map(
        ([
          accountNumber,
          {
            totalDebit,
            totalCredit,
          },
        ]) => {
          const account =
            accounts.find(
              (entry) =>
                entry.number ===
                accountNumber
            );

          const accountClass =
            getAccountClass(
              accountNumber
            );

          return {
            accountNumber,

            accountName:
              account?.name ||
              "Unknown",

            totalDebit,

            totalCredit,

            balance:
              roundToOre(
                calculateBalance(
                  accountClass,
                  totalDebit,
                  totalCredit
                )
              ),
          };
        }
      )
      .sort(
        (a, b) =>
          a.accountNumber.localeCompare(
            b.accountNumber
          )
      );
  };

  const getIncomeStatement = (
    startDate?:
      string,

    endDate?:
      string
  ) => {
    const ledger =
      getGeneralLedger(
        startDate,
        endDate
      );

    const revenues =
      ledger.filter(
        (entry) =>
          entry.accountNumber
            .startsWith("3") ||
          entry.accountNumber ===
            "8310"
      );

    const expenses =
      ledger.filter(
        (entry) =>
          entry.accountNumber
            .startsWith("4") ||
          entry.accountNumber
            .startsWith("5") ||
          entry.accountNumber
            .startsWith("6") ||
          entry.accountNumber
            .startsWith("7") ||
          (
            entry.accountNumber
              .startsWith("8") &&
            entry.accountNumber !==
              "8310" &&
            entry.accountNumber !==
              "8999"
          )
      );

    const totalRevenue =
      roundToOre(
        revenues.reduce(
          (
            sum,
            entry
          ) =>
            sum +
            entry.balance,
          0
        )
      );

    const totalExpenses =
      roundToOre(
        expenses.reduce(
          (
            sum,
            entry
          ) =>
            sum +
            entry.balance,
          0
        )
      );

    const netResult =
      roundToOre(
        totalRevenue -
          totalExpenses
      );

    return {
      revenues,

      expenses,

      netResult,
    };
  };

  const getBalanceSheet = (
    endDate?:
      string
  ) => {
    const ledger =
      getGeneralLedger(
        undefined,
        endDate
      );

    const assets =
      ledger.filter(
        (entry) =>
          entry.accountNumber
            .startsWith("1")
      );

    const equityLiabilities =
      ledger.filter(
        (entry) =>
          entry.accountNumber
            .startsWith("2")
      );

    const totalAssets =
      roundToOre(
        assets.reduce(
          (
            sum,
            entry
          ) =>
            sum +
            entry.balance,
          0
        )
      );

    const totalEquityLiabilities =
      roundToOre(
        equityLiabilities.reduce(
          (
            sum,
            entry
          ) =>
            sum +
            entry.balance,
          0
        )
      );

    const assetOre =
      toOre(
        totalAssets
      );

    const equityLiabilityOre =
      toOre(
        totalEquityLiabilities
      );

    const isBalanced =
      assetOre !== null &&
      equityLiabilityOre !==
        null &&
      assetOre ===
        equityLiabilityOre;

    return {
      assets,

      equityLiabilities,

      totalAssets,

      totalEquityLiabilities,

      isBalanced,
    };
  };

  const importSIE = async (
    fileContent:
      string
  ): Promise<{
    success:
      boolean;

    imported:
      number;

    skipped:
      number;

    errors:
      string[];
  }> => {
    const parseResult =
      parseSIEFile(
        fileContent
      );

    if (
      parseResult.errors.length >
      0
    ) {
      return {
        success:
          false,

        imported:
          0,

        skipped:
          0,

        errors:
          parseResult.errors,
      };
    }

    if (writingRef.current || failedWriteRef.current) {
      return { success: false, imported: 0, skipped: 0,
        errors: ["En sparning pågår eller har misslyckats. Lös lagringsfelet innan du importerar."] };
    }

    // Existing posted vouchers must never be overwritten by another SIE import.
    // Import into an empty ledger; a future reconciled incremental import can
    // be implemented separately without weakening this invariant.
    if (vouchers.length > 0) {
      return {
        success: false, imported: 0, skipped: 0,
        errors: ["Företaget har redan bokförda verifikationer. Importen stoppades för att skydda befintlig bokföring. Importera till ett tomt företag tills sammanslagning med avstämning har införts."],
      };
    }
    if (companyId) {
      registerHistoricalAccountsFromSIE(companyId, parseResult);
    }
    const importSourceId = crypto.randomUUID();
    const importedAt = new Date().toISOString();

    const standardAccounts =
      getLatestBASAccounts(
        "K2"
      );

    const historicalAccounts =
      companyId
        ? loadHistoricalAccounts(
            companyId
          )
        : [];

    const sieAccounts =
      convertSIEAccountsToBAS(
        parseResult.accounts
      );

    const conversionAccounts =
      mergeAccountsPreferFirst(
        sieAccounts,
        historicalAccounts,
        standardAccounts
      );

    const contextAccounts =
      mergeAccountsPreferFirst(
        standardAccounts,
        historicalAccounts
      );

    const openingBalanceVoucher =
      convertSIEOpeningBalancesToVoucher(
        parseResult,
        companyId,
        conversionAccounts
      );

    if (
      openingBalanceVoucher
    ) {
      openingBalanceVoucher.voucherNumber = 0;
      openingBalanceVoucher.importSourceId = importSourceId;
      openingBalanceVoucher.importedAt = importedAt;
      openingBalanceVoucher.status = "POSTED";
    }

    const converted =
      convertSIEVouchersToInternal(
        parseResult.vouchers,
        companyId,
        [],
        conversionAccounts
      );
    converted.newVouchers.forEach((voucher) => {
      voucher.importSourceId = importSourceId;
      voucher.importedAt = importedAt;
      voucher.status = "POSTED";
    });

    const replacementVouchers =
      [
        ...(
          openingBalanceVoucher
            ? [
                openingBalanceVoucher,
              ]
            : []
        ),

        ...converted
          .newVouchers,
      ].sort(
        (
          a,
          b
        ) =>
          new Date(
            a.date
          ).getTime() -
            new Date(
              b.date
            ).getTime() ||
          a.voucherNumber -
            b.voucherNumber
      );

    if (!(await commitVoucherState(replacementVouchers, converted.nextVoucherNumber))) {
      return { success: false, imported: 0, skipped: 0,
        errors: ["Importen kunde inte bekräftas av databasen. Sparningen är stoppad tills lagringsfelet är löst."] };
    }
    saveAccounts(contextAccounts);
    // Mark the import complete only after the posted vouchers were committed.
    if (companyId) {
      appStorage.setItem(
        "accountpro_sie_imported_" + companyId,
        "true"
      );
    }

    syncSieStateToDatabase(
      replacementVouchers,
      conversionAccounts
    );

    return {
      success:
        true,

      imported:
        replacementVouchers
          .length,

      skipped:
        converted
          .skippedDuplicates,

      errors: [],
    };
  };

  const exportSIE =
    (): string => {
      if (
        !activeCompany
      ) {
        return "";
      }

      return generateSIEFile(
        vouchers,
        accounts,
        {
          companyName:
            activeCompany
              .companyName,

          organizationNumber:
            activeCompany
              .organizationNumber,

          fiscalYearStart:
            activeCompany
              .fiscalYearStart,

          fiscalYearEnd:
            activeCompany
              .fiscalYearEnd,
        }
      );
    };

  return (
    <AccountingContext.Provider
      value={{
        accounts,

        vouchers,

        nextVoucherNumber,

        addAccount,

        removeAccount,

        createVoucher,

        updateVoucher,

        deleteVoucher,

        reverseVoucher,

        getVoucherById,

        getVoucherByNumber,

        getAccountStatement,

        getGeneralLedger,

        getIncomeStatement,

        getBalanceSheet,

        validateVoucher,

        importSIE,

        exportSIE,
      }}
    >
      {children}
    </AccountingContext.Provider>
  );
}

export function useAccounting() {
  const context =
    useContext(
      AccountingContext
    );

  if (
    context ===
    undefined
  ) {
    throw new Error(
      "useAccounting must be used within an AccountingProvider"
    );
  }

  return context;
}
