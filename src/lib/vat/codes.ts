// Frontend-modell för svenska momskoder (K2-only system)
// Konfigurerbar lista — momssatser och rapportrutor kan justeras utan att UI behöver göras om.

export type VatCodeType = "utgaende" | "ingaende" | "bada";

export interface VatCode {
  id: string;
  code: string; // t.ex. "SE25"
  namn: string;
  beskrivning: string;
  sats: number; // procent
  typ: VatCodeType;
  rapportRutor: string[]; // ruta-id, t.ex. ["05", "10"]
  aktiv: boolean;
  /** Markera om koden räknas som omvänd skattskyldighet */
  omvand?: boolean;
  /** Markera om koden räknas som EU/utanför EU/import/export */
  kategori?: "se" | "eu" | "export" | "import" | "omvand" | "fri";
}

export const DEFAULT_VAT_CODES: VatCode[] = [
  // Svensk försäljning
  { id: "SE25", code: "SE25", namn: "Försäljning 25% moms", beskrivning: "Vanlig svensk försäljning med 25% moms", sats: 25, typ: "utgaende", rapportRutor: ["05", "10"], aktiv: true, kategori: "se" },
  { id: "SE12", code: "SE12", namn: "Försäljning 12% moms", beskrivning: "Svensk försäljning med 12% moms (t.ex. livsmedel, restaurang)", sats: 12, typ: "utgaende", rapportRutor: ["06", "11"], aktiv: true, kategori: "se" },
  { id: "SE6",  code: "SE6",  namn: "Försäljning 6% moms",  beskrivning: "Svensk försäljning med 6% moms (t.ex. böcker, persontransport)", sats: 6, typ: "utgaende", rapportRutor: ["07", "12"], aktiv: true, kategori: "se" },
  { id: "SE0",  code: "SE0",  namn: "Momsfri försäljning",   beskrivning: "Försäljning som inte omfattas av moms", sats: 0, typ: "utgaende", rapportRutor: ["42"], aktiv: true, kategori: "fri" },

  // Svenska inköp (avdragsgill ingående moms)
  { id: "IN25", code: "IN25", namn: "Inköp 25% moms", beskrivning: "Svenskt inköp med 25% avdragsgill ingående moms", sats: 25, typ: "ingaende", rapportRutor: ["48"], aktiv: true, kategori: "se" },
  { id: "IN12", code: "IN12", namn: "Inköp 12% moms", beskrivning: "Svenskt inköp med 12% avdragsgill ingående moms", sats: 12, typ: "ingaende", rapportRutor: ["48"], aktiv: true, kategori: "se" },
  { id: "IN6",  code: "IN6",  namn: "Inköp 6% moms",  beskrivning: "Svenskt inköp med 6% avdragsgill ingående moms",  sats: 6,  typ: "ingaende", rapportRutor: ["48"], aktiv: true, kategori: "se" },

  // Omvänd skattskyldighet
  { id: "REV-OUT", code: "REV-OUT", namn: "Omvänd moms försäljning", beskrivning: "Försäljning där köparen redovisar momsen", sats: 0, typ: "utgaende", rapportRutor: ["41"], aktiv: true, omvand: true, kategori: "omvand" },
  { id: "REV-IN",  code: "REV-IN",  namn: "Omvänd moms inköp",      beskrivning: "Inköp där köparen själv redovisar utgående och ingående moms (25%)", sats: 25, typ: "bada", rapportRutor: ["24", "30", "48"], aktiv: true, omvand: true, kategori: "omvand" },

  // EU-försäljning
  { id: "EU-SALE-G", code: "EU-SALE-G", namn: "EU-försäljning vara", beskrivning: "Försäljning av varor till momsregistrerad köpare i annat EU-land", sats: 0, typ: "utgaende", rapportRutor: ["35"], aktiv: true, kategori: "eu" },
  { id: "EU-SALE-S", code: "EU-SALE-S", namn: "EU-försäljning tjänst", beskrivning: "Försäljning av tjänster till momsregistrerad köpare i annat EU-land", sats: 0, typ: "utgaende", rapportRutor: ["39"], aktiv: true, kategori: "eu" },

  // EU-inköp (fiktiv moms 25%)
  { id: "EU-PURCH-G", code: "EU-PURCH-G", namn: "EU-inköp vara",   beskrivning: "Inköp av varor från annat EU-land med fiktiv moms (25%)", sats: 25, typ: "bada", rapportRutor: ["20", "30", "48"], aktiv: true, kategori: "eu" },
  { id: "EU-PURCH-S", code: "EU-PURCH-S", namn: "EU-inköp tjänst", beskrivning: "Inköp av tjänster från annat EU-land med fiktiv moms (25%)", sats: 25, typ: "bada", rapportRutor: ["21", "30", "48"], aktiv: true, kategori: "eu" },

  // Export & Import
  { id: "EXPORT", code: "EXPORT", namn: "Export utanför EU", beskrivning: "Försäljning till köpare utanför EU", sats: 0, typ: "utgaende", rapportRutor: ["36"], aktiv: true, kategori: "export" },
  { id: "IMPORT", code: "IMPORT", namn: "Import från land utanför EU", beskrivning: "Inköp från land utanför EU, beskattningsunderlag och moms (25%)", sats: 25, typ: "bada", rapportRutor: ["50", "60", "48"], aktiv: true, kategori: "import" },
];

export function getVatCodeById(codes: VatCode[], id?: string | null): VatCode | undefined {
  if (!id) return undefined;
  return codes.find((c) => c.id === id);
}

export function getActiveVatCodes(codes: VatCode[]): VatCode[] {
  return codes.filter((c) => c.aktiv);
}

export function calculateVatFromCode(amountExclVat: number, code: VatCode | undefined): number {
  if (!code) return 0;
  return Math.round(amountExclVat * (code.sats / 100) * 100) / 100;
}

export function getOutgoingCodes(codes: VatCode[]): VatCode[] {
  return getActiveVatCodes(codes).filter((c) => c.typ === "utgaende" || c.typ === "bada");
}

export function getIncomingCodes(codes: VatCode[]): VatCode[] {
  return getActiveVatCodes(codes).filter((c) => c.typ === "ingaende" || c.typ === "bada");
}
