import { FileCheck, Lock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useAccounting } from "@/contexts/AccountingContexts";
import { useMemo, useState } from "react";
import { calculateDeclarationFields, formatSEK, type FieldResult } from "@/lib/declarationCalculator";

function DeclarationField({
  label,
  id,
  sign,
  result,
}: {
  label: string;
  id: string;
  sign?: string;
  result?: FieldResult;
}) {
  const [open, setOpen] = useState(false);
  const hasValue = !!result && Math.abs(result.value) >= 0.5;
  const hasBreakdown = !!result && result.breakdown.length > 0;
  const displayValue = hasValue ? formatSEK(result!.value) : "";

  const inputEl = (
    <Input
      id={id}
      type="text"
      value={displayValue}
      readOnly
      className={`w-[140px] h-7 text-xs text-right font-mono bg-muted/30 border-border shrink-0 ${
        hasValue && hasBreakdown ? "cursor-pointer hover:bg-accent/30 hover:border-primary/40 transition-colors" : ""
      }`}
      onClick={(e) => {
        if (hasValue && hasBreakdown) {
          e.preventDefault();
          setOpen((o) => !o);
        }
      }}
    />
  );

  return (
    <div className="flex items-start justify-between gap-2 py-1.5 px-2 border-b border-border/50 last:border-b-0">
      <label htmlFor={id} className="text-xs text-foreground flex-1 pt-1">
        {label}
      </label>
      {sign && <span className="text-xs text-muted-foreground font-medium shrink-0">{sign}</span>}

      {hasValue && hasBreakdown ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{inputEl}</PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            sideOffset={6}
            className="w-[340px] p-0 shadow-lg border-primary/20"
            collisionPadding={16}
          >
            <div className="bg-primary/5 px-3 py-2 border-b border-border flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-foreground">Beräkning av {label.split(" ")[0]}</p>
                {result?.note && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{result.note}</p>
                )}
              </div>
            </div>
            <div className="max-h-[280px] overflow-y-auto">
              {result!.breakdown.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex justify-between gap-3 px-3 py-1.5 text-[11px] border-b border-border/40 last:border-b-0"
                >
                  <span className="text-foreground/80 truncate">{entry.label}</span>
                  <span className="font-mono text-foreground shrink-0">{formatSEK(entry.amount)}</span>
                </div>
              ))}
            </div>
            <div className="bg-muted/40 px-3 py-2 border-t border-border flex justify-between text-xs">
              <span className="font-semibold text-foreground">Summa</span>
              <span className="font-mono font-semibold text-primary">{formatSEK(result!.value)}</span>
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        inputEl
      )}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="bg-muted/50 px-3 py-1.5 border-b border-border">
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

