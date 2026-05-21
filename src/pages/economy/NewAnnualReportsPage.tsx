import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Lock, RefreshCw, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  type AnnualReportQuestionField,
  type AnnualReportQuestionSchema,
  scriptService,
} from "@/services/scripts/scriptService";

type FormValue = string | boolean;
type FormState = Record<string, FormValue>;

const DRAFT_KEY = "annual-report-v7-form-draft";

const makeInitialState = (schema: AnnualReportQuestionSchema): FormState => {
  const initial: FormState = {};

  for (const field of schema.fields) {
    initial[field.id] = field.kind === "bool" ? false : "";
  }

  for (const repeater of schema.repeaters) {
    if (repeater.kind === "signatories" && repeater.countField) {
      initial[repeater.countField.id] = "2";
    }
  }

  return initial;
};

const sectionCardDescription: Record<string, string> = {
  general: "Grunduppgifter och upplysningar som v7 frågar efter innan själva årsredovisningen byggs.",
  k2: "Kontroller som avgör om processen får fortsätta som K2-årsredovisning.",
  history: "Manuella uppgifter för flerårsöversikten, hämtade från v7-formatet.",
  signatures: "Underskrifter som ska finnas med i dokumentet.",
};

const replaceTemplateTokens = (label: string, replacements: Record<string, string | number>) => {
  return label.replace(/\{(\w+)\}/g, (_, key: string) => String(replacements[key] ?? `{${key}}`));
};

