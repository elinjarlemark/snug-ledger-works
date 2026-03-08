import { FileCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";

function DeclarationField({ label, id }: { label: string; id: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 px-2 border-b border-border/50 last:border-b-0">
      <label htmlFor={id} className="text-xs text-foreground shrink-0">
        {label}
      </label>
      <Input
        id={id}
        type="text"
        className="w-[140px] h-7 text-xs text-right font-mono bg-muted/30 border-border"
        readOnly
      />
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="bg-muted/50 px-3 py-1.5 border-b border-border">
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function DeclarationPage() {
  const { user, companyProfile } = useAuth();

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
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
          <FileCheck className="h-5 w-5 text-secondary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Inkomstdeklaration 2</h1>
          <p className="text-xs text-muted-foreground">Aktiebolag, ekonomisk förening m.fl.</p>
        </div>
      </div>

      {/* Company info bar */}
      <div className="border border-border rounded-md p-3 bg-muted/20 flex flex-wrap gap-x-8 gap-y-1 text-xs text-foreground">
        <div>
          <span className="text-muted-foreground">Organisationsnummer: </span>
          <span className="font-medium">{companyProfile?.orgNumber || "—"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Namn: </span>
          <span className="font-medium">{companyProfile?.name || "—"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Räkenskapsår: </span>
          <span className="font-medium">{companyProfile?.fiscalYear || "—"}</span>
        </div>
      </div>

      {/* Main form grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          <SectionCard title="Underlag för inkomstskatt">
            <DeclarationField label="1.1 Överskott av näringsverksamhet" id="f1_1" />
            <DeclarationField label="1.2 Underskott av näringsverksamhet" id="f1_2" />
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

        {/* Right column */}
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
        </div>
      </div>

      {/* Signature section */}
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

      <p className="text-[10px] text-muted-foreground">
        Ange belopp i hela kronor. Fälten kopplas till bokföringen i ett senare steg.
      </p>
    </div>
  );
}
