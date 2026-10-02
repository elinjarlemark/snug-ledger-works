import { appStorage } from "@/lib/appStorage";

import {
  useState,
  useRef,
  useEffect,
  useMemo,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  useAccounting,
  VoucherLine,
  Voucher,
} from "@/contexts/AccountingContext";

import { useAuth } from "@/contexts/AuthContext";
import { useBilling } from "@/contexts/BillingContext";
import { useAuditTrail } from "@/contexts/AuditTrailContext";
import { useReceipts } from "@/contexts/ReceiptsContext";
import { useFiscalLock } from "@/contexts/FiscalLockContext";
import { useVat } from "@/contexts/VatContext";
import { useVatPeriodLock } from "@/contexts/VatPeriodLockContext";

import {
  getActiveVatCodes,
  getVatCodeById,
} from "@/lib/vat/codes";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Checkbox } from "@/components/ui/checkbox";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  formatAmount,
  getBASAccountsForDate,
  getBASVersionLabel,
  hasBASYear,
} from "@/lib/bas-accounts";

import {
  getHistoricalAccountsEligibleForYear,
  loadHistoricalAccounts,
  HistoricalImportedAccount,
} from "@/lib/account-plan";

import {
  HistoricalAccountPickerDialog,
} from "@/components/accounting/HistoricalAccountPickerDialog";

import {
  formatMoneyInput,
  parseMoneyInput,
} from "@/lib/money";

import {
  Plus,
  Trash2,
  Check,
  AlertCircle,
  X,
  Upload,
  FileText,
  Image,
  ChevronDown,
  Lock,
  History,
} from "lucide-react";

import { toast } from "sonner";
import { cn } from "@/lib/utils";

const VOUCHER_CONFIRMATION_KEY =
  "accountpro_voucher_confirmation_enabled";

const INTERNAL_PARTY = "Intern bokslutspost";

function todayLocalIsoDate(): string {
  const today = new Date();
  const year = String(today.getFullYear());
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const actual = new Date(year, month - 1, day);
  return actual.getFullYear() === year &&
    actual.getMonth() + 1 === month && actual.getDate() === day;
}

function isVoucherConfirmationEnabled() {
  return (
    appStorage.getItem(
      VOUCHER_CONFIRMATION_KEY
    ) !==
    "false"
  );
}

function setVoucherConfirmationEnabled(
  enabled: boolean
) {
  appStorage.setItem(
    VOUCHER_CONFIRMATION_KEY,

    enabled
      ? "true"
      : "false"
  );
}

interface PendingAttachment {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
}

interface AmountInputs {
  debit: string;
  credit: string;
}

interface VoucherFormProps {
  onCancel:
    () => void;

  onSuccess:
    () => void;

  editVoucher?:
    Voucher;

  duplicateFrom?:
    Voucher;

  templateName?:
    string;

  onSaveDraft?: (
    draft:
      Omit<
        Voucher,
        | "id"
        | "companyId"
        | "voucherNumber"
        | "createdAt"
      >
  ) => void;
}

function buildAmountInputState(
  lines:
    VoucherLine[]
):
  Record<
    string,
    AmountInputs
  > {
  const result:
    Record<
      string,
      AmountInputs
    > = {};

  lines.forEach(
    (line) => {
      result[line.id] = {
        debit:
          formatMoneyInput(
            line.debit
          ),

        credit:
          formatMoneyInput(
            line.credit
          ),
      };
    }
  );

  return result;
}

