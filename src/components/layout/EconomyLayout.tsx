import { useEffect } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { useUnlockOnTabClose } from "@/hooks/useUnlockOnTabClose";

export function EconomyLayout() {
  useInactivityLogout();
  useUnlockOnTabClose();
  const { user, hasValidCompany, isLoading } = useAuth();
  const navigate = useNavigate();

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