export default function NewAnnualReportsPage() {
  const { user } = useAuth();
  const [schema, setSchema] = useState<AnnualReportQuestionSchema | null>(null);
  const [formValues, setFormValues] = useState<FormState>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSchema = async (showToast = false) => {
    try {
      setError(null);
      setRefreshing(true);
      const nextSchema = await scriptService.fetchAnnualReportQuestionSchema();
      setSchema(nextSchema);
      setFormValues((current) => {
        const base = makeInitialState(nextSchema);
        const draft = (() => {
          try {
            return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}");
          } catch {
            return {};
          }
        })();
        return { ...base, ...draft, ...current };
      });
      if (showToast) {
        toast.success("Frågorna hämtades på nytt från v7.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kunde inte läsa frågorna från v7.";
      setError(message);
      if (showToast) {
        toast.error(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void loadSchema();
  }, [user]);

  useEffect(() => {
    if (!schema) {
      return;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(formValues));
  }, [formValues, schema]);

  const updateValue = (key: string, value: FormValue) => {
    setFormValues((current) => ({ ...current, [key]: value }));
  };

  const reportYear = useMemo(() => {
    const reportStart = String(formValues.report_start ?? "").trim();
    if (/^\d{4}/.test(reportStart)) {
      return Number(reportStart.slice(0, 4));
    }
    return new Date().getFullYear();
  }, [formValues.report_start]);

  const visibleFieldsBySection = useMemo(() => {
    const map = new Map<string, AnnualReportQuestionField[]>();
    if (!schema) {
      return map;
    }

    for (const section of schema.sectionOrder) {
      map.set(section, []);
    }

    for (const field of schema.fields) {
      const isVisible = !field.dependsOn || formValues[field.dependsOn.field] === field.dependsOn.value;
      if (!isVisible) {
        continue;
      }
      const bucket = map.get(field.section) ?? [];
      bucket.push(field);
      map.set(field.section, bucket);
    }

    return map;
  }, [formValues, schema]);

  const clearDraft = () => {
    if (!schema) {
      return;
    }
    localStorage.removeItem(DRAFT_KEY);
    setFormValues(makeInitialState(schema));
    toast.success("Formuläret återställdes.");
  };

  const renderField = (field: AnnualReportQuestionField, key: string, label = field.label) => {
    const value = formValues[key];
    const inputType = field.widget === "date" ? "date" : field.kind === "int" || field.kind === "number" ? "number" : "text";

    if (field.kind === "bool") {
      return (
        <div key={key} className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-background/70 px-4 py-3">
          <div className="space-y-1">
            <Label htmlFor={key} className="text-sm font-medium leading-5">{label}</Label>
          </div>
          <Switch id={key} checked={Boolean(value)} onCheckedChange={(checked) => updateValue(key, checked)} />
        </div>
      );
    }

    if (field.kind === "select") {
      return (
        <div key={key} className="space-y-2">
          <Label htmlFor={key}>{label}</Label>
          <Select value={String(value ?? "")} onValueChange={(next) => updateValue(key, next)}>
            <SelectTrigger id={key}>
              <SelectValue placeholder="Välj" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.widget === "textarea") {
      return (
        <div key={key} className="space-y-2 md:col-span-2">
          <Label htmlFor={key}>{label}</Label>
          <Textarea id={key} value={String(value ?? "")} onChange={(event) => updateValue(key, event.target.value)} />
        </div>
      );
    }

    return (
      <div key={key} className="space-y-2">
        <Label htmlFor={key}>{label}</Label>
        <Input
          id={key}
          type={inputType}
          step={field.kind === "number" ? "0.001" : "1"}
          value={String(value ?? "")}
          onChange={(event) => updateValue(key, event.target.value)}
        />
      </div>
    );
  };

  if (!user) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Annual Reports</h1>
          </div>
        </div>

        <section className="bg-primary/5 rounded-xl p-8 border border-primary/10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-2">Create Annual Reports</h3>
              <Button asChild>
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold gradient-text">Annual Reports</h1>
          <p className="text-sm text-muted-foreground">
            Den här sidan läser nu frågorna direkt från v7 och låter användaren fylla i dem här. SIE-koppling och DOCX-generering kopplar vi på i nästa steg.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadSchema(true)} disabled={refreshing} className="gap-2">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Hämta om v7-frågor
          </Button>
          <Button variant="ghost" onClick={clearDraft} disabled={!schema} className="gap-2">
            <Trash2 className="h-4 w-4" />
            Rensa utkast
          </Button>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Så fungerar det nu</CardTitle>
          <CardDescription>
            Formuläret byggs från {schema?.source ?? "v7"} via backend i stället för att frågorna hårdkodas i React. Om vi ändrar v7 kan sidan hämta om frågorna.
          </CardDescription>
        </CardHeader>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Läser frågorna från v7...
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-destructive/30">
          <CardContent className="py-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {!loading && schema ? (
        <div className="space-y-6">
          {schema.sectionOrder.map((section) => {
            const sectionFields = visibleFieldsBySection.get(section) ?? [];
            const sectionRepeaters = schema.repeaters.filter((repeater) => repeater.section === section);
            if (!sectionFields.length && !sectionRepeaters.length) {
              return null;
            }

            return (
              <Card key={section}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{schema.sectionLabels[section] ?? section}</CardTitle>
                  <CardDescription>{sectionCardDescription[section] ?? ""}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {sectionFields.length ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {sectionFields.map((field) => renderField(field, field.id))}
                    </div>
                  ) : null}

                  {sectionRepeaters.map((repeater) => {
                    if (repeater.kind === "year_history") {
                      const yearsBack = repeater.yearsBack ?? [2, 3];
                      return (
                        <div key={repeater.id} className="space-y-4">
                          <Separator />
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">{repeater.label}</h3>
                            <p className="text-sm text-muted-foreground">
                              Formuläret använder rapportåret för att visa rätt historiska år. Om du fyller i rapportperiod start uppdateras rubrikerna här.
                            </p>
                          </div>
                          <div className="space-y-4">
                            {yearsBack.map((yearsBackValue) => {
                              const year = reportYear - yearsBackValue;
                              return (
                                <div key={`${repeater.id}-${year}`} className="space-y-4 rounded-xl border border-border/60 p-4">
                                  <h4 className="font-medium text-foreground">År {year}</h4>
                                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {repeater.fields.map((field) => {
                                      const label = replaceTemplateTokens(field.label, { year });
                                      const key = `${repeater.id}.${year}.${field.id}`;
                                      return renderField(field, key, label);
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    if (repeater.kind === "signatories") {
                      const countKey = repeater.countField?.id ?? "board_member_count";
                      const signerCount = Math.max(1, Number(formValues[countKey] || "2") || 2);
                      return (
                        <div key={repeater.id} className="space-y-4">
                          <Separator />
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">{repeater.label}</h3>
                            <p className="text-sm text-muted-foreground">
                              Antalet underskrifter styr hur många signatärrader som visas här.
                            </p>
                          </div>
                          {repeater.countField ? (
                            <div className="max-w-xs">
                              {renderField(repeater.countField, countKey)}
                            </div>
                          ) : null}
                          <div className="space-y-4">
                            {Array.from({ length: signerCount }).map((_, index) => (
                              <div key={`${repeater.id}-${index}`} className="space-y-4 rounded-xl border border-border/60 p-4">
                                <h4 className="font-medium text-foreground">Underskrift {index + 1}</h4>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                  {repeater.fields.map((field) => {
                                    const label = replaceTemplateTokens(field.label, { index: index + 1 });
                                    const key = `${repeater.id}.${index}.${field.id}`;
                                    return renderField(field, key, label);
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
