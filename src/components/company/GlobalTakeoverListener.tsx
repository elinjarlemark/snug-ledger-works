import { authService } from "@/services/auth";
import { useAuth } from "@/contexts/AuthContext";
import { TakeoverListener } from "@/components/company/TakeoverListener";

export function GlobalTakeoverListener() {
  const { user, activeCompany } = useAuth();

  if (!authService.isDatabaseConnected() || !user || !activeCompany) {
    return null;
  }

  return (
    <TakeoverListener
      companyId={activeCompany.id}
      userId={Number(user.id)}
      pollMs={2000}
    />
  );
}