function PageDivider({ pageNumber, title, subtitle }: { pageNumber: number; title: string; subtitle?: string }) {
  return (
    <div className="relative my-8">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t-2 border-dashed border-primary/30" />
      </div>
      <div className="relative flex justify-center">
        <div className="bg-background px-4 py-2 rounded-lg border-2 border-primary/30 shadow-sm">
          <div className="text-center">
            <span className="text-[10px] font-medium text-primary/60 uppercase tracking-wider">Sida {pageNumber}</span>
            <h2 className="text-sm font-bold text-foreground">{title}</h2>
            {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DeclarationPage() {
  const { user, activeCompany } = useAuth();
  const { vouchers, accounts } = useAccounting();

  const fields = useMemo(
    () => calculateDeclarationFields(vouchers, accounts),
    [vouchers, accounts]
  );

  const F = (id: string) => fields[id];

  if (!user) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
            <FileCheck className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Deklaration</h1>
          </div>
        </div>
        <section className="bg-primary/5 rounded-xl p-6 border border-primary/10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground mb-2">Logga in för att deklarera</h3>
              <Button size="sm" asChild>
                <Link to="/login">Logga in</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* ========== PAGE 1: Inkomstdeklaration 2 ========== */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold gradient-text">Inkomstdeklaration 2</h1>
        <p className="text-sm text-muted-foreground">Aktiebolag, ekonomisk förening m.fl.</p>
      </div>

      <div className="border border-border rounded-md p-3 bg-muted/20 flex flex-wrap gap-x-8 gap-y-1 text-xs text-foreground">
        <div>
          <span className="text-muted-foreground">Organisationsnummer: </span>
          <span className="font-medium">{activeCompany?.organizationNumber || "—"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Namn: </span>
          <span className="font-medium">{activeCompany?.companyName || "—"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Räkenskapsår: </span>
          <span className="font-medium">{activeCompany?.fiscalYearStart && activeCompany?.fiscalYearEnd ? `${activeCompany.fiscalYearStart} - ${activeCompany.fiscalYearEnd}` : "—"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <SectionCard title="Underlag för inkomstskatt">
            <DeclarationField label="1.1 Överskott av näringsverksamhet" id="f1_1" result={F("f1_1")} />
            <DeclarationField label="1.2 Underskott av näringsverksamhet" id="f1_2" result={F("f1_2")} />
          </SectionCard>
          <SectionCard title="Underlag för riskskatt">
            <DeclarationField label="1.3 Kreditinstituts underlag för riskskatt" id="f1_3" />
          </SectionCard>
          <SectionCard title="Underlag för särskild löneskatt">
            <DeclarationField label="1.4 Underlag för särskild löneskatt på pensionskostnader" id="f1_4" />
            <DeclarationField label="1.5 Negativt underlag för särskild löneskatt på pensionskostnader" id="f1_5" />
          </SectionCard>
          <SectionCard title="Underlag för avkastningsskatt">
            <DeclarationField label="1.6a Försäkringsföretag m.fl. samt avsatt till pensioner 15 %" id="f1_6a" />
            <DeclarationField label="1.6b Utländska pensionsförsäkringar 15 %" id="f1_6b" />
            <DeclarationField label="1.7a Försäkringsföretag m.fl. 30 %" id="f1_7a" />
            <DeclarationField label="1.7b Utländska kapitalförsäkringar 30 %" id="f1_7b" />
          </SectionCard>
        </div>
        <div className="space-y-4">
          <SectionCard title="Underlag för fastighetsavgift">
            <DeclarationField label="1.8 Småhus/ägarlägenhet" id="f1_8" />
            <DeclarationField label="1.9 Hyreshus: bostäder" id="f1_9" />
          </SectionCard>
          <SectionCard title="Underlag för fastighetsskatt">
            <DeclarationField label="1.10 Småhus/ägarlägenhet: tomtmark, byggnad under uppförande" id="f1_10" />
            <DeclarationField label="1.11 Hyreshus: tomtmark, bostäder under uppförande" id="f1_11" />
            <DeclarationField label="1.12 Hyreshus: lokaler" id="f1_12" />
            <DeclarationField label="1.13 Industrienhet och elproduktionsenhet: värmekraftverk" id="f1_13" />
            <DeclarationField label="1.14 Elproduktionsenhet: vattenkraftverk" id="f1_14" />
            <DeclarationField label="1.15 Elproduktionsenhet: vindkraftverk" id="f1_15" />
          </SectionCard>
          <SectionCard title="Underlag för skattereduktion">
            <DeclarationField label="1.16 Förnybar el (kilowattimmar)" id="f1_16" />
          </SectionCard>
        </div>
      </div>

      <div className="border border-border rounded-md p-4 space-y-3">
        <h3 className="text-xs font-semibold text-foreground">Underskrift</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">Behörig firmatecknares namnteckning</label>
            <Input className="h-7 text-xs bg-muted/30" readOnly />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">Namnförtydligande</label>
            <Input className="h-7 text-xs bg-muted/30" readOnly />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">Telefonnummer</label>
            <Input className="h-7 text-xs bg-muted/30" readOnly />
          </div>
        </div>
      </div>

      {/* ========== PAGE 3: Räkenskapsschema INK2R ========== */}
      <PageDivider pageNumber={3} title="Räkenskapsschema — INK2R" subtitle="Balansräkning" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <SectionCard title="Tillgångar — Immateriella anläggningstillgångar">
            <DeclarationField label="2.1 Koncessioner, patent, licenser, varumärken, hyresrätter, goodwill m.m." id="f2_1" result={F("f2_1")} />
            <DeclarationField label="2.2 Förskott avseende immateriella anläggningstillgångar" id="f2_2" result={F("f2_2")} />
          </SectionCard>
          <SectionCard title="Tillgångar — Materiella anläggningstillgångar">
            <DeclarationField label="2.3 Byggnader och mark" id="f2_3" result={F("f2_3")} />
            <DeclarationField label="2.4 Maskiner, inventarier och övriga materiella anläggningstillgångar" id="f2_4" result={F("f2_4")} />
            <DeclarationField label="2.5 Förbättringsutgifter på annans fastighet" id="f2_5" result={F("f2_5")} />
            <DeclarationField label="2.6 Pågående nyanläggningar och förskott avseende materiella anläggningstillgångar" id="f2_6" result={F("f2_6")} />
          </SectionCard>
          <SectionCard title="Tillgångar — Finansiella anläggningstillgångar">
            <DeclarationField label="2.7 Andelar i koncernföretag" id="f2_7" result={F("f2_7")} />
            <DeclarationField label="2.8 Fordringar hos koncernföretag" id="f2_8" result={F("f2_8")} />
            <DeclarationField label="2.9 Andelar i intresseföretag och gemensamt styrda företag" id="f2_9" result={F("f2_9")} />
            <DeclarationField label="2.10 Fordringar hos intresseföretag och gemensamt styrda företag" id="f2_10" result={F("f2_10")} />
            <DeclarationField label="2.11 Andelar i övriga företag som det finns ett ägarintresse i" id="f2_11" result={F("f2_11")} />
            <DeclarationField label="2.12 Fordringar hos övriga företag som det finns ett ägarintresse i" id="f2_12" result={F("f2_12")} />
            <DeclarationField label="2.13 Andra långfristiga värdepappersinnehav" id="f2_13" result={F("f2_13")} />
            <DeclarationField label="2.14 Lån till delägare eller närstående" id="f2_14" result={F("f2_14")} />
            <DeclarationField label="2.15 Andra långfristiga fordringar" id="f2_15" result={F("f2_15")} />
          </SectionCard>
          <SectionCard title="Tillgångar — Omsättningstillgångar">
            <DeclarationField label="2.16 Varulager m.m." id="f2_16" result={F("f2_16")} />
            <DeclarationField label="2.17 Kundfordringar" id="f2_17" result={F("f2_17")} />
            <DeclarationField label="2.18 Fordringar hos koncernföretag" id="f2_18" result={F("f2_18")} />
            <DeclarationField label="2.19 Fordringar hos intresseföretag och gemensamt styrda företag" id="f2_19" result={F("f2_19")} />
            <DeclarationField label="2.20 Fordringar hos övriga företag som det finns ett ägarintresse i" id="f2_20" result={F("f2_20")} />
            <DeclarationField label="2.21 Övriga fordringar" id="f2_21" result={F("f2_21")} />
            <DeclarationField label="2.22 Förutbetalda kostnader och upplupna intäkter" id="f2_22" result={F("f2_22")} />
            <DeclarationField label="2.23 Kortfristiga placeringar" id="f2_23" result={F("f2_23")} />
            <DeclarationField label="2.24 Övriga omsättningstillgångar" id="f2_24" result={F("f2_24")} />
          </SectionCard>
          <SectionCard title="Kassa och bank">
            <DeclarationField label="2.26 Kassa, bank och redovisningsmedel" id="f2_26" result={F("f2_26")} />
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Eget kapital">
            <DeclarationField label="2.27 Bundet eget kapital" id="f2_27" result={F("f2_27")} />
            <DeclarationField label="2.28 Fritt eget kapital" id="f2_28" result={F("f2_28")} />
          </SectionCard>
          <SectionCard title="Obeskattade reserver">
            <DeclarationField label="2.29 Periodiseringsfonder" id="f2_29" result={F("f2_29")} />
            <DeclarationField label="2.30 Ackumulerade överavskrivningar" id="f2_30" result={F("f2_30")} />
            <DeclarationField label="2.31 Övriga obeskattade reserver" id="f2_31" result={F("f2_31")} />
          </SectionCard>
          <SectionCard title="Avsättningar">
            <DeclarationField label="2.32 Avsättningar för pensioner och liknande förpliktelser enl. tryggandelagen" id="f2_32" result={F("f2_32")} />
            <DeclarationField label="2.33 Övriga avsättningar för pensioner och liknande förpliktelser" id="f2_33" result={F("f2_33")} />
            <DeclarationField label="2.34 Övriga avsättningar" id="f2_34" result={F("f2_34")} />
          </SectionCard>
          <SectionCard title="Skulder — Långfristiga">
            <DeclarationField label="2.35 Obligationslån" id="f2_35" result={F("f2_35")} />
            <DeclarationField label="2.36 Checkräkningskredit" id="f2_36" result={F("f2_36")} />
            <DeclarationField label="2.37 Övriga skulder till kreditinstitut" id="f2_37" result={F("f2_37")} />
            <DeclarationField label="2.38 Skulder till koncern-, intresse- och gemensamt styrda företag" id="f2_38" result={F("f2_38")} />
            <DeclarationField label="2.39 Skulder till övriga företag som det finns ett ägarintresse i och övriga skulder" id="f2_39" result={F("f2_39")} />
          </SectionCard>
          <SectionCard title="Skulder — Kortfristiga">
            <DeclarationField label="2.40 Checkräkningskredit" id="f2_40" result={F("f2_40")} />
            <DeclarationField label="2.41 Övriga skulder till kreditinstitut" id="f2_41" result={F("f2_41")} />
            <DeclarationField label="2.42 Förskott från kunder" id="f2_42" result={F("f2_42")} />
            <DeclarationField label="2.43 Pågående arbeten för annans räkning" id="f2_43" result={F("f2_43")} />
            <DeclarationField label="2.44 Fakturerad men ej upparbetad intäkt" id="f2_44" result={F("f2_44")} />
            <DeclarationField label="2.45 Leverantörsskulder" id="f2_45" result={F("f2_45")} />
            <DeclarationField label="2.46 Växelskulder" id="f2_46" result={F("f2_46")} />
            <DeclarationField label="2.47 Skulder till koncern-, intresse- och gemensamt styrda företag" id="f2_47" result={F("f2_47")} />
            <DeclarationField label="2.48 Skulder till övriga företag som det finns ett ägarintresse i och övriga skulder" id="f2_48" result={F("f2_48")} />
            <DeclarationField label="2.49 Skatteskulder" id="f2_49" result={F("f2_49")} />
            <DeclarationField label="2.50 Upplupna kostnader och förutbetalda intäkter" id="f2_50" result={F("f2_50")} />
          </SectionCard>
        </div>
      </div>

      {/* ========== PAGE 4: Resultaträkning INK2R ========== */}
      <PageDivider pageNumber={4} title="Räkenskapsschema — INK2R" subtitle="Resultaträkning" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <SectionCard title="Rörelseintäkter">
            <DeclarationField label="3.1 Nettoomsättning" id="f3_1" sign="+" result={F("f3_1")} />
            <DeclarationField label="3.2 Förändring av lager av produkter i arbete, färdiga varor och pågående arbete" id="f3_2" sign="+" result={F("f3_2")} />
            <DeclarationField label="3.3 Aktiverat arbete för egen räkning" id="f3_3" sign="+" result={F("f3_3")} />
            <DeclarationField label="3.4 Övriga rörelseintäkter" id="f3_4" sign="+" result={F("f3_4")} />
          </SectionCard>
          <SectionCard title="Rörelsekostnader">
            <DeclarationField label="3.5 Råvaror och förnödenheter" id="f3_5" sign="−" result={F("f3_5")} />
            <DeclarationField label="3.6 Handelsvaror" id="f3_6" sign="−" result={F("f3_6")} />
            <DeclarationField label="3.7 Övriga externa kostnader" id="f3_7" sign="−" result={F("f3_7")} />
            <DeclarationField label="3.8 Personalkostnader" id="f3_8" sign="−" result={F("f3_8")} />
            <DeclarationField label="3.9 Av- och nedskrivningar av materiella och immateriella anläggningstillgångar" id="f3_9" sign="−" result={F("f3_9")} />
            <DeclarationField label="3.10 Nedskrivningar av omsättningstillgångar utöver normala nedskrivningar" id="f3_10" sign="−" result={F("f3_10")} />
            <DeclarationField label="3.11 Övriga rörelsekostnader" id="f3_11" sign="−" result={F("f3_11")} />
          </SectionCard>
          <SectionCard title="Finansiella poster">
            <DeclarationField label="3.12 Resultat från andelar i koncernföretag" id="f3_12" sign="±" result={F("f3_12")} />
            <DeclarationField label="3.13 Resultat från andelar i intresseföretag och gemensamt styrda företag" id="f3_13" sign="±" result={F("f3_13")} />
            <DeclarationField label="3.14 Resultat från övriga företag som det finns ett ägarintresse i" id="f3_14" sign="±" result={F("f3_14")} />
            <DeclarationField label="3.15 Resultat från övriga finansiella anläggningstillgångar" id="f3_15" sign="±" result={F("f3_15")} />
          </SectionCard>
        </div>
        <div className="space-y-4">
          <SectionCard title="Finansiella poster (forts.)">
            <DeclarationField label="3.16 Övriga ränteintäkter och liknande resultatposter" id="f3_16" sign="+" result={F("f3_16")} />
            <DeclarationField label="3.17 Nedskrivningar av finansiella anläggningstillgångar och kortfristiga placeringar" id="f3_17" sign="−" result={F("f3_17")} />
            <DeclarationField label="3.18 Räntekostnader och liknande resultatposter" id="f3_18" sign="−" result={F("f3_18")} />
          </SectionCard>
          <SectionCard title="Koncernbidrag">
            <DeclarationField label="3.19 Lämnade koncernbidrag" id="f3_19" sign="−" result={F("f3_19")} />
            <DeclarationField label="3.20 Mottagna koncernbidrag" id="f3_20" sign="+" result={F("f3_20")} />
          </SectionCard>
          <SectionCard title="Bokslutsdispositioner">
            <DeclarationField label="3.21 Återföring av periodiseringsfond" id="f3_21" sign="+" result={F("f3_21")} />
            <DeclarationField label="3.22 Avsättning till periodiseringsfond" id="f3_22" sign="−" result={F("f3_22")} />
            <DeclarationField label="3.23 Förändring av överavskrivningar" id="f3_23" sign="±" result={F("f3_23")} />
            <DeclarationField label="3.24 Övriga bokslutsdispositioner" id="f3_24" sign="±" result={F("f3_24")} />
          </SectionCard>
          <SectionCard title="Årets resultat">
            <DeclarationField label="3.25 Skatt på årets resultat" id="f3_25" sign="−" result={F("f3_25")} />
            <DeclarationField label="3.26 Årets resultat, vinst (→ 4.1)" id="f3_26" sign="+" result={F("f3_26")} />
            <DeclarationField label="3.27 Årets resultat, förlust (→ 4.2)" id="f3_27" sign="−" result={F("f3_27")} />
          </SectionCard>
        </div>
      </div>

      {/* ========== PAGE 5: Skattemässiga justeringar INK2S ========== */}
      <PageDivider pageNumber={5} title="Skattemässiga justeringar — INK2S" subtitle="Inkomstdeklaration 2" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <SectionCard title="Årets resultat">
            <DeclarationField label="4.1 Årets resultat, vinst" id="f4_1" sign="+" result={F("f4_1")} />
            <DeclarationField label="4.2 Årets resultat, förlust" id="f4_2" sign="−" result={F("f4_2")} />
          </SectionCard>
          <SectionCard title="4.3 Bokförda kostnader som inte ska dras av">
            <DeclarationField label="a. Skatt på årets resultat" id="f4_3a" sign="+" result={F("f4_3a")} />
            <DeclarationField label="b. Nedskrivning av finansiella tillgångar" id="f4_3b" sign="+" />
            <DeclarationField label="c. Andra bokförda kostnader" id="f4_3c" sign="+" />
          </SectionCard>
          <SectionCard title="4.4 Kostnader som ska dras av men som inte ingår i det redovisade resultatet">
            <DeclarationField label="a. Lämnade koncernbidrag" id="f4_4a" sign="−" />
            <DeclarationField label="b. Andra ej bokförda kostnader" id="f4_4b" sign="−" />
          </SectionCard>
          <SectionCard title="4.5 Bokförda intäkter som inte ska tas upp">
            <DeclarationField label="a. Ackordsvinster" id="f4_5a" sign="−" />
            <DeclarationField label="b. Utdelning" id="f4_5b" sign="−" />
            <DeclarationField label="c. Andra bokförda intäkter" id="f4_5c" sign="−" />
          </SectionCard>
          <SectionCard title="4.6 Intäkter som ska tas upp men som inte ingår i det redovisade resultatet">
            <DeclarationField label="a. Beräknad schablonintäkt på periodiseringsfonder" id="f4_6a" sign="+" />
            <DeclarationField label="b. Beräknad schablonintäkt på fondandelar" id="f4_6b" sign="+" />
            <DeclarationField label="c. Mottagna koncernbidrag" id="f4_6c" sign="+" />
            <DeclarationField label="d. Uppräknat belopp vid återföring av periodiseringsfond" id="f4_6d" sign="+" />
            <DeclarationField label="e. Andra ej bokförda intäkter" id="f4_6e" sign="+" />
          </SectionCard>
        </div>
        <div className="space-y-4">
          <SectionCard title="4.7 Avyttring av delägarrätter">
            <DeclarationField label="a. Bokförd vinst" id="f4_7a" sign="−" />
            <DeclarationField label="b. Bokförd förlust" id="f4_7b" sign="+" />
            <DeclarationField label="c. Uppskov med kapitalvinst enl. blankett N4" id="f4_7c" sign="−" />
            <DeclarationField label="d. Återfört uppskov av kapitalvinst enl. blankett N4" id="f4_7d" sign="+" />
            <DeclarationField label="e. Kapitalvinst för beskattningsåret" id="f4_7e" sign="+" />
            <DeclarationField label="f. Kapitalförlust som ska dras av" id="f4_7f" sign="−" />
          </SectionCard>
          <SectionCard title="4.8 Andel i handelsbolag (inkl. avyttring)">
            <DeclarationField label="a. Bokförd intäkt/vinst" id="f4_8a" sign="−" />
            <DeclarationField label="b. Skattemässigt överskott enl. N3B" id="f4_8b" sign="+" />
            <DeclarationField label="c. Bokförd kostnad/förlust" id="f4_8c" sign="+" />
            <DeclarationField label="d. Skattemässigt underskott enl. N3B" id="f4_8d" sign="−" />
          </SectionCard>
          <SectionCard title="Övriga justeringar">
            <DeclarationField label="4.9 Skattemässig justering av bokfört resultat för avskrivning på byggnader m.m." id="f4_9" sign="±" />
            <DeclarationField label="4.10 Skattemässig justering vid avyttring av näringsfastighet/näringsbostadsrätt" id="f4_10" sign="±" />
            <DeclarationField label="4.11 Skogs-/substansminskningsavdrag (blankett N8)" id="f4_11" sign="−" />
            <DeclarationField label="4.12 Återföringar vid avyttring av fastighet" id="f4_12" sign="+" />
          </SectionCard>
          <SectionCard title="4.14 Underskott">
            <DeclarationField label="a. Outnyttjat underskott från föregående år" id="f4_14a" sign="−" />
            <DeclarationField label="b. Reduktion av outnyttjat underskott med hänsyn till beloppsspärr, ackord, konkurs m.m." id="f4_14b" sign="+" />
            <DeclarationField label="c. Reduktion av outnyttjat underskott med hänsyn till koncernbidragsspärr, fusionsspärr m.m. (beloppet ska också tas upp vid p. 1.2 på sid. 1)" id="f4_14c" sign="+" />
          </SectionCard>
          <SectionCard title="Resultat efter skattemässiga justeringar">
            <DeclarationField label="4.15 Överskott (flyttas till p. 1.1 på sid. 1)" id="f4_15" sign="+" result={F("f4_15")} />
            <DeclarationField label="4.16 Underskott (flyttas till p. 1.2 på sid. 1)" id="f4_16" sign="−" result={F("f4_16")} />
          </SectionCard>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <SectionCard title="Övriga uppgifter">
            <DeclarationField label="4.17 Årets begärda och tidigare års medgivna värdeminskningsavdrag som finns vid beskattningsårets utgång avseende byggnader" id="f4_17" />
            <DeclarationField label="4.18 Årets begärda och tidigare års medgivna värdeminskningsavdrag som finns vid beskattningsårets utgång avseende markanläggningar" id="f4_18" />
            <DeclarationField label="4.19 Vid restvärdesavskrivning: återförda belopp för av- och nedskrivning, försäljning, utrangering" id="f4_19" />
          </SectionCard>
        </div>
        <div className="space-y-4">
          <SectionCard title="Övriga uppgifter (forts.)">
            <DeclarationField label="4.20 Lån från aktieägare (fysisk person) vid beskattningsårets utgång" id="f4_20" />
            <DeclarationField label="4.21 Pensionskostnader (som ingår i p. 3.8)" id="f4_21" />
            <DeclarationField label="4.22 Koncernbidragsspärrat och fusionsspärrat underskott m.m. (frivillig uppgift)" id="f4_22" />
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Upplysningar om årsredovisningen">
        <div className="px-3 py-2.5 border-b border-border/50">
          <p className="text-xs text-foreground mb-2">Uppdragstagare (t.ex. redovisningskonsult) har biträtt vid upprättandet av årsredovisningen</p>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
              <input type="radio" name="uppdragstagare" className="h-3 w-3 accent-primary" />
              Ja
            </label>
            <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
              <input type="radio" name="uppdragstagare" className="h-3 w-3 accent-primary" />
              Nej
            </label>
          </div>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-xs text-foreground mb-2">Årsredovisningen har varit föremål för revision</p>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
              <input type="radio" name="revision" className="h-3 w-3 accent-primary" />
              Ja
            </label>
            <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
              <input type="radio" name="revision" className="h-3 w-3 accent-primary" />
              Nej
            </label>
          </div>
        </div>
      </SectionCard>

      <p className="text-[10px] text-muted-foreground mt-4">
        Klicka på en ifylld ruta för att se vilka konton eller fält som har räknats ihop.
      </p>
    </div>
  );
}
