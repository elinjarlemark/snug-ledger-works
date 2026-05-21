import { useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { useUnlockOnTabClose } from "@/hooks/useUnlockOnTabClose";

export function EconomyLayout() {
  useInactivityLogout();
  useUnlockOnTabClose();
  const { user, hasValidCompany, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/economy/accounting") {
      const forceScrollTop = () => {
        window.scrollTo({ top: 0, behavior: "instant" });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      };
      forceScrollTop();
      const frame = requestAnimationFrame(forceScrollTop);
      return () => cancelAnimationFrame(frame);
    }
  }, [location.key, location.pathname]);

  useEffect(() => {
    if (!isLoading && user && !hasValidCompany) {
      navigate("/settings", { replace: true, state: { showCompanyRequiredAlert: true } });
    }
  }, [user, hasValidCompany, isLoading, navigate]);

  if (!isLoading && user && !hasValidCompany) {
    return null;
  }

  return <Outlet />;
}
