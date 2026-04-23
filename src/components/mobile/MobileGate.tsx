import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Redirects mobile users to the dedicated mobile flow.
 * - Unauthenticated mobile users on public pages -> /mobile
 * - Authenticated mobile users on any non-mobile/non-login route -> /mobile/upload
 * Desktop users are unaffected.
 */
export function MobileGate() {
  const isMobile = useIsMobile();
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isMobile || isLoading) return;

    const path = location.pathname;
    const isMobileRoute = path.startsWith("/mobile");
    const isLoginRoute = path === "/login" || path === "/company-gate";

    if (user) {
      // Logged-in mobile user: only allow mobile routes
      if (!isMobileRoute) {
        navigate("/mobile/upload", { replace: true });
      }
    } else {
      // Anonymous mobile user: redirect away from desktop pages to mobile landing
      if (!isMobileRoute && !isLoginRoute) {
        navigate("/mobile", { replace: true });
      }
    }
  }, [isMobile, user, isLoading, location.pathname, navigate]);

  return null;
}
