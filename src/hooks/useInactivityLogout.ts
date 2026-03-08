import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { unlockCompany } from "@/lib/api";
import { authService } from "@/services/auth";

const INACTIVITY_MS = 1 * 60 * 1000; // 5 min

export function useInactivityLogout() {
  const navigate = useNavigate();
  const { user, activeCompany, logout } = useAuth();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;

    const resetTimer = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(async () => {
        // Best-effort unlock
        if (authService.isDatabaseConnected() && user && activeCompany?.id) {
          try {
            await unlockCompany(activeCompany.id, user.id);
          } catch {}
        }

        logout();
        navigate("/login");
      }, INACTIVITY_MS);
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    resetTimer(); // starta direkt

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer as any));
    };
  }, [user, activeCompany?.id, logout, navigate]);
}