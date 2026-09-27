import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Calendar,
  Check,
  Eye,
  History,
  Info,
  Search,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { YearSelector } from "@/components/ui/year-selector";

import {
  AccountStatementDialog,
} from "@/components/accounting/AccountStatementDialog";

import {
  getAvailableBASYears,
  getBASAccountsForYear,
  getBASVersionLabel,
  getAccountClassName,
} from "@/lib/bas-accounts";

import {
  getBasReportMapping,
  getHistoricalAccountYearsLabel,
  getHistoricalAutoMapping,
  loadHistoricalAccounts,
} from "@/lib/account-plan";

import {
  subscribeStorage,
} from "@/lib/appStorage";

import {
  useAccounting,
} from "@/contexts/AccountingContext";

import {
  useAuth,
} from "@/contexts/AuthContext";

export default function AccountsPage() {
  const {
    activeCompany,
  } = useAuth();

  const {
    vouchers,
  } = useAccounting();

  const availableYears =
    getAvailableBASYears();

  const latestAvailableYear =
    availableYears.length > 0
      ? availableYears[
          availableYears.length - 1
        ]
      : new Date().getFullYear();

  const [selectedYear, setSelectedYear] =
    useState<number | undefined>(
      availableYears.includes(
        new Date().getFullYear()
      )
        ? new Date().getFullYear()
        : latestAvailableYear
    );

  const [searchQuery, setSearchQuery] =
    useState("");

  const [
    selectedAccount,
    setSelectedAccount,
  ] = useState<string | null>(
    null
  );

  const [
    storageVersion,
    setStorageVersion,
  ] = useState(0);

  useEffect(() => {
    return subscribeStorage(() => {
      setStorageVersion(
        (value) => value + 1
      );
    });
  }, []);

  const year =
    selectedYear ??
    latestAvailableYear;

  const standardAccounts =
    useMemo(
      () =>
        getBASAccountsForYear(
          year,
          "K2"
        ),
      [year]
    );

  const historicalAccounts =
    useMemo(() => {
      if (!activeCompany?.id) {
        return [];
      }

      return loadHistoricalAccounts(
        activeCompany.id
      );
    }, [
      activeCompany?.id,
      storageVersion,
    ]);

  const historicalAccountsForYear =
    useMemo(
      () =>
        historicalAccounts.filter(
          (account) =>
            account.years.includes(
              year
            )
        ),
      [
        historicalAccounts,
        year,
      ]
    );

  const query =
    searchQuery
      .trim()
      .toLowerCase();

  const filteredStandardAccounts =
    useMemo(() => {
      if (!query) {
        return standardAccounts;
      }

      return standardAccounts.filter(
        (account) =>
          account.number
            .toLowerCase()
            .includes(query) ||
          account.name
            .toLowerCase()
            .includes(query)
      );
    }, [
      standardAccounts,
      query,
    ]);

  const filteredHistoricalAccounts =
    useMemo(() => {
      if (!query) {
        return historicalAccountsForYear;
      }

      return historicalAccountsForYear.filter(
        (account) =>
          account.number
            .toLowerCase()
            .includes(query) ||
          account.name
            .toLowerCase()
            .includes(query)
      );
    }, [
      historicalAccountsForYear,
      query,
    ]);

  const usedAccountNumbers =
    useMemo(() => {
      const result =
        new Set<string>();

      vouchers.forEach((voucher) => {
        voucher.lines.forEach(
          (line) => {
            result.add(
              line.accountNumber
            );
          }
        );
      });

      return result;
    }, [vouchers]);

  const hasBasVersion =
    standardAccounts.length > 0;

  return (
    <div className="space-y-6">
      <section className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />

            <h1 className="text-2xl font-bold">
              Kontoplan
            </h1>
          </div>

          <p className="mt-2 text-muted-foreground">
            AccountPro använder endast
            BAS-kontoplanen. Egna
            kontoplaner eller fritt skapade
            konton stöds inte.
          </p>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />

          <div>
            <h2 className="font-semibold">
              BAS-kontoplan per
              räkenskapsår
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Varje år använder sin egen
              BAS-version. Ett äldre års
              kontoplan skrivs aldrig över
              när en ny BAS-version läggs
              till.
            </p>

            <p className="mt-2 text-sm text-muted-foreground">
              Installerade BAS-versioner:
              {" "}
              {availableYears
                .map(
                  (availableYear) =>
                    "BAS " +
                    String(
                      availableYear
                    )
                )
                .join(", ")}
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />

          <YearSelector
            value={selectedYear}
            onChange={
              setSelectedYear
            }
            className="w-[150px]"
          />
        </div>

        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(
                event.target.value
              )
            }
            placeholder="Sök kontonummer eller kontonamn"
            className="pl-9"
          />
        </div>
      </section>

      {!hasBasVersion && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <History className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

            <div>
              <h2 className="font-semibold text-amber-900">
                BAS {year} finns inte
                installerad
              </h2>

              <p className="mt-1 text-sm text-amber-800">
                AccountPro använder inte
                en annan årgång som
                ersättning. Om bokföring
                för detta år har
                importerats via SIE visas
                de konton som faktiskt
                förekom i den importerade
                bokföringen längre ner.
              </p>
            </div>
          </div>
        </section>
      )}

      {hasBasVersion && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {getBASVersionLabel(
                  year
                )}
              </h2>

              <p className="text-sm text-muted-foreground">
                {
                  filteredStandardAccounts.length
                }
                {" "}
                konton visas.
              </p>
            </div>

            <Badge variant="outline">
              BAS {year}
            </Badge>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium">
                      Konto
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Kontonamn
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Klass
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Rapportkoppling
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Moms
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Händelser
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStandardAccounts.map(
                    (account) => {
                      const mapping =
                        getBasReportMapping(
                          year,
                          account
                        );

                      const used =
                        usedAccountNumbers.has(
                          account.number
                        );

                      return (
                        <tr
                          key={
                            account.number
                          }
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="px-4 py-3 font-mono font-medium text-secondary">
                            {
                              account.number
                            }
                          </td>

                          <td className="px-4 py-3">
                            {account.name}
                          </td>

                          <td className="px-4 py-3">
                            <Badge variant="secondary">
                              {getAccountClassName(
                                account.class
                              )}
                            </Badge>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {
                                mapping.reportGroup
                              }
                            </div>

                            <div className="text-xs text-muted-foreground">
                              {
                                mapping.k2ReportKey
                              }
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            {mapping.defaultVatCodeId ? (
                              <Badge variant="outline">
                                {
                                  mapping.defaultVatCodeId
                                }
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">
                                Ingen automatisk
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {used && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setSelectedAccount(
                                    account.number
                                  )
                                }
                              >
                                <Eye className="mr-1 h-4 w-4" />
                                Kontoanalys
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />

            <h2 className="text-lg font-semibold">
              Konton från importerad
              bokföring {year}
            </h2>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Dessa konton förekommer i
            företagets importerade
            SIE-bokföring. De kan därför
            bevaras även om AccountPro
            saknar BAS-versionen för året
            eller kontot senare har tagits
            bort ur BAS.
          </p>
        </div>

        {filteredHistoricalAccounts.length ===
        0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <History className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />

            <p className="font-medium">
              Inga importerade konton för
              {year}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Konton läggs automatiskt
              till här när de faktiskt
              förekommer i en importerad
              SIE-fil.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium">
                      Konto
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Kontonamn
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Förekommer år
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      BAS-status
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Rapportkoppling
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Händelser
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredHistoricalAccounts.map(
                    (account) => {
                      const status =
                        account.basStatusByYear[
                          String(year)
                        ];

                      const mapping =
                        account.reportMappings[
                          String(year)
                        ] ??
                        getHistoricalAutoMapping(
                          year,
                          account
                        );

                      const used =
                        usedAccountNumbers.has(
                          account.number
                        );

                      return (
                        <tr
                          key={
                            account.number
                          }
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="px-4 py-3 font-mono font-medium text-secondary">
                            {
                              account.number
                            }
                          </td>

                          <td className="px-4 py-3">
                            {account.name}
                          </td>

                          <td className="px-4 py-3">
                            {getHistoricalAccountYearsLabel(
                              account
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {status ===
                              "in_bas" && (
                              <Badge variant="secondary">
                                Fanns i BAS
                                {" "}
                                {year}
                              </Badge>
                            )}

                            {status ===
                              "not_in_bas" && (
                              <Badge variant="outline">
                                Ej i BAS
                                {" "}
                                {year}
                              </Badge>
                            )}

                            {status ===
                              "bas_version_missing" && (
                              <Badge variant="outline">
                                BAS-version saknas
                              </Badge>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {
                                mapping.reportGroup
                              }
                            </div>

                            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              {mapping.status ===
                              "ready" ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  Bekräftad
                                </>
                              ) : (
                                "Behöver kontrolleras innan återanvändning"
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-right">
                            {used && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setSelectedAccount(
                                    account.number
                                  )
                                }
                              >
                                <Eye className="mr-1 h-4 w-4" />
                                Kontoanalys
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-muted/20 p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />

          <div className="text-sm">
            <div className="font-medium">
              Egna konton kan inte skapas
            </div>

            <p className="mt-1 text-muted-foreground">
              Vid vanlig bokföring används
              alltid BAS-kontoplanen för
              verifikationens år. Ett konto
              utanför årets BAS kan endast
              användas om det tidigare har
              verifierats genom företagets
              importerade SIE-bokföring.
            </p>
          </div>
        </div>
      </section>

      {selectedAccount && (
        <AccountStatementDialog
          open={
            selectedAccount !== null
          }
          onOpenChange={(open) => {
            if (!open) {
              setSelectedAccount(
                null
              );
            }
          }}
          accountNumber={
            selectedAccount
          }
        />
      )}
    </div>
  );
}
