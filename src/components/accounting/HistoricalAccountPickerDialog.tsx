import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  History,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import {
  HistoricalImportedAccount,
  confirmHistoricalAccountMapping,
  getHistoricalAccountsEligibleForYear,
  getHistoricalAccountYearsLabel,
  getHistoricalAutoMapping,
  loadHistoricalAccounts,
} from "@/lib/account-plan";

interface HistoricalAccountPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  fiscalYear: number;
  onSelect: (
    account: HistoricalImportedAccount
  ) => void;
}

export function HistoricalAccountPickerDialog({
  open,
  onOpenChange,
  companyId,
  fiscalYear,
  onSelect,
}: HistoricalAccountPickerDialogProps) {
  const [search, setSearch] =
    useState("");

  const [selectedAccount, setSelectedAccount] =
    useState<HistoricalImportedAccount | null>(
      null
    );

  const historicalAccounts =
    useMemo(() => {
      if (!companyId || !open) return [];

      return getHistoricalAccountsEligibleForYear(
        loadHistoricalAccounts(companyId),
        fiscalYear
      );
    }, [companyId, fiscalYear, open]);

  const filteredAccounts =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return historicalAccounts;
      }

      return historicalAccounts.filter(
        (account) =>
          account.number
            .toLowerCase()
            .includes(query) ||
          account.name
            .toLowerCase()
            .includes(query)
      );
    }, [
      historicalAccounts,
      search,
    ]);

  const mapping =
    selectedAccount
      ? selectedAccount.reportMappings[
          String(fiscalYear)
        ] ??
        getHistoricalAutoMapping(
          fiscalYear,
          selectedAccount
        )
      : null;

  const closeDialog = () => {
    setSelectedAccount(null);
    setSearch("");
    onOpenChange(false);
  };

  const useSelectedAccount = () => {
    if (!selectedAccount) return;

    const confirmed =
      confirmHistoricalAccountMapping(
        companyId,
        selectedAccount.number,
        fiscalYear
      );

    onSelect(
      confirmed ?? selectedAccount
    );

    closeDialog();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSelectedAccount(null);
          setSearch("");
        }

        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Konto från tidigare bokföring
          </DialogTitle>

          <DialogDescription>
            Här visas endast konton som har
            verifierats genom företagets
            importerade SIE-bokföring och som
            inte finns i BAS {fiscalYear}.
          </DialogDescription>
        </DialogHeader>

        {!selectedAccount && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="font-medium">
                AccountPro använder endast
                BAS-kontoplanen.
              </div>

              <div className="mt-1 text-muted-foreground">
                Historiska konton kan användas
                vid exempelvis återföring eller
                rättelse när kontot förekommer i
                tidigare importerad bokföring.
                Det går inte att skapa ett nytt
                konto här.
              </div>
            </div>

            <Input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Sök kontonummer eller namn"
            />

            {filteredAccounts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <History className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />

                <p className="font-medium">
                  Inga historiska konton finns
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Endast konton som tidigare
                  verifierats genom en SIE-import
                  kan visas här.
                </p>
              </div>
            ) : (
              <div className="max-h-[420px] space-y-2 overflow-auto">
                {filteredAccounts.map(
                  (account) => (
                    <button
                      type="button"
                      key={account.number}
                      onClick={() =>
                        setSelectedAccount(
                          account
                        )
                      }
                      className="flex w-full items-start justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">
                            {account.number}
                          </span>

                          <span className="font-medium">
                            {account.name}
                          </span>
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground">
                          Förekommer i importerad
                          bokföring:
                          {" "}
                          {getHistoricalAccountYearsLabel(
                            account
                          )}
                        </div>
                      </div>

                      <Badge variant="outline">
                        Historiskt konto
                      </Badge>
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {selectedAccount && mapping && (
          <div className="space-y-5">
            <div className="rounded-lg border p-4">
              <div className="text-lg font-semibold">
                <span className="font-mono">
                  {selectedAccount.number}
                </span>
                {" "}
                {selectedAccount.name}
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                Kontot har verifierats genom
                företagets tidigare importerade
                bokföring.
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

                <div>
                  <div className="font-medium text-amber-900">
                    Kontrollera rapportkopplingen
                  </div>

                  <p className="mt-1 text-sm text-amber-800">
                    Kontot finns inte i BAS
                    {" "}
                    {fiscalYear}.
                    AccountPro har därför gjort
                    ett förslag baserat på
                    kontonumret. Bekräfta
                    kopplingen innan kontot
                    används.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">
                  Rapport
                </div>

                <div className="font-medium">
                  {mapping.reportSection ===
                  "balance"
                    ? "Balansräkning"
                    : "Resultaträkning"}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">
                  Rapportpost
                </div>

                <div className="font-medium">
                  {mapping.reportGroup}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">
                  K2-koppling
                </div>

                <div className="font-mono text-sm">
                  {mapping.k2ReportKey}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">
                  Momskod
                </div>

                <div className="font-medium">
                  {mapping.defaultVatCodeId ??
                    "Ingen automatisk momskod"}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setSelectedAccount(null)
                }
              >
                Tillbaka
              </Button>

              <Button
                type="button"
                onClick={
                  useSelectedAccount
                }
              >
                <Check className="mr-2 h-4 w-4" />
                Bekräfta och använd konto
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
