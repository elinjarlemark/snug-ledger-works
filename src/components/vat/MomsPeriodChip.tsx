import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type MomsPeriodStatus = "pagaende" | "klar" | "last";

interface Props {
  status: MomsPeriodStatus;
  className?: string;
}

const LABELS: Record<MomsPeriodStatus, string> = {
  pagaende: "Pågående",
  klar: "Klar att granska",
  last: "Låst",
};

export function MomsPeriodChip({ status, className }: Props) {
  const styles: Record<MomsPeriodStatus, string> = {
    pagaende: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    klar: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    last: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn(styles[status], className)}>
      {LABELS[status]}
    </Badge>
  );
}
