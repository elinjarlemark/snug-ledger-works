import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { VatWarning } from "@/lib/vat/validation";

interface Props {
  warnings: VatWarning[];
  title?: string;
  className?: string;
}

export function VarningKort({ warnings, title = "Varningar", className }: Props) {
  if (warnings.length === 0) return null;
  return (
    <div className={cn("rounded-lg border bg-card p-4 space-y-2", className)}>
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <ul className="space-y-1.5">
        {warnings.map((w, i) => {
          const Icon = w.severity === "error" ? AlertCircle : w.severity === "warning" ? AlertTriangle : Info;
          const color =
            w.severity === "error"
              ? "text-destructive"
              : w.severity === "warning"
              ? "text-amber-600"
              : "text-muted-foreground";
          return (
            <li key={i} className={cn("flex items-start gap-2 text-xs", color)}>
              <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                {w.message}
                {w.context && <span className="text-muted-foreground ml-1">({w.context})</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
