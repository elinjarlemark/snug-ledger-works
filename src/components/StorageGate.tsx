import { Fragment, ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { activateAppStorage, downloadRecovery, flushAppStorage, storageStatus, subscribeStorage } from "@/lib/appStorage";
import { shouldUseLocalStorageMode } from "@/lib/runtimeMode";
import { Button } from "@/components/ui/button";

let activation = Promise.resolve();

export function StorageGate({ children }: { children: ReactNode }) {
  const { user, activeCompany, isLoading } = useAuth();
  const local = shouldUseLocalStorageMode();
  const identity = `${user?.id ?? ""}:${activeCompany?.id ?? ""}`;
  const pendingCompany = !local && !!activeCompany && !/^\d+$/.test(activeCompany.id);
  const [ready, setReady] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const status = useSyncExternalStore(subscribeStorage, storageStatus);

  useEffect(() => {
    if (local || isLoading || pendingCompany) return;
    let current = true;
    setError("");
    activation = activation.catch(() => undefined).then(() => activateAppStorage(user?.id ? String(user.id) : undefined, activeCompany?.id));
    activation.then(() => { if (current) setReady(identity); }).catch(error => { if (current) setError(String(error.message || error)); });
    return () => { current = false; };
  }, [local, isLoading, pendingCompany, identity, user?.id, activeCompany?.id, attempt]);

  if (!local && (isLoading || ready !== identity || error)) return <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground"><div className="max-w-lg space-y-4">
    <h1 className="text-xl font-semibold">{error ? "Kunde inte öppna sparade data" : "Hämtar dina data…"}</h1>
    {error && <><p role="alert">{error}</p><div className="flex flex-wrap gap-2"><Button onClick={() => setAttempt(value => value + 1)}>Försök igen</Button><Button variant="outline" onClick={downloadRecovery}>Exportera osparade ändringar</Button></div></>}
  </div></div>;

  return <>
    <Fragment key={identity}>{children}</Fragment>
    <div className="fixed bottom-16 left-3 z-[100] max-w-[calc(100vw-1.5rem)] rounded-md border border-border bg-card px-3 py-2 text-xs text-card-foreground shadow-sm sm:bottom-3 sm:max-w-[calc(100vw-15rem)]" role="status" aria-live="polite">
      {local ? "Förhandsvisning · sparas endast i denna webbläsare" : status === "saved" ? "Sparat i lokal databas" : status === "saving" ? "Sparar till databasen…" : <div className="max-w-md space-y-2"><p className="text-destructive">Inte sparat: {status}</p><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => { void flushAppStorage().catch(() => undefined); }}>Försök spara igen</Button><Button size="sm" variant="outline" onClick={downloadRecovery}>Exportera ändringar</Button></div></div>}
    </div>
  </>;
}
