import {
  BASAccount,
  getAccountClass,
} from "./bas-accounts";

import {
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

export function parseSIEFile(
  content:
    string
):
  SIEParseResult {
  const result:
    SIEParseResult = {
    accounts: [],
    vouchers: [],

    openingBalances:
      [],

    previousClosingBalances:
      [],

    metadata: {},

    errors: [],
  };

  const lines =
    content
      .replace(
        /\r\n/g,
        "\n"
      )
      .replace(
        /\r/g,
        "\n"
      )
      .split(
        "\n"
      );

  let currentVoucher:
    SIEVoucher |
    null =
    null;

  let lineNumber =
    0;

  for (
    const line of
    lines
  ) {
    lineNumber +=
      1;

    const trimmedLine =
      line.trim();

    if (
      !trimmedLine
    ) {
      continue;
    }

    if (
      trimmedLine ===
      "}"
    ) {
      if (
        currentVoucher
      ) {
        if (
          addVoucherValidationErrors(
            result,
            currentVoucher,
            lineNumber
          )
        ) {
          result.vouchers.push(
            currentVoucher
          );
        }

        currentVoucher =
          null;
      }

      continue;
    }

    if (
      !trimmedLine.startsWith(
        "#"
      )
    ) {
      continue;
    }

    const parsed =
      parseSIELine(
        trimmedLine
      );

    if (
      !parsed
    ) {
      continue;
    }

    const command =
      parsed.command;

    const values =
      parsed.values;

    switch (
      command
    ) {
      case "FNAMN":
        result.metadata.companyName =
          values[0] ||
          "";
        break;

      case "ORGNR":
        result.metadata.organizationNumber =
          values[0] ||
          "";
        break;

      case "RAR":
        if (
          values.length >=
            3 &&
          values[0] ===
            "0"
        ) {
          const startDate =
            parseSIEDate(
              values[1]
            );

          const endDate =
            parseSIEDate(
              values[2]
            );

          if (
            startDate
          ) {
            result.metadata.fiscalYearStart =
              startDate;
          }

          if (
            endDate
          ) {
            result.metadata.fiscalYearEnd =
              endDate;
          }
        }
        break;

      case "KONTO":
        if (
          values.length >=
          2
        ) {
          const accountNumber =
            values[0];

          const accountName =
            values[1];

          if (
            accountNumber &&
            accountName
          ) {
            result.accounts.push({
              number:
                accountNumber,

              name:
                accountName,
            });
          }
        }
        break;

      case "VER":
        if (
          values.length >=
          3
        ) {
          const series =
            values[0] ||
            "A";

          const number =
            Number.parseInt(
              values[1],
              10
            ) ||
            0;

          const date =
            parseSIEDate(
              values[2]
            );

          const description =
            values[3] ||
            "";

          if (date) {
            currentVoucher = {
              series,
              number,
              date,
              description,
              lines: [],
            };
          } else {
            result.errors.push(
              "Rad " +
              String(
                lineNumber
              ) +
              ": Ogiltigt datum i verifikation."
            );
          }
        }
        break;

      case "TRANS":
        if (
          currentVoucher &&
          values.length >=
            2
        ) {
          const accountNumber =
            values[0];

          let amountIndex =
            1;

          if (
            values[1] ===
            "{}"
          ) {
            amountIndex =
              2;
          }

          const parsedAmount =
            parseSIEAmount(
              values[
                amountIndex
              ]
            );

          if (
            parsedAmount ===
            null
          ) {
            result.errors.push(
              "Rad " +
              String(
                lineNumber
              ) +
              ": Ogiltigt belopp i SIE-transaktion."
            );

            break;
          }

          if (
            accountNumber
          ) {
            const account =
              result.accounts.find(
                (entry) =>
                  entry.number ===
                  accountNumber
              );

            currentVoucher
              .lines
              .push({
                id:
                  crypto.randomUUID(),

                accountNumber,

                accountName:
                  account?.name ||
                  "Konto " +
                  accountNumber,

                debit:
                  parsedAmount >
                  0
                    ? parsedAmount
                    : 0,

                credit:
                  parsedAmount <
                  0
                    ? Math.abs(
                        parsedAmount
                      )
                    : 0,
              });
          }
        }
        break;

      case "IB":
        if (
          values.length >=
            3 &&
          values[0] ===
            "0"
        ) {
          const parsedAmount =
            parseSIEAmount(
              values[2]
            );

          if (
            parsedAmount ===
            null
          ) {
            result.errors.push(
              "Rad " +
              String(
                lineNumber
              ) +
              ": Ogiltigt belopp i ingående balans."
            );

            break;
          }

          result
            .openingBalances
            .push({
              accountNumber:
                values[1],

              amount:
                parsedAmount,
            });
        }
        break;

      case "UB":
        if (
          values.length >=
            3 &&
          values[0] ===
            "-1"
        ) {
          const parsedAmount =
            parseSIEAmount(
              values[2]
            );

          if (
            parsedAmount ===
            null
          ) {
            result.errors.push(
              "Rad " +
              String(
                lineNumber
              ) +
              ": Ogiltigt belopp i föregående års utgående balans."
            );

            break;
          }

          result
            .previousClosingBalances
            .push({
              accountNumber:
                values[1],

              amount:
                parsedAmount,
            });
        }
        break;

      default:
        break;
    }
  }

  if (
    currentVoucher
  ) {
    result.errors.push(
      "SIE-filen avslutades innan verifikation " +
      currentVoucher.series +
      String(
        currentVoucher.number
      ) +
      " stängdes."
    );
  }

  if (
    result
      .openingBalances
      .length >
    0
  ) {
    validateBalanceCollection(
      result
        .openingBalances,

      "Ingående balans i SIE-filen",

      result.errors
    );
  } else {
    validateBalanceCollection(
      result
        .previousClosingBalances,

      "Föregående års utgående balans i SIE-filen",

      result.errors
    );
  }

  return result;
}

function parseSIELine(
  line:
    string
): {
  command:
    string;

  values:
    string[];
} | null {
  const match =
    line.match(
      /^#(\w+)\s*(.*)?$/
    );

  if (
    !match
  ) {
    return null;
  }

  const command =
    match[1];

  const rest =
    match[2] ||
    "";

  const values:
    string[] =
    [];

  let current =
    "";

  let inQuotes =
    false;

  let index =
    0;

  while (
    index <
    rest.length
  ) {
    const char =
      rest[index];

    if (
      char ===
      '"'
    ) {
      if (
        inQuotes
      ) {
        values.push(
          current
        );

        current =
          "";

        inQuotes =
          false;
      } else {
        inQuotes =
          true;
      }
    } else if (
      char ===
        " " &&
      !inQuotes
    ) {
      if (
        current
      ) {
        values.push(
          current
        );

        current =
          "";
      }
    } else if (
      char ===
        "{" &&
      !inQuotes
    ) {
      const closeIndex =
        rest.indexOf(
          "}",
          index
        );

      if (
        closeIndex >
        index
      ) {
        values.push(
          rest.substring(
            index,
            closeIndex +
              1
          )
        );

        index =
          closeIndex;
      }
    } else if (
      char !==
        "}" ||
      inQuotes
    ) {
      current +=
        char;
    }

    index +=
      1;
  }

  if (
    current
  ) {
    values.push(
      current
    );
  }

  return {
    command,
    values,
  };
}

function parseSIEAmount(
  amountString:
    string |
    undefined
):
  number | null {
  if (
    !amountString
  ) {
    return null;
  }

  const normalized =
    amountString
      .trim()
      .replace(
        /\s/g,
        ""
      )
      .replace(
        ",",
        "."
      );

  if (
    !/^[+-]?\d+(?:\.\d+)?$/.test(
      normalized
    )
  ) {
    return null;
  }

  const parsed =
    Number(
      normalized
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return null;
  }

  return roundToOre(
    parsed
  );
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

export function findDuplicateVoucher(
  existingVouchers:
    Voucher[],

  _series:
    string,

  number:
    number,

  date:
    string
):
  Voucher |
  undefined {
  return existingVouchers.find(
    (voucher) =>
      voucher.voucherNumber ===
        number &&
      voucher.date ===
        date
  );
}

export function convertSIEVouchersToInternal(
  sieVouchers:
    SIEVoucher[],

  companyId:
    string,

  existingVouchers:
    Voucher[],

  accounts:
    BASAccount[]
): {
  newVouchers:
    Voucher[];

  skippedDuplicates:
    number;

  nextVoucherNumber:
    number;
} {
  const newVouchers:
    Voucher[] =
    [];

  let skippedDuplicates =
    0;

  let nextVoucherNumber =
    existingVouchers.length >
    0
      ? Math.max(
          ...existingVouchers.map(
            (voucher) =>
              voucher.voucherNumber
          )
        ) +
        1
      : 1;

  for (
    const sieVoucher of
    sieVouchers
  ) {
    const duplicate =
      findDuplicateVoucher(
        [
          ...existingVouchers,
          ...newVouchers,
        ],

        sieVoucher.series,

        sieVoucher.number,

        sieVoucher.date
      );

    if (
      duplicate
    ) {
      skippedDuplicates +=
        1;

      continue;
    }

    const validation =
      validateBookkeepingLines(
        sieVoucher.lines
      );

    if (
      !validation.isValid
    ) {
      continue;
    }

    const linesWithNames =
      sieVoucher.lines
        .filter(
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

            return (
              debitOre >
                0 ||
              creditOre >
                0
            );
          }
        )
        .map(
          (line) => {
            const account =
              accounts.find(
                (entry) =>
                  entry.number ===
                  line.accountNumber
              );

            return {
              ...line,

              accountName:
                account?.name ||
                line.accountName,

              debit:
                roundToOre(
                  line.debit
                ),

              credit:
                roundToOre(
                  line.credit
                ),
            };
          }
        );

    const newVoucher:
      Voucher = {
      id:
        crypto.randomUUID(),

      companyId,

      voucherNumber:
        nextVoucherNumber,

      date:
        sieVoucher.date,

      description:
        sieVoucher.description,

      lines:
        linesWithNames,

      createdAt:
        new Date()
          .toISOString(),
    };

    newVouchers.push(
      newVoucher
    );

    nextVoucherNumber +=
      1;
  }

  return {
    newVouchers,

    skippedDuplicates,

    nextVoucherNumber,
  };
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
