import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface YearSelectorProps {
  value: number;
  onChange: (year: number) => void;
  className?: string;
}

export function YearSelector({ value, onChange, className }: YearSelectorProps) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <Select value={value.toString()} onValueChange={(val) => onChange(parseInt(val))}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select year" />
      </SelectTrigger>
      <SelectContent className="bg-popover">
        {years.map((year) => (
          <SelectItem key={year} value={year.toString()}>
            {year === currentYear ? `${year} (Current)` : year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
