import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounting } from "@/contexts/AccountingContext";

interface YearSelectorProps {
  value?: number;
  onChange: (year: number | undefined) => void;
  className?: string;
}

export function YearSelector({ value, onChange, className }: YearSelectorProps) {
  const { vouchers } = useAccounting();
  const currentYear = new Date().getFullYear();

  const years = useMemo(() => {
    const yearSet = new Set<number>([currentYear]);
    vouchers.forEach((v) => {
      const y = new Date(v.date).getFullYear();
      if (!isNaN(y)) yearSet.add(y);
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [vouchers, currentYear]);

  return (
    <Select
      value={value?.toString() || ""}
      onValueChange={(val) => onChange(val ? parseInt(val) : undefined)}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select year" />
      </SelectTrigger>
      <SelectContent className="bg-popover">
        {years.map((year) => (
          <SelectItem key={year} value={year.toString()}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
