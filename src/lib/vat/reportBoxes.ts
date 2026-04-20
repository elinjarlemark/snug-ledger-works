// Skatteverkets rutor för momsdeklaration
export interface ReportBox {
  number: string;
  label: string;
  group: "utgaende-omsattning" | "utgaende-moms" | "eu-utlandet" | "ingaende-moms" | "summering" | "uttag";
}

export const REPORT_BOXES: ReportBox[] = [
  // A. Momspliktig försäljning eller uttag exkl. moms
  { number: "05", label: "Momspliktig försäljning som inte ingår i ruta 06–08", group: "utgaende-omsattning" },
  { number: "06", label: "Momspliktiga uttag", group: "utgaende-omsattning" },
  { number: "07", label: "Beskattningsunderlag vid vinstmarginalbeskattning", group: "utgaende-omsattning" },
  { number: "08", label: "Hyresinkomster vid frivillig skattskyldighet", group: "utgaende-omsattning" },

  // B. Utgående moms på försäljning eller uttag i ruta 05–08
  { number: "10", label: "Utgående moms 25%", group: "utgaende-moms" },
  { number: "11", label: "Utgående moms 12%", group: "utgaende-moms" },
  { number: "12", label: "Utgående moms 6%", group: "utgaende-moms" },

  // C. Momspliktiga inköp där köparen är skattskyldig
  { number: "20", label: "Inköp av varor från annat EU-land", group: "eu-utlandet" },
  { number: "21", label: "Inköp av tjänster från annat EU-land enligt huvudregeln", group: "eu-utlandet" },
  { number: "22", label: "Inköp av tjänster från land utanför EU", group: "eu-utlandet" },
  { number: "23", label: "Inköp av varor i Sverige enligt omvänd skattskyldighet", group: "eu-utlandet" },
  { number: "24", label: "Övriga inköp av tjänster (omvänd skattskyldighet)", group: "eu-utlandet" },

  // D. Utgående moms på inköp i ruta 20–24
  { number: "30", label: "Utgående moms 25% (fiktiv)", group: "utgaende-moms" },
  { number: "31", label: "Utgående moms 12% (fiktiv)", group: "utgaende-moms" },
  { number: "32", label: "Utgående moms 6% (fiktiv)", group: "utgaende-moms" },

  // E. Försäljning som är undantagen eller där köparen är skattskyldig
  { number: "35", label: "Försäljning av varor till annat EU-land", group: "eu-utlandet" },
  { number: "36", label: "Försäljning av varor utanför EU", group: "eu-utlandet" },
  { number: "39", label: "Försäljning av tjänster till EU-land enligt huvudregeln", group: "eu-utlandet" },
  { number: "41", label: "Försäljning där köparen är skattskyldig (omvänd)", group: "eu-utlandet" },
  { number: "42", label: "Övrig försäljning m.m. (momsfri)", group: "eu-utlandet" },

  // F. Ingående moms
  { number: "48", label: "Ingående moms att dra av", group: "ingaende-moms" },

  // G. Moms att betala eller få tillbaka
  { number: "49", label: "Moms att betala eller få tillbaka", group: "summering" },

  // H. Import
  { number: "50", label: "Beskattningsunderlag vid import", group: "uttag" },
  { number: "60", label: "Utgående moms 25% på import", group: "ingaende-moms" },
  { number: "61", label: "Utgående moms 12% på import", group: "ingaende-moms" },
  { number: "62", label: "Utgående moms 6% på import", group: "ingaende-moms" },
];

export const REPORT_BOX_GROUPS: { id: ReportBox["group"]; label: string }[] = [
  { id: "utgaende-omsattning", label: "Försäljning / Uttag (exkl. moms)" },
  { id: "utgaende-moms", label: "Utgående moms" },
  { id: "eu-utlandet", label: "EU & utlandet (omvänd / momsfri)" },
  { id: "ingaende-moms", label: "Ingående moms" },
  { id: "uttag", label: "Import" },
  { id: "summering", label: "Summering" },
];

export function getReportBox(num: string): ReportBox | undefined {
  return REPORT_BOXES.find((b) => b.number === num);
}
