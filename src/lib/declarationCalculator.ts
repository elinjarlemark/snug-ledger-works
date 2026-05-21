// Declaration field calculator
// Maps INK2R / INK2S / sida 1 fields to BAS accounts via exact BAS 2026 -> INK2 mapping.
// Important: this replaces broad account ranges with exact account-number mapping.
// Important: field.value is the real signed declaration value.
// Example:
// 3.1  = 63
// 3.5  = -45
// 3.12 = -5 or +5 depending on actual result
// 3.26 = positive profit
// 3.27 = negative loss

import type { Voucher } from "@/contexts/AccountingContexts";
import type { BASAccount } from "@/lib/bas-accounts";
import { calculateBalance, getAccountClass } from "@/lib/bas-accounts";
import { INK2_ACCOUNT_MAPPING_2026 } from "@/lib/ink2Mapping2026";

export interface BreakdownEntry {
  label: string;
  amount: number;
}

export interface FieldResult {
  value: number;
  breakdown: BreakdownEntry[];
  source: "accounts" | "formula" | "manual";
  note?: string;
}

interface AccountAggregate {
  accountNumber: string;
  accountName: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

const PLUS_FIELDS = new Set<string>([
  "f3_1",
  "f3_2",
  "f3_3",
  "f3_4",
  "f3_16",
  "f3_20",
  "f3_21",
  "f3_26",

  "f4_1",
  "f4_3a",
  "f4_3b",
  "f4_3c",
  "f4_6a",
  "f4_6b",
  "f4_6c",
  "f4_6d",
  "f4_6e",
  "f4_7b",
  "f4_7d",
  "f4_7e",
  "f4_8b",
  "f4_8c",
  "f4_12",
  "f4_14b",
  "f4_14c",
  "f4_15",

  "f1_1",
]);

const MINUS_FIELDS = new Set<string>([
  "f3_5",
  "f3_6",
  "f3_7",
  "f3_8",
  "f3_9",
  "f3_10",
  "f3_11",
  "f3_17",
  "f3_18",
  "f3_19",
  "f3_22",
  "f3_25",
  "f3_27",

  "f4_2",
  "f4_4a",
  "f4_4b",
  "f4_5a",
  "f4_5b",
  "f4_5c",
  "f4_7a",
  "f4_7c",
  "f4_7f",
  "f4_8a",
  "f4_8d",
  "f4_11",
  "f4_14a",
  "f4_16",

  "f1_2",
]);

const PLUS_MINUS_FIELDS = new Set<string>([
  "f3_12",
  "f3_13",
  "f3_14",
  "f3_15",
  "f3_23",
  "f3_24",

  "f4_9",
  "f4_10",
]);

function fieldIdFromInk2rField(ink2rField: string): string | null {
  if (!ink2rField || ink2rField.includes("/")) return null;
  return `f${ink2rField.replace(".", "_")}`;
}

function getOrCreateField(
  fields: Record<string, FieldResult>,
  id: string,
  note = "Summeras från exakt BAS 2026 → INK2-koppling."
): FieldResult {
  if (!fields[id]) {
    fields[id] = {
      value: 0,
      breakdown: [],
      source: "accounts",
      note,
    };
  }

  return fields[id];
}

function addToField(
  fields: Record<string, FieldResult>,
  fieldId: string,
  label: string,
  amount: number,
  note?: string
): void {
  if (Math.abs(amount) < 0.005) return;

  const field = getOrCreateField(fields, fieldId, note);
  field.value += amount;
  field.breakdown.push({ label, amount });
}

function aggregateVoucherAccounts(
  vouchers: Voucher[],
  accounts: BASAccount[]
): AccountAggregate[] {
  const totals = new Map<string, { debit: number; credit: number }>();

  vouchers.forEach((voucher) => {
    voucher.lines.forEach((line) => {
      const accountNumber = line.accountNumber?.trim();
      if (!/^\d{4}$/.test(accountNumber)) return;

      const cur = totals.get(accountNumber) ?? { debit: 0, credit: 0 };
      cur.debit += line.debit || 0;
      cur.credit += line.credit || 0;
      totals.set(accountNumber, cur);
    });
  });

  return Array.from(totals.entries())
    .map(([accountNumber, { debit, credit }]) => {
      const account = accounts.find((a) => a.number === accountNumber);
      const accClass = getAccountClass(accountNumber);

      return {
        accountNumber,
        accountName:
          account?.name ??
          INK2_ACCOUNT_MAPPING_2026[accountNumber]?.accountName ??
          INK2_ACCOUNT_MAPPING_2026[accountNumber]?.ink2rLabel ??
          "Okänt konto",
        totalDebit: debit,
        totalCredit: credit,
        balance: calculateBalance(accClass, debit, credit),
      };
    })
    .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
}

function declarationValueForField(fieldId: string, accountBalance: number): number {
  /*
    Plusfält ska alltid bli positiva.
    Exempel:
    3.1, 3.16, 3.20, 3.21

    Minusfält ska alltid bli negativa.
    Exempel:
    3.5, 3.7, 3.18, 3.25

    ±-fält ska behålla sitt riktiga tecken.
    De ska INTE inverteras här.

    Exempel:
    f3_12.value = -5  -> UI kan placera 5 i minusfältet
    f3_12.value = 5   -> UI kan placera 5 i plusfältet

    Detta gäller:
    3.12, 3.13, 3.14, 3.15, 3.23, 3.24, 4.9 och 4.10.
  */

  if (PLUS_FIELDS.has(fieldId)) {
    return Math.abs(accountBalance);
  }

  if (MINUS_FIELDS.has(fieldId)) {
    return -Math.abs(accountBalance);
  }

  if (PLUS_MINUS_FIELDS.has(fieldId)) {
    return accountBalance;
  }

  return accountBalance;
}

function addMappedAccount(
  fields: Record<string, FieldResult>,
  aggregate: AccountAggregate
): void {
  const mapping = INK2_ACCOUNT_MAPPING_2026[aggregate.accountNumber];
  if (!mapping?.ink2rField) return;

  const baseLabel = `${aggregate.accountNumber} ${aggregate.accountName}`;
  const fullLabel = mapping.sruCodes
    ? `${baseLabel} · SRU ${mapping.sruCodes}`
    : baseLabel;

  // 8990/8999 ska inte bokas direkt in i 3.26/3.27.
  // 3.26/3.27 beräknas från hela resultaträkningen nedan.
  if (mapping.ink2rField === "3.26/3.27") return;

  // 8810 är ett BAS-konto men två deklarationsfält:
  // debetsaldo  = avsättning/kostnad -> 3.22, negativt värde
  // kreditsaldo = återföring/intäkt  -> 3.21, positivt värde
  if (mapping.ink2rField === "3.21/3.22") {
    if (aggregate.balance > 0) {
      addToField(
        fields,
        "f3_22",
        fullLabel,
        -Math.abs(aggregate.balance),
        "8810 teckenstyrs: debetsaldo/avsättning till 3.22, kreditsaldo/återföring till 3.21."
      );
    } else if (aggregate.balance < 0) {
      addToField(
        fields,
        "f3_21",
        fullLabel,
        Math.abs(aggregate.balance),
        "8810 teckenstyrs: debetsaldo/avsättning till 3.22, kreditsaldo/återföring till 3.21."
      );
    }

    return;
  }

  const fieldId = fieldIdFromInk2rField(mapping.ink2rField);
  if (!fieldId) return;

  const declarationAmount = declarationValueForField(fieldId, aggregate.balance);
  addToField(fields, fieldId, fullLabel, declarationAmount);
}

function get(fields: Record<string, FieldResult>, id: string): number {
  return fields[id]?.value ?? 0;
}

function sum(fields: Record<string, FieldResult>, ids: string[]): number {
  return ids.reduce((total, id) => total + get(fields, id), 0);
}

function buildIncomeStatementResult(
  fields: Record<string, FieldResult>
): Record<"f3_26" | "f3_27", FieldResult> {
  /*
    Alla fält har redan rätt deklarationstecken.

    Därför ska vi INTE göra:
    intäkter - kostnader - skatt

    Vi ska bara summera fältens riktiga value:
    3.1 + 3.2 + ... + 3.25
  */

  const rorelseintakter = sum(fields, [
    "f3_1",
    "f3_2",
    "f3_3",
    "f3_4",
  ]);

  const rorelsekostnader = sum(fields, [
    "f3_5",
    "f3_6",
    "f3_7",
    "f3_8",
    "f3_9",
    "f3_10",
    "f3_11",
  ]);

  const finansiellaPoster = sum(fields, [
    "f3_12",
    "f3_13",
    "f3_14",
    "f3_15",
    "f3_16",
    "f3_17",
    "f3_18",
  ]);

  const koncernbidrag = sum(fields, [
    "f3_19",
    "f3_20",
  ]);

  const bokslutsdispositioner = sum(fields, [
    "f3_21",
    "f3_22",
    "f3_23",
    "f3_24",
  ]);

  const skatt = get(fields, "f3_25");

  const netto =
    rorelseintakter +
    rorelsekostnader +
    finansiellaPoster +
    koncernbidrag +
    bokslutsdispositioner +
    skatt;

  const breakdown: BreakdownEntry[] = [
    { label: "Rörelseintäkter (3.1–3.4)", amount: rorelseintakter },
    { label: "Rörelsekostnader (3.5–3.11)", amount: rorelsekostnader },
    { label: "Finansiella poster (3.12–3.18)", amount: finansiellaPoster },
    { label: "Koncernbidrag (3.19/3.20)", amount: koncernbidrag },
    { label: "Bokslutsdispositioner (3.21–3.24)", amount: bokslutsdispositioner },
    { label: "Skatt (3.25)", amount: skatt },
    { label: "Årets resultat", amount: netto },
  ];

  return {
    f3_26:
      netto >= 0
        ? {
            value: netto,
            breakdown,
            source: "formula",
            note: "Beräknas från INK2R resultaträkning, inte direkt från 899x.",
          }
        : {
            value: 0,
            breakdown: [],
            source: "formula",
          },

    f3_27:
      netto < 0
        ? {
            value: netto,
            breakdown,
            source: "formula",
            note: "Beräknas från INK2R resultaträkning, inte direkt från 899x.",
          }
        : {
            value: 0,
            breakdown: [],
            source: "formula",
          },
  };
}

function buildTaxAdjustments(
  fields: Record<string, FieldResult>
): Record<string, FieldResult> {
  /*
    3.26 är positiv vid vinst.
    3.27 är negativ vid förlust.

    Därför blir årets resultat:
    3.26 + 3.27
  */
  const aretsResultat = get(fields, "f3_26") + get(fields, "f3_27");

  const f4_1: FieldResult =
    aretsResultat >= 0
      ? {
          value: aretsResultat,
          breakdown: [
            { label: "3.26 Årets resultat, vinst", amount: get(fields, "f3_26") },
            { label: "3.27 Årets resultat, förlust", amount: get(fields, "f3_27") },
          ],
          source: "formula",
          note: "Hämtas från resultaträkningen (3.26/3.27).",
        }
      : {
          value: 0,
          breakdown: [],
          source: "formula",
        };

  const f4_2: FieldResult =
    aretsResultat < 0
      ? {
          value: aretsResultat,
          breakdown: [
            { label: "3.27 Årets resultat, förlust", amount: get(fields, "f3_27") },
            { label: "3.26 Årets resultat, vinst", amount: get(fields, "f3_26") },
          ],
          source: "formula",
          note: "Hämtas från resultaträkningen (3.26/3.27).",
        }
      : {
          value: 0,
          breakdown: [],
          source: "formula",
        };

  /*
    4.3a är en plusjustering.

    3.25 är negativt i resultaträkningen eftersom skatt är kostnad.
    I 4.3a ska skatten återläggas, alltså bli positiv.
  */
  const f4_3a: FieldResult = {
    value: Math.abs(get(fields, "f3_25")),
    breakdown: [
      {
        label: "3.25 Skatt på årets resultat återläggs",
        amount: Math.abs(get(fields, "f3_25")),
      },
    ],
    source: "formula",
    note: "Återlagd skatt – ej avdragsgill kostnad.",
  };

  const taxFields: Record<string, FieldResult> = {
    ...fields,
    f4_1,
    f4_2,
    f4_3a,
  };

  /*
    INK2S räknas också genom att summera fältens riktiga teckenvärde.

    Exempel:
    4.1  = positivt
    4.2  = negativt
    4.3  = positivt
    4.4  = negativt
    4.5  = negativt
    4.6  = positivt
    4.9  = plus/minus
    4.10 = plus/minus
    4.14a = negativt
    4.14b = positivt
    4.14c = positivt
  */
  const skattemassigtResultat = sum(taxFields, [
    "f4_1",
    "f4_2",

    "f4_3a",
    "f4_3b",
    "f4_3c",

    "f4_4a",
    "f4_4b",

    "f4_5a",
    "f4_5b",
    "f4_5c",

    "f4_6a",
    "f4_6b",
    "f4_6c",
    "f4_6d",
    "f4_6e",

    "f4_7a",
    "f4_7b",
    "f4_7c",
    "f4_7d",
    "f4_7e",
    "f4_7f",

    "f4_8a",
    "f4_8b",
    "f4_8c",
    "f4_8d",

    "f4_9",
    "f4_10",
    "f4_11",
    "f4_12",

    "f4_14a",
    "f4_14b",
    "f4_14c",
  ]);

  const breakdown415: BreakdownEntry[] = [
    { label: "4.1 Årets resultat, vinst", amount: get(taxFields, "f4_1") },
    { label: "4.2 Årets resultat, förlust", amount: get(taxFields, "f4_2") },
    {
      label: "4.3 Bokförda kostnader som inte ska dras av",
      amount: sum(taxFields, ["f4_3a", "f4_3b", "f4_3c"]),
    },
    {
      label: "4.4 Kostnader som ska dras av men som inte ingår i det redovisade resultatet",
      amount: sum(taxFields, ["f4_4a", "f4_4b"]),
    },
    {
      label: "4.5 Bokförda intäkter som inte ska tas upp",
      amount: sum(taxFields, ["f4_5a", "f4_5b", "f4_5c"]),
    },
    {
      label: "4.6 Intäkter som ska tas upp men som inte ingår i det redovisade resultatet",
      amount: sum(taxFields, ["f4_6a", "f4_6b", "f4_6c", "f4_6d", "f4_6e"]),
    },
    {
      label: "4.7 Avyttring av delägarrätter",
      amount: sum(taxFields, ["f4_7a", "f4_7b", "f4_7c", "f4_7d", "f4_7e", "f4_7f"]),
    },
    {
      label: "4.8 Andel i handelsbolag",
      amount: sum(taxFields, ["f4_8a", "f4_8b", "f4_8c", "f4_8d"]),
    },
    {
      label: "4.9–4.12 Övriga skattemässiga justeringar",
      amount: sum(taxFields, ["f4_9", "f4_10", "f4_11", "f4_12"]),
    },
    {
      label: "4.14 Underskott",
      amount: sum(taxFields, ["f4_14a", "f4_14b", "f4_14c"]),
    },
    {
      label: "Resultat efter skattemässiga justeringar",
      amount: skattemassigtResultat,
    },
  ];

  const f4_15: FieldResult =
    skattemassigtResultat >= 0
      ? {
          value: skattemassigtResultat,
          breakdown: breakdown415,
          source: "formula",
          note: "Bokfört resultat ± skattemässiga justeringar.",
        }
      : {
          value: 0,
          breakdown: [],
          source: "formula",
        };

  const f4_16: FieldResult =
    skattemassigtResultat < 0
      ? {
          value: skattemassigtResultat,
          breakdown: breakdown415,
          source: "formula",
          note: "Bokfört resultat ± skattemässiga justeringar.",
        }
      : {
          value: 0,
          breakdown: [],
          source: "formula",
        };

  const f1_1: FieldResult = {
    value: f4_15.value,
    breakdown: [{ label: "4.15 Överskott", amount: f4_15.value }],
    source: "formula",
    note: "Hämtas från 4.15.",
  };

  const f1_2: FieldResult = {
    value: f4_16.value,
    breakdown: [{ label: "4.16 Underskott", amount: f4_16.value }],
    source: "formula",
    note: "Hämtas från 4.16.",
  };

  return {
    f1_1,
    f1_2,
    f4_1,
    f4_2,
    f4_3a,
    f4_15,
    f4_16,
  };
}

export function calculateDeclarationFields(
  vouchers: Voucher[],
  accounts: BASAccount[]
): Record<string, FieldResult> {
  const fields: Record<string, FieldResult> = {};

  aggregateVoucherAccounts(vouchers, accounts).forEach((aggregate) => {
    addMappedAccount(fields, aggregate);
  });

  // 3.26/3.27 måste finnas innan 4.1/4.2/4.15/4.16 räknas.
  Object.assign(fields, buildIncomeStatementResult(fields));

  // INK2S och sida 1.
  Object.assign(fields, buildTaxAdjustments(fields));

  return fields;
}

export function formatSEK(value: number): string {
  return new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}
