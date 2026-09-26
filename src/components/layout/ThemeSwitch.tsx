import { useId } from "react";
import { Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";

export function ThemeSwitch() {
  const id = useId();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="flex shrink-0 items-center gap-2 text-sm">
      <Sun className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <label htmlFor={id} className="cursor-pointer text-muted-foreground">Ljust läge</label>
      <Switch id={id} checked={resolvedTheme === "light"} onCheckedChange={(light) => setTheme(light ? "light" : "dark")} />
    </div>
  );
}
