import { useVat } from "@/contexts/VatContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getActiveVatCodes, VatCodeType } from "@/lib/vat/codes";

interface MomskodDropdownProps {
  value?: string;
  onChange: (codeId: string | undefined) => void;
  filter?: VatCodeType | "all";
  className?: string;
  placeholder?: string;
  allowEmpty?: boolean;
}

export function MomskodDropdown({ value, onChange, filter = "all", className, placeholder = "Välj momskod...", allowEmpty = true }: MomskodDropdownProps) {
  const { vatCodes } = useVat();
  let active = getActiveVatCodes(vatCodes);
  if (filter === "utgaende") active = active.filter((c) => c.typ === "utgaende" || c.typ === "bada");
  if (filter === "ingaende") active = active.filter((c) => c.typ === "ingaende" || c.typ === "bada");

  return (
    <Select
      value={value || "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? undefined : v)}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value="__none__">Ingen momskod</SelectItem>}
        {active.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="font-mono mr-2">{c.code}</span>
            <span>{c.namn}</span>
            {c.sats > 0 && <span className="text-muted-foreground ml-1">({c.sats}%)</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
