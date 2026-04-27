import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useIsMobile as useDeviceIsMobile } from "@/hooks/use-mobile";

export type ViewMode = "auto" | "mobile" | "desktop";

interface ViewModeContextValue {
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
  /** Effective mobile state, taking the user override into account. */
  isMobile: boolean;
  /** True device detection (ignores override). */
  deviceIsMobile: boolean;
}

const STORAGE_KEY = "accountpro_view_mode";

const ViewModeContext = createContext<ViewModeContextValue | undefined>(undefined);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const deviceIsMobile = useDeviceIsMobile();
  const [mode, setModeState] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "auto";
    const stored = window.localStorage.getItem(STORAGE_KEY) as ViewMode | null;
    return stored === "mobile" || stored === "desktop" || stored === "auto" ? stored : "auto";
  });

  const setMode = (m: ViewMode) => {
    setModeState(m);
    try {
      window.localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  const isMobile = useMemo(() => {
    if (mode === "mobile") return true;
    if (mode === "desktop") return false;
    return deviceIsMobile;
  }, [mode, deviceIsMobile]);

  // Reflect simulated mobile on the document so any pure-CSS hooks can react too.
  useEffect(() => {
    const root = document.documentElement;
    if (mode === "mobile") root.setAttribute("data-view-mode", "mobile");
    else if (mode === "desktop") root.setAttribute("data-view-mode", "desktop");
    else root.removeAttribute("data-view-mode");
  }, [mode]);

  return (
    <ViewModeContext.Provider value={{ mode, setMode, isMobile, deviceIsMobile }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error("useViewMode must be used within ViewModeProvider");
  return ctx;
}

/** Drop-in replacement for useIsMobile that respects user override. */
export function useEffectiveIsMobile() {
  const ctx = useContext(ViewModeContext);
  // Fallback: if provider not mounted (shouldn't happen), use device detection.
  const device = useDeviceIsMobile();
  return ctx ? ctx.isMobile : device;
}
