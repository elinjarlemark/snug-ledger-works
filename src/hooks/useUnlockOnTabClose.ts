import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/auth";

const API_BASE =
  ((import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");

export function useUnlockOnTabClose() {
  const { user, activeCompany } = useAuth();

  useEffect(() => {
    if (!authService.isDatabaseConnected()) return;
    if (!user?.id) return;
    if (!activeCompany?.id) return;

    const companyId = String(activeCompany.id);
    const userId = Number(user.id);

    const handler = () => {
      try {
        const url = API_BASE + "/companies/" + companyId + "/unlock";
        const payload = JSON.stringify({ user_id: userId });

        navigator.sendBeacon(
          url,
          new Blob([payload], { type: "application/json" })
        );
      } catch {
        // best-effort
      }
    };

    // pagehide triggas när fliken stängs/navigerar bort/bfcache
    window.addEventListener("pagehide", handler);

    // fallback för vissa browsers
    window.addEventListener("beforeunload", handler);

    return () => {
      window.removeEventListener("pagehide", handler);
      window.removeEventListener("beforeunload", handler);
    };
  }, [user?.id, activeCompany?.id]);
}