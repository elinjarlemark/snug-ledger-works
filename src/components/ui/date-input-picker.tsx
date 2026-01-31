import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateInputPickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DateInputPicker({
  date,
  onDateChange,
  placeholder = "YYYY-MM-DD",
  className,
}: DateInputPickerProps) {
  const [inputValue, setInputValue] = React.useState(
    date ? format(date, "yyyy-MM-dd") : ""
  );
  const [open, setOpen] = React.useState(false);

  // Sync input value when date prop changes externally
  React.useEffect(() => {
    setInputValue(date ? format(date, "yyyy-MM-dd") : "");
  }, [date]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Try to parse the date
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    if (isValid(parsed) && value.length === 10) {
      onDateChange(parsed);
    }
  };

  const handleInputBlur = () => {
    // On blur, if the input is invalid, reset to the current date
    const parsed = parse(inputValue, "yyyy-MM-dd", new Date());
    if (!isValid(parsed) || inputValue.length !== 10) {
      if (date) {
        setInputValue(format(date, "yyyy-MM-dd"));
      } else {
        setInputValue("");
      }
    }
  };

  const handleCalendarSelect = (selectedDate: Date | undefined) => {
    onDateChange(selectedDate);
    if (selectedDate) {
      setInputValue(format(selectedDate, "yyyy-MM-dd"));
    }
    setOpen(false);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        className="w-[120px] h-9 text-sm"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleCalendarSelect}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