export function VoucherForm({
  onCancel,
  onSuccess,
  editVoucher,
  duplicateFrom,
  templateName,
  onSaveDraft,
}: VoucherFormProps) {
  const sourceVoucher =
    editVoucher ||
    duplicateFrom;

  const {
    nextVoucherNumber,
    createVoucher,
    validateVoucher,
  } = useAccounting();

  const {
    activeCompany,
  } = useAuth();

  const { customers } = useBilling();

  const {
    addEntry,
  } = useAuditTrail();

  const {
    addReceipt,
  } = useReceipts();

  const {
    isDateInLockedYear,
  } = useFiscalLock();

  const {
    vatCodes,
  } = useVat();

  const {
    isDateInLockedPeriod,
  } =
    useVatPeriodLock();

  const activeVatCodes =
    getActiveVatCodes(
      vatCodes
    );

  const fileInputRef =
    useRef<
      HTMLInputElement
    >(null);

  const debitInputRefs =
    useRef<
      Map<
        string,
        HTMLInputElement
      >
    >(
      new Map()
    );

  const creditInputRefs =
    useRef<
      Map<
        string,
        HTMLInputElement
      >
    >(
      new Map()
    );

  const accountButtonRefs =
    useRef<
      Map<
        string,
        HTMLButtonElement
      >
    >(
      new Map()
    );

  const initialLines =
    sourceVoucher
      ?.lines
      .map(
        (line) => ({
          ...line,

          id:
            crypto.randomUUID(),
        })
      ) || [
      {
        id:
          crypto.randomUUID(),

        accountNumber:
          "",

        accountName:
          "",

        debit:
          0,

        credit:
          0,
      },

      {
        id:
          crypto.randomUUID(),

        accountNumber:
          "",

        accountName:
          "",

        debit:
          0,

        credit:
          0,
      },
    ];

  const [
    date,
    setDate,
  ] =
    useState(
      sourceVoucher?.reversesVoucherId && sourceVoucher.status !== "DRAFT"
        ? todayLocalIsoDate()
        : sourceVoucher?.date || ""
    );

  const [
    description,
    setDescription,
  ] = useState(sourceVoucher?.description || "");
  const [party, setParty] = useState(sourceVoucher?.party || "");
  const [partyId, setPartyId] = useState(sourceVoucher?.partyId || "");
  const [internalEntry, setInternalEntry] = useState(
    sourceVoucher?.party === INTERNAL_PARTY
  );
  const [documentDate, setDocumentDate] = useState(
    sourceVoucher?.status === "DRAFT"
      ? sourceVoucher.documentDate || todayLocalIsoDate()
      : todayLocalIsoDate()
  );

  const [
    lines,
    setLines,
  ] =
    useState<
      VoucherLine[]
    >(
      initialLines
    );

  const [
    amountInputs,
    setAmountInputs,
  ] =
    useState<
      Record<
        string,
        AmountInputs
      >
    >(
      () =>
        buildAmountInputState(
          initialLines
        )
    );

  const [
    pendingAttachments,
    setPendingAttachments,
  ] =
    useState<PendingAttachment[]>(
      sourceVoucher?.status === "DRAFT" && sourceVoucher.attachments
        ? sourceVoucher.attachments.map((attachment) => ({ ...attachment }))
        : []
    );

  const [
    openComboboxes,
    setOpenComboboxes,
  ] =
    useState<
      Record<
        string,
        boolean
      >
    >({});

  const [
    pendingFocusLineId,
    setPendingFocusLineId,
  ] =
    useState<
      string |
      null
    >(null);

  const [
    historicalPickerLineId,
    setHistoricalPickerLineId,
  ] =
    useState<
      string |
      null
    >(null);

  const [
    showConfirmation,
    setShowConfirmation,
  ] =
    useState(
      false
    );

  const [
    confirmationEnabled,
    setConfirmationEnabled,
  ] =
    useState(
      isVoucherConfirmationEnabled
    );

  const voucherYear =
    date
      ? Number(
          date.slice(
            0,
            4
          )
        )
      : Number.NaN;

  const historicalAccounts =
    useMemo(
      () => {
        if (
          !activeCompany
            ?.id
        ) {
          return [];
        }

        return loadHistoricalAccounts(
          activeCompany.id
        );
      },
      [
        activeCompany?.id,
      ]
    );

  const eligibleHistoricalAccounts =
    useMemo(
      () => {
        if (
          !Number.isFinite(
            voucherYear
          )
        ) {
          return [];
        }

        return getHistoricalAccountsEligibleForYear(
          historicalAccounts,
          voucherYear
        );
      },
      [
        historicalAccounts,
        voucherYear,
      ]
    );

  const [
    dateAccounts,
    setDateAccounts,
  ] =
    useState(
      getBASAccountsForDate(
        sourceVoucher?.date ||
          "",
        "K2"
      )
    );

  useEffect(
    () => {
      const yearAccounts =
        getBASAccountsForDate(
          date,
          "K2"
        );

      setDateAccounts(
        yearAccounts
      );
    },
    [
      date,
    ]
  );

  useEffect(
    () => {
      const validAccountNumbers =
        new Set<string>();

      dateAccounts.forEach(
        (account) => {
          validAccountNumbers.add(
            account.number
          );
        }
      );

      eligibleHistoricalAccounts.forEach(
        (account) => {
          validAccountNumbers.add(
            account.number
          );
        }
      );

      setLines(
        (
          previousLines
        ) =>
          previousLines.map(
            (line) => {
              if (
                !line.accountNumber
              ) {
                return line;
              }

              if (
                validAccountNumbers.has(
                  line.accountNumber
                )
              ) {
                return line;
              }

              return {
                ...line,

                accountNumber:
                  "",

                accountName:
                  "",
              };
            }
          )
      );
    },
    [
      dateAccounts,
      eligibleHistoricalAccounts,
    ]
  );

  useEffect(
    () => {
      if (
        !pendingFocusLineId
      ) {
        return;
      }

      const debitInput =
        debitInputRefs
          .current
          .get(
            pendingFocusLineId
          );

      if (
        debitInput
      ) {
        setTimeout(
          () => {
            debitInput.focus();
            debitInput.select();
          },
          50
        );
      }

      setPendingFocusLineId(
        null
      );
    },
    [
      pendingFocusLineId,
    ]
  );

  const validation =
    validateVoucher(
      lines
    );

  const addLine =
    () => {
      const id =
        crypto.randomUUID();

      setLines(
        [
          ...lines,

          {
            id,

            accountNumber:
              "",

            accountName:
              "",

            debit:
              0,

            credit:
              0,
          },
        ]
      );

      setAmountInputs(
        (
          previous
        ) => ({
          ...previous,

          [id]: {
            debit:
              "",

            credit:
              "",
          },
        })
      );
    };

  const removeLine = (
    id: string
  ) => {
    if (
      lines.length <=
      2
    ) {
      return;
    }

    setLines(
      lines.filter(
        (line) =>
          line.id !==
          id
      )
    );

    setAmountInputs(
      (
        previous
      ) => {
        const {
          [id]:
            _removed,
          ...rest
        } = previous;

        return rest;
      }
    );
  };

  const updateLineAccount = (
    id: string,
    accountNumber:
      string
  ) => {
    setLines(
      (
        previousLines
      ) =>
        previousLines.map(
          (line) => {
            if (
              line.id !==
              id
            ) {
              return line;
            }

            const account =
              dateAccounts.find(
                (entry) =>
                  entry.number ===
                  accountNumber
              ) ??
              eligibleHistoricalAccounts.find(
                (entry) =>
                  entry.number ===
                  accountNumber
              );

            return {
              ...line,

              accountNumber,

              accountName:
                account?.name ||
                "",
            };
          }
        )
    );
  };

  const updateVatCode = (
    id: string,
    vatCodeId:
      string
  ) => {
    setLines(
      (
        previousLines
      ) =>
        previousLines.map(
          (line) =>
            line.id ===
            id
              ? {
                  ...line,

                  vatCodeId:
                    vatCodeId ||
                    undefined,
                }
              : line
        )
    );
  };

  const updateAmountInput = (
    id: string,

    field:
      "debit" |
      "credit",

    rawValue:
      string
  ) => {
    const compactValue =
      rawValue.replace(
        /\s/g,
        ""
      );

    if (
      compactValue &&
      !/^\d*(?:[,.]\d*)?$/.test(
        compactValue
      )
    ) {
      return;
    }

    setAmountInputs(
      (
        previous
      ) => ({
        ...previous,

        [id]: {
          ...(
            previous[id] ||
            {
              debit:
                "",

              credit:
                "",
            }
          ),

          [field]:
            compactValue,
        },
      })
    );

    const parsed =
      parseMoneyInput(
        compactValue
      );

    if (
      !parsed.valid
    ) {
      return;
    }

    setLines(
      (
        previousLines
      ) =>
        previousLines.map(
          (line) => {
            if (
              line.id !==
              id
            ) {
              return line;
            }

            if (
              field ===
              "debit"
            ) {
              return {
                ...line,

                debit:
                  parsed.amount,

                credit:
                  parsed.amount >
                  0
                    ? 0
                    : line.credit,
              };
            }

            return {
              ...line,

              credit:
                parsed.amount,

              debit:
                parsed.amount >
                0
                  ? 0
                  : line.debit,
            };
          }
        )
    );

    if (
      parsed.amount >
      0
    ) {
      const oppositeField =
        field ===
        "debit"
          ? "credit"
          : "debit";

      setAmountInputs(
        (
          previous
        ) => ({
          ...previous,

          [id]: {
            ...(
              previous[id] ||
              {
                debit:
                  "",

                credit:
                  "",
              }
            ),

            [field]:
              compactValue,

            [oppositeField]:
              "",
          },
        })
      );
    }
  };

  const normalizeAmountInput = (
    id: string,

    field:
      "debit" |
      "credit"
  ) => {
    const currentInput =
      amountInputs[id]
        ?.[field] ||
      "";

    const parsed =
      parseMoneyInput(
        currentInput
      );

    const currentLine =
      lines.find(
        (line) =>
          line.id ===
          id
      );

    const fallbackValue =
      currentLine
        ? currentLine[
            field
          ]
        : 0;

    setAmountInputs(
      (
        previous
      ) => ({
        ...previous,

        [id]: {
          ...(
            previous[id] ||
            {
              debit:
                "",

              credit:
                "",
            }
          ),

          [field]:
            parsed.valid
              ? formatMoneyInput(
                  parsed.amount
                )
              : formatMoneyInput(
                  fallbackValue
                ),
        },
      })
    );
  };

  const selectHistoricalAccount = (
    account:
      HistoricalImportedAccount
  ) => {
    if (
      !historicalPickerLineId
    ) {
      return;
    }

    const lineId =
      historicalPickerLineId;

    setLines(
      (
        currentLines
      ) =>
        currentLines.map(
          (line) =>
            line.id ===
            lineId
              ? {
                  ...line,

                  accountNumber:
                    account.number,

                  accountName:
                    account.name,
                }
              : line
        )
    );

    setHistoricalPickerLineId(
      null
    );

    setPendingFocusLineId(
      lineId
    );
  };

  const handleFileChange = (
    event:
      React.ChangeEvent<
        HTMLInputElement
      >
  ) => {
    const files =
      event.target.files;

    if (!files) {
      return;
    }

    Array.from(
      files
    ).forEach(
      (file) => {
        const isValid =
          file.type.startsWith(
            "image/"
          ) ||
          file.type ===
            "application/pdf";

        if (
          !isValid
        ) {
          toast.error(
            "Invalid file type: " +
            file.name +
            ". Only images and PDFs are allowed."
          );

          return;
        }

        const reader =
          new FileReader();

        reader.onload =
          () => {
            const newAttachment:
              PendingAttachment = {
              id:
                crypto.randomUUID(),

              name:
                file.name,

              type:
                file.type,

              dataUrl:
                reader.result as string,
            };

            setPendingAttachments(
              (
                previous
              ) => [
                ...previous,
                newAttachment,
              ]
            );
          };

        reader.readAsDataURL(
          file
        );
      }
    );

    if (
      fileInputRef.current
    ) {
      fileInputRef.current.value =
        "";
    }
  };

  const removeAttachment = (
    id: string
  ) => {
    setPendingAttachments(
      (
        previous
      ) =>
        previous.filter(
          (attachment) =>
            attachment.id !==
            id
        )
    );
  };

  const getValidLines =
    () =>
      lines.filter(
        (line) =>
          line.accountNumber &&
          (
            line.debit >
              0 ||
            line.credit >
              0
          )
      );

  const validateBeforePosting =
    () => {
      if (!date || !documentDate || !description.trim()) {
        toast.error("Ange affärsdatum, verifikationsdatum och beskrivning.");

        return false;
      }

      if (!internalEntry && !party.trim()) {
        toast.error("Ange motpart eller markera intern bokslutspost.");
        return false;
      }

      if (!isValidIsoDate(date) || !isValidIsoDate(documentDate)) {
        toast.error("Ange giltiga datum.");
        return false;
      }

      const today = todayLocalIsoDate();

      if (documentDate > today) {
        toast.error("Verifikationsdatumet kan inte ligga i framtiden.");
        return false;
      }

      if (
        date > today
      ) {
        toast.error(
          "Datumet kan inte ligga i framtiden."
        );

        return false;
      }

      if (
        isDateInLockedYear(
          date
        )
      ) {
        toast.error(
          "Det går inte att bokföra i ett stängt räkenskapsår."
        );

        return false;
      }

      if (
        isDateInLockedPeriod(
          date
        )
      ) {
        toast.error(
          "Momsperioden är låst. Skapa en rättelseverifikation istället."
        );

        return false;
      }

      if (
        !validation.isValid
      ) {
        toast.error(
          validation
            .errors[0]
            ?.message ||
          "Verifikationen är inte giltig."
        );

        return false;
      }

      if (!hasBASYear(voucherYear)) {
        toast.error("Det finns ingen BAS-kontoplan installerad för verifikationens år.");
        return false;
      }

      const availableAccounts = new Set([
        ...dateAccounts.map((account) => account.number),
        ...eligibleHistoricalAccounts.map((account) => account.number),
      ]);
      if (getValidLines().some((line) => !availableAccounts.has(line.accountNumber))) {
        toast.error("Ett valt konto saknas i årets BAS och är inte ett tillåtet historiskt konto.");
        return false;
      }

      return true;
    };

  const buildDraftPayload =
    () => ({
      date,

      description: description.trim(),
      party: internalEntry ? INTERNAL_PARTY : party.trim(),
      partyId: internalEntry ? undefined : partyId || undefined,
      documentDate,
      status: "DRAFT" as const,
      lines,
      attachments: pendingAttachments,

      reversesVoucherId:
        duplicateFrom
          ?.reversesVoucherId,

      reversesVoucherNumber:
        duplicateFrom
          ?.reversesVoucherNumber,
    });

  const handleSaveDraft =
    () => {
      if (
        !date &&
        !description.trim() &&
        lines.every(
          (line) =>
            !line.accountNumber &&
            !line.debit &&
            !line.credit
        )
      ) {
        toast.error(
          "Fyll i något innan du sparar ett utkast"
        );

        return;
      }

      onSaveDraft?.(
        buildDraftPayload()
      );
    };

  const postVoucher =
    () => {
      if (!validateBeforePosting()) return;
      const validLines = getValidLines();

      if (editVoucher && editVoucher.status !== "DRAFT") {
        toast.error("Bokförda verifikationer kan inte ändras. Skapa en rättelse.");
        return;
      }
      const voucher = createVoucher({
        date,
        documentDate,
        party: internalEntry ? INTERNAL_PARTY : party.trim(),
        partyId: internalEntry ? undefined : partyId || undefined,
        description: description.trim(),
        lines: validLines,
        attachments: pendingAttachments,
        reversesVoucherId: duplicateFrom?.reversesVoucherId,
        reversesVoucherNumber: duplicateFrom?.reversesVoucherNumber,
      });

        if (voucher) {
          pendingAttachments.forEach(
            (
              attachment
            ) => {
              const extension =
                attachment.name
                  .split(".")
                  .pop() ||
                "jpg";

              addReceipt({
                name:
                  "voucher_" +
                  voucher
                    .voucherNumber +
                  "." +
                  extension,

                type:
                  attachment.type,

                dataUrl:
                  attachment.dataUrl,

                voucherId:
                  voucher.id,

                voucherNumber:
                  voucher
                    .voucherNumber,
              });
            }
          );

          addEntry(
            "Created voucher #" +
            voucher
              .voucherNumber
          );

          toast.success(
            "Verifikation #" +
            voucher.voucherNumber +
            " bokförd"
          );

          onSuccess();
        } else {
          toast.error(
            "Failed to create voucher"
          );
        }
    };

  const handleSubmit =
    () => {
      if (
        !validateBeforePosting()
      ) {
        return;
      }

      if (confirmationEnabled) {
        setShowConfirmation(
          true
        );

        return;
      }

      postVoucher();
    };

  // A posted voucher must never be opened as an editable form.
  if (editVoucher && editVoucher.status !== "DRAFT") {
    return (
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <p className="font-semibold">Bokförda verifikationer är låsta.</p>
        <p className="text-sm text-muted-foreground">
          Skapa en rättelse eller vändningsverifikation för att korrigera bokföringen.
        </p>
        <Button variant="outline" onClick={onCancel}>Gå tillbaka</Button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-6">
      <HistoricalAccountPickerDialog
        open={
          historicalPickerLineId !==
          null
        }

        onOpenChange={(
          open
        ) => {
          if (!open) {
            setHistoricalPickerLineId(
              null
            );
          }
        }}

        companyId={
          activeCompany?.id ||
          ""
        }

        fiscalYear={
          Number.isFinite(
            voucherYear
          )
            ? voucherYear
            : new Date()
                .getFullYear()
        }

        onSelect={
          selectHistoricalAccount
        }
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {editVoucher
              ? "Redigera utkast"
              : duplicateFrom
                ? "Duplicate Voucher #" +
                  duplicateFrom
                    .voucherNumber
                : "Create Voucher"}
          </h2>

          {!editVoucher && (
            <p className="text-sm text-muted-foreground">
              Verifikation #
              {nextVoucherNumber}
            </p>
          )}

          {!editVoucher &&
            templateName && (
              <p className="mt-1 text-sm font-medium text-primary">
                Mall:{" "}
                {templateName}
              </p>
            )}
        </div>

        <div className="flex items-center gap-2">
          {!editVoucher && (
            <Button
              variant="outline"
              size="sm"
              onClick={
                onCancel
              }
            >
              Gå tillbaka
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={
              onCancel
            }
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Affärsdatum</Label>

          <Input
            id="date"
            type="date"

            value={
              date
            }

            max={todayLocalIsoDate()}

            onChange={(
              event
            ) =>
              setDate(
                event.target.value
              )
            }

            className={
              isDateInLockedYear(
                date
              )
                ? "border-destructive"
                : ""
            }
          />

          {isDateInLockedYear(
            date
          ) && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              This date falls
              in a locked fiscal
              year. You cannot
              create vouchers
              for locked years.
            </p>
          )}

          {!isDateInLockedYear(
            date
          ) &&
            date &&
            isDateInLockedPeriod(
              date
            ) && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Momsperioden är
                låst. Använd en
                rättelseverifikation
                istället.
              </p>
            )}

          {date &&
            Number.isFinite(
              voucherYear
            ) &&
            hasBASYear(
              voucherYear
            ) && (
              <p className="text-xs text-muted-foreground">
                {getBASVersionLabel(
                  voucherYear
                )}{" "}
                används för denna
                verifikation.
              </p>
            )}

          {date &&
            Number.isFinite(
              voucherYear
            ) &&
            !hasBASYear(
              voucherYear
            ) && (
              <p className="text-xs text-destructive">
                AccountPro har
                ingen BAS-kontoplan
                installerad för{" "}
                {voucherYear}.
                Endast verifierade
                historiska konton
                från tidigare
                importerad bokföring
                kan visas.
              </p>
            )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Beskrivning</Label>

          <Input
            id="description"

            value={
              description
            }

            onChange={(
              event
            ) =>
              setDescription(
                event.target.value
              )
            }

            placeholder="Transaction description"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="voucher-document-date">Verifikationsdatum (sammanställd)</Label>
          <Input id="voucher-document-date" type="date" value={documentDate}
            max={todayLocalIsoDate()}
            onChange={(event) => setDocumentDate(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="voucher-party">Motpart</Label>
          <Input
            id="voucher-party"
            list="voucher-existing-customers"
            value={internalEntry ? INTERNAL_PARTY : party}
            disabled={internalEntry}
            onChange={(event) => {
              const name = event.target.value;
              setParty(name);
              const customer = customers.find((entry) => entry.name === name);
              setPartyId(customer?.id || "");
            }}
            placeholder="Välj kund eller skriv namn på leverantör/person"
          />
          <datalist id="voucher-existing-customers">
            {customers.map((customer) => (
              <option key={customer.id} value={customer.name} />
            ))}
          </datalist>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={internalEntry} onCheckedChange={(checked) => {
              setInternalEntry(checked === true);
              setPartyId("");
            }} />
            Intern bokslutspost (ingen extern motpart)
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <Label>
          Voucher Lines
        </Label>

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full table-fixed">
            <thead>
              <tr className="bg-muted/50 text-sm">
                <th className="text-left p-3 font-medium">
                  Account
                </th>

                <th className="text-right p-3 font-medium w-28">
                  Debit
                </th>

                <th className="text-right p-3 font-medium w-28">
                  Credit
                </th>

                <th className="text-left p-3 font-medium w-36">
                  Momskod
                </th>

                <th className="p-3 w-12"></th>
              </tr>
            </thead>

            <tbody>
              {lines.map(
                (
                  line,
                  lineIndex
                ) => (
                  <tr
                    key={
                      line.id
                    }

                    className="border-t border-border"
                  >
                    <td className="p-2">
                      <Popover
                        open={
                          openComboboxes[
                            line.id
                          ] ||
                          false
                        }

                        onOpenChange={(
                          open
                        ) =>
                          setOpenComboboxes(
                            (
                              previous
                            ) => ({
                              ...previous,

                              [line.id]:
                                open,
                            })
                          )
                        }
                      >
                        <PopoverTrigger
                          asChild
                        >
                          <Button
                            ref={(
                              element
                            ) => {
                              if (
                                element
                              ) {
                                accountButtonRefs
                                  .current
                                  .set(
                                    line.id,
                                    element
                                  );
                              }
                            }}

                            variant="outline"

                            role="combobox"

                            aria-expanded={
                              openComboboxes[
                                line.id
                              ] ||
                              false
                            }

                            className="w-full justify-between font-normal overflow-hidden"
                          >
                            {line.accountNumber ? (
                              <span className="truncate">
                                <span className="font-mono">
                                  {
                                    line.accountNumber
                                  }
                                </span>

                                <span className="ml-2 text-muted-foreground">
                                  {
                                    line.accountName
                                  }
                                </span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                Select
                                account...
                              </span>
                            )}

                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>

                        <PopoverContent
                          className="w-[400px] p-0"
                          align="start"
                        >
                          <Command>
                            <CommandInput placeholder="Search by number or name..." />

                            <CommandList>
                              <CommandEmpty>
                                No account
                                found.
                              </CommandEmpty>

                              <CommandGroup className="max-h-64 overflow-auto">
                                {dateAccounts.map(
                                  (
                                    account
                                  ) => (
                                    <CommandItem
                                      key={
                                        account.number
                                      }

                                      value={
                                        account.number +
                                        " " +
                                        account.name
                                      }

                                      onSelect={() => {
                                        updateLineAccount(
                                          line.id,
                                          account.number
                                        );

                                        setOpenComboboxes(
                                          (
                                            previous
                                          ) => ({
                                            ...previous,

                                            [line.id]:
                                              false,
                                          })
                                        );

                                        setPendingFocusLineId(
                                          line.id
                                        );
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",

                                          line.accountNumber ===
                                            account.number
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />

                                      <span className="font-mono">
                                        {
                                          account.number
                                        }
                                      </span>

                                      <span className="ml-2 text-muted-foreground">
                                        {
                                          account.name
                                        }
                                      </span>
                                    </CommandItem>
                                  )
                                )}
                              </CommandGroup>
                            </CommandList>
                          </Command>

                          <div className="border-t p-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"

                              className="w-full justify-start"

                              disabled={
                                !date ||
                                !Number.isFinite(
                                  voucherYear
                                ) ||
                                eligibleHistoricalAccounts.length ===
                                  0
                              }

                              onClick={() => {
                                setOpenComboboxes(
                                  (
                                    previous
                                  ) => ({
                                    ...previous,

                                    [line.id]:
                                      false,
                                  })
                                );

                                setHistoricalPickerLineId(
                                  line.id
                                );
                              }}
                            >
                              <History className="mr-2 h-4 w-4" />

                              <span className="text-left">
                                Använd
                                konto från
                                tidigare
                                år som inte
                                finns i
                                årets
                                BAS-kontoplan
                              </span>

                              {eligibleHistoricalAccounts.length >
                                0 && (
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {
                                    eligibleHistoricalAccounts.length
                                  }
                                </span>
                              )}
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </td>

                    <td className="p-2">
                      <Input
                        ref={(
                          element
                        ) => {
                          if (
                            element
                          ) {
                            debitInputRefs
                              .current
                              .set(
                                line.id,
                                element
                              );
                          }
                        }}

                        type="text"

                        inputMode="decimal"

                        className="text-right"

                        value={
                          amountInputs[
                            line.id
                          ]?.debit ||
                          ""
                        }

                        onChange={(
                          event
                        ) =>
                          updateAmountInput(
                            line.id,
                            "debit",
                            event
                              .target
                              .value
                          )
                        }

                        onBlur={() =>
                          normalizeAmountInput(
                            line.id,
                            "debit"
                          )
                        }

                        onKeyDown={(
                          event
                        ) => {
                          if (
                            event.key ===
                              "Tab" &&
                            !event.shiftKey
                          ) {
                            event.preventDefault();

                            const creditInput =
                              creditInputRefs
                                .current
                                .get(
                                  line.id
                                );

                            if (
                              creditInput
                            ) {
                              creditInput.focus();
                              creditInput.select();
                            }
                          }
                        }}

                        placeholder="0,00"
                      />
                    </td>

                    <td className="p-2">
                      <Input
                        ref={(
                          element
                        ) => {
                          if (
                            element
                          ) {
                            creditInputRefs
                              .current
                              .set(
                                line.id,
                                element
                              );
                          }
                        }}

                        type="text"

                        inputMode="decimal"

                        className="text-right"

                        value={
                          amountInputs[
                            line.id
                          ]?.credit ||
                          ""
                        }

                        onChange={(
                          event
                        ) =>
                          updateAmountInput(
                            line.id,
                            "credit",
                            event
                              .target
                              .value
                          )
                        }

                        onBlur={() =>
                          normalizeAmountInput(
                            line.id,
                            "credit"
                          )
                        }

                        onKeyDown={(
                          event
                        ) => {
                          if (
                            event.key ===
                              "Tab" &&
                            !event.shiftKey
                          ) {
                            const nextLineIndex =
                              lineIndex +
                              1;

                            if (
                              nextLineIndex <
                              lines.length
                            ) {
                              event.preventDefault();

                              const nextLine =
                                lines[
                                  nextLineIndex
                                ];

                              const nextAccountButton =
                                accountButtonRefs
                                  .current
                                  .get(
                                    nextLine.id
                                  );

                              if (
                                nextAccountButton
                              ) {
                                nextAccountButton.focus();
                              }
                            }
                          }
                        }}

                        placeholder="0,00"
                      />
                    </td>

                    <td className="p-2">
                      <Select
                        value={
                          line.vatCodeId ||
                          "__none__"
                        }

                        onValueChange={(
                          value
                        ) =>
                          updateVatCode(
                            line.id,

                            value ===
                              "__none__"
                              ? ""
                              : value
                          )
                        }
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="__none__">
                            Ingen
                          </SelectItem>

                          {activeVatCodes.map(
                            (
                              code
                            ) => (
                              <SelectItem
                                key={
                                  code.id
                                }

                                value={
                                  code.id
                                }
                              >
                                <span className="font-mono mr-1">
                                  {
                                    code.code
                                  }
                                </span>

                                <span className="text-muted-foreground">
                                  (
                                  {
                                    code.sats
                                  }
                                  %)
                                </span>
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </td>

                    <td className="p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"

                        onClick={() =>
                          removeLine(
                            line.id
                          )
                        }

                        disabled={
                          lines.length <=
                          2
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                )
              )}
            </tbody>

            <tfoot>
              <tr className="border-t border-border bg-muted/30">
                <td className="p-3 font-semibold">
                  Balance
                </td>

                <td className="p-3 text-right font-mono font-semibold">
                  {formatAmount(
                    validation
                      .totalDebit
                  )}
                </td>

                <td className="p-3 text-right font-mono font-semibold">
                  {formatAmount(
                    validation
                      .totalCredit
                  )}
                </td>

                <td className="p-3"></td>

                <td className="p-3">
                  {validation.isValid ? (
                    <Check className="h-5 w-5 text-success mx-auto" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-destructive mx-auto" />
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"

          onClick={
            addLine
          }
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Line
        </Button>
      </div>

      {!validation.isValid &&
        validation.errors.length >
          0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />

              <div>
                <p className="text-sm font-medium text-destructive">
                  Verifikationen
                  kan inte
                  bokföras ännu
                </p>

                <ul className="mt-1 space-y-1 text-xs text-destructive">
                  {Array.from(
                    new Set(
                      validation
                        .errors
                        .map(
                          (
                            error
                          ) =>
                            error.message
                        )
                    )
                  ).map(
                    (
                      message
                    ) => (
                      <li
                        key={
                          message
                        }
                      >
                        {message}
                      </li>
                    )
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>
            Receipts /
            Attachments
          </Label>

          <Button
            type="button"
            variant="outline"
            size="sm"

            onClick={() =>
              fileInputRef
                .current
                ?.click()
            }
          >
            <Upload className="h-4 w-4 mr-1" />
            Add Receipt
          </Button>

          <input
            ref={
              fileInputRef
            }

            type="file"

            accept="image/*,.pdf"

            multiple

            className="hidden"

            onChange={
              handleFileChange
            }
          />
        </div>

        {pendingAttachments.length >
          0 && (
          <div className="flex flex-wrap gap-2">
            {pendingAttachments.map(
              (
                attachment
              ) => (
                <div
                  key={
                    attachment.id
                  }

                  className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-sm"
                >
                  {attachment.type.startsWith(
                    "image/"
                  ) ? (
                    <Image className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}

                  <span className="max-w-32 truncate">
                    {
                      attachment.name
                    }
                  </span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"

                    className="h-5 w-5"

                    onClick={() =>
                      removeAttachment(
                        attachment.id
                      )
                    }
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {lines.some(
        (line) =>
          line.vatCodeId
      ) && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="h-4 w-4 text-primary" />
            Momspåverkan
          </div>

          <ul className="text-xs space-y-1">
            {lines
              .filter(
                (line) =>
                  line.vatCodeId
              )
              .map(
                (line) => {
                  const code =
                    getVatCodeById(
                      vatCodes,
                      line.vatCodeId
                    );

                  if (
                    !code
                  ) {
                    return null;
                  }

                  const amount =
                    (
                      line.debit ||
                      0
                    ) +
                    (
                      line.credit ||
                      0
                    );

                  return (
                    <li
                      key={
                        line.id
                      }

                      className="flex justify-between"
                    >
                      <span>
                        <span className="font-mono">
                          {line.accountNumber ||
                            "—"}
                        </span>{" "}

                        <span className="text-muted-foreground">
                          {
                            code.code
                          }{" "}
                          (
                          {
                            code.sats
                          }
                          %)
                        </span>

                        <span className="text-muted-foreground">
                          {" "}
                          → ruta{" "}
                          {
                            code
                              .rapportRutor
                              .join(
                                ", "
                              )
                          }
                        </span>
                      </span>

                      <span className="font-mono">
                        {formatAmount(
                          amount
                        )}
                      </span>
                    </li>
                  );
                }
              )}
          </ul>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
        {!editVoucher &&
          onSaveDraft && (
            <Button
              variant="secondary"

              onClick={
                handleSaveDraft
              }
            >
              Spara som utkast
            </Button>
          )}

        <Button
          variant="outline"

          onClick={
            onCancel
          }
        >
          Gå tillbaka
        </Button>

        <Button
          onClick={
            handleSubmit
          }

          disabled={
            !validation.isValid
          }
        >
          {confirmationEnabled ? "Granska och bokför" : "Bokför"}
        </Button>
      </div>

      <AlertDialog
        open={
          showConfirmation
        }

        onOpenChange={
          setShowConfirmation
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Kontrollera
              verifikationen
            </AlertDialogTitle>

            <AlertDialogDescription>
              Kontrollera datum,
              namn, konton och
              summor innan
              verifikationen
              bokförs.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-3">
              <div>
                <p className="text-muted-foreground">
                  Datum
                </p>

                <p className="font-medium">
                  {date}
                </p>
              </div>

              <div>
                <p className="text-muted-foreground">
                  Namn
                </p>

                <p className="font-medium">
                  {description.trim()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Verifikationsdatum: </span>{documentDate}</div>
              <div><span className="text-muted-foreground">Motpart: </span>{internalEntry ? INTERNAL_PARTY : party}</div>
            </div>

            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="p-2 text-left">
                      Konto
                    </th>

                    <th className="p-2 text-left">
                      Namn
                    </th>

                    <th className="p-2 text-right">
                      Debet
                    </th>

                    <th className="p-2 text-right">
                      Kredit
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {getValidLines().map(
                    (
                      line
                    ) => (
                      <tr
                        key={
                          line.id
                        }

                        className="border-t"
                      >
                        <td className="p-2 font-mono">
                          {
                            line.accountNumber
                          }
                        </td>

                        <td className="p-2">
                          {
                            line.accountName
                          }
                        </td>

                        <td className="p-2 text-right font-mono">
                          {line.debit >
                          0
                            ? formatAmount(
                                line.debit
                              )
                            : ""}
                        </td>

                        <td className="p-2 text-right font-mono">
                          {line.credit >
                          0
                            ? formatAmount(
                                line.credit
                              )
                            : ""}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>

                <tfoot className="bg-muted/30 border-t">
                  <tr>
                    <td
                      className="p-2 font-semibold"

                      colSpan={
                        2
                      }
                    >
                      Summa
                    </td>

                    <td className="p-2 text-right font-mono font-semibold">
                      {formatAmount(
                        validation
                          .totalDebit
                      )}
                    </td>

                    <td className="p-2 text-right font-mono font-semibold">
                      {formatAmount(
                        validation
                          .totalCredit
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                onCheckedChange={(
                  checked
                ) => {
                  if (
                    checked
                  ) {
                    setVoucherConfirmationEnabled(
                      false
                    );

                    setConfirmationEnabled(
                      false
                    );

                    toast.info(
                      "Du kan ändra tillbaka till extra check i inställningarna"
                    );
                  }
                }}
              />

              <span>
                Ta bort check av
                verification
              </span>
            </label>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>
              Ändra
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={
                postVoucher
              }
            >
              Bokför
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
