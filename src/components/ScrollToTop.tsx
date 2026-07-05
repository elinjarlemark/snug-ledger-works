import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const isAppShellRoute =
      pathname === "/settings" ||
      pathname === "/audit-trail" ||
      pathname === "/admin" ||
      pathname.startsWith("/economy");

    if (isAppShellRoute) return;

    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
