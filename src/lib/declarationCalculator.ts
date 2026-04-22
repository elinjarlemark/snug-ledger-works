// Declaration field calculator
// Maps INK2R / INK2S / sida 1 fields to either BAS-account aggregations
// or formula-based values, returning a breakdown for the popover.

import type { Voucher } from "@/contexts/AccountingContexts";
import type { BASAccount } from "@/lib/bas-accounts";
import { calculateBalance, getAccountClass } from "@/lib/bas-accounts";

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

type AccountRange = [number, number];

interface AccountAggregate {
  accountNumber: string;
  accountName: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

function aggregateAccounts(
  vouchers: Voucher[],
  accounts: BASAccount[],
  ranges: AccountRange[],
  excludeAccounts: string[] = []
): AccountAggregate[] {
  const totals = new Map<string, { debit: number; credit: number }>();

  vouchers.forEach((v) => {
    v.lines.forEach((line) => {
      const accNum = parseInt(line.accountNumber, 10);
      if (Number.isNaN(accNum)) return;
      if (excludeAccounts.includes(line.accountNumber)) return;
      const inRange = ranges.some(([from, to]) => accNum >= from && accNum <= to);
      if (!inRange) return;
      const cur = totals.get(line.accountNumber) ?? { debit: 0, credit: 0 };
      cur.debit += line.debit || 0;
      cur.credit += line.credit || 0;
      totals.set(line.accountNumber, cur);
    });
  });

  return Array.from(totals.entries())
    .map(([accountNumber, { debit, credit }]) => {
      const account = accounts.find((a) => a.number === accountNumber);
      const accClass = getAccountClass(accountNumber);
      return {
        accountNumber,
        accountName: account?.name ?? "Okänt konto",
        totalDebit: debit,
        totalCredit: credit,
        balance: calculateBalance(accClass, debit, credit),
      };
    })
    .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
}

function buildFromRanges(
  vouchers: Voucher[],
  accounts: BASAccount[],
  ranges: AccountRange[],
  excludeAccounts: string[] = []
): FieldResult {
  const aggregates = aggregateAccounts(vouchers, accounts, ranges, excludeAccounts);
  const breakdown = aggregates.map((a) => ({
    label: `${a.accountNumber} ${a.accountName}`,
    amount: a.balance,
  }));
  const value = breakdown.reduce((sum, b) => sum + b.amount, 0);
  return { value, breakdown, source: "accounts" };
}

// Map of field id -> account ranges (INK2R)
const FIELD_RANGES: Record<string, { ranges: AccountRange[]; exclude?: string[] }> = {
  // Balansräkning - Tillgångar
  f2_1: { ranges: [[1000, 1079]] },
  f2_2: { ranges: [[1080, 1099]] },
  f2_3: { ranges: [[1100, 1199]] },
  f2_4: { ranges: [[1200, 1299]] },
  f2_5: { ranges: [[1120, 1129]] },
  f2_6: { ranges: [[1180, 1189]] },
  f2_7: { ranges: [[1310, 1319]] },
  f2_8: { ranges: [[1320, 1329]] },
  f2_9: { ranges: [[1330, 1339]] },
  f2_10: { ranges: [[1340, 1349]] },
  f2_11: { ranges: [[1350, 1359]] },
  f2_12: { ranges: [[1360, 1369]] },
  f2_13: { ranges: [[1350, 1359]] },
  f2_14: { ranges: [[1380, 1384]] },
  f2_15: { ranges: [[1385, 1399]] },
  f2_16: { ranges: [[1400, 1499]] },
  f2_17: { ranges: [[1510, 1519]] },
  f2_18: { ranges: [[1560, 1569]] },
  f2_19: { ranges: [[1570, 1579]] },
  f2_20: { ranges: [[1580, 1589]] },
  f2_21: { ranges: [[1600, 1689]] },
  f2_22: { ranges: [[1700, 1799]] },
  f2_23: { ranges: [[1800, 1899]] },
  f2_24: { ranges: [[1690, 1699]] },
  f2_26: { ranges: [[1900, 1999]] },

  // Eget kapital & skulder
  f2_27: { ranges: [[2080, 2089]] },
  f2_28: { ranges: [[2090, 2099]] },
  f2_29: { ranges: [[2110, 2129]] },
  f2_30: { ranges: [[2150, 2159]] },
  f2_31: { ranges: [[2130, 2149], [2160, 2199]] },
  f2_32: { ranges: [[2200, 2219]] },
  f2_33: { ranges: [[2220, 2229]] },
  f2_34: { ranges: [[2230, 2299]] },
  f2_35: { ranges: [[2300, 2319]] },
  f2_36: { ranges: [[2330, 2339]] },
  f2_37: { ranges: [[2340, 2399]] },
  f2_38: { ranges: [[2360, 2379]] },
  f2_39: { ranges: [[2380, 2399]] },
  f2_40: { ranges: [[2410, 2419]] },
  f2_41: { ranges: [[2400, 2409], [2420, 2439]] },
  f2_42: { ranges: [[2420, 2429]] },
  f2_43: { ranges: [[2430, 2439]] },
  f2_44: { ranges: [[2450, 2459]] },
  f2_45: { ranges: [[2440, 2449]] },
  f2_46: { ranges: [[2480, 2489]] },
  f2_47: { ranges: [[2860, 2869]] },
  f2_48: { ranges: [[2870, 2899]] },
  f2_49: { ranges: [[2500, 2599], [2700, 2799]] },
  f2_50: { ranges: [[2900, 2999]] },

  // Resultaträkning
  f3_1: { ranges: [[3000, 3799]] },
  f3_2: { ranges: [[4900, 4999]] },
  f3_3: { ranges: [[3800, 3899]] },
  f3_4: { ranges: [[3900, 3999]] },
  f3_5: { ranges: [[4000, 4099]] },
  f3_6: { ranges: [[4100, 4199]] },
  f3_7: { ranges: [[5000, 6999]], exclude: [] },
  f3_8: { ranges: [[7000, 7699]] },
  f3_9: { ranges: [[7800, 7899]] },
  f3_10: { ranges: [[7700, 7799]] },
  f3_11: { ranges: [[7900, 7999]] },
  f3_12: { ranges: [[8000, 8099]] },
  f3_13: { ranges: [[8100, 8119]] },
  f3_14: { ranges: [[8120, 8199]] },
  f3_15: { ranges: [[8200, 8299]] },
  f3_16: { ranges: [[8300, 8399]] },
  f3_17: { ranges: [[8270, 8279]] },
  f3_18: { ranges: [[8400, 8499]] },
  f3_19: { ranges: [[8820, 8829]] },
  f3_20: { ranges: [[8820, 8829]] },
  f3_21: { ranges: [[8810, 8819]] },
  f3_22: { ranges: [[8810, 8819]] },
  f3_23: { ranges: [[8850, 8859]] },
  f3_24: { ranges: [[8860, 8899]] },
  f3_25: { ranges: [[8910, 8919]] },
};

// INK2S derived/manual fields and their formula descriptions
function calcInk2S(fields: Record<string, FieldResult>): Record<string, FieldResult> {
  const get = (id: string) => fields[id]?.value ?? 0;

  // 4.1 / 4.2 = årets resultat (positiv = vinst, negativ = förlust)
  const aretsResultat = get("f3_26") - get("f3_27");
  const f4_1: FieldResult = aretsResultat >= 0
    ? {
        value: aretsResultat,
        breakdown: [
          { label: "3.26 Årets resultat (vinst)", amount: get("f3_26") },
          { label: "− 3.27 Årets resultat (förlust)", amount: -get("f3_27") },
        ],
        source: "formula",
        note: "Hämtas från resultaträkningen (3.26 / 3.27).",
      }
    : { value: 0, breakdown: [], source: "formula" };

  const f4_2: FieldResult = aretsResultat < 0
    ? {
        value: -aretsResultat,
        breakdown: [
          { label: "3.27 Årets resultat (förlust)", amount: get("f3_27") },
          { label: "− 3.26 Årets resultat (vinst)", amount: -get("f3_26") },
        ],
        source: "formula",
        note: "Hämtas från resultaträkningen.",
      }
    : { value: 0, breakdown: [], source: "formula" };

  // 4.3a Skatt på årets resultat (alltid att lägga tillbaka)
  const f4_3a: FieldResult = {
    value: get("f3_25"),
    breakdown: [{ label: "8910–8919 Skatt på årets resultat", amount: get("f3_25") }],
    source: "formula",
    note: "Återlagd skatt – ej avdragsgill kostnad.",
  };

  // 4.15 / 4.16 - Skattemässigt resultat
  const skattemassigtResultat =
    f4_1.value
    - f4_2.value
    + f4_3a.value
    + get("f4_3b") + get("f4_3c")
    - get("f4_4a") - get("f4_4b")
    - get("f4_5a") - get("f4_5b") - get("f4_5c")
    + get("f4_6a") + get("f4_6b") + get("f4_6c") + get("f4_6d") + get("f4_6e")
    - get("f4_7a") + get("f4_7b") - get("f4_7c") + get("f4_7d") + get("f4_7e") - get("f4_7f")
    - get("f4_8a") + get("f4_8b") + get("f4_8c") - get("f4_8d")
    + get("f4_9") + get("f4_10") - get("f4_11") + get("f4_12")
    - get("f4_14a") + get("f4_14b") + get("f4_14c");

  const breakdown415: BreakdownEntry[] = [
    { label: "4.1 Årets vinst", amount: f4_1.value },
    { label: "− 4.2 Årets förlust", amount: -f4_2.value },
    { label: "+ 4.3 Bokförda kostnader som inte ska dras av", amount: f4_3a.value + get("f4_3b") + get("f4_3c") },
    { label: "− 4.4 Kostnader som ska dras av (ej bokförda)", amount: -(get("f4_4a") + get("f4_4b")) },
    { label: "− 4.5 Bokförda intäkter som inte ska tas upp", amount: -(get("f4_5a") + get("f4_5b") + get("f4_5c")) },
    { label: "+ 4.6 Intäkter som ska tas upp (ej bokförda)", amount: get("f4_6a") + get("f4_6b") + get("f4_6c") + get("f4_6d") + get("f4_6e") },
    { label: "± 4.7–4.8 Avyttring delägarrätter / handelsbolag", amount: -get("f4_7a") + get("f4_7b") - get("f4_7c") + get("f4_7d") + get("f4_7e") - get("f4_7f") - get("f4_8a") + get("f4_8b") + get("f4_8c") - get("f4_8d") },
    { label: "± 4.9–4.12 Övriga skattemässiga justeringar", amount: get("f4_9") + get("f4_10") - get("f4_11") + get("f4_12") },
    { label: "± 4.14 Underskott", amount: -get("f4_14a") + get("f4_14b") + get("f4_14c") },
  ];

  const f4_15: FieldResult = skattemassigtResultat >= 0
    ? { value: skattemassigtResultat, breakdown: breakdown415, source: "formula", note: "Bokfört resultat ± skattemässiga justeringar." }
    : { value: 0, breakdown: [], source: "formula" };

  const f4_16: FieldResult = skattemassigtResultat < 0
    ? { value: -skattemassigtResultat, breakdown: breakdown415, source: "formula", note: "Bokfört resultat ± skattemässiga justeringar." }
    : { value: 0, breakdown: [], source: "formula" };

  // Sida 1 (1.1 / 1.2)
  const f1_1: FieldResult = {
    value: f4_15.value,
    breakdown: [{ label: "4.15 Överskott", amount: f4_15.value }],
    source: "formula",
    note: "Hämtas från 4.15 (sida 5).",
  };
  const f1_2: FieldResult = {
    value: f4_16.value,
    breakdown: [{ label: "4.16 Underskott", amount: f4_16.value }],
    source: "formula",
    note: "Hämtas från 4.16 (sida 5).",
  };

  // 3.26 / 3.27 - calculated as net of resultaträkning
  const intakter =
    get("f3_1") + get("f3_2") + get("f3_3") + get("f3_4");
  const kostnader =
    get("f3_5") + get("f3_6") + get("f3_7") + get("f3_8") + get("f3_9") + get("f3_10") + get("f3_11");
  const fin =
    get("f3_12") + get("f3_13") + get("f3_14") + get("f3_15") + get("f3_16") - get("f3_17") - get("f3_18");
  const koncern = get("f3_20") - get("f3_19");
  const bokslut = get("f3_21") - get("f3_22") + get("f3_23") + get("f3_24");
  const skatt = get("f3_25");

  const netto = intakter - kostnader + fin + koncern + bokslut - skatt;

  const f3_26: FieldResult = netto >= 0
    ? {
        value: netto,
        breakdown: [
          { label: "Rörelseintäkter (3.1–3.4)", amount: intakter },
          { label: "− Rörelsekostnader (3.5–3.11)", amount: -kostnader },
          { label: "± Finansiella poster (3.12–3.18)", amount: fin },
          { label: "± Koncernbidrag (3.19/3.20)", amount: koncern },
          { label: "± Bokslutsdispositioner (3.21–3.24)", amount: bokslut },
          { label: "− Skatt (3.25)", amount: -skatt },
        ],
        source: "formula",
        note: "Summan av resultaträkningens poster.",
      }
    : { value: 0, breakdown: [], source: "formula" };

  const f3_27: FieldResult = netto < 0
    ? {
        value: -netto,
        breakdown: [
          { label: "Rörelseintäkter (3.1–3.4)", amount: intakter },
          { label: "− Rörelsekostnader (3.5–3.11)", amount: -kostnader },
          { label: "± Finansiella poster (3.12–3.18)", amount: fin },
          { label: "± Koncernbidrag (3.19/3.20)", amount: koncern },
          { label: "± Bokslutsdispositioner (3.21–3.24)", amount: bokslut },
          { label: "− Skatt (3.25)", amount: -skatt },
        ],
        source: "formula",
        note: "Summan av resultaträkningens poster.",
      }
    : { value: 0, breakdown: [], source: "formula" };

  return {
    f1_1, f1_2,
    f3_26, f3_27,
    f4_1, f4_2, f4_3a,
    f4_15, f4_16,
  };
}

export function calculateDeclarationFields(
  vouchers: Voucher[],
  accounts: BASAccount[]
): Record<string, FieldResult> {
  const fields: Record<string, FieldResult> = {};

  // Build all account-range based fields first
  Object.entries(FIELD_RANGES).forEach(([id, { ranges, exclude }]) => {
    fields[id] = buildFromRanges(vouchers, accounts, ranges, exclude);
  });

  // Then derived/formula fields (overrides)
  const derived = calcInk2S(fields);
  Object.entries(derived).forEach(([id, result]) => {
    fields[id] = result;
  });

  return fields;
}

export function formatSEK(value: number): string {
  return new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}
