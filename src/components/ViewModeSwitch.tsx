import { useViewMode } from "@/contexts/ViewModeContext";
import { Smartphone, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Floating switch (top center) to toggle between mobile and desktop view.
 * Visible on every page so the user can preview either layout from any device.
 */
export function ViewModeSwitch() {
  const { isMobile, setMode } = useViewMode();

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto">
      <div className="flex items-center gap-1 rounded-full border border-border bg-card/90 backdrop-blur-md shadow-lg p-1">
        <button
          type="button"
          onClick={() => setMode("desktop")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors",
            !isMobile
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-pressed={!isMobile}
          aria-label="Switch to desktop view"
        >
          <Monitor className="h-3.5 w-3.5" />
          Desktop
        </button>
        <button
          type="button"
          onClick={() => setMode("mobile")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors",
            isMobile
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-pressed={isMobile}
          aria-label="Switch to mobile view"
        >
          <Smartphone className="h-3.5 w-3.5" />
          Mobil
        </button>
      </div>
    </div>
  );
}
