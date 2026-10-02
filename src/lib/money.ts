export interface MoneyParseResult {
  valid: boolean;
  amount: number;
  ore: number;
}

export interface BookkeepingLineLike {
  accountNumber: string;
  debit: number;
  credit: number;
}

export type BookkeepingValidationErrorCode =
  | "INVALID_AMOUNT"
  | "NEGATIVE_AMOUNT"
  | "BOTH_DEBIT_AND_CREDIT"
  | "MISSING_ACCOUNT"
  | "TOO_FEW_POSTING_LINES"
  | "TOO_FEW_ACCOUNTS"
  | "ZERO_TOTAL"
  | "UNBALANCED";

export interface BookkeepingValidationError {
  code: BookkeepingValidationErrorCode;
  message: string;
  lineIndex?: number;
}

export interface BookkeepingValidationResult {
  isValid: boolean;

  totalDebit: number;
  totalCredit: number;

  totalDebitOre: number;
  totalCreditOre: number;

  difference: number;
  differenceOre: number;

  postingLineCount: number;
  distinctAccountCount: number;

  errors: BookkeepingValidationError[];
}

export function toOre(
  value: number
): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(
    value * 100
  );
}

export function fromOre(
  ore: number
): number {
  if (!Number.isFinite(ore)) {
    return 0;
  }

  return ore / 100;
}

export function roundToOre(
  value: number
): number {
  const ore =
    toOre(value);

  if (ore === null) {
    return 0;
  }

  return fromOre(ore);
}

export function parseMoneyInput(
  input: string
): MoneyParseResult {
  const normalized =
    input
      .trim()
      .replace(/\s/g, "")
      .replace(",", ".");

  if (!normalized) {
    return {
      valid: true,
      amount: 0,
      ore: 0,
    };
  }

  if (
    !/^\+?\d+(?:\.\d*)?$/.test(
      normalized
    )
  ) {
    return {
      valid: false,
      amount: 0,
      ore: 0,
    };
  }

  const parsed =
    Number(normalized);

  const ore =
    toOre(parsed);

  if (
    ore === null ||
    ore < 0
  ) {
    return {
      valid: false,
      amount: 0,
      ore: 0,
    };
  }

  return {
    valid: true,
    amount:
      fromOre(ore),
    ore,
  };
}

export function formatMoneyInput(
  value: number
): string {
  const ore =
    toOre(value);

  if (
    ore === null ||
    ore === 0
  ) {
    return "";
  }

  return fromOre(ore)
    .toFixed(2)
    .replace(".", ",");
}

export function validateBookkeepingLines(
  lines: BookkeepingLineLike[]
): BookkeepingValidationResult {
  const errors:
    BookkeepingValidationError[] =
    [];

  const postingAccounts =
    new Set<string>();

  let totalDebitOre = 0;
  let totalCreditOre = 0;
  let postingLineCount = 0;

  lines.forEach(
    (
      line,
      lineIndex
    ) => {
      const accountNumber =
        (
          line.accountNumber ||
          ""
        ).trim();

      const debitOre =
        toOre(line.debit);

      const creditOre =
        toOre(line.credit);

      if (
        debitOre === null ||
        creditOre === null
      ) {
        errors.push({
          code:
            "INVALID_AMOUNT",

          message:
            "Beloppet på raden är inte ett giltigt tal.",

          lineIndex,
        });

        return;
      }

      if (
        debitOre < 0 ||
        creditOre < 0
      ) {
        errors.push({
          code:
            "NEGATIVE_AMOUNT",

          message:
            "Debet och kredit får inte vara negativa.",

          lineIndex,
        });

        return;
      }

      if (
        debitOre > 0 &&
        creditOre > 0
      ) {
        errors.push({
          code:
            "BOTH_DEBIT_AND_CREDIT",

          message:
            "En bokföringsrad får inte ha belopp i både debet och kredit.",

          lineIndex,
        });

        return;
      }

      const hasAmount =
        debitOre > 0 ||
        creditOre > 0;

      if (!hasAmount) {
        return;
      }

      if (!accountNumber) {
        errors.push({
          code:
            "MISSING_ACCOUNT",

          message:
            "En rad med belopp måste ha ett konto.",

          lineIndex,
        });

        return;
      }

      postingLineCount +=
        1;

      postingAccounts.add(
        accountNumber
      );

      totalDebitOre +=
        debitOre;

      totalCreditOre +=
        creditOre;
    }
  );

  if (
    postingLineCount < 2
  ) {
    errors.push({
      code:
        "TOO_FEW_POSTING_LINES",

      message:
        "Verifikationen måste innehålla minst två bokföringsrader med belopp.",
    });
  }

  if (
    postingAccounts.size < 2
  ) {
    errors.push({
      code:
        "TOO_FEW_ACCOUNTS",

      message:
        "Verifikationen måste innehålla minst två olika konton.",
    });
  }

  if (
    totalDebitOre === 0 &&
    totalCreditOre === 0
  ) {
    errors.push({
      code:
        "ZERO_TOTAL",

      message:
        "Verifikationen måste innehålla ett belopp större än noll.",
    });
  }

  const differenceOre =
    Math.abs(
      totalDebitOre -
        totalCreditOre
    );

  if (
    differenceOre !== 0
  ) {
    errors.push({
      code:
        "UNBALANCED",

      message:
        "Summan i debet och kredit måste vara exakt lika i ören.",
    });
  }

  return {
    isValid:
      errors.length === 0,

    totalDebit:
      fromOre(
        totalDebitOre
      ),

    totalCredit:
      fromOre(
        totalCreditOre
      ),

    totalDebitOre,

    totalCreditOre,

    difference:
      fromOre(
        differenceOre
      ),

    differenceOre,

    postingLineCount,

    distinctAccountCount:
      postingAccounts.size,

    errors,
  };
}